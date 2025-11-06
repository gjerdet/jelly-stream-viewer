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
    const { url, apiKey } = await req.json();
    
    if (!url || !apiKey) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'URL og API-nøkkel er påkrevd' 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Normalize URL - force HTTP to avoid SSL issues
    const cleanDomain = url
      .replace(/^https?:\/\//, '')
      .replace(/\/$/, '');
    
    const jellyseerrUrl = `http://${cleanDomain}`;
    const statusUrl = `${jellyseerrUrl}/api/v1/status`;
    
    console.log('Testing Jellyseerr connection:', statusUrl);

    let response;
    try {
      response = await fetch(statusUrl, {
        method: 'GET',
        headers: {
          'X-Api-Key': apiKey,
          'Content-Type': 'application/json',
        },
      });
    } catch (fetchError) {
      console.error('Connection error:', fetchError);
      const errorMessage = fetchError instanceof Error ? fetchError.message : 'Ukjent feil';
      
      let userMessage = 'Kunne ikke nå Jellyseerr-serveren. ';
      
      if (errorMessage.includes('Connection timed out') || errorMessage.includes('tcp connect error')) {
        userMessage += 'Dette kan skyldes at serveren er utilgjengelig fra skyen. Prøv å bruke en offentlig URL eller verifiser at serveren er tilgjengelig.';
      } else if (errorMessage.includes('SSL') || errorMessage.includes('certificate') || errorMessage.includes('NotValidForName')) {
        userMessage += 'SSL-sertifikatfeil oppdaget. Bruk lokal IP-adresse (f.eks. http://192.168.x.x:5055) eller fiks SSL-sertifikatet.';
      } else {
        userMessage += errorMessage;
      }
      
      return new Response(
        JSON.stringify({ 
          success: false,
          error: userMessage,
          details: errorMessage
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Jellyseerr error:', response.status, errorText);
      
      let errorMessage = 'Tilkobling feilet. ';
      if (response.status === 401 || response.status === 403) {
        errorMessage += 'Ugyldig API-nøkkel.';
      } else if (response.status === 404) {
        errorMessage += 'Kunne ikke finne Jellyseerr API. Sjekk URL.';
      } else {
        errorMessage += `HTTP ${response.status}: ${errorText}`;
      }
      
      return new Response(
        JSON.stringify({ 
          success: false,
          error: errorMessage,
          details: errorText
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const data = await response.json();
    console.log('Jellyseerr status:', data);

    return new Response(
      JSON.stringify({ 
        success: true,
        message: `Tilkobling vellykket! Jellyseerr versjon: ${data.version || 'ukjent'}`,
        data: data
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error in jellyseerr-test:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error instanceof Error ? error.message : 'Ukjent feil' 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
