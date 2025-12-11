import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Get authorization header for user verification
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verify user is admin
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    )
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check admin role
    const { data: roles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .single()

    if (!roles) {
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const body = await req.json()
    const { action, jellyfinItemId, jellyfinItemName, outputFormat } = body

    // Get transcode server settings
    const { data: settings } = await supabase
      .from('server_settings')
      .select('setting_key, setting_value')
      .in('setting_key', ['transcode_server_url', 'transcode_secret', 'media_base_path', 'jellyfin_server_url', 'jellyfin_api_key'])

    const settingsMap = Object.fromEntries(
      (settings || []).map(s => [s.setting_key, s.setting_value])
    )

    const transcodeServerUrl = settingsMap['transcode_server_url']
    const transcodeSecret = settingsMap['transcode_secret'] || ''
    const mediaBasePath = settingsMap['media_base_path'] || ''
    const jellyfinUrl = settingsMap['jellyfin_server_url']
    const jellyfinApiKey = settingsMap['jellyfin_api_key']

    if (action === 'health') {
      // Check transcode server health
      if (!transcodeServerUrl) {
        return new Response(
          JSON.stringify({ 
            status: 'not_configured',
            message: 'Transcode server URL not configured' 
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      try {
        const healthUrl = transcodeServerUrl.replace(/\/$/, '') + '/health'
        const healthRes = await fetch(healthUrl, { 
          method: 'GET',
          headers: { 'x-transcode-secret': transcodeSecret }
        })
        const health = await healthRes.json()
        return new Response(
          JSON.stringify({ status: 'ok', ...health }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      } catch (err) {
        return new Response(
          JSON.stringify({ status: 'error', message: 'Cannot reach transcode server' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    if (action === 'start') {
      if (!transcodeServerUrl) {
        return new Response(
          JSON.stringify({ error: 'Transcode server not configured' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Get file path from Jellyfin
      let filePath = ''
      
      if (jellyfinUrl && jellyfinApiKey && jellyfinItemId) {
        try {
          // First get a user ID from Jellyfin (needed for item access)
          const usersRes = await fetch(`${jellyfinUrl}/Users`, {
            headers: { 'X-Emby-Token': jellyfinApiKey }
          })
          
          if (!usersRes.ok) {
            throw new Error(`Failed to get Jellyfin users: ${usersRes.status}`)
          }
          
          const users = await usersRes.json()
          const userId = users[0]?.Id
          
          if (!userId) {
            throw new Error('No Jellyfin users found')
          }
          
          console.log('Using Jellyfin user:', userId)
          
          // Get item with user context and Path field
          const itemUrl = `${jellyfinUrl}/Users/${userId}/Items/${jellyfinItemId}?Fields=Path`
          console.log('Fetching item from Jellyfin:', itemUrl)
          
          const itemRes = await fetch(itemUrl, {
            headers: { 'X-Emby-Token': jellyfinApiKey }
          })
          
          if (!itemRes.ok) {
            const errorText = await itemRes.text()
            console.error('Jellyfin API error:', itemRes.status, errorText)
            throw new Error(`Jellyfin API error: ${itemRes.status}`)
          }
          
          const item = await itemRes.json()
          filePath = item.Path || ''
          
          // If mediaBasePath is set, adjust the path (for NAS mount point differences)
          if (mediaBasePath && filePath) {
            // Replace common Jellyfin paths with the actual mount path
            // e.g., /media/movies -> /mnt/nas/movies
            const pathParts = filePath.split('/')
            const relevantPath = pathParts.slice(2).join('/') // Skip /media or similar
            filePath = `${mediaBasePath}/${relevantPath}`
          }
          
          console.log('File path from Jellyfin:', item.Path)
          console.log('Adjusted file path:', filePath)
        } catch (err) {
          console.error('Failed to get file path from Jellyfin:', err)
        }
      }

      if (!filePath) {
        return new Response(
          JSON.stringify({ error: 'Could not determine file path' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Create job in database
      const { data: job, error: jobError } = await supabase
        .from('transcode_jobs')
        .insert({
          jellyfin_item_id: jellyfinItemId,
          jellyfin_item_name: jellyfinItemName,
          file_path: filePath,
          output_format: outputFormat || 'hevc',
          status: 'pending',
          created_by: user.id
        })
        .select()
        .single()

      if (jobError) {
        console.error('Failed to create job:', jobError)
        return new Response(
          JSON.stringify({ error: 'Failed to create job' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Trigger transcode server
      const transcodeUrl = transcodeServerUrl.replace(/\/$/, '') + '/transcode'
      const transcodeRes = await fetch(transcodeUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-transcode-secret': transcodeSecret
        },
        body: JSON.stringify({
          jobId: job.id,
          filePath: filePath,
          outputFormat: outputFormat || 'hevc',
          replaceOriginal: true
        })
      })

      if (!transcodeRes.ok) {
        // Update job as failed
        await supabase
          .from('transcode_jobs')
          .update({ status: 'failed', error: 'Failed to start transcode' })
          .eq('id', job.id)
          
        return new Response(
          JSON.stringify({ error: 'Failed to start transcode' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      return new Response(
        JSON.stringify({ success: true, jobId: job.id }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
