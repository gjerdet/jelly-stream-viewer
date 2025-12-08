import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const bazarrUrl = Deno.env.get('BAZARR_URL');
    const bazarrApiKey = Deno.env.get('BAZARR_API_KEY');

    if (!bazarrUrl || !bazarrApiKey) {
      return new Response(
        JSON.stringify({ error: 'Bazarr configuration missing' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { action, params } = await req.json();
    console.log(`Bazarr proxy action: ${action}`, params);

    const baseUrl = bazarrUrl.replace(/\/$/, '');
    let endpoint = '';
    let method = 'GET';
    let body: string | undefined;

    switch (action) {
      // Get system status
      case 'status':
        endpoint = '/api/system/status';
        break;

      // Get all movies with missing subtitles
      case 'movies-wanted':
        endpoint = '/api/movies/wanted';
        break;

      // Get all series/episodes with missing subtitles
      case 'episodes-wanted':
        endpoint = '/api/episodes/wanted';
        break;

      // Get movie history
      case 'movies-history':
        endpoint = '/api/history/movies';
        break;

      // Get series history
      case 'episodes-history':
        endpoint = '/api/history/series';
        break;

      // Get specific movie
      case 'movie':
        endpoint = `/api/movies?radarrid=${params.radarrId}`;
        break;

      // Get specific series
      case 'series':
        endpoint = `/api/series?seriesid=${params.sonarrId}`;
        break;

      // Get episodes for a series
      case 'episodes':
        endpoint = `/api/episodes?seriesid=${params.sonarrId}`;
        break;

      // Search for subtitles for a movie
      case 'search-movie':
        endpoint = '/api/movies/subtitles';
        method = 'PATCH';
        body = JSON.stringify({
          radarrid: params.radarrId,
          profileid: params.profileId
        });
        break;

      // Search for subtitles for an episode
      case 'search-episode':
        endpoint = '/api/episodes/subtitles';
        method = 'PATCH';
        body = JSON.stringify({
          seriesid: params.sonarrId,
          episodeid: params.episodeId,
          profileid: params.profileId
        });
        break;

      // Download specific subtitle for movie
      case 'download-movie-subtitle':
        endpoint = '/api/movies/subtitles';
        method = 'POST';
        body = JSON.stringify({
          radarrid: params.radarrId,
          language: params.language,
          hi: params.hi || false,
          forced: params.forced || false,
          provider: params.provider,
          subtitle: params.subtitle
        });
        break;

      // Download specific subtitle for episode
      case 'download-episode-subtitle':
        endpoint = '/api/episodes/subtitles';
        method = 'POST';
        body = JSON.stringify({
          seriesid: params.sonarrId,
          episodeid: params.episodeId,
          language: params.language,
          hi: params.hi || false,
          forced: params.forced || false,
          provider: params.provider,
          subtitle: params.subtitle
        });
        break;

      // Delete subtitle for movie
      case 'delete-movie-subtitle':
        endpoint = '/api/movies/subtitles';
        method = 'DELETE';
        body = JSON.stringify({
          radarrid: params.radarrId,
          language: params.language,
          forced: params.forced || false,
          hi: params.hi || false,
          path: params.path
        });
        break;

      // Delete subtitle for episode
      case 'delete-episode-subtitle':
        endpoint = '/api/episodes/subtitles';
        method = 'DELETE';
        body = JSON.stringify({
          seriesid: params.sonarrId,
          episodeid: params.episodeId,
          language: params.language,
          forced: params.forced || false,
          hi: params.hi || false,
          path: params.path
        });
        break;

      // Manual search for movie subtitles
      case 'manual-search-movie':
        endpoint = `/api/providers/movies?radarrid=${params.radarrId}`;
        break;

      // Manual search for episode subtitles
      case 'manual-search-episode':
        endpoint = `/api/providers/episodes?episodeid=${params.episodeId}`;
        break;

      // Get providers
      case 'providers':
        endpoint = '/api/providers';
        break;

      // Get languages
      case 'languages':
        endpoint = '/api/system/languages';
        break;

      default:
        return new Response(
          JSON.stringify({ error: `Unknown action: ${action}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    const url = `${baseUrl}${endpoint}`;
    console.log(`Bazarr request: ${method} ${url}`);

    const fetchOptions: RequestInit = {
      method,
      headers: {
        'X-API-KEY': bazarrApiKey,
        'Content-Type': 'application/json',
      },
    };

    if (body) {
      fetchOptions.body = body;
    }

    // Add timeout with AbortController
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    
    try {
      const response = await fetch(url, { ...fetchOptions, signal: controller.signal });
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Bazarr error: ${response.status} - ${errorText}`);
        return new Response(
          JSON.stringify({ error: `Bazarr error: ${response.status}`, details: errorText }),
          { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const data = await response.json();
      console.log(`Bazarr response for ${action}:`, JSON.stringify(data).substring(0, 200));

      return new Response(
        JSON.stringify(data),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } catch (fetchError: unknown) {
      clearTimeout(timeoutId);
      if (fetchError instanceof Error && fetchError.name === 'AbortError') {
        console.error('Bazarr request timeout');
        return new Response(
          JSON.stringify({ error: 'Timeout: Bazarr svarer ikke' }),
          { status: 504, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      throw fetchError;
    }

  } catch (error) {
    console.error('Bazarr proxy error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
