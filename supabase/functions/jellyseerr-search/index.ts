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
    const { query } = await req.json();
    
    if (!query || query.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: 'Søkeord er påkrevd' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('Search query:', query);

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

    // Force HTTP to avoid SSL certificate issues
    let jellyseerrUrl = urlData?.setting_value?.replace(/\/$/, ''); // Remove trailing slash
    if (jellyseerrUrl?.startsWith('https://')) {
      jellyseerrUrl = jellyseerrUrl.replace('https://', 'http://');
    }
    const jellyseerrApiKey = apiKeyData?.setting_value;

    if (!jellyseerrUrl || !jellyseerrApiKey) {
      console.error('Missing Jellyseerr configuration');
      return new Response(
        JSON.stringify({ error: 'Jellyseerr er ikke konfigurert' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Search via Jellyseerr API
    const searchUrl = `${jellyseerrUrl}/api/v1/search?query=${encodeURIComponent(query)}&page=1&language=no`;
    console.log('Searching Jellyseerr:', searchUrl);

    let response;
    try {
      response = await fetch(searchUrl, {
        method: 'GET',
        headers: {
          'X-Api-Key': jellyseerrApiKey,
          'Content-Type': 'application/json',
        },
      });
    } catch (fetchError) {
      console.error('Fetch error:', fetchError);
      return new Response(
        JSON.stringify({ 
          error: 'Kunne ikke koble til Jellyseerr. Dette kan skyldes et ugyldig SSL-sertifikat. Vennligst bruk lokal IP-adresse (f.eks. http://192.168.x.x:5055) i stedet for domenenavn, eller fiks SSL-sertifikatet.',
          details: fetchError instanceof Error ? fetchError.message : 'Ukjent tilkoblingsfeil'
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Jellyseerr search error:', response.status, errorText);
      return new Response(
        JSON.stringify({ 
          error: 'Søket feilet',
          details: errorText 
        }),
        { 
          status: response.status, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const data = await response.json();
    console.log('Search results count:', data.results?.length || 0);

    return new Response(
      JSON.stringify(data),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error in jellyseerr-search:', error);
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
