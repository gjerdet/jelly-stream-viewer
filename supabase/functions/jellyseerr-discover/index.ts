import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.74.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { type, page = 1, genre, sortBy } = await req.json();
    
    if (!type || !['movie', 'tv'].includes(type)) {
      return new Response(
        JSON.stringify({ error: 'Type må være "movie" eller "tv"' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('Discover request:', { type, page, genre, sortBy });

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch Jellyseerr settings
    const { data: urlData } = await supabase
      .from('server_settings')
      .select('setting_value')
      .eq('setting_key', 'jellyseerr_url')
      .maybeSingle();

    const { data: apiKeyData } = await supabase
      .from('server_settings')
      .select('setting_value')
      .eq('setting_key', 'jellyseerr_api_key')
      .maybeSingle();

    const rawUrl = urlData?.setting_value;
    const jellyseerrApiKey = apiKeyData?.setting_value;

    if (!rawUrl || !jellyseerrApiKey) {
      console.error('Missing Jellyseerr configuration');
      return new Response(
        JSON.stringify({ error: 'Tjenesten er midlertidig utilgjengelig' }),
        { 
          status: 503, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Keep user's protocol choice (HTTP or HTTPS)
    const jellyseerrUrl = rawUrl.replace(/\/$/, ''); // Remove trailing slash
    // Jellyseerr uses plural 'movies' but singular 'tv'
    const endpoint = type === 'movie' ? 'movies' : type;
    
    // Build query params
    const params = new URLSearchParams({
      page: String(page),
      language: 'no',
    });
    
    if (genre) {
      params.append('genre', String(genre));
    }
    
    if (sortBy) {
      params.append('sortBy', sortBy);
    }
    
    const discoverUrl = `${jellyseerrUrl}/api/v1/discover/${endpoint}?${params.toString()}`;
    
    console.log('Fetching from Jellyseerr:', discoverUrl);

    let response;
    try {
      response = await fetch(discoverUrl, {
        method: 'GET',
        headers: {
          'X-Api-Key': jellyseerrApiKey,
          'Content-Type': 'application/json',
        },
      });
    } catch (fetchError) {
      console.error('Fetch error:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Kunne ikke fullføre forespørselen' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Jellyseerr error:', response.status, errorText);
      return new Response(
        JSON.stringify({ error: 'Kunne ikke fullføre forespørselen' }),
        { 
          status: response.status, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const data = await response.json();
    console.log('Discover results count:', data.results?.length || 0);

    return new Response(
      JSON.stringify(data),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error in jellyseerr-discover:', error);
    return new Response(
      JSON.stringify({ error: 'Det oppsto en feil' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
