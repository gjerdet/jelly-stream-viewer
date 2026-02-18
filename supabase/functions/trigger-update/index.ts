import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.74.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function generateSignature(payload: string, secret: string): Promise<string> {
  try {
    if (typeof crypto === 'undefined' || !crypto.subtle) {
      console.log('crypto.subtle not available, skipping signature');
      return '';
    }
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw', encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
    );
    const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
    return Array.from(new Uint8Array(signature)).map(b => b.toString(16).padStart(2, '0')).join('');
  } catch (err) {
    console.error('Failed to generate signature:', err);
    return '';
  }
}

// Fetch with timeout
async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs = 15000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    return response;
  } finally {
    clearTimeout(timer);
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Triggering git pull update');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get git pull server settings from database
    const { data: gitPullSettings } = await supabase
      .from('server_settings')
      .select('setting_key, setting_value')
      .in('setting_key', [
        'update_webhook_url', 'update_webhook_secret',
        'git_pull_server_url', 'git_pull_secret',
      ]);

    const settingsMap = new Map<string, string>(
      (gitPullSettings || []).map((row: any) => [row.setting_key, row.setting_value]),
    );

    const primaryUrl = settingsMap.get('update_webhook_url') || settingsMap.get('git_pull_server_url');
    const primarySecret = settingsMap.get('update_webhook_secret') || settingsMap.get('git_pull_secret');

    const gitPullUrl = primaryUrl || 'http://localhost:3002/git-pull';
    const envSecret = Deno.env.get('UPDATE_SECRET') || '';
    const cleanSecret = (envSecret || primarySecret || '').trim();

    // Validate URL before attempting connection
    if (!primaryUrl || primaryUrl.includes('192.168.') || primaryUrl.includes('10.0.') || primaryUrl.includes('172.16.') || primaryUrl.startsWith('http://localhost')) {
      console.error(`Invalid webhook URL: ${gitPullUrl} — private/local addresses cannot be reached from cloud`);
      return new Response(
        JSON.stringify({
          error: 'Git pull server URL er ikkje tilgjengeleg frå skyen',
          details: `Konfigurert URL "${gitPullUrl}" er ei lokal/privat adresse. Edge functions køyrer i skyen og kan ikkje nå lokale IP-ar. Konfigurer ein offentleg URL (t.d. via Cloudflare Tunnel eller reverse proxy) under Servere → Git Pull Server URL.`,
          needsPublicUrl: true,
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Git pull URL: ${gitPullUrl}`);

    // Get updateId from request body if provided
    const { updateId: providedUpdateId } = await req.json().catch(() => ({}));

    // Create HMAC signature if secret is provided
    const requestBody = JSON.stringify({ updateId: providedUpdateId || null });
    const signature = cleanSecret ? await generateSignature(requestBody, cleanSecret) : '';

    // Attempt connection with timeout
    let gitPullResponse: Response;
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (cleanSecret && signature) {
        headers['X-Update-Signature'] = signature;
      }

      gitPullResponse = await fetchWithTimeout(gitPullUrl, {
        method: 'POST',
        headers,
        body: requestBody,
      }, 15000);
    } catch (fetchError) {
      const errorMessage = fetchError instanceof Error ? fetchError.message : String(fetchError);
      const isTimeout = errorMessage.includes('abort') || errorMessage.includes('timeout');
      
      console.error('Failed to reach git pull server:', errorMessage);

      return new Response(
        JSON.stringify({
          error: isTimeout
            ? 'Git pull server svara ikkje innan 15 sekund'
            : 'Kunne ikkje nå git pull server',
          details: isTimeout
            ? `Tidsavbrot ved tilkobling til ${gitPullUrl}. Sjekk at serveren køyrer og at URL-en er riktig.`
            : `Feil: ${errorMessage}. Sjekk at git-pull-server.js køyrer og at URL-en (${gitPullUrl}) er tilgjengeleg.`,
          connectionFailed: true,
        }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!gitPullResponse.ok) {
      const errorText = await gitPullResponse.text();
      console.error('Git pull failed:', gitPullResponse.status, errorText);

      return new Response(
        JSON.stringify({
          error: `Git pull feilet med status ${gitPullResponse.status}`,
          details: errorText || 'Ingen detaljar frå serveren',
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Success
    console.log('Git pull triggered successfully');
    const responseData = await gitPullResponse.text().catch(() => '');

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Git pull starta på serveren',
        serverResponse: responseData,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in trigger-update function:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Ukjend feil oppstod',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
