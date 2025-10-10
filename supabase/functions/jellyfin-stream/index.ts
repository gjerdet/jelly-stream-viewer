import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, range',
  'Access-Control-Expose-Headers': 'content-length, content-range, accept-ranges',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get video ID and token from URL
    const url = new URL(req.url);
    const videoId = url.searchParams.get('id');
    const token = url.searchParams.get('token');
    
    if (!videoId || !token) {
      return new Response('Video ID and token required', { 
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

    // Get user ID from Jellyfin to build proper playback URL
    const usersResponse = await fetch(`${jellyfinServerUrl}/Users?api_key=${apiKey}`);
    const users = await usersResponse.json();
    const userId = users[0]?.Id;

    if (!userId) {
      return new Response('Jellyfin user not found', { 
        status: 500,
        headers: corsHeaders 
      });
    }

    // Use Jellyfin's playback endpoint which handles format negotiation automatically
    const streamUrl = `${jellyfinServerUrl}/Videos/${videoId}/stream?`
      + `UserId=${userId}`
      + `&MediaSourceId=${videoId}`
      + `&Static=false`
      + `&api_key=${apiKey}`;

    console.log(`Proxying stream for video: ${videoId}`);

    // Forward range header for seeking support
    const requestHeaders: Record<string, string> = {
      'Authorization': `MediaBrowser Token="${apiKey}"`,
    };
    
    const rangeHeader = req.headers.get('range');
    if (rangeHeader) {
      requestHeaders['Range'] = rangeHeader;
    }

    // Fetch the video stream from Jellyfin
    const jellyfinResponse = await fetch(streamUrl, {
      headers: requestHeaders,
    });

    console.log('Jellyfin response status:', jellyfinResponse.status);
    console.log('Jellyfin response headers:', Object.fromEntries(jellyfinResponse.headers.entries()));

    if (!jellyfinResponse.ok) {
      const errorText = await jellyfinResponse.text();
      console.error('Jellyfin error:', errorText);
      return new Response(`Jellyfin error: ${jellyfinResponse.status} - ${errorText}`, {
        status: jellyfinResponse.status,
        headers: corsHeaders,
      });
    }

    // Forward the response with CORS headers
    const responseHeaders = new Headers(corsHeaders);
    
    // Copy important headers from Jellyfin response
    const headersToForward = [
      'content-type',
      'content-length',
      'content-range',
      'accept-ranges',
      'last-modified',
      'etag',
    ];
    
    for (const header of headersToForward) {
      const value = jellyfinResponse.headers.get(header);
      if (value) {
        responseHeaders.set(header, value);
      }
    }

    return new Response(jellyfinResponse.body, {
      status: jellyfinResponse.status,
      headers: responseHeaders,
    });

  } catch (error) {
    console.error('Error in jellyfin-stream:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(errorMessage, { 
      status: 500,
      headers: corsHeaders 
    });
  }
});
