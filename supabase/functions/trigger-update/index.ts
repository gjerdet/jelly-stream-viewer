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
      return new Response(
        JSON.stringify({ 
          error: 'Oppdatering feilet',
          details: `Server svarte med status ${webhookResponse.status}`,
          message: await webhookResponse.text()
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const result = await webhookResponse.text();
    console.log('Update triggered successfully:', result);

    return new Response(
      JSON.stringify({
        success: true,
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
