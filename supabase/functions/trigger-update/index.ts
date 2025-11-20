import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.74.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// URL validation function - prevents SSRF attacks
function isValidWebhookUrl(url: string): boolean {
  try {
    const parsedUrl = new URL(url);
    
    // Only allow HTTP/HTTPS
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return false;
    }
    
    // Block internal IPs (SSRF prevention)
    const hostname = parsedUrl.hostname;
    const internalPatterns = [
      /^localhost$/i,
      /^127\./,
      /^10\./,
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
      /^192\.168\./,
      /^169\.254\./,
    ];
    
    // Allow localhost for development
    const isDevelopment = Deno.env.get('ENVIRONMENT') === 'development';
    if (!isDevelopment && internalPatterns.some(pattern => pattern.test(hostname))) {
      return false;
    }
    
    return true;
  } catch {
    return false;
  }
}

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
    console.log('Triggering server update');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Create initial update status entry
    const { data: statusEntry, error: statusError } = await supabase
      .from('update_status')
      .insert({
        status: 'starting',
        progress: 0,
        current_step: 'Initialiserer oppdatering...',
        logs: JSON.stringify([{
          timestamp: new Date().toISOString(),
          message: 'Oppdatering startet',
          level: 'info'
        }])
      })
      .select()
      .single();

    if (statusError) {
      console.error('Failed to create status entry:', statusError);
    }

    const updateId = statusEntry?.id;

    // Get update webhook URL from settings
    const { data: webhookData } = await supabase
      .from('server_settings')
      .select('setting_value')
      .eq('setting_key', 'update_webhook_url')
      .maybeSingle();

    // Get update secret for authentication
    const { data: secretData } = await supabase
      .from('server_settings')
      .select('setting_value')
      .eq('setting_key', 'update_webhook_secret')
      .maybeSingle();

    if (!webhookData?.setting_value) {
      // Update status to failed
      if (updateId) {
        await supabase
          .from('update_status')
          .update({
            status: 'failed',
            error: 'Update webhook ikke konfigurert',
            current_step: 'Feil: Webhook ikke konfigurert',
            completed_at: new Date().toISOString()
          })
          .eq('id', updateId);
      }

      return new Response(
        JSON.stringify({ 
          error: 'Tjenesten er midlertidig utilgjengelig'
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const webhookUrl = webhookData.setting_value;
    const webhookSecret = secretData?.setting_value || '';

    // Validate webhook URL
    if (!isValidWebhookUrl(webhookUrl)) {
      console.error('Invalid webhook URL:', webhookUrl);
      
      if (updateId) {
        await supabase
          .from('update_status')
          .update({
            status: 'failed',
            error: 'Ugyldig webhook URL',
            current_step: 'Feil: Ugyldig URL',
            completed_at: new Date().toISOString()
          })
          .eq('id', updateId);
      }

      return new Response(
        JSON.stringify({ 
          error: 'Konfigurasjonsfeil',
          message: 'Webhook URL må være en gyldig HTTP/HTTPS URL'
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('Sending update request to:', webhookUrl);

    // Update status to in progress
    if (updateId) {
      await supabase
        .from('update_status')
        .update({
          status: 'in_progress',
          progress: 25,
          current_step: 'Sender forespørsel til server...',
          logs: JSON.stringify([{
            timestamp: new Date().toISOString(),
            message: `Sender webhook til ${webhookUrl}`,
            level: 'info'
          }])
        })
        .eq('id', updateId);
    }

    // Prepare webhook payload with timestamp
    const timestamp = new Date().toISOString();
    const payload = JSON.stringify({
      action: 'update',
      timestamp
    });

    // Generate HMAC signature
    const signature = await generateSignature(payload, webhookSecret);

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
        details: 'Sjekk at git-pull-server.js kjører på serveren (port 3002)'
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
            error: `Server svarte med status ${webhookResponse.status}`,
            current_step: 'Feil: Webhook feilet',
            completed_at: new Date().toISOString(),
            logs: JSON.stringify([{
              timestamp: new Date().toISOString(),
              message: `Webhook feilet: ${errorText}`,
              level: 'error'
            }])
          })
          .eq('id', updateId);
      }

      return new Response(
        JSON.stringify({ 
          error: 'Oppdatering feilet',
          details: `Server svarte med status ${webhookResponse.status}`,
          message: errorText
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const result = await webhookResponse.text();
    console.log('Update triggered successfully:', result);

    // Update status to completing
    if (updateId) {
      await supabase
        .from('update_status')
        .update({
          status: 'completing',
          progress: 75,
          current_step: 'Oppdatering startet på server...',
          logs: JSON.stringify([{
            timestamp: new Date().toISOString(),
            message: 'Webhook vellykket, server oppdaterer...',
            level: 'success'
          }])
        })
        .eq('id', updateId);
    }

    // Background task to mark as completed after delay
    setTimeout(async () => {
      if (updateId) {
        await supabase
          .from('update_status')
          .update({
            status: 'completed',
            progress: 100,
            current_step: 'Oppdatering fullført!',
            completed_at: new Date().toISOString(),
            logs: JSON.stringify([{
              timestamp: new Date().toISOString(),
              message: 'Oppdatering fullført. Serveren restarter...',
              level: 'success'
            }])
          })
          .eq('id', updateId);
      }
    }, 3000);

    return new Response(
      JSON.stringify({
        success: true,
        updateId: updateId,
        message: 'Oppdatering startet! Serveren vil restarte om noen sekunder.',
        details: result
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error triggering update:', error);
    
    // Update status to failed if we have an updateId
    // Note: updateId may not be available if error occurred before it was created
    
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Ukjent feil',
        message: 'Kunne ikke starte oppdatering'
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
