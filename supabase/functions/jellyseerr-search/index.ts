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

    const { query, page = 1 } = await req.json();
    
    if (!query || query.trim().length === 0) {
      return new Response(JSON.stringify({ error: 'Søkeord er påkrevd' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const { data: urlData } = await supabase.from('server_settings').select('setting_value').eq('setting_key', 'jellyseerr_url').maybeSingle();
    const { data: apiKeyData } = await supabase.from('server_settings').select('setting_value').eq('setting_key', 'jellyseerr_api_key').maybeSingle();

    const jellyseerrUrl = urlData?.setting_value?.replace(/\/$/, '');
    const jellyseerrApiKey = apiKeyData?.setting_value;

    if (!jellyseerrUrl || !jellyseerrApiKey) {
      return new Response(JSON.stringify({ error: 'Tjenesten er midlertidig utilgjengelig' }), { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const searchUrl = `${jellyseerrUrl}/api/v1/search?query=${encodeURIComponent(query)}&page=${page}&language=no`;

    let response;
    try {
      response = await fetch(searchUrl, { method: 'GET', headers: { 'X-Api-Key': jellyseerrApiKey, 'Content-Type': 'application/json' } });
    } catch (fetchError) {
      console.error('Fetch error:', fetchError);
      return new Response(JSON.stringify({ error: 'Kunne ikke fullføre forespørselen' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Jellyseerr search error:', response.status, errorText);
      return new Response(JSON.stringify({ error: 'Kunne ikke fullføre forespørselen' }), { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const data = await response.json();
    return new Response(JSON.stringify(data), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('Error in jellyseerr-search:', error);
    return new Response(JSON.stringify({ error: 'Det oppsto en feil' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
