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
    const requestedAudioIndex = url.searchParams.get('audioIndex'); // Manual audio track selection
    const useHls = url.searchParams.get('hls') === 'true'; // Request HLS format
    const startPosition = url.searchParams.get('startPosition'); // Seek position in seconds
    
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

    // Prefer streams from the actual media source (more reliable for stream-index mapping)
    const primarySource = itemInfo?.MediaSources?.[0] ?? null;
    const mediaStreams = (primarySource?.MediaStreams ?? itemInfo?.MediaStreams ?? []) as any[];

    const videoStream = mediaStreams.find((s: any) => s.Type === 'Video');
    // Find audio streams - prefer first default audio, otherwise first audio stream
    const audioStreams = mediaStreams.filter((s: any) => s.Type === 'Audio') || [];
    const defaultAudioStream = audioStreams.find((s: any) => s.IsDefault) || audioStreams[0];

    // Jellyfin expects MediaSourceId (can differ from the item id, especially for movies)
    const mediaSourceId: string = primarySource?.Id ?? videoId;

    // Parse requested audio index - use global MediaStreams Index directly
    const requestedAudioIndexValue =
      requestedAudioIndex && requestedAudioIndex.trim().length > 0
        ? parseInt(requestedAudioIndex, 10)
        : null;

    const hasManualAudioSelection =
      requestedAudioIndexValue !== null && Number.isFinite(requestedAudioIndexValue);

    // Use the requested audio index directly (it's the global MediaStreams Index)
    const effectiveAudioIndex = hasManualAudioSelection
      ? requestedAudioIndexValue!
      : defaultAudioStream?.Index ?? null;

    const selectedAudioStream =
      typeof effectiveAudioIndex === 'number' && Number.isFinite(effectiveAudioIndex)
        ? (audioStreams.find((s: any) => s.Index === effectiveAudioIndex) ?? defaultAudioStream)
        : defaultAudioStream;

    const videoCodec = videoStream?.Codec?.toLowerCase();
    const selectedAudioCodec = selectedAudioStream?.Codec?.toLowerCase();
    const videoBitrate = videoStream?.BitRate;
    const container = (primarySource?.Container ?? itemInfo.Container)?.toLowerCase();

    const selectedAudioChannelsRaw = selectedAudioStream?.Channels;
    const selectedAudioChannels =
      typeof selectedAudioChannelsRaw === 'number' && Number.isFinite(selectedAudioChannelsRaw)
        ? Math.max(1, selectedAudioChannelsRaw)
        : null;

    console.log(
      `Video codec: ${videoCodec}, audio codec: ${selectedAudioCodec}, container: ${container}, audioStreamIndex: ${effectiveAudioIndex}`
    );

    if (hasManualAudioSelection) {
      console.log('Manual audio selection:', {
        effectiveAudioIndex,
        selectedAudio: {
          index: selectedAudioStream?.Index,
          language: selectedAudioStream?.Language,
          title: selectedAudioStream?.DisplayTitle,
          codec: selectedAudioStream?.Codec,
          channels: selectedAudioChannels,
        },
        mediaSourceId,
      });
    }

    // If info-only request, return stream metadata
    if (infoOnly) {
      const needsVideoTranscode = !!(videoCodec && !['h264', 'vp8', 'vp9', 'av1'].includes(videoCodec));
      const needsAudioTranscode = !!(selectedAudioCodec && !['aac', 'mp3', 'opus'].includes(selectedAudioCodec));
      const isTranscoding = needsVideoTranscode || needsAudioTranscode || hasManualAudioSelection || requestedBitrate !== null;
      const bitrate = videoBitrate ? `${Math.round(videoBitrate / 1000000)} Mbps` : null;

      return new Response(
        JSON.stringify({
          videoCodec: videoCodec?.toUpperCase() || 'Unknown',
          audioCodec: selectedAudioStream?.Codec?.toUpperCase() || 'Unknown',
          container: container?.toUpperCase() || 'Unknown',
          bitrate,
          isTranscoding,
          resolution: videoStream?.Width && videoStream?.Height ? `${videoStream.Width}x${videoStream.Height}` : null,
          userIdSource,
          hlsSupported: true,
          // Include detailed selected audio info for diagnostics
          selectedAudio: {
            index: selectedAudioStream?.Index ?? effectiveAudioIndex ?? null,
            language: selectedAudioStream?.Language || null,
            codec: selectedAudioStream?.Codec || null,
            channels: selectedAudioChannels,
            title: selectedAudioStream?.DisplayTitle || null,
          },
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    let streamUrl: string;
    const targetBitrate = requestedBitrate ? parseInt(requestedBitrate, 10) : 8000000;
    const needsVideoTranscode = !!(videoCodec && !['h264', 'vp8', 'vp9', 'av1'].includes(videoCodec));
    const needsAudioTranscode = !!(selectedAudioCodec && !['aac', 'mp3', 'opus'].includes(selectedAudioCodec));
    const needsTranscode = needsVideoTranscode || needsAudioTranscode;
    const forceTranscode = requestedBitrate !== null || hasManualAudioSelection; // Manual quality/audio selection always transcodes

    // Transcode if codec is NOT browser-compatible OR if user requested specific quality/audio
    if (needsTranscode || forceTranscode) {
      const maxAudioChannels = selectedAudioChannels ?? 2;

      // Use Jellyfin's PlaybackInfo API to get the proper TranscodingUrl
      // This ensures audioIndex and bitrate are respected by the server
      let playbackInfoTranscodingUrl: string | null = null;

      try {
        const playbackInfoUrl = new URL(`${jellyfinServerUrl}/Items/${videoId}/PlaybackInfo`);
        playbackInfoUrl.searchParams.set('UserId', userId);
        playbackInfoUrl.searchParams.set('api_key', apiKey);
        playbackInfoUrl.searchParams.set('MaxStreamingBitrate', targetBitrate.toString());

        // Include audio stream index in the query params for PlaybackInfo
        if (typeof effectiveAudioIndex === 'number' && Number.isFinite(effectiveAudioIndex)) {
          playbackInfoUrl.searchParams.set('AudioStreamIndex', effectiveAudioIndex.toString());
        }

        const deviceProfile = {
          MaxStreamingBitrate: targetBitrate,
          DirectPlayProfiles: [
            {
              Container: 'mp4,m4v,mov',
              Type: 'Video',
              VideoCodec: 'h264',
              AudioCodec: 'aac,mp3,ac3,eac3',
            },
          ],
          TranscodingProfiles: useHls ? [
            {
              Container: 'ts',
              Type: 'Video',
              VideoCodec: 'h264',
              AudioCodec: 'aac',
              Protocol: 'hls',
              Context: 'Streaming',
              TranscodeSeekInfo: 'Auto',
              MaxAudioChannels: String(maxAudioChannels),
              MinSegments: 1,
              SegmentLength: 3,
              BreakOnNonKeyFrames: false,
            },
          ] : [
            {
              Container: 'mp4',
              Type: 'Video',
              VideoCodec: 'h264',
              AudioCodec: 'aac',
              Protocol: 'http',
              Context: 'Streaming',
              TranscodeSeekInfo: 'Auto',
              EstimateContentLength: true,
              MaxAudioChannels: String(maxAudioChannels),
            },
          ],
          SubtitleProfiles: [
            { Format: 'vtt', Method: 'External' },
            { Format: 'srt', Method: 'External' },
          ],
        };

        const playbackRes = await fetch(playbackInfoUrl.toString(), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `MediaBrowser Token="${apiKey}"`,
          },
          body: JSON.stringify({ DeviceProfile: deviceProfile }),
          client: httpClient,
        });

        if (playbackRes.ok) {
          const playbackInfo = await playbackRes.json();
          const mediaSource = playbackInfo?.MediaSources?.[0] ?? null;
          const urlPath = mediaSource?.TranscodingUrl ?? null;

          if (typeof urlPath === 'string' && urlPath.length > 0) {
            playbackInfoTranscodingUrl = urlPath.startsWith('http') ? urlPath : `${jellyfinServerUrl}${urlPath}`;
            
            // IMPORTANT: Jellyfin PlaybackInfo might not always include AudioStreamIndex correctly
            // We need to ensure it's in the URL if user selected a specific audio track
            if (hasManualAudioSelection && typeof effectiveAudioIndex === 'number') {
              const urlObj = new URL(playbackInfoTranscodingUrl);
              // Only add if not already present or different
              const existingAudioIndex = urlObj.searchParams.get('AudioStreamIndex');
              if (existingAudioIndex !== effectiveAudioIndex.toString()) {
                urlObj.searchParams.set('AudioStreamIndex', effectiveAudioIndex.toString());
                playbackInfoTranscodingUrl = urlObj.toString();
                console.log(`Forced AudioStreamIndex=${effectiveAudioIndex} in TranscodingUrl`);
              }
            }
            
            // Add StartTimeTicks for seeking if startPosition is provided
            if (startPosition && parseFloat(startPosition) > 0) {
              const urlObj = new URL(playbackInfoTranscodingUrl);
              const startTicks = Math.floor(parseFloat(startPosition) * 10000000); // Convert seconds to ticks
              urlObj.searchParams.set('StartTimeTicks', startTicks.toString());
              playbackInfoTranscodingUrl = urlObj.toString();
              console.log(`Added StartTimeTicks=${startTicks} for seek position ${startPosition}s`);
            }
            
            console.log(`PlaybackInfo provided TranscodingUrl: ${playbackInfoTranscodingUrl.substring(0, 100)}...`);
          }
        } else {
          console.warn('PlaybackInfo returned non-OK, falling back to manual transcode URL:', playbackRes.status);
        }
      } catch (err) {
        console.warn('PlaybackInfo failed, falling back to manual transcode URL:', err);
      }

      if (playbackInfoTranscodingUrl) {
        streamUrl = playbackInfoTranscodingUrl;
        console.log(
          `Transcoding via PlaybackInfo at ${targetBitrate / 1000000} Mbps (audioStreamIndex: ${typeof effectiveAudioIndex === 'number' ? effectiveAudioIndex : 'default'}${hasManualAudioSelection ? ' [user-selected]' : ''}, HLS: ${useHls}, startPosition: ${startPosition || '0'})`
        );
      } else {
        // Fallback: Build transcode URL manually (legacy behavior)
        const transcodeParams = new URLSearchParams({
          UserId: userId,
          MediaSourceId: mediaSourceId,
          VideoCodec: 'h264',
          AudioCodec: 'aac',
          VideoBitrate: targetBitrate.toString(),
          api_key: apiKey,
        });

        transcodeParams.set('MaxAudioChannels', maxAudioChannels.toString());
        transcodeParams.set('TranscodingMaxAudioChannels', maxAudioChannels.toString());
        transcodeParams.set('AudioBitrate', maxAudioChannels > 2 ? '384000' : '192000');

        // Use the global audio stream index directly
        if (typeof effectiveAudioIndex === 'number' && Number.isFinite(effectiveAudioIndex)) {
          transcodeParams.set('AudioStreamIndex', effectiveAudioIndex.toString());
        }
        
        // Add StartTimeTicks for seeking if startPosition is provided
        if (startPosition && parseFloat(startPosition) > 0) {
          const startTicks = Math.floor(parseFloat(startPosition) * 10000000);
          transcodeParams.set('StartTimeTicks', startTicks.toString());
          console.log(`Added StartTimeTicks=${startTicks} for seek position ${startPosition}s`);
        }

        if (useHls) {
          transcodeParams.set('TranscodingContainer', 'ts');
          transcodeParams.set('TranscodingProtocol', 'hls');
          transcodeParams.set('SegmentContainer', 'ts');
          transcodeParams.set('MinSegments', '1');
          transcodeParams.set('BreakOnNonKeyFrames', 'false');
          streamUrl = `${jellyfinServerUrl}/Videos/${videoId}/master.m3u8?${transcodeParams.toString()}`;
        } else {
          transcodeParams.set('TranscodingContainer', 'mp4');
          transcodeParams.set('TranscodingProtocol', 'http');
          streamUrl = `${jellyfinServerUrl}/Videos/${videoId}/stream.mp4?${transcodeParams.toString()}`;
        }
        
        console.log(
          `Transcoding (manual URL) to H264/AAC at ${targetBitrate / 1000000} Mbps (audioStreamIndex: ${typeof effectiveAudioIndex === 'number' ? effectiveAudioIndex : 'default'}${hasManualAudioSelection ? ' [user-selected]' : ''}, HLS: ${useHls}, startPosition: ${startPosition || '0'})`
        );
      }
    } else {
      // Direct stream for compatible codecs
      streamUrl =
        `${jellyfinServerUrl}/Videos/${videoId}/stream?` +
        `UserId=${userId}` +
        `&Static=true` +
        `&MediaSourceId=${mediaSourceId}` +
        `&api_key=${apiKey}`;
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
    const jellyfinAcceptRanges = jellyfinResponse.headers.get('accept-ranges');
    const jellyfinContentRange = jellyfinResponse.headers.get('content-range');
    
    console.log('Jellyfin stream response:', {
      status: jellyfinResponse.status,
      contentType: jellyfinContentType,
      contentLength: jellyfinResponse.headers.get('content-length'),
      contentRange: jellyfinContentRange,
      acceptRanges: jellyfinAcceptRanges,
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
      // Exception: HLS playlists are text-based and valid
      if (!jellyfinContentType.includes('mpegurl') && !jellyfinContentType.includes('m3u')) {
        console.error('Unexpected stream content-type from Jellyfin:', jellyfinContentType);
        return new Response('Stream returned unexpected content', {
          status: 502,
          headers: corsHeaders,
        });
      }
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
    
    // IMPORTANT: Do NOT set accept-ranges manually if upstream doesn't support it
    // This was causing seeking issues - the browser thought byte-range was supported when it wasn't

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
