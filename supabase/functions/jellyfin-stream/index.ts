import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, range',
  'Access-Control-Expose-Headers': 'content-length, content-range, accept-ranges',
};

// Input validation helper
function validateVideoId(videoId: string): boolean {
  // Jellyfin IDs are 32-character hex strings
  return /^[a-f0-9]{32}$/i.test(videoId);
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get video ID and token from URL
    // Note: Token in URL is required for browser video elements (can't send custom headers)
    const url = new URL(req.url);
    const videoId = url.searchParams.get('id');
    const token = url.searchParams.get('token');
    
    if (!videoId || !token) {
      return new Response('Missing required parameters', { 
        status: 400,
        headers: corsHeaders 
      });
    }

    // Validate video ID format to prevent injection
    if (!validateVideoId(videoId)) {
      console.warn(`Invalid video ID format attempt: ${videoId.substring(0, 10)}...`);
      return new Response('Invalid request', { 
        status: 400,
        headers: corsHeaders 
      });
    }

    // Validate token and get user
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);

    if (authError || !user) {
      console.error('Authentication failed');
      return new Response('Unauthorized', { 
        status: 401,
        headers: corsHeaders 
      });
    }

    // Get Jellyfin server settings using service role key
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
      console.error('Server configuration not found');
      return new Response('Service temporarily unavailable', { 
        status: 503,
        headers: corsHeaders 
      });
    }

    const jellyfinServerUrl = serverSettings.setting_value.replace(/\/$/, '');
    const apiKey = apiKeySettings.setting_value;

    // Get user ID from Jellyfin
    const usersResponse = await fetch(`${jellyfinServerUrl}/Users?api_key=${apiKey}`);
    if (!usersResponse.ok) {
      console.error('Failed to fetch Jellyfin users');
      return new Response('Service temporarily unavailable', { 
        status: 503,
        headers: corsHeaders 
      });
    }
    
    const users = await usersResponse.json();
    const userId = users[0]?.Id;

    if (!userId) {
      console.error('Jellyfin user not found');
      return new Response('Service configuration error', { 
        status: 500,
        headers: corsHeaders 
      });
    }

    // Get video info including codec information
    const infoUrl = `${jellyfinServerUrl}/Users/${userId}/Items/${videoId}?api_key=${apiKey}&Fields=MediaStreams`;
    const infoResponse = await fetch(infoUrl);
    
    if (!infoResponse.ok) {
      console.error('Failed to fetch video info:', infoResponse.status);
      return new Response('Content not found', { 
        status: 404,
        headers: corsHeaders 
      });
    }
    
    // Let Jellyfin decide streaming method automatically
    const itemInfo = await infoResponse.json();
    
    console.log(`Streaming video ${videoId} for user ${user.id}`);
    
    // Use Jellyfin's automatic streaming endpoint - it will decide if transcoding is needed
    const streamUrl = `${jellyfinServerUrl}/Videos/${videoId}/stream?`
      + `UserId=${userId}`
      + `&MediaSourceId=${videoId}`
      + `&Static=true`
      + `&api_key=${apiKey}`;
    
    console.log('Using Jellyfin automatic streaming');

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

    if (!jellyfinResponse.ok) {
      console.error('Jellyfin streaming error:', jellyfinResponse.status);
      return new Response('Stream unavailable', {
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
    return new Response('Request failed', { 
      status: 500,
      headers: corsHeaders 
    });
  }
});
