import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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
    console.log("Starting Netdata setup via git-pull-server...");

    // Get git_pull_url from server_settings
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: settings, error: settingsError } = await supabase
      .from('server_settings')
      .select('setting_value')
      .eq('setting_key', 'git_pull_url')
      .single();

    if (settingsError || !settings?.setting_value) {
      console.log("No git_pull_url configured, returning manual instructions");
      return new Response(
        JSON.stringify({
          success: false,
          message: "Git Pull Server URL ikke konfigurert. Installer manuelt med: bash <(curl -Ss https://my-netdata.io/kickstart.sh)",
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

    // Parse git_pull_url to get the base URL
    const gitPullUrl = settings.setting_value;
    const baseUrl = gitPullUrl.replace('/git-pull', '');
    const setupNetdataUrl = `${baseUrl}/setup-netdata`;

    console.log(`Calling setup-netdata endpoint: ${setupNetdataUrl}`);

    // Call the git-pull-server's setup-netdata endpoint
    const response = await fetch(setupNetdataUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      }
    });

    if (!response.ok) {
      throw new Error(`Git-pull-server responded with status ${response.status}`);
    }

    const result = await response.json();
    console.log("Setup Netdata response:", result);

    return new Response(
      JSON.stringify({
        success: true,
        message: result.alreadyInstalled 
          ? "Netdata er allerede installert og kjører."
          : "Netdata installasjon startet. Dette kan ta noen minutter.",
        alreadyInstalled: result.alreadyInstalled,
        path: result.path
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