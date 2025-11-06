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
    console.log('Fetching server stats');

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch monitoring URL (can be Netdata, Prometheus, or custom endpoint)
    const { data: urlData } = await supabase
      .from('server_settings')
      .select('setting_value')
      .eq('setting_key', 'monitoring_url')
      .maybeSingle();

    const monitoringUrl = urlData?.setting_value;

    if (!monitoringUrl) {
      console.error('Missing monitoring configuration');
      return new Response(
        JSON.stringify({ 
          error: 'Overvåkning er ikke konfigurert',
          suggestion: 'Konfigurer monitoring_url i Admin for å aktivere server statistikk. Støtter Netdata API.'
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const baseUrl = monitoringUrl.replace(/\/$/, '');

    console.log('Fetching from monitoring URL:', baseUrl);

    // Try to fetch from Netdata API
    // Netdata exposes a JSON API at /api/v1/info and /api/v1/data
    let systemInfo = null;
    let cpuData = null;
    let ramData = null;
    let diskData = null;
    let networkData = null;

    try {
      // Fetch system info
      const infoResponse = await fetch(`${baseUrl}/api/v1/info`);
      if (infoResponse.ok) {
        systemInfo = await infoResponse.json();
      }

      // Fetch CPU usage (last 60 seconds)
      const cpuResponse = await fetch(
        `${baseUrl}/api/v1/data?chart=system.cpu&after=-60&points=60&group=average&format=json&options=seconds`
      );
      if (cpuResponse.ok) {
        cpuData = await cpuResponse.json();
      }

      // Fetch RAM usage
      const ramResponse = await fetch(
        `${baseUrl}/api/v1/data?chart=system.ram&after=-60&points=60&group=average&format=json&options=seconds`
      );
      if (ramResponse.ok) {
        ramData = await ramResponse.json();
      }

      // Fetch disk usage
      const diskResponse = await fetch(
        `${baseUrl}/api/v1/data?chart=disk_space._&after=-60&points=1&group=average&format=json&options=seconds`
      );
      if (diskResponse.ok) {
        diskData = await diskResponse.json();
      }

      // Fetch network usage
      const networkResponse = await fetch(
        `${baseUrl}/api/v1/data?chart=system.net&after=-60&points=60&group=average&format=json&options=seconds`
      );
      if (networkResponse.ok) {
        networkData = await networkResponse.json();
      }

      console.log('Server stats fetched successfully');

      return new Response(
        JSON.stringify({
          systemInfo,
          cpu: cpuData,
          ram: ramData,
          disk: diskData,
          network: networkData,
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );

    } catch (fetchError) {
      console.error('Failed to fetch from monitoring endpoint:', fetchError);
      return new Response(
        JSON.stringify({ 
          error: 'Kunne ikke hente data fra overvåkningsverktøy',
          details: fetchError instanceof Error ? fetchError.message : 'Ukjent feil',
          suggestion: 'Sjekk at monitoring URL er korrekt og at tjenesten kjører (f.eks. Netdata på http://localhost:19999)'
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

  } catch (error) {
    console.error('Error in server-stats:', error);
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
