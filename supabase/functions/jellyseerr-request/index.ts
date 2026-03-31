import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.74.0';
import { z } from 'https://deno.land/x/zod@v3.21.4/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authentication check
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const authClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(authHeader.replace('Bearer ', ''));
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const rawBody = await req.json();
    const validationResult = RequestSchema.safeParse(rawBody);
    if (!validationResult.success) {
      return new Response(
        JSON.stringify({ error: 'Ugyldig forespørsel', details: validationResult.error.errors.map(e => e.message).join(', ') }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { mediaType, mediaId, seasons } = validationResult.data;
    console.log('Jellyseerr request:', { mediaType, mediaId, seasons });

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const { data: urlData } = await supabase.from('server_settings').select('setting_value').eq('setting_key', 'jellyseerr_url').maybeSingle();
    const { data: apiKeyData } = await supabase.from('server_settings').select('setting_value').eq('setting_key', 'jellyseerr_api_key').maybeSingle();

    const jellyseerrUrl = urlData?.setting_value?.replace(/\/$/, '');
    const jellyseerrApiKey = apiKeyData?.setting_value;

    if (!jellyseerrUrl || !jellyseerrApiKey) {
      return new Response(JSON.stringify({ error: 'Tjenesten er midlertidig utilgjengelig' }), { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const payload: any = { mediaType, mediaId };
    if (mediaType === 'tv') {
      payload.seasons = seasons || 'all';
    }

    let response;
    try {
      response = await fetch(`${jellyseerrUrl}/api/v1/request`, {
        method: 'POST',
        headers: { 'X-Api-Key': jellyseerrApiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch (fetchError) {
      console.error('Fetch error:', fetchError);
      return new Response(JSON.stringify({ error: 'Kunne ikke fullføre forespørselen' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const responseData = await response.json();
    if (!response.ok) {
      return new Response(JSON.stringify({ error: 'Kunne ikke fullføre forespørselen' }), { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ success: true, data: responseData, message: 'Forespørsel sendt til Jellyseerr!' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('Error in jellyseerr-request:', error);
    return new Response(JSON.stringify({ error: 'Det oppsto en feil' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
