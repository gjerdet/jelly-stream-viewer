import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { currentPassword, newPassword, jellyfinUserId, jellyfinToken } = await req.json();

    if (!newPassword) {
      return new Response(
        JSON.stringify({ error: 'Nytt passord er påkrevd' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!jellyfinUserId || !jellyfinToken) {
      return new Response(
        JSON.stringify({ error: 'Jellyfin-sesjon mangler. Logg inn på nytt.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client with service role to fetch settings
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Fetch Jellyfin server settings
    const { data: serverUrlData, error: serverUrlError } = await supabaseAdmin
      .from('server_settings')
      .select('setting_value')
      .eq('setting_key', 'jellyfin_server_url')
      .single();

    if (serverUrlError || !serverUrlData) {
      console.error('Failed to fetch server URL:', serverUrlError);
      return new Response(
        JSON.stringify({ error: 'Kunne ikke hente serverinnstillinger' }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const serverUrl = serverUrlData.setting_value.replace(/\/$/, '');
    
    console.log('Changing password for Jellyfin user:', jellyfinUserId);

    // Call Jellyfin API to change password
    const passwordUrl = `${serverUrl}/Users/${jellyfinUserId}/Password`;
    
    const jellyfinResponse = await fetch(passwordUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Emby-Token': jellyfinToken,
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        CurrentPw: currentPassword || '',
        NewPw: newPassword,
      }),
    });

    console.log('Jellyfin password change response:', jellyfinResponse.status);

    if (!jellyfinResponse.ok) {
      const errorText = await jellyfinResponse.text();
      console.error('Jellyfin password change failed:', {
        status: jellyfinResponse.status,
        error: errorText,
      });

      if (jellyfinResponse.status === 401 || jellyfinResponse.status === 403) {
        return new Response(
          JSON.stringify({ error: 'Feil nåværende passord eller manglende tilgang' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ error: 'Kunne ikke endre passord i Jellyfin' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Password changed successfully for user:', jellyfinUserId);

    return new Response(
      JSON.stringify({ success: true, message: 'Passord oppdatert' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in jellyfin-change-password:', error);
    return new Response(
      JSON.stringify({ error: 'Intern serverfeil' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
