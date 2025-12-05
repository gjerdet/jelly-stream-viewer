import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Input validation helpers
function validateVideoId(videoId: string): boolean {
  // Jellyfin IDs are 32-character hex strings
  return /^[a-f0-9]{32}$/i.test(videoId);
}

function validateSubtitleIndex(index: string): boolean {
  const num = parseInt(index, 10);
  // Subtitle index should be a reasonable number (0-99)
  return !isNaN(num) && num >= 0 && num < 100;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get parameters from URL
    // Note: Token in URL is required for browser subtitle tracks (can't send custom headers)
    const url = new URL(req.url);
    const videoId = url.searchParams.get('id');
    const subtitleIndex = url.searchParams.get('index');
    const token = url.searchParams.get('token');
    
    if (!videoId || !subtitleIndex || !token) {
      return new Response('Missing required parameters', { 
        status: 400,
        headers: corsHeaders 
      });
    }

    // Validate inputs to prevent injection
    if (!validateVideoId(videoId)) {
      console.warn(`Invalid video ID format attempt: ${videoId.substring(0, 10)}...`);
      return new Response('Invalid request', { 
        status: 400,
        headers: corsHeaders 
      });
    }

    if (!validateSubtitleIndex(subtitleIndex)) {
      console.warn(`Invalid subtitle index: ${subtitleIndex}`);
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

    // Construct Jellyfin subtitle URL
    const subtitleUrl = `${jellyfinServerUrl}/Videos/${videoId}/Subtitles/${subtitleIndex}/Stream.vtt?api_key=${apiKey}`;

    console.log(`Fetching subtitle ${subtitleIndex} for video ${videoId} for user ${user.id}`);

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
    return new Response('Request failed', { 
      status: 500,
      headers: corsHeaders 
    });
  }
});
