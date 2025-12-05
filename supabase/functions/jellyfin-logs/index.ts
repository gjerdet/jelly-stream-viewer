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
    console.log('Fetching Jellyfin activity logs');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get Jellyfin settings
    const { data: settings } = await supabase
      .from('server_settings')
      .select('setting_key, setting_value')
      .in('setting_key', ['jellyfin_server_url', 'jellyfin_api_key']);

    const serverUrl = settings?.find(s => s.setting_key === 'jellyfin_server_url')?.setting_value;
    const apiKey = settings?.find(s => s.setting_key === 'jellyfin_api_key')?.setting_value;

    if (!serverUrl || !apiKey) {
      return new Response(
        JSON.stringify({ 
          error: 'Jellyfin er ikke konfigurert',
          logs: []
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    let normalizedUrl = serverUrl;
    if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
      normalizedUrl = `http://${normalizedUrl}`;
    }
    normalizedUrl = normalizedUrl.replace(/\/$/, '');

    // Fetch activity logs from Jellyfin
    const logsResponse = await fetch(
      `${normalizedUrl}/System/ActivityLog/Entries?startIndex=0&limit=100`,
      {
        headers: {
          'X-Emby-Token': apiKey,
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(10000),
      }
    );

    if (!logsResponse.ok) {
      console.error('Jellyfin logs error:', logsResponse.status);
      return new Response(
        JSON.stringify({ 
          error: `Jellyfin returnerte status ${logsResponse.status}`,
          logs: []
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const logsData = await logsResponse.json();
    
    // Transform logs to our format
    const logs = (logsData.Items || []).map((item: any) => ({
      timestamp: new Date(item.Date).getTime() * 1000, // Convert to microseconds
      level: item.Severity?.toLowerCase() || 'info',
      message: item.Name || item.ShortOverview || 'Ukjent hendelse',
      type: item.Type,
      userId: item.UserId,
      itemId: item.ItemId,
    }));

    console.log(`Fetched ${logs.length} Jellyfin activity logs`);

    return new Response(
      JSON.stringify({ logs }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error fetching Jellyfin logs:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Ukjent feil',
        logs: []
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
