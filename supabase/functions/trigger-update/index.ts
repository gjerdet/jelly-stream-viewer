import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.74.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// HMAC signature generation with fallback
async function generateSignature(payload: string, secret: string): Promise<string> {
  try {
    // Check if crypto.subtle is available
    if (typeof crypto === 'undefined' || !crypto.subtle) {
      console.log('crypto.subtle not available, skipping signature');
      return '';
    }
    
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
  } catch (err) {
    console.error('Failed to generate signature:', err);
    return '';
  }
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
    // PRIORITIZE env variable UPDATE_SECRET over database value
    const envSecret = Deno.env.get('UPDATE_SECRET') || '';
    const gitPullSecret = envSecret || primarySecret || '';
    
    // Debug logging for signature troubleshooting
    console.log('=== TRIGGER UPDATE DEBUG ===');
    console.log(`Git pull URL: ${gitPullUrl}`);
    console.log(`Secret source: ${envSecret ? 'env UPDATE_SECRET' : (primarySecret ? 'database' : 'none')}`);
    console.log(`Secret length: ${gitPullSecret.length}`);
    console.log(`Secret (trimmed) length: ${gitPullSecret.trim().length}`);
    console.log(`Secret first 8 chars: "${gitPullSecret.slice(0, 8)}"`);
    console.log(`Secret has whitespace: ${gitPullSecret !== gitPullSecret.trim()}`);

    // Get updateId from request body if provided
    const { updateId: providedUpdateId } = await req.json().catch(() => ({}));
    const finalUpdateId = providedUpdateId || updateId;

    // Trim secret to avoid whitespace issues
    const cleanSecret = gitPullSecret.trim();

    // Create HMAC signature if secret is provided
    const requestBody = JSON.stringify({ updateId: finalUpdateId });
    const signature = cleanSecret ? await generateSignature(requestBody, cleanSecret) : '';
    
    console.log(`Request body: ${requestBody}`);
    console.log(`Generated signature length: ${signature.length}`);
    console.log(`Generated signature: ${signature}`);

    console.log('Triggering git pull on server');

    // Update status to show we're attempting git pull
    if (finalUpdateId) {
      const { data: currentStatus } = await supabase
        .from('update_status')
        .select('logs')
        .eq('id', finalUpdateId)
        .single();

      const existingLogs = currentStatus?.logs ? JSON.parse(currentStatus.logs as any) : [];
      const updatedLogs = [...existingLogs, {
        timestamp: new Date().toISOString(),
        message: `Kontakter git-pull server på ${gitPullUrl}...`,
        level: 'info'
      }];

      await supabase
        .from('update_status')
        .update({
          current_step: 'Kontakter git pull server...',
          progress: 10,
          logs: JSON.stringify(updatedLogs)
        })
        .eq('id', finalUpdateId);
    }

    // Trigger git pull on local server
    let gitPullResponse;
    
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      
      if (cleanSecret && signature) {
        headers['X-Update-Signature'] = signature;
        console.log(`Adding X-Update-Signature header: ${signature.slice(0, 16)}...`);
      } else {
        console.log('No signature added to request (no secret configured)');
      }
      
      console.log(`Sending request to: ${gitPullUrl}`);
      console.log(`Request headers: ${JSON.stringify(Object.keys(headers))}`);
      
      gitPullResponse = await fetch(gitPullUrl, {
        method: 'POST',
        headers,
        body: requestBody
      });
    } catch (fetchError) {
      console.error('Failed to reach git pull server:', fetchError);
      const errorMessage = fetchError instanceof Error ? fetchError.message : String(fetchError);
      
      if (finalUpdateId) {
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
          .eq('id', finalUpdateId);
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
      if (finalUpdateId) {
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
          .eq('id', finalUpdateId);
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
    if (finalUpdateId) {
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
        .eq('id', finalUpdateId);
      
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
          .eq('id', finalUpdateId);
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
          .eq('id', finalUpdateId);
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
          .eq('id', finalUpdateId);
      }, 20000);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Git pull startet på serveren',
        updateId: finalUpdateId,
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
