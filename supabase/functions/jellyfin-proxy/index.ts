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
  /^\/Library\/VirtualFolders$/i,
  /^\/Library\/Refresh$/i,
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
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !SUPABASE_ANON_KEY) {
      console.error('Missing backend configuration for jellyfin-proxy');
      return new Response(JSON.stringify({ error: 'Service configuration error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify user is authenticated using the caller's JWT
    const authHeaderRaw = req.headers.get('authorization') ?? '';

    if (!authHeaderRaw) {
      console.log('jellyfin-proxy unauthorized: missing bearer token');
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Extract the token from "Bearer <token>"
    const tokenMatch = authHeaderRaw.match(/^bearer\s+(.+)$/i);
    const accessToken = tokenMatch?.[1]?.trim();

    if (!accessToken) {
      console.log('jellyfin-proxy unauthorized: malformed bearer token');
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validate the user JWT using anon key + Authorization header (most reliable in edge runtime)
    const supabaseAuth = createClient(
      SUPABASE_URL,
      SUPABASE_ANON_KEY,
      {
        global: { headers: { Authorization: `Bearer ${accessToken}` } },
        auth: { persistSession: false, autoRefreshToken: false },
      }
    );

    const {
      data: { user },
      error: userError,
    } = await supabaseAuth.auth.getUser();

    if (userError || !user) {
      console.log('jellyfin-proxy unauthorized: invalid user token', userError?.message);
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Service-role client for reading settings / admin checks
    const supabaseAdmin = createClient(
      SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );

    // Parse request body
    const { endpoint, method = 'GET', body }: JellyfinRequest = await req.json();
    const endpointPath = (endpoint ?? '').split('?')[0];
    const isLibraryRefresh = endpointPath.toLowerCase() === '/library/refresh';

    // Validate endpoint
    if (!endpoint || !validateEndpoint(endpoint)) {
      console.warn(`Invalid or disallowed endpoint: ${endpoint}`);
      return new Response(JSON.stringify({ error: 'Invalid endpoint' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (isLibraryRefresh && method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Invalid method for endpoint' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get Jellyfin server settings using service role key
    // (supabaseAdmin already initialized above)

    const { data: settings, error: settingsError } = await supabaseAdmin
      .from('server_settings')
      .select('setting_value')
      .eq('setting_key', 'jellyfin_server_url')
      .single();

    if (settingsError || !settings?.setting_value) {
      console.error('Error fetching server settings', settingsError);
      return new Response(JSON.stringify({ error: 'Service configuration error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Admin-only operations
    if (isLibraryRefresh) {
      const { data: roleData } = await supabaseAdmin
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .maybeSingle();

      if (!roleData) {
        return new Response(JSON.stringify({ error: 'Admin access required' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
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

    const contentType = jellyfinResponse.headers.get('content-type');
    const responseText = await jellyfinResponse.text();

    // Handle empty responses (e.g. 204 No Content from /Library/Refresh)
    if (!responseText || responseText.trim() === '') {
      return new Response(JSON.stringify({ success: true }), {
        status: jellyfinResponse.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (contentType && contentType.includes('application/json')) {
      try {
        const jellyfinData = JSON.parse(responseText);
        return new Response(JSON.stringify(jellyfinData), {
          status: jellyfinResponse.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } catch (e) {
        console.error('Invalid JSON response from Jellyfin');
        return new Response(
          JSON.stringify({ error: 'Invalid response from service', details: responseText }),
          {
            status: 502,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
    }

    // Non-JSON response
    return new Response(
      JSON.stringify({ success: true, details: responseText }),
      {
        status: jellyfinResponse.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
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
