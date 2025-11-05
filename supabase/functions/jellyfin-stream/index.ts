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

    // Prepare headers for requests
    const requestHeaders: Record<string, string> = {
      'Authorization': `MediaBrowser Token="${apiKey}"`,
    };
    
    const rangeHeader = req.headers.get('range');
    if (rangeHeader) {
      requestHeaders['Range'] = rangeHeader;
    }

    const headersToForward = [
      'content-type',
      'content-length',
      'content-range',
      'accept-ranges',
      'last-modified',
      'etag',
    ];

    // Use PlaybackInfo to let Jellyfin choose optimal streaming method
    console.log(`Getting playback info for video ${videoId}`);
    
    const playbackInfoUrl = `${jellyfinServerUrl}/Items/${videoId}/PlaybackInfo?UserId=${userId}&api_key=${apiKey}`;
    const playbackResponse = await fetch(playbackInfoUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Emby-Token': apiKey
      },
      body: JSON.stringify({
        DeviceProfile: {
          MaxStreamingBitrate: 120000000,
          MusicStreamingTranscodingBitrate: 192000,
          DirectPlayProfiles: [
            {
              Container: 'mp4,m4v',
              Type: 'Video',
              VideoCodec: 'h264',
              AudioCodec: 'aac,mp3,ac3,eac3'
            },
            {
              Container: 'mkv',
              Type: 'Video', 
              VideoCodec: 'h264',
              AudioCodec: 'aac,mp3,ac3,eac3,opus,flac'
            }
          ],
          TranscodingProfiles: [
            {
              Container: 'ts',
              Type: 'Video',
              VideoCodec: 'h264',
              AudioCodec: 'aac',
              Protocol: 'hls',
              EstimateContentLength: false,
              EnableMpegtsM2TsMode: false,
              TranscodeSeekInfo: 'Auto',
              CopyTimestamps: false,
              Context: 'Streaming',
              EnableSubtitlesInManifest: false,
              MaxAudioChannels: '2',
              MinSegments: 1,
              SegmentLength: 3,
              BreakOnNonKeyFrames: true
            },
            {
              Container: 'mp4',
              Type: 'Video',
              VideoCodec: 'h264',
              AudioCodec: 'aac',
              Protocol: 'http',
              EstimateContentLength: false,
              EnableMpegtsM2TsMode: false,
              TranscodeSeekInfo: 'Auto',
              CopyTimestamps: false,
              Context: 'Streaming',
              EnableSubtitlesInManifest: false,
              MaxAudioChannels: '2'
            }
          ],
          ContainerProfiles: [],
          CodecProfiles: [
            {
              Type: 'Video',
              Codec: 'h264',
              Conditions: [
                {
                  Condition: 'LessThanEqual',
                  Property: 'Width',
                  Value: '1920'
                },
                {
                  Condition: 'LessThanEqual',
                  Property: 'Height',
                  Value: '1080'
                }
              ]
            }
          ],
          ResponseProfiles: [],
          SubtitleProfiles: [
            {
              Format: 'vtt',
              Method: 'External'
            }
          ]
        }
      })
    });
    
    if (!playbackResponse.ok) {
      console.error('Failed to get playback info:', playbackResponse.status);
      // Fallback to simple stream
      const streamUrl = `${jellyfinServerUrl}/Videos/${videoId}/stream?UserId=${userId}&MediaSourceId=${videoId}&api_key=${apiKey}`;
      
      const jellyfinResponse = await fetch(streamUrl, {
        headers: requestHeaders,
      });
      
      const responseHeaders = new Headers(corsHeaders);
      for (const header of headersToForward) {
        const value = jellyfinResponse.headers.get(header);
        if (value) responseHeaders.set(header, value);
      }
      
      return new Response(jellyfinResponse.body, {
        status: jellyfinResponse.status,
        headers: responseHeaders,
      });
    }
    
    const playbackInfo = await playbackResponse.json();
    const mediaSource = playbackInfo.MediaSources?.[0];
    
    if (!mediaSource) {
      console.error('No media source found in playback info');
      return new Response('No playback source available', { 
        status: 500,
        headers: corsHeaders 
      });
    }
    
    // Use the TranscodingUrl if transcoding, otherwise DirectStreamUrl or construct URL
    let streamUrl;
    if (mediaSource.TranscodingUrl) {
      streamUrl = `${jellyfinServerUrl}${mediaSource.TranscodingUrl}`;
      console.log('Using transcoding stream');
    } else if (mediaSource.SupportsDirectStream && mediaSource.DirectStreamUrl) {
      streamUrl = `${jellyfinServerUrl}${mediaSource.DirectStreamUrl}`;
      console.log('Using direct stream');
    } else {
      streamUrl = `${jellyfinServerUrl}/Videos/${videoId}/stream?UserId=${userId}&MediaSourceId=${videoId}&api_key=${apiKey}`;
      console.log('Using fallback stream');
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
