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

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { itemId } = await req.json();

    if (!itemId) {
      return new Response(JSON.stringify({ error: 'Item ID required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get server settings
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
      return new Response(JSON.stringify({ error: 'Server not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const jellyfinUrl = serverSettings.setting_value.replace(/\/$/, '');
    const apiKey = apiKeySettings.setting_value;

    // Search for subtitles using Jellyfin API
    const searchUrl = `${jellyfinUrl}/Items/${itemId}/RemoteSearch/Subtitles/NoLanguage`;
    
    const searchResponse = await fetch(searchUrl, {
      headers: {
        'X-Emby-Token': apiKey,
      },
    });

    if (!searchResponse.ok) {
      console.error('Failed to search subtitles:', searchResponse.status);
      return new Response(JSON.stringify({ error: 'Failed to search subtitles' }), {
        status: searchResponse.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const results = await searchResponse.json();

    // If subtitles are found, download the first one
    if (results && results.length > 0) {
      const firstSubtitle = results[0];
      const downloadUrl = `${jellyfinUrl}/Items/${itemId}/RemoteSearch/Subtitles/${firstSubtitle.Id}`;
      
      const downloadResponse = await fetch(downloadUrl, {
        method: 'POST',
        headers: {
          'X-Emby-Token': apiKey,
        },
      });

      if (!downloadResponse.ok) {
        console.error('Failed to download subtitle:', downloadResponse.status);
        return new Response(JSON.stringify({ error: 'Failed to download subtitle' }), {
          status: downloadResponse.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ 
        success: true, 
        message: 'Undertekster lastet ned',
        subtitles: results.length 
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ 
      success: false, 
      message: 'Ingen undertekster funnet' 
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in jellyfin-search-subtitles:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Internal server error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
