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
    const requestedBitrate = url.searchParams.get('bitrate'); // Manual quality selection
    
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
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !SUPABASE_ANON_KEY) {
      console.error('Missing backend configuration for jellyfin-stream');
      return new Response('Service temporarily unavailable', {
        status: 503,
        headers: corsHeaders,
      });
    }

    // Validate the user JWT (token query param) using anon key + Authorization header
    const supabaseAuth = createClient(
      SUPABASE_URL,
      SUPABASE_ANON_KEY,
      {
        global: { headers: { Authorization: `Bearer ${token}` } },
        auth: { persistSession: false, autoRefreshToken: false },
      }
    );

    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();

    if (authError || !user) {
      console.error('Authentication failed:', authError?.message);
      return new Response('Unauthorized', {
        status: 401,
        headers: corsHeaders,
      });
    }

    const supabaseAdmin = createClient(
      SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );

    // Get Jellyfin server settings using service role key
    const { data: serverSettings } = await supabaseAdmin
      .from('server_settings')
      .select('setting_value')
      .eq('setting_key', 'jellyfin_server_url')
      .single();

    const { data: apiKeySettings } = await supabaseAdmin
      .from('server_settings')
      .select('setting_value')
      .eq('setting_key', 'jellyfin_api_key')
      .single();

    if (!serverSettings || !apiKeySettings) {
      console.error('Server configuration not found');
      return new Response('Service temporarily unavailable', {
        status: 503,
        headers: corsHeaders,
      });
    }

    const jellyfinServerUrl = serverSettings.setting_value.replace(/\/$/, '');
    const apiKey = apiKeySettings.setting_value;

    console.log(`Connecting to Jellyfin server: ${jellyfinServerUrl}`);

    // Determine which Jellyfin user to use for this app user.
    // Prefer auth user metadata (set during jellyfin-authenticate), then profiles table, then legacy fallback.
    const metaJellyfinUserId = (user.user_metadata as Record<string, unknown> | null)?.jellyfin_user_id;

    let userId: string | null =
      typeof metaJellyfinUserId === 'string' && metaJellyfinUserId.length > 0
        ? metaJellyfinUserId
        : null;

    let userIdSource: 'user_metadata' | 'profiles' | 'fallback_first_user' = userId
      ? 'user_metadata'
      : 'profiles';

    if (!userId) {
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('jellyfin_user_id')
        .eq('id', user.id)
        .maybeSingle();

      userId = profile?.jellyfin_user_id ?? null;
    }

    // Fallback: legacy behavior (first Jellyfin user) if user is not linked yet
    if (!userId) {
      userIdSource = 'fallback_first_user';

      const usersResponse = await fetch(`${jellyfinServerUrl}/Users?api_key=${apiKey}`, {
        client: httpClient,
      });
      if (!usersResponse.ok) {
        console.error('Failed to fetch Jellyfin users:', usersResponse.status);
        return new Response('Service temporarily unavailable', {
          status: 503,
          headers: corsHeaders,
        });
      }

      const users = await usersResponse.json();
      userId = users?.[0]?.Id ?? null;
    }

    if (!userId) {
      console.error('Jellyfin user not found');
      return new Response('Service configuration error', {
        status: 500,
        headers: corsHeaders,
      });
    }

    console.log(`Using Jellyfin user (${userIdSource}): ${userId.slice(0, 8)}...`);

    // Get video info and check codec (with SSL bypass)
    // NOTE: We also fetch MediaSources to get the correct MediaSourceId for reliable transcoding.
    const infoUrl = `${jellyfinServerUrl}/Users/${userId}/Items/${videoId}?api_key=${apiKey}&Fields=MediaStreams,MediaSources`;
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
    // Find audio streams - prefer first default audio, otherwise first audio stream
    const audioStreams = itemInfo.MediaStreams?.filter((s: any) => s.Type === 'Audio') || [];
    const defaultAudioStream = audioStreams.find((s: any) => s.IsDefault) || audioStreams[0];
    const audioStreamIndex = defaultAudioStream?.Index;
    
    const videoCodec = videoStream?.Codec?.toLowerCase();
    const audioCodec = defaultAudioStream?.Codec?.toLowerCase();
    const audioBitrate = defaultAudioStream?.BitRate;
    const videoBitrate = videoStream?.BitRate;
    const container = itemInfo.Container?.toLowerCase();

    // Jellyfin expects MediaSourceId (can differ from the item id, especially for movies)
    const mediaSourceId: string = itemInfo?.MediaSources?.[0]?.Id ?? videoId;
    
    console.log(`Video codec: ${videoCodec}, audio codec: ${audioCodec}, container: ${container}, audioStreamIndex: ${audioStreamIndex}`);

    // If info-only request, return stream metadata
    if (infoOnly) {
      const needsVideoTranscode = !!(videoCodec && !['h264', 'vp8', 'vp9', 'av1'].includes(videoCodec));
      const needsAudioTranscode = !!(audioCodec && !['aac', 'mp3', 'opus'].includes(audioCodec));
      const isTranscoding = needsVideoTranscode || needsAudioTranscode;
      const bitrate = videoBitrate ? `${Math.round(videoBitrate / 1000000)} Mbps` : null;
      
      return new Response(JSON.stringify({
        videoCodec: videoCodec?.toUpperCase() || 'Unknown',
        audioCodec: defaultAudioStream?.Codec?.toUpperCase() || 'Unknown',
        container: container?.toUpperCase() || 'Unknown',
        bitrate,
        isTranscoding,
        resolution: videoStream?.Width && videoStream?.Height 
          ? `${videoStream.Width}x${videoStream.Height}` 
          : null,
        userIdSource,
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let streamUrl;
    const targetBitrate = requestedBitrate ? parseInt(requestedBitrate) : 8000000;
    const needsVideoTranscode = !!(videoCodec && !['h264', 'vp8', 'vp9', 'av1'].includes(videoCodec));
    const needsAudioTranscode = !!(audioCodec && !['aac', 'mp3', 'opus'].includes(audioCodec));
    const needsTranscode = needsVideoTranscode || needsAudioTranscode;
    const forceTranscode = requestedBitrate !== null; // Manual quality selection always transcodes
    
    // Transcode if codec is NOT browser-compatible OR if user requested specific quality
    if (needsTranscode || forceTranscode) {
      // Build transcode URL with explicit audio stream selection
      const transcodeParams = new URLSearchParams({
        UserId: userId,
        MediaSourceId: mediaSourceId,
        VideoCodec: 'h264',
        AudioCodec: 'aac',
        VideoBitrate: targetBitrate.toString(),
        AudioBitrate: '192000',
        MaxAudioChannels: '2',
        TranscodingContainer: 'mp4',
        TranscodingProtocol: 'http',
        api_key: apiKey,
      });
      
      // Add audio stream index if available to ensure correct audio track
      if (audioStreamIndex !== undefined) {
        transcodeParams.set('AudioStreamIndex', audioStreamIndex.toString());
      }
      
      // Use an explicit .mp4 extension for best browser compatibility (content-type sniffing)
      streamUrl = `${jellyfinServerUrl}/Videos/${videoId}/stream.mp4?${transcodeParams.toString()}`;
      console.log(`Transcoding to H264/AAC at ${targetBitrate / 1000000} Mbps (original codec: ${videoCodec}/${audioCodec}, audioStreamIndex: ${audioStreamIndex})`);
    } else {
      // Direct stream for compatible codecs
      streamUrl = `${jellyfinServerUrl}/Videos/${videoId}/stream?`
        + `UserId=${userId}`
        + `&Static=true`
        + `&MediaSourceId=${mediaSourceId}`
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

    const jellyfinContentType = jellyfinResponse.headers.get('content-type') ?? '';
    console.log('Jellyfin stream response:', {
      status: jellyfinResponse.status,
      contentType: jellyfinContentType,
      contentLength: jellyfinResponse.headers.get('content-length'),
      contentRange: jellyfinResponse.headers.get('content-range'),
      acceptRanges: jellyfinResponse.headers.get('accept-ranges'),
    });

    if (!jellyfinResponse.ok) {
      console.error('Jellyfin streaming error:', jellyfinResponse.status);
      return new Response('Stream unavailable', {
        status: jellyfinResponse.status,
        headers: corsHeaders,
      });
    }

    // If Jellyfin returns non-video content, don't let the browser try to decode it.
    if (jellyfinContentType && (jellyfinContentType.startsWith('text/') || jellyfinContentType.includes('application/json'))) {
      console.error('Unexpected stream content-type from Jellyfin:', jellyfinContentType);
      return new Response('Stream returned unexpected content', {
        status: 502,
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
