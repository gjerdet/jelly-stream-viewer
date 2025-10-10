import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

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
    const { serverUrl, apiKey } = await req.json();

    if (!serverUrl || !apiKey) {
      return new Response(
        JSON.stringify({ error: 'Server URL and API key are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client with service role to bypass RLS
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Check if settings already exist
    const { data: existingSettings } = await supabaseAdmin
      .from('server_settings')
      .select('setting_key')
      .in('setting_key', ['jellyfin_server_url', 'jellyfin_api_key']);

    console.log('Existing settings:', existingSettings);

    // Upsert server URL
    const { error: urlError } = await supabaseAdmin
      .from('server_settings')
      .upsert({ 
        setting_key: 'jellyfin_server_url', 
        setting_value: serverUrl.trim()
      }, {
        onConflict: 'setting_key'
      });

    if (urlError) {
      console.error('Error updating server URL:', urlError);
      throw urlError;
    }

    // Upsert API key
    const { error: apiError } = await supabaseAdmin
      .from('server_settings')
      .upsert({ 
        setting_key: 'jellyfin_api_key', 
        setting_value: apiKey.trim()
      }, {
        onConflict: 'setting_key'
      });

    if (apiError) {
      console.error('Error updating API key:', apiError);
      throw apiError;
    }

    console.log('Setup completed successfully');

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in jellyfin-setup:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
