import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, range',
  'Access-Control-Expose-Headers': 'content-length, content-range, accept-ranges',
};

// Create HTTP client that ignores SSL certificate errors (for self-signed certs)
const httpClient = Deno.createHttpClient({
  caCerts: [],
});

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
    const infoOnly = url.searchParams.get('info') === 'true';
    
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

    console.log(`Connecting to Jellyfin server: ${jellyfinServerUrl}`);

    // Get user ID from Jellyfin (with SSL bypass)
    const usersResponse = await fetch(`${jellyfinServerUrl}/Users?api_key=${apiKey}`, {
      client: httpClient,
    });
    if (!usersResponse.ok) {
      console.error('Failed to fetch Jellyfin users:', usersResponse.status);
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

    // Get video info and check codec (with SSL bypass)
    const infoUrl = `${jellyfinServerUrl}/Users/${userId}/Items/${videoId}?api_key=${apiKey}&Fields=MediaStreams`;
    const infoResponse = await fetch(infoUrl, {
      client: httpClient,
    });
    
    if (!infoResponse.ok) {
      console.error('Failed to fetch video info:', infoResponse.status);
      return new Response('Content not found', { 
        status: 404,
        headers: corsHeaders 
      });
    }

    const itemInfo = await infoResponse.json();
    const videoStream = itemInfo.MediaStreams?.find((s: any) => s.Type === 'Video');
    const audioStream = itemInfo.MediaStreams?.find((s: any) => s.Type === 'Audio');
    const videoCodec = videoStream?.Codec?.toLowerCase();
    const audioBitrate = audioStream?.BitRate;
    const videoBitrate = videoStream?.BitRate;
    const container = itemInfo.Container?.toLowerCase();
    
    console.log(`Video codec: ${videoCodec}, container: ${container}`);

    // If info-only request, return stream metadata
    if (infoOnly) {
      const isTranscoding = videoCodec && !['h264', 'vp8', 'vp9', 'av1'].includes(videoCodec);
      const bitrate = videoBitrate ? `${Math.round(videoBitrate / 1000000)} Mbps` : null;
      
      return new Response(JSON.stringify({
        videoCodec: videoCodec?.toUpperCase() || 'Unknown',
        audioCodec: audioStream?.Codec?.toUpperCase() || 'Unknown',
        container: container?.toUpperCase() || 'Unknown',
        bitrate,
        isTranscoding,
        resolution: videoStream?.Width && videoStream?.Height 
          ? `${videoStream.Width}x${videoStream.Height}` 
          : null,
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let streamUrl;
    // Only transcode if codec is NOT browser-compatible
    if (videoCodec && !['h264', 'vp8', 'vp9', 'av1'].includes(videoCodec)) {
      // Use progressive streaming with proper seeking support
      streamUrl = `${jellyfinServerUrl}/Videos/${videoId}/stream?`
        + `UserId=${userId}`
        + `&MediaSourceId=${videoId}`
        + `&VideoCodec=h264`
        + `&AudioCodec=aac`
        + `&VideoBitrate=8000000`
        + `&AudioBitrate=192000`
        + `&MaxAudioChannels=2`
        + `&TranscodingContainer=ts`
        + `&TranscodingProtocol=http`
        + `&BreakOnNonKeyFrames=true`
        + `&api_key=${apiKey}`;
      console.log(`Transcoding ${videoCodec} to H264 with seeking`);
    } else {
      // Direct stream for compatible codecs
      streamUrl = `${jellyfinServerUrl}/Videos/${videoId}/stream?`
        + `UserId=${userId}`
        + `&Static=true`
        + `&MediaSourceId=${videoId}`
        + `&api_key=${apiKey}`;
      console.log(`Direct streaming (codec: ${videoCodec})`);
    }

    // Forward range header for seeking support
    const requestHeaders: Record<string, string> = {
      'Authorization': `MediaBrowser Token="${apiKey}"`,
    };
    
    const rangeHeader = req.headers.get('range');
    if (rangeHeader) {
      requestHeaders['Range'] = rangeHeader;
    }

    // Fetch the video stream from Jellyfin (with SSL bypass)
    const jellyfinResponse = await fetch(streamUrl, {
      headers: requestHeaders,
      client: httpClient,
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
    
    // Always set accept-ranges for seeking support
    if (!responseHeaders.has('accept-ranges')) {
      responseHeaders.set('accept-ranges', 'bytes');
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
