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
    const { page = 1 } = await req.json();

    console.log('Fetching trending content, page:', page);

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
        JSON.stringify({ error: 'Jellyseerr er ikke konfigurert' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const jellyseerrUrl = rawUrl.replace(/\/$/, '');
    
    // Try fetching trending from Jellyseerr - use discover movies and TV as fallback
    // since trending endpoint might not be available in all Jellyseerr versions
    const discoverMoviesUrl = `${jellyseerrUrl}/api/v1/discover/movies?page=${page}&language=no&sortBy=popularity.desc`;
    const discoverTvUrl = `${jellyseerrUrl}/api/v1/discover/tv?page=${page}&language=no&sortBy=popularity.desc`;
    
    console.log('Fetching popular movies and TV');

    try {
      const [moviesResponse, tvResponse] = await Promise.all([
        fetch(discoverMoviesUrl, {
          method: 'GET',
          headers: {
            'X-Api-Key': jellyseerrApiKey,
            'Content-Type': 'application/json',
          },
        }),
        fetch(discoverTvUrl, {
          method: 'GET',
          headers: {
            'X-Api-Key': jellyseerrApiKey,
            'Content-Type': 'application/json',
          },
        })
      ]);

      if (!moviesResponse.ok || !tvResponse.ok) {
        throw new Error('Failed to fetch popular content');
      }

      const moviesData = await moviesResponse.json();
      const tvData = await tvResponse.json();

      // Combine and interleave results for variety
      const combined = [];
      const maxLength = Math.max(moviesData.results.length, tvData.results.length);
      
      for (let i = 0; i < maxLength; i++) {
        if (i < moviesData.results.length) {
          combined.push(moviesData.results[i]);
        }
        if (i < tvData.results.length) {
          combined.push(tvData.results[i]);
        }
      }

      console.log('Trending results count:', combined.length);

      return new Response(
        JSON.stringify({
          page: page,
          totalPages: Math.max(moviesData.totalPages || 0, tvData.totalPages || 0),
          totalResults: (moviesData.totalResults || 0) + (tvData.totalResults || 0),
          results: combined
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );

    } catch (fetchError) {
      console.error('Fetch error:', fetchError);
      return new Response(
        JSON.stringify({ 
          error: 'Kunne ikke koble til Jellyseerr',
          details: fetchError instanceof Error ? fetchError.message : 'Ukjent tilkoblingsfeil'
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

  } catch (error) {
    console.error('Error in jellyseerr-trending:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Ukjent feil' 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
