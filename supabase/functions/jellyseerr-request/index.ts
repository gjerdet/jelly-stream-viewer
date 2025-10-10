import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.74.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RequestBody {
  mediaType: 'movie' | 'tv';
  mediaId: number;
  seasons?: number[] | 'all';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { mediaType, mediaId, seasons }: RequestBody = await req.json();
    
    console.log('Jellyseerr request:', { mediaType, mediaId, seasons });

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch Jellyseerr settings from database
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

    const jellyseerrUrl = urlData?.setting_value?.replace(/\/$/, ''); // Remove trailing slash
    const jellyseerrApiKey = apiKeyData?.setting_value;

    if (!jellyseerrUrl || !jellyseerrApiKey) {
      console.error('Missing Jellyseerr configuration');
      return new Response(
        JSON.stringify({ error: 'Jellyseerr er ikke konfigurert. Gå til Admin for å sette opp.' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Build request payload
    const payload: any = {
      mediaType,
      mediaId,
    };

    // Add seasons for TV shows
    if (mediaType === 'tv') {
      payload.seasons = seasons || 'all';
    }

    console.log('Sending request to Jellyseerr:', payload);

    // Send request to Jellyseerr
    let response;
    try {
      response = await fetch(`${jellyseerrUrl}/api/v1/request`, {
        method: 'POST',
        headers: {
          'X-Api-Key': jellyseerrApiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
    } catch (fetchError: any) {
      // If SSL error, try with http instead of https as fallback
      if (fetchError.message?.includes('certificate') || fetchError.message?.includes('TLS')) {
        console.log('SSL error detected, retrying with HTTP...');
        const httpUrl = jellyseerrUrl.replace('https://', 'http://');
        
        response = await fetch(`${httpUrl}/api/v1/request`, {
          method: 'POST',
          headers: {
            'X-Api-Key': jellyseerrApiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });
      } else {
        throw fetchError;
      }
    }

    const responseData = await response.json();
    console.log('Jellyseerr response:', responseData);

    if (!response.ok) {
      console.error('Jellyseerr error:', response.status, responseData);
      return new Response(
        JSON.stringify({ 
          error: responseData.message || 'Kunne ikke sende forespørsel til Jellyseerr',
          details: responseData 
        }),
        { 
          status: response.status, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        data: responseData,
        message: 'Forespørsel sendt til Jellyseerr!' 
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error in jellyseerr-request:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Ukjent feil oppstod' 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
