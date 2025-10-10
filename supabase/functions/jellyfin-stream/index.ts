import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
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
      return new Response('Unauthorized', { status: 401 });
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
      return new Response('Server configuration not found', { status: 500 });
    }

    const jellyfinServerUrl = serverSettings.setting_value.replace(/\/$/, '');
    const apiKey = apiKeySettings.setting_value;

    // Get video ID and other params from URL
    const url = new URL(req.url);
    const videoId = url.searchParams.get('id');
    
    if (!videoId) {
      return new Response('Video ID required', { status: 400 });
    }

    // Construct Jellyfin stream URL with authentication
    const streamUrl = `${jellyfinServerUrl}/Videos/${videoId}/stream?Static=true&api_key=${apiKey}`;

    console.log(`Redirecting to stream: ${streamUrl.replace(apiKey, '***')}`);

    // Redirect to the actual stream URL
    return Response.redirect(streamUrl, 302);

  } catch (error) {
    console.error('Error in jellyfin-stream:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(errorMessage, { status: 500 });
  }
});
