import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.74.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
          error: 'Update webhook ikke konfigurert',
          needsSetup: true,
          message: 'Sett opp update_webhook_url i Server Innstillinger'
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const webhookUrl = webhookData.setting_value;
    const webhookSecret = secretData?.setting_value || '';

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

    // Trigger the update webhook
    const webhookResponse = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Update-Secret': webhookSecret
      },
      body: JSON.stringify({
        action: 'update',
        timestamp: new Date().toISOString()
      })
    });

    if (!webhookResponse.ok) {
      console.error('Webhook failed:', webhookResponse.status);
      const errorText = await webhookResponse.text();
      
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
