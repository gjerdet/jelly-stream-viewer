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
    const { tvId, seasonNumber } = await req.json();
    
    if (!tvId || seasonNumber === undefined) {
      return new Response(
        JSON.stringify({ error: 'TV ID og sesong nummer er påkrevd' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('Fetching season details for TV:', tvId, 'Season:', seasonNumber);

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

    const jellyseerrUrl = rawUrl.replace(/\/$/, '');
    const seasonDetailsUrl = `${jellyseerrUrl}/api/v1/tv/${tvId}/season/${seasonNumber}?language=no`;
    
    console.log('Fetching from Jellyseerr:', seasonDetailsUrl);

    let response;
    try {
      response = await fetch(seasonDetailsUrl, {
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
    console.log('Season details fetched:', data.name, 'with', data.episodes?.length || 0, 'episodes');

    return new Response(
      JSON.stringify(data),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error in jellyseerr-season-details:', error);
    return new Response(
      JSON.stringify({ error: 'Det oppsto en feil' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
