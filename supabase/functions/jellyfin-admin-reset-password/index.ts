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
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Mangler autorisasjon' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client with user's JWT
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    // Verify user is authenticated
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Ikke autentisert' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user is admin using service role
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: roleData } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (roleData?.role !== 'admin') {
      return new Response(
        JSON.stringify({ error: 'Kun administratorer kan resette passord' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { jellyfinUserId, newPassword } = await req.json();

    if (!jellyfinUserId || !newPassword) {
      return new Response(
        JSON.stringify({ error: 'Jellyfin bruker-ID og nytt passord er påkrevd' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch Jellyfin server settings
    const { data: serverUrlData } = await supabaseAdmin
      .from('server_settings')
      .select('setting_value')
      .eq('setting_key', 'jellyfin_server_url')
      .single();

    const { data: apiKeyData } = await supabaseAdmin
      .from('server_settings')
      .select('setting_value')
      .eq('setting_key', 'jellyfin_api_key')
      .single();

    if (!serverUrlData || !apiKeyData) {
      return new Response(
        JSON.stringify({ error: 'Serverinnstillinger mangler' }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const serverUrl = serverUrlData.setting_value.replace(/\/$/, '');
    const apiKey = apiKeyData.setting_value;

    console.log('Admin resetting password for Jellyfin user:', jellyfinUserId);

    // Use Jellyfin admin API to reset password (doesn't require current password)
    const passwordUrl = `${serverUrl}/Users/${jellyfinUserId}/Password`;
    
    const jellyfinResponse = await fetch(passwordUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Emby-Token': apiKey,
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        CurrentPw: '',
        NewPw: newPassword,
        ResetPassword: true,
      }),
    });

    console.log('Jellyfin admin password reset response:', jellyfinResponse.status);

    if (!jellyfinResponse.ok) {
      const errorText = await jellyfinResponse.text();
      console.error('Jellyfin admin password reset failed:', {
        status: jellyfinResponse.status,
        error: errorText,
      });

      return new Response(
        JSON.stringify({ error: 'Kunne ikke resette passord i Jellyfin' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Password reset successfully for user:', jellyfinUserId);

    return new Response(
      JSON.stringify({ success: true, message: 'Passord resatt' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in jellyfin-admin-reset-password:', error);
    return new Response(
      JSON.stringify({ error: 'Intern serverfeil' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
