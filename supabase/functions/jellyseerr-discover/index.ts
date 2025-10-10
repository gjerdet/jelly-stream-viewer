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
    const { type, page = 1 } = await req.json();
    
    if (!type || !['movie', 'tv'].includes(type)) {
      return new Response(
        JSON.stringify({ error: 'Type må være "movie" eller "tv"' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('Discover request:', { type, page });

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

    // Try HTTPS first since most Jellyseerr instances use HTTPS
    const cleanDomain = rawUrl
      .replace(/^https?:\/\//, '')  // Remove any protocol
      .replace(/\/$/, '');            // Remove trailing slash
    
    let jellyseerrUrl = `https://${cleanDomain}`;
    let discoverUrl = `${jellyseerrUrl}/api/v1/discover/${type}?page=${page}&language=no`;
    
    console.log('Trying HTTPS first:', discoverUrl);

    try {
      const response = await fetch(discoverUrl, {
        method: 'GET',
        headers: {
          'X-Api-Key': jellyseerrApiKey,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Jellyseerr HTTPS error:', response.status, errorText);
        throw new Error(`HTTPS request failed: ${response.status}`);
      }

      const data = await response.json();
      console.log('Discover results count (HTTPS):', data.results?.length || 0);

      return new Response(
        JSON.stringify(data),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    } catch (httpsError) {
      console.log('HTTPS failed, trying HTTP fallback...', httpsError);
      
      // Fallback to HTTP if HTTPS fails (SSL issues)
      jellyseerrUrl = `http://${cleanDomain}`;
      discoverUrl = `${jellyseerrUrl}/api/v1/discover/${type}?page=${page}&language=no`;
      console.log('Trying HTTP fallback:', discoverUrl);
      
      const response = await fetch(discoverUrl, {
        method: 'GET',
        headers: {
          'X-Api-Key': jellyseerrApiKey,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Jellyseerr HTTP fallback error:', response.status, errorText);
        return new Response(
          JSON.stringify({ 
            error: 'Kunne ikke koble til Jellyseerr via HTTPS eller HTTP. Sjekk at URL og API-nøkkel er riktig konfigurert i Admin.',
            details: `HTTPS error: ${httpsError instanceof Error ? httpsError.message : 'Unknown'}. HTTP error: ${errorText}`
          }),
          { 
            status: response.status, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      const data = await response.json();
      console.log('Discover results count (HTTP):', data.results?.length || 0);

      return new Response(
        JSON.stringify(data),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

  } catch (error) {
    console.error('Error in jellyseerr-discover:', error);
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
