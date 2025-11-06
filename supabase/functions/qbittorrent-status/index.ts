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
    console.log('Fetching qBittorrent status');

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch qBittorrent settings
    const { data: urlData } = await supabase
      .from('server_settings')
      .select('setting_value')
      .eq('setting_key', 'qbittorrent_url')
      .maybeSingle();

    const { data: usernameData } = await supabase
      .from('server_settings')
      .select('setting_value')
      .eq('setting_key', 'qbittorrent_username')
      .maybeSingle();

    const { data: passwordData } = await supabase
      .from('server_settings')
      .select('setting_value')
      .eq('setting_key', 'qbittorrent_password')
      .maybeSingle();

    const qbUrl = urlData?.setting_value;
    const qbUsername = usernameData?.setting_value || 'admin';
    const qbPassword = passwordData?.setting_value;

    if (!qbUrl || !qbPassword) {
      console.error('Missing qBittorrent configuration');
      return new Response(
        JSON.stringify({ error: 'qBittorrent er ikke konfigurert' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const baseUrl = qbUrl.replace(/\/$/, '');

    // Login to qBittorrent
    console.log('Logging in to qBittorrent:', baseUrl);
    const loginResponse = await fetch(`${baseUrl}/api/v2/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `username=${encodeURIComponent(qbUsername)}&password=${encodeURIComponent(qbPassword)}`,
    });

    if (!loginResponse.ok) {
      console.error('qBittorrent login failed:', loginResponse.status);
      return new Response(
        JSON.stringify({ 
          error: 'Kunne ikke logge inn på qBittorrent',
          details: `Status: ${loginResponse.status}`
        }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Get session cookie
    const setCookie = loginResponse.headers.get('set-cookie');
    if (!setCookie) {
      return new Response(
        JSON.stringify({ error: 'Ingen session cookie mottatt' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Fetch torrent list
    console.log('Fetching torrent list');
    const torrentsResponse = await fetch(`${baseUrl}/api/v2/torrents/info`, {
      headers: {
        'Cookie': setCookie,
      },
    });

    if (!torrentsResponse.ok) {
      console.error('Failed to fetch torrents:', torrentsResponse.status);
      return new Response(
        JSON.stringify({ error: 'Kunne ikke hente torrents' }),
        { 
          status: torrentsResponse.status, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const torrents = await torrentsResponse.json();

    // Fetch transfer info (global stats)
    console.log('Fetching transfer info');
    const transferResponse = await fetch(`${baseUrl}/api/v2/transfer/info`, {
      headers: {
        'Cookie': setCookie,
      },
    });

    let transferInfo = null;
    if (transferResponse.ok) {
      transferInfo = await transferResponse.json();
    }

    console.log('qBittorrent data fetched successfully');

    return new Response(
      JSON.stringify({
        torrents,
        transferInfo,
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error in qbittorrent-status:', error);
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
