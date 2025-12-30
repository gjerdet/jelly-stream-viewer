import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[git-pull-proxy] Starting proxy request');

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get request body
    const body = await req.json().catch(() => ({}));
    const { updateId } = body;

    console.log('[git-pull-proxy] Update ID:', updateId);

    // Get git-pull server settings from database
    const { data: settingsData, error: settingsError } = await supabase
      .from('server_settings')
      .select('setting_key, setting_value')
      .in('setting_key', ['git_pull_server_url', 'update_webhook_url', 'git_pull_secret']);

    if (settingsError) {
      console.error('[git-pull-proxy] Settings error:', settingsError);
      throw new Error('Could not fetch server settings');
    }

    const settingsMap = new Map<string, string>(
      (settingsData || []).map((row: any) => [row.setting_key, row.setting_value])
    );

    // Get the git-pull server URL
    let gitPullUrl = settingsMap.get('git_pull_server_url') || settingsMap.get('update_webhook_url') || '';
    const gitPullSecret = settingsMap.get('git_pull_secret') || '';

    console.log('[git-pull-proxy] Raw URL from DB:', gitPullUrl);

    if (!gitPullUrl) {
      throw new Error('Git pull server URL is not configured. Go to Admin -> Servers to set it up.');
    }

    // Ensure the URL has /git-pull endpoint
    gitPullUrl = gitPullUrl.replace(/\/$/, '');
    if (!gitPullUrl.endsWith('/git-pull')) {
      gitPullUrl = `${gitPullUrl}/git-pull`;
    }

    console.log('[git-pull-proxy] Calling git-pull server at:', gitPullUrl);

    // Create update log entry if updateId provided
    if (updateId) {
      await supabase
        .from('update_status')
        .update({
          logs: JSON.stringify([
            {
              timestamp: new Date().toISOString(),
              message: 'Oppdatering startet...',
              level: 'info'
            },
            {
              timestamp: new Date().toISOString(),
              message: '🔄 Edge function kontakter git-pull server...',
              level: 'info'
            }
          ])
        })
        .eq('id', updateId);
    }

    // Build headers for the git-pull server
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    if (gitPullSecret) {
      // Generate HMAC signature
      const encoder = new TextEncoder();
      const data = encoder.encode(JSON.stringify({ updateId }));
      const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(gitPullSecret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      );
      const signature = await crypto.subtle.sign('HMAC', key, data);
      const signatureHex = Array.from(new Uint8Array(signature))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
      // Match git-pull-server expectation (raw hex, no prefix)
      headers['X-Update-Signature'] = signatureHex;
      console.log('[git-pull-proxy] Added HMAC signature');
    }

    // Call the git-pull server
    const response = await fetch(gitPullUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({ updateId }),
    });

    console.log('[git-pull-proxy] Response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[git-pull-proxy] Server error:', errorText);
      
      // Update status with error
      if (updateId) {
        await supabase
          .from('update_status')
          .update({
            status: 'failed',
            error: `Git pull server error: ${response.status} - ${errorText}`,
            logs: JSON.stringify([
              {
                timestamp: new Date().toISOString(),
                message: 'Oppdatering startet...',
                level: 'info'
              },
              {
                timestamp: new Date().toISOString(),
                message: `❌ Git pull server feilet: ${response.status}`,
                level: 'error'
              },
              {
                timestamp: new Date().toISOString(),
                message: errorText,
                level: 'error'
              }
            ])
          })
          .eq('id', updateId);
      }
      
      throw new Error(`Git pull server returned ${response.status}: ${errorText}`);
    }

    const responseData = await response.json().catch(() => ({ success: true }));
    console.log('[git-pull-proxy] Success:', responseData);

    // Update status with success
    if (updateId) {
      await supabase
        .from('update_status')
        .update({
          status: 'in_progress',
          progress: 10,
          current_step: 'Git pull startet...',
          logs: JSON.stringify([
            {
              timestamp: new Date().toISOString(),
              message: 'Oppdatering startet...',
              level: 'info'
            },
            {
              timestamp: new Date().toISOString(),
              message: '✅ Git pull server kontaktet',
              level: 'success'
            },
            {
              timestamp: new Date().toISOString(),
              message: '🔄 Git pull pågår...',
              level: 'info'
            }
          ])
        })
        .eq('id', updateId);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Git pull triggered successfully',
        data: responseData
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error: any) {
    console.error('[git-pull-proxy] Error:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Unknown error'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
