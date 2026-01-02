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

    // Get Sonarr settings from server_settings table
    const { data: settings, error: settingsError } = await supabase
      .from('server_settings')
      .select('setting_key, setting_value')
      .in('setting_key', ['sonarr_url', 'sonarr_api_key']);

    if (settingsError) {
      console.error('Error fetching Sonarr settings:', settingsError);
      return new Response(
        JSON.stringify({ error: 'Could not fetch Sonarr settings' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const SONARR_URL = settings?.find(s => s.setting_key === 'sonarr_url')?.setting_value;
    const SONARR_API_KEY = settings?.find(s => s.setting_key === 'sonarr_api_key')?.setting_value;

    if (!SONARR_URL || !SONARR_API_KEY) {
      console.error('Sonarr configuration missing');
      return new Response(
        JSON.stringify({ error: 'Sonarr is not configured. Please add URL and API key in Admin → Servers.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { action, params } = await req.json();
    console.log(`Sonarr proxy request: ${action}`, params);

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

    const baseUrl = SONARR_URL.replace(/\/$/, '');
    let endpoint = '';
    let method = 'GET';
    let body = null;

    switch (action) {
      case 'health':
        endpoint = '/api/v3/health';
        break;
      
      case 'series':
        endpoint = '/api/v3/series';
        break;
      
      case 'serie':
        endpoint = `/api/v3/series/${params?.seriesId}`;
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
        endpoint = '/api/v3/queue?includeSeries=true&includeEpisode=true';
        break;
      
      case 'toggleMonitored':
        endpoint = `/api/v3/series/${params?.seriesId}`;
        method = 'PUT';
        // First get the series to toggle its monitored status
        const seriesResponse = await fetch(`${baseUrl}/api/v3/series/${params?.seriesId}`, {
          headers: { 'X-Api-Key': SONARR_API_KEY }
        });
        const seriesData = await seriesResponse.json();
        seriesData.monitored = params?.monitored ?? !seriesData.monitored;
        body = JSON.stringify(seriesData);
        break;
      
      case 'qualityProfiles':
        endpoint = '/api/v3/qualityprofile';
        break;
      
      case 'calendar':
        const startDate = params?.start || new Date().toISOString().split('T')[0];
        const endDate = params?.end || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        endpoint = `/api/v3/calendar?start=${startDate}&end=${endDate}`;
        break;
      
      case 'episodeFile':
        // Get episode file details
        endpoint = `/api/v3/episodefile/${params?.episodeFileId}`;
        break;
      
      case 'episodeFiles':
        // Get all episode files for a series
        endpoint = `/api/v3/episodefile?seriesId=${params?.seriesId}`;
        break;
      
      case 'deleteEpisodeFile':
        // Delete a specific episode file
        endpoint = `/api/v3/episodefile/${params?.episodeFileId}`;
        method = 'DELETE';
        console.log(`Deleting episode file: ${params?.episodeFileId}`);
        break;
      
      case 'command':
        // Execute a command (e.g. RenameSeries)
        endpoint = '/api/v3/command';
        method = 'POST';
        body = JSON.stringify({
          name: params?.name,
          seriesIds: params?.seriesIds,
        });
        console.log(`Executing command: ${params?.name} for series:`, params?.seriesIds);
        break;
      
      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    console.log(`Sonarr API call: ${method} ${baseUrl}${endpoint}`);

    const fetchOptions: RequestInit = {
      method,
      headers: {
        'X-Api-Key': SONARR_API_KEY,
        'Content-Type': 'application/json',
      },
    };

    if (body) {
      fetchOptions.body = body;
    }

    const response = await fetch(`${baseUrl}${endpoint}`, fetchOptions);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Sonarr API error: ${response.status} - ${errorText}`);
      return new Response(
        JSON.stringify({ error: `Sonarr API error: ${response.status}`, details: errorText }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Handle DELETE responses (often empty body)
    if (method === 'DELETE') {
      console.log(`Sonarr ${action} DELETE successful`);
      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const responseText = await response.text();
    if (!responseText || responseText.trim() === '') {
      console.log(`Sonarr ${action} returned empty response`);
      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = JSON.parse(responseText);
    console.log(`Sonarr ${action} response received, items:`, Array.isArray(data) ? data.length : 1);

    return new Response(
      JSON.stringify(data),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Sonarr proxy error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
