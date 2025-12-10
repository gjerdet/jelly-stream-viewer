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

    const body = await req.json()
    const { jobId, status, progress, logs, error } = body

    if (!jobId) {
      return new Response(
        JSON.stringify({ error: 'Missing jobId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Build update object
    const updateData: Record<string, unknown> = {
      status,
      progress,
      updated_at: new Date().toISOString()
    }

    if (logs) {
      updateData.logs = logs
    }

    if (error) {
      updateData.error = error
    }

    if (status === 'running' && !updateData.started_at) {
      // Get current job to check if started_at is set
      const { data: currentJob } = await supabase
        .from('transcode_jobs')
        .select('started_at')
        .eq('id', jobId)
        .single()
      
      if (!currentJob?.started_at) {
        updateData.started_at = new Date().toISOString()
      }
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

    // If completed successfully, update media_compatibility status
    if (status === 'completed') {
      // Get the job to find the jellyfin_item_id
      const { data: job } = await supabase
        .from('transcode_jobs')
        .select('jellyfin_item_id')
        .eq('id', jobId)
        .single()

      if (job) {
        // Mark as resolved in media_compatibility
        await supabase
          .from('media_compatibility')
          .update({
            resolved: true,
            resolved_at: new Date().toISOString(),
            status: 'compatible'
          })
          .eq('jellyfin_item_id', job.jellyfin_item_id)
      }
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
