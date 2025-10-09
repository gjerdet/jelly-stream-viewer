import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface JellyfinRequest {
  endpoint: string;
  method?: string;
  body?: any;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Create Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    // Verify user is authenticated
    const {
      data: { user },
    } = await supabaseClient.auth.getUser();

    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get Jellyfin server URL from settings
    const { data: settings, error: settingsError } = await supabaseClient
      .from('server_settings')
      .select('setting_value')
      .eq('setting_key', 'jellyfin_server_url')
      .single();

    if (settingsError || !settings) {
      console.error('Error fetching server settings:', settingsError);
      return new Response(JSON.stringify({ error: 'Server configuration not found' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const jellyfinServerUrl = settings.setting_value.replace(/\/$/, '');

    // Parse request body
    const { endpoint, method = 'GET', body }: JellyfinRequest = await req.json();

    console.log(`Proxying request to Jellyfin: ${method} ${jellyfinServerUrl}${endpoint}`);

    // Make request to Jellyfin API
    const jellyfinResponse = await fetch(`${jellyfinServerUrl}${endpoint}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const jellyfinData = await jellyfinResponse.json();

    return new Response(JSON.stringify(jellyfinData), {
      status: jellyfinResponse.status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in jellyfin-proxy:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
