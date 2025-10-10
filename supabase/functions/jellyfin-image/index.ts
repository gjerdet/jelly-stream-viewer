import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const {
      data: { user },
    } = await supabaseClient.auth.getUser();

    if (!user) {
      return new Response('Unauthorized', { status: 401, headers: corsHeaders });
    }

    // Get server URL and API key
    const { data: serverSettings } = await supabaseClient
      .from('server_settings')
      .select('setting_value')
      .eq('setting_key', 'jellyfin_server_url')
      .single();

    const { data: apiKeySettings } = await supabaseClient
      .from('server_settings')
      .select('setting_value')
      .eq('setting_key', 'jellyfin_api_key')
      .maybeSingle();

    if (!serverSettings || !apiKeySettings) {
      return new Response('Configuration not found', { status: 500, headers: corsHeaders });
    }

    const jellyfinServerUrl = serverSettings.setting_value.replace(/\/$/, '');
    const apiKey = apiKeySettings.setting_value;

    // Get image path from query params
    const url = new URL(req.url);
    const imagePath = url.searchParams.get('path');

    if (!imagePath) {
      return new Response('Missing image path', { status: 400, headers: corsHeaders });
    }

    // Fetch image from Jellyfin
    const imageUrl = `${jellyfinServerUrl}${imagePath}`;
    const imageResponse = await fetch(imageUrl, {
      headers: {
        'Authorization': `MediaBrowser Token="${apiKey}"`,
      },
    });

    if (!imageResponse.ok) {
      return new Response('Image not found', { status: 404, headers: corsHeaders });
    }

    const imageBlob = await imageResponse.blob();
    const contentType = imageResponse.headers.get('content-type') || 'image/jpeg';

    return new Response(imageBlob, {
      headers: {
        ...corsHeaders,
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000',
      },
    });
  } catch (error) {
    console.error('Error in jellyfin-image:', error);
    return new Response('Internal server error', { status: 500, headers: corsHeaders });
  }
});
