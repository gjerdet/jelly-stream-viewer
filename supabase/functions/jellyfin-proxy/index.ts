import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Create HTTP client that ignores SSL certificate errors (for self-signed certs)
const httpClient = Deno.createHttpClient({
  caCerts: [],
});

interface JellyfinRequest {
  endpoint: string;
  method?: string;
  body?: any;
}

// Whitelist of allowed Jellyfin API endpoints (base paths only, query params allowed)
// Note: Jellyfin IDs can be both upper and lowercase hex
const ALLOWED_ENDPOINT_PATTERNS = [
  /^\/Users$/i,
  /^\/Users\/[a-f0-9]{32}\/Items/i,
  /^\/Users\/[a-f0-9]{32}\/Suggestions/i,
  /^\/Users\/[a-f0-9]{32}\/Views$/i,
  /^\/Users\/[a-f0-9]{32}\/FavoriteItems/i,
  /^\/Items\/[a-f0-9]{32}/i,
  /^\/Items$/i,
  /^\/Shows\/[a-f0-9]{32}\/Seasons/i,
  /^\/Shows\/[a-f0-9]{32}\/Episodes/i,
  /^\/Persons\/[a-f0-9]{32}/i,
  /^\/Search\/Hints/i,
  /^\/Videos\/[a-f0-9]{32}\/[a-f0-9]{32}\/Subtitles/i,
  /^\/Sessions\/Playing/i,
];

function validateEndpoint(endpoint: string): boolean {
  // Extract path without query parameters for validation
  const path = endpoint.split('?')[0];
  return ALLOWED_ENDPOINT_PATTERNS.some(pattern => pattern.test(path));
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Create Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    // Verify user is authenticated
    const {
      data: { user },
    } = await supabaseClient.auth.getUser();

    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Parse request body
    const { endpoint, method = 'GET', body }: JellyfinRequest = await req.json();

    // Validate endpoint
    if (!endpoint || !validateEndpoint(endpoint)) {
      console.warn(`Invalid or disallowed endpoint: ${endpoint}`);
      return new Response(JSON.stringify({ error: 'Invalid endpoint' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get Jellyfin server settings using service role key
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: settings, error: settingsError } = await supabaseAdmin
      .from('server_settings')
      .select('setting_value')
      .eq('setting_key', 'jellyfin_server_url')
      .single();

    if (settingsError || !settings) {
      console.error('Error fetching server settings');
      return new Response(JSON.stringify({ error: 'Service configuration error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const jellyfinServerUrl = settings.setting_value.replace(/\/$/, '');

    // Get Jellyfin API key
    const { data: apiKeySettings, error: apiKeyError } = await supabaseAdmin
      .from('server_settings')
      .select('setting_value')
      .eq('setting_key', 'jellyfin_api_key')
      .maybeSingle();

    if (apiKeyError || !apiKeySettings) {
      console.error('Error fetching Jellyfin API key');
      return new Response(JSON.stringify({ error: 'Service configuration error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const apiKey = apiKeySettings.setting_value;

    console.log(`Proxying request to Jellyfin: ${method} ${jellyfinServerUrl}${endpoint}`);

    // Make request to Jellyfin API with authentication (with SSL bypass)
    const jellyfinResponse = await fetch(`${jellyfinServerUrl}${endpoint}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `MediaBrowser Token="${apiKey}"`,
      },
      body: body ? JSON.stringify(body) : undefined,
      client: httpClient,
    });

    // Check if response is JSON
    const contentType = jellyfinResponse.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      const textResponse = await jellyfinResponse.text();
      console.error('Non-JSON response from Jellyfin');
      return new Response(
        JSON.stringify({ 
          error: 'Invalid response from service'
        }),
        {
          status: jellyfinResponse.status || 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const jellyfinData = await jellyfinResponse.json();

    return new Response(JSON.stringify(jellyfinData), {
      status: jellyfinResponse.status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in jellyfin-proxy:', error);
    return new Response(
      JSON.stringify({ error: 'Request failed' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
