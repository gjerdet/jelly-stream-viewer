import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Starting Netdata setup...");

    // Check if we have a webhook URL configured to send installation commands
    const webhookUrl = Deno.env.get('UPDATE_WEBHOOK_URL');
    
    if (!webhookUrl) {
      console.log("No webhook URL configured, returning installation instructions");
      return new Response(
        JSON.stringify({
          success: false,
          message: "Automatisk installasjon krever webhook-konfigurasjon. Installer manuelt med: bash <(curl -Ss https://my-netdata.io/kickstart.sh)",
          instructions: [
            "1. SSH til serveren din",
            "2. Kjør: bash <(curl -Ss https://my-netdata.io/kickstart.sh)",
            "3. Følg instruksjonene på skjermen",
            "4. Netdata vil være tilgjengelig på http://localhost:19999"
          ]
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        }
      );
    }

    // Send installation command to webhook
    const installScript = `
#!/bin/bash
# Install Netdata
bash <(curl -Ss https://my-netdata.io/kickstart.sh) --dont-wait --disable-telemetry

# Wait for installation to complete
sleep 5

# Check if Netdata is running
if systemctl is-active --quiet netdata; then
  echo "Netdata installed successfully and is running"
else
  echo "Netdata installation may have failed or is still starting"
fi
`;

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'setup-netdata',
        script: installScript,
        timestamp: new Date().toISOString()
      })
    });

    if (!response.ok) {
      throw new Error(`Webhook responded with status ${response.status}`);
    }

    console.log("Netdata setup webhook triggered successfully");

    return new Response(
      JSON.stringify({
        success: true,
        message: "Netdata installasjon startet. Dette kan ta noen minutter."
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );

  } catch (error: any) {
    console.error('Setup Netdata error:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        message: "Kunne ikke starte Netdata installasjon. Installer manuelt med: bash <(curl -Ss https://my-netdata.io/kickstart.sh)"
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});
