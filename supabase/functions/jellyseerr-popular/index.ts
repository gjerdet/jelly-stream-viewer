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

    const { type, page = 1 } = await req.json();
    
    if (!type || !['movie', 'tv'].includes(type)) {
      return new Response(JSON.stringify({ error: 'Type must be "movie" or "tv"' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const { data: urlData } = await supabase.from('server_settings').select('setting_value').eq('setting_key', 'jellyseerr_url').maybeSingle();
    const { data: apiKeyData } = await supabase.from('server_settings').select('setting_value').eq('setting_key', 'jellyseerr_api_key').maybeSingle();

    const rawUrl = urlData?.setting_value;
    const jellyseerrApiKey = apiKeyData?.setting_value;

    if (!rawUrl || !jellyseerrApiKey) {
      return new Response(JSON.stringify({ error: 'Service temporarily unavailable' }), { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const jellyseerrUrl = rawUrl.replace(/\/$/, '');
    const trendingUrl = `${jellyseerrUrl}/api/v1/discover/trending?page=${page}&language=no`;

    let response;
    try {
      response = await fetch(trendingUrl, { method: 'GET', headers: { 'X-Api-Key': jellyseerrApiKey, 'Content-Type': 'application/json' } });
    } catch (fetchError) {
      console.error('Fetch error:', fetchError);
      return new Response(JSON.stringify({ error: 'Could not complete request' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Jellyseerr error:', response.status, errorText);
      return new Response(JSON.stringify({ error: 'Could not complete request' }), { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const data = await response.json();
    const filteredResults = data.results?.filter((item: any) => item.mediaType === type) || [];

    return new Response(JSON.stringify({ ...data, results: filteredResults }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('Error in jellyseerr-popular:', error);
    return new Response(JSON.stringify({ error: 'An error occurred' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
