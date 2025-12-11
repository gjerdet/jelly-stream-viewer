import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-transcode-secret',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Verify transcode server secret
    const transcodeSecret = req.headers.get('x-transcode-secret')
    
    // Get the expected secret from server_settings
    const { data: secretSetting } = await supabase
      .from('server_settings')
      .select('setting_value')
      .eq('setting_key', 'transcode_secret')
      .single()
    
    if (!secretSetting || transcodeSecret !== secretSetting.setting_value) {
      console.log('Invalid transcode secret')
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const body = await req.json()
    const { action } = body

    // Action: poll - Get pending jobs
    if (action === 'poll') {
      const { data: jobs, error } = await supabase
        .from('transcode_jobs')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: true })
        .limit(1)

      if (error) {
        console.error('Failed to fetch jobs:', error)
        return new Response(
          JSON.stringify({ error: 'Failed to fetch jobs' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Also return settings the transcode server needs
      const { data: settings } = await supabase
        .from('server_settings')
        .select('setting_key, setting_value')
        .in('setting_key', ['media_base_path', 'jellyfin_server_url', 'jellyfin_api_key'])

      const settingsMap = Object.fromEntries(
        (settings || []).map(s => [s.setting_key, s.setting_value])
      )

      return new Response(
        JSON.stringify({ 
          jobs: jobs || [],
          settings: settingsMap
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Action: update - Update job status
    if (action === 'update') {
      const { jobId, status, progress, logs, error: jobError, filePath } = body

      if (!jobId) {
        return new Response(
          JSON.stringify({ error: 'Missing jobId' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const updateData: Record<string, unknown> = {
        status,
        progress,
        updated_at: new Date().toISOString()
      }

      if (logs) updateData.logs = logs
      if (jobError) updateData.error = jobError
      if (filePath) updateData.file_path = filePath
      if (status === 'processing' && progress <= 1) {
        updateData.started_at = new Date().toISOString()
      }
      if (status === 'completed' || status === 'failed') {
        updateData.completed_at = new Date().toISOString()
      }

      const { error: updateError } = await supabase
        .from('transcode_jobs')
        .update(updateData)
        .eq('id', jobId)

      if (updateError) {
        console.error('Failed to update job:', updateError)
        return new Response(
          JSON.stringify({ error: 'Failed to update job' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // If completed, mark media as compatible
      if (status === 'completed') {
        const { data: job } = await supabase
          .from('transcode_jobs')
          .select('jellyfin_item_id')
          .eq('id', jobId)
          .single()

        if (job?.jellyfin_item_id) {
          await supabase
            .from('media_compatibility')
            .update({
              status: 'compatible',
              resolved: true,
              resolved_at: new Date().toISOString()
            })
            .eq('jellyfin_item_id', job.jellyfin_item_id)
          
          console.log(`Marked media ${job.jellyfin_item_id} as compatible`)
        }
      }

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Action: jellyfin - Get file path from Jellyfin
    if (action === 'jellyfin') {
      const { itemId } = body

      console.log('Jellyfin action called with itemId:', itemId)

      if (!itemId) {
        return new Response(
          JSON.stringify({ error: 'Missing itemId' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const { data: settings } = await supabase
        .from('server_settings')
        .select('setting_key, setting_value')
        .in('setting_key', ['jellyfin_server_url', 'jellyfin_api_key'])

      const settingsMap = Object.fromEntries(
        (settings || []).map(s => [s.setting_key, s.setting_value])
      )

      const jellyfinUrl = settingsMap['jellyfin_server_url']
      const jellyfinApiKey = settingsMap['jellyfin_api_key']

      console.log('Jellyfin URL:', jellyfinUrl)
      console.log('Jellyfin API Key configured:', !!jellyfinApiKey)

      if (!jellyfinUrl || !jellyfinApiKey) {
        return new Response(
          JSON.stringify({ error: 'Jellyfin not configured' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      try {
        const apiUrl = `${jellyfinUrl}/Items/${itemId}?api_key=${jellyfinApiKey}`
        console.log('Calling Jellyfin API:', apiUrl.replace(jellyfinApiKey, '***'))
        
        const itemRes = await fetch(apiUrl)
        console.log('Jellyfin response status:', itemRes.status)
        
        if (!itemRes.ok) {
          const errorText = await itemRes.text()
          console.error('Jellyfin error response:', errorText)
          throw new Error(`Jellyfin API error: ${itemRes.status} - ${errorText}`)
        }
        const item = await itemRes.json()
        
        console.log('Jellyfin item name:', item.Name)
        console.log('Jellyfin item path:', item.Path)
        
        return new Response(
          JSON.stringify({ path: item.Path }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      } catch (err) {
        console.error('Jellyfin error:', err)
        return new Response(
          JSON.stringify({ error: 'Failed to get path from Jellyfin', details: err instanceof Error ? err.message : 'Unknown error' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
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
