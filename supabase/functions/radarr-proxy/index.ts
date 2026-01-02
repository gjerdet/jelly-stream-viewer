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
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // Get Radarr settings from server_settings table
    const { data: settings, error: settingsError } = await supabase
      .from('server_settings')
      .select('setting_key, setting_value')
      .in('setting_key', ['radarr_url', 'radarr_api_key']);

    if (settingsError) {
      console.error('Error fetching Radarr settings:', settingsError);
      return new Response(
        JSON.stringify({ error: 'Could not fetch Radarr settings' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const RADARR_URL = settings?.find(s => s.setting_key === 'radarr_url')?.setting_value;
    const RADARR_API_KEY = settings?.find(s => s.setting_key === 'radarr_api_key')?.setting_value;

    if (!RADARR_URL || !RADARR_API_KEY) {
      console.error('Radarr configuration missing');
      return new Response(
        JSON.stringify({ error: 'Radarr is not configured. Please add URL and API key in Admin → Servers.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { action, params } = await req.json();
    console.log(`Radarr proxy request: ${action}`, params);

    // Check if user is admin
    const authHeader = req.headers.get('Authorization');
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const { data: { user } } = await supabase.auth.getUser(token);
      
      if (user) {
        const { data: roleData } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .eq('role', 'admin')
          .maybeSingle();
        
        if (!roleData && action !== 'health') {
          return new Response(
            JSON.stringify({ error: 'Admin access required' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
    }

    const baseUrl = RADARR_URL.replace(/\/$/, '');
    let endpoint = '';
    let method = 'GET';
    let body = null;

    switch (action) {
      case 'health':
        endpoint = '/api/v3/health';
        break;
      
      case 'movies':
        endpoint = '/api/v3/movie';
        break;
      
      case 'movie':
        endpoint = `/api/v3/movie/${params?.movieId}`;
        break;
      
      case 'history':
        const page = params?.page || 1;
        const pageSize = params?.pageSize || 50;
        endpoint = `/api/v3/history?page=${page}&pageSize=${pageSize}&sortKey=date&sortDirection=descending`;
        if (params?.eventType) {
          endpoint += `&eventType=${params.eventType}`;
        }
        break;
      
      case 'queue':
        endpoint = '/api/v3/queue?includeMovie=true';
        break;
      
      case 'toggleMonitored':
        endpoint = `/api/v3/movie/${params?.movieId}`;
        method = 'PUT';
        // First get the movie to toggle its monitored status
        const movieResponse = await fetch(`${baseUrl}/api/v3/movie/${params?.movieId}`, {
          headers: { 'X-Api-Key': RADARR_API_KEY }
        });
        const movieData = await movieResponse.json();
        movieData.monitored = params?.monitored ?? !movieData.monitored;
        body = JSON.stringify(movieData);
        break;
      
      case 'qualityProfiles':
        endpoint = '/api/v3/qualityprofile';
        break;
      
      case 'movieFile':
        // Get movie file details
        endpoint = `/api/v3/moviefile/${params?.movieFileId}`;
        break;
      
      case 'movieFiles':
        // Get all movie files - either for a specific movie or all files
        if (params?.movieId) {
          endpoint = `/api/v3/moviefile?movieId=${params.movieId}`;
        } else {
          // Get ALL movie files in the system
          endpoint = '/api/v3/moviefile';
        }
        break;
      
      case 'deleteMovieFile':
        // Delete a specific movie file
        endpoint = `/api/v3/moviefile/${params?.movieFileId}`;
        method = 'DELETE';
        console.log(`Deleting movie file: ${params?.movieFileId}`);
        break;
      
      case 'command':
        // Execute a command (e.g. RenameMovie, RescanMovie, RefreshMovie)
        endpoint = '/api/v3/command';
        method = 'POST';
        body = JSON.stringify({
          name: params?.name,
          movieId: params?.movieId,
          movieIds: params?.movieIds,
          files: params?.files,
        });
        console.log(`Executing command: ${params?.name}`, { movieId: params?.movieId, movieIds: params?.movieIds, files: params?.files });
        break;
      
      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    console.log(`Radarr API call: ${method} ${baseUrl}${endpoint}`);

    // Create HTTP client that ignores SSL certificate errors (for self-signed certs)
    const client = Deno.createHttpClient({
      caCerts: [],
    });

    const fetchOptions: RequestInit & { client?: Deno.HttpClient } = {
      method,
      headers: {
        'X-Api-Key': RADARR_API_KEY,
        'Content-Type': 'application/json',
      },
      client,
    };

    if (body) {
      fetchOptions.body = body;
    }

    const response = await fetch(`${baseUrl}${endpoint}`, fetchOptions);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Radarr API error: ${response.status} - ${errorText}`);
      return new Response(
        JSON.stringify({ error: `Radarr API error: ${response.status}`, details: errorText }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Handle DELETE responses (usually 200 with empty body or 204 No Content)
    if (method === 'DELETE') {
      console.log(`Radarr ${action} DELETE successful`);
      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if response has content before parsing
    const contentType = response.headers.get('content-type');
    const responseText = await response.text();
    
    if (!responseText || responseText.trim() === '') {
      console.log(`Radarr ${action} returned empty response`);
      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = JSON.parse(responseText);
    console.log(`Radarr ${action} response received, items:`, Array.isArray(data) ? data.length : 1);

    return new Response(
      JSON.stringify(data),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Radarr proxy error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
