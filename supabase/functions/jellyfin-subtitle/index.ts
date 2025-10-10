import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    // Get parameters from URL
    const url = new URL(req.url);
    const videoId = url.searchParams.get('id');
    const subtitleIndex = url.searchParams.get('index');
    const token = url.searchParams.get('token');
    
    if (!videoId || !subtitleIndex || !token) {
      return new Response('Video ID, subtitle index and token required', { 
        status: 400,
        headers: corsHeaders 
      });
    }

    // Create Supabase client and verify token
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Verify the user token
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);

    if (authError || !user) {
      console.error('Authentication failed:', authError);
      return new Response('Unauthorized', { 
        status: 401,
        headers: corsHeaders 
      });
    }

    // Get Jellyfin server URL and API key from settings
    const { data: serverSettings } = await supabaseClient
      .from('server_settings')
      .select('setting_value')
      .eq('setting_key', 'jellyfin_server_url')
      .single();

    const { data: apiKeySettings } = await supabaseClient
      .from('server_settings')
      .select('setting_value')
      .eq('setting_key', 'jellyfin_api_key')
      .single();

    if (!serverSettings || !apiKeySettings) {
      return new Response('Server configuration not found', { 
        status: 500,
        headers: corsHeaders 
      });
    }

    const jellyfinServerUrl = serverSettings.setting_value.replace(/\/$/, '');
    const apiKey = apiKeySettings.setting_value;

    // Construct Jellyfin subtitle URL with authentication
    const subtitleUrl = `${jellyfinServerUrl}/Videos/${videoId}/${videoId}/Subtitles/${subtitleIndex}/Stream.vtt?api_key=${apiKey}`;

    console.log(`Proxying subtitle ${subtitleIndex} for video: ${videoId}`);

    // Fetch subtitle from Jellyfin
    const jellyfinResponse = await fetch(subtitleUrl);

    if (!jellyfinResponse.ok) {
      console.error('Failed to fetch subtitle:', jellyfinResponse.status);
      return new Response('Subtitle not found', { 
        status: jellyfinResponse.status,
        headers: corsHeaders 
      });
    }

    const subtitleContent = await jellyfinResponse.text();

    return new Response(subtitleContent, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/vtt',
      },
    });

  } catch (error) {
    console.error('Error in jellyfin-subtitle:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(errorMessage, { 
      status: 500,
      headers: corsHeaders 
    });
  }
});
