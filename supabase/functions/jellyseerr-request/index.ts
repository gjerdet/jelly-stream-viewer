import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.74.0';
import { z } from 'https://deno.land/x/zod@v3.21.4/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Input validation schema
const RequestSchema = z.object({
  mediaType: z.enum(['movie', 'tv'], {
    errorMap: () => ({ message: "mediaType must be 'movie' or 'tv'" })
  }),
  mediaId: z.number().int().positive({
    message: "mediaId must be a positive integer"
  }),
  seasons: z.union([
    z.array(z.number().int().positive()),
    z.literal('all')
  ]).optional()
});

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
    const rawBody = await req.json();
    
    // Validate input
    const validationResult = RequestSchema.safeParse(rawBody);
    if (!validationResult.success) {
      console.error('Validation error:', validationResult.error);
      return new Response(
        JSON.stringify({ 
          error: 'Ugyldig forespørsel',
          details: validationResult.error.errors.map(e => e.message).join(', ')
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const { mediaType, mediaId, seasons }: RequestBody = validationResult.data;
    
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

    // Keep user's protocol choice (HTTP or HTTPS)
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
