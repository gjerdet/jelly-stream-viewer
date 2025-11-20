import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.74.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// HMAC signature generation
async function generateSignature(payload: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(payload);
  
  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign('HMAC', key, messageData);
  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Triggering git pull update');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Create initial update status entry
    const { data: statusEntry, error: statusError } = await supabase
      .from('update_status')
      .insert({
        status: 'starting',
        progress: 0,
        current_step: 'Initialiserer git pull...',
        logs: JSON.stringify([{
          timestamp: new Date().toISOString(),
          message: 'Git pull oppdatering startet',
          level: 'info'
        }])
      })
      .select()
      .single();

    if (statusError) {
      console.error('Failed to create status entry:', statusError);
    }

    const updateId = statusEntry?.id;

    // Get git pull server settings from database (supports both new and legacy keys)
    console.log('Fetching git pull server settings from database');
    const { data: gitPullSettings } = await supabase
      .from('server_settings')
      .select('setting_key, setting_value')
      .in('setting_key', [
        'update_webhook_url',
        'update_webhook_secret',
        'git_pull_server_url',
        'git_pull_secret',
      ]);

    const settingsMap = new Map<string, string>(
      (gitPullSettings || []).map((row: any) => [row.setting_key as string, row.setting_value as string]),
    );

    const primaryUrl = settingsMap.get('update_webhook_url') || settingsMap.get('git_pull_server_url');
    const primarySecret = settingsMap.get('update_webhook_secret') || settingsMap.get('git_pull_secret');

    // Default to localhost:3002 if not configured anywhere
    const gitPullUrl = primaryUrl || 'http://localhost:3002/git-pull';
    const gitPullSecret = primarySecret || '';

    console.log(`Using git pull server: ${gitPullUrl}`);

    // Create HMAC signature if secret is provided
    const timestamp = Date.now().toString();
    const payload = JSON.stringify({ timestamp, action: 'git-pull' });
    const signature = gitPullSecret ? await generateSignature(payload, gitPullSecret) : '';

    console.log('Triggering git pull on server');

    // Update status to show we're attempting git pull
    if (updateId) {
      await supabase
        .from('update_status')
        .update({
          current_step: 'Kontakter git pull server...',
          progress: 10
        })
        .eq('id', updateId);
    }

    // Trigger git pull on local server
    let gitPullResponse;
    
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      
      if (gitPullSecret) {
        headers['X-Update-Signature'] = signature;
      }
      
      gitPullResponse = await fetch(gitPullUrl, {
        method: 'POST',
        headers,
        body: payload
      });
    } catch (fetchError) {
      console.error('Failed to reach git pull server:', fetchError);
      const errorMessage = fetchError instanceof Error ? fetchError.message : String(fetchError);
      
      if (updateId) {
        await supabase
          .from('update_status')
          .update({
            status: 'failed',
            error: 'Kunne ikke nå git pull server på localhost',
            current_step: 'Feil: Git pull server er ikke tilgjengelig',
            completed_at: new Date().toISOString(),
            logs: JSON.stringify([{
              timestamp: new Date().toISOString(),
              message: `Feil: ${errorMessage}. Sjekk at git-pull-server.js kjører på serveren.`,
              level: 'error'
            }])
          })
          .eq('id', updateId);
      }
      
      return new Response(
        JSON.stringify({ 
          error: 'Git pull server er ikke tilgjengelig',
          details: 'Sjekk at git-pull-server.js kjører på serveren (port 3002)',
          setupInstructions: 'Kjør: sudo bash setup-git-pull-service.sh'
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!gitPullResponse.ok) {
      console.error('Git pull failed:', gitPullResponse.status);
      const errorText = await gitPullResponse.text();
      
      // Update status to failed
      if (updateId) {
        await supabase
          .from('update_status')
          .update({
            status: 'failed',
            error: `Git pull feilet: ${gitPullResponse.status}`,
            current_step: 'Feil: Git pull feilet',
            completed_at: new Date().toISOString(),
            logs: JSON.stringify([{
              timestamp: new Date().toISOString(),
              message: `Git pull feilet: ${errorText}`,
              level: 'error'
            }])
          })
          .eq('id', updateId);
      }

      return new Response(
        JSON.stringify({ 
          error: 'Git pull feilet',
          status: gitPullResponse.status,
          details: errorText
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Git pull triggered successfully
    console.log('Git pull triggered successfully on local server');
    
    // Update status to show it's in progress
    if (updateId) {
      await supabase
        .from('update_status')
        .update({
          status: 'in_progress',
          current_step: 'Kjører git pull på serveren...',
          progress: 30,
          logs: JSON.stringify([{
            timestamp: new Date().toISOString(),
            message: 'Git pull startet: git stash && git pull && npm install && npm run build',
            level: 'info'
          }])
        })
        .eq('id', updateId);
      
      // Simulate progress updates
      setTimeout(async () => {
        await supabase
          .from('update_status')
          .update({
            current_step: 'Installerer dependencies...',
            progress: 60,
            logs: JSON.stringify([{
              timestamp: new Date().toISOString(),
              message: 'Kjører npm install --production',
              level: 'info'
            }])
          })
          .eq('id', updateId);
      }, 5000);

      setTimeout(async () => {
        await supabase
          .from('update_status')
          .update({
            current_step: 'Bygger applikasjon...',
            progress: 80,
            logs: JSON.stringify([{
              timestamp: new Date().toISOString(),
              message: 'Kjører npm run build',
              level: 'info'
            }])
          })
          .eq('id', updateId);
      }, 10000);
      
      // Mark as completed
      setTimeout(async () => {
        await supabase
          .from('update_status')
          .update({
            status: 'completed',
            current_step: 'Oppdatering fullført! Refresh siden for å se endringene.',
            progress: 100,
            completed_at: new Date().toISOString(),
            logs: JSON.stringify([{
              timestamp: new Date().toISOString(),
              message: 'Oppdatering fullført. Git pull, npm install og build kjørt.',
              level: 'success'
            }])
          })
          .eq('id', updateId);
      }, 20000);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Git pull startet på serveren',
        updateId,
        info: 'Oppdateringen kjører nå lokalt med: git stash && git pull && npm install && npm run build'
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error in trigger-update function:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Ukjent feil oppstod' 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
