import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
      console.log('Missing authorization header');
      return new Response(
        JSON.stringify({ error: 'Mangler autorisasjon' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body first
    const requestBody = await req.json();
    const { jellyfinUserId, newPassword } = requestBody;

    console.log('Received reset password request for jellyfinUserId:', jellyfinUserId);

    if (!jellyfinUserId || !newPassword) {
      console.log('Missing required fields');
      return new Response(
        JSON.stringify({ error: 'Jellyfin bruker-ID og nytt passord er påkrevd' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate the caller's JWT using anon key + Authorization header (most reliable in edge runtime)
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error('Missing backend configuration for jellyfin-admin-reset-password');
      return new Response(
        JSON.stringify({ error: 'Service configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const authHeaderRaw = req.headers.get('authorization') ?? '';
    const tokenMatch = authHeaderRaw.match(/^bearer\s+(.+)$/i);
    const accessToken = tokenMatch?.[1]?.trim();

    if (!accessToken) {
      console.log('Missing or malformed authorization header');
      return new Response(
        JSON.stringify({ error: 'Mangler autorisasjon' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseAuth = createClient(
      SUPABASE_URL,
      SUPABASE_ANON_KEY,
      {
        global: { headers: { Authorization: `Bearer ${accessToken}` } },
        auth: { persistSession: false, autoRefreshToken: false },
      }
    );

    const {
      data: { user },
      error: userError,
    } = await supabaseAuth.auth.getUser();

    if (userError || !user) {
      console.log('User authentication failed:', userError);
      return new Response(
        JSON.stringify({ error: 'Ikke autentisert' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Service-role client for admin-only operations (role check + server settings)
    const supabaseAdmin = createClient(
      SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );

    console.log('Authenticated user:', user.id);

    // Check if user is admin
    const { data: roleData, error: roleError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    console.log('User role:', roleData?.role, 'Error:', roleError);

    if (roleData?.role !== 'admin') {
      console.log('User is not admin');
      return new Response(
        JSON.stringify({ error: 'Kun administratorer kan resette passord' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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

    // Get user state before reset
    const userBeforeUrl = `${serverUrl}/Users/${jellyfinUserId}`;
    const userBeforeResponse = await fetch(userBeforeUrl, {
      method: 'GET',
      headers: {
        'X-Emby-Token': apiKey,
        'Accept': 'application/json',
      },
    });

    let userBefore = null;
    if (userBeforeResponse.ok) {
      userBefore = await userBeforeResponse.json();
      console.log('User state before reset:', {
        HasPassword: userBefore.HasPassword,
        HasConfiguredPassword: userBefore.HasConfiguredPassword,
      });
    }

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
        CurrentPwd: '',
        NewPw: newPassword,
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

    // Verify the password was actually set by fetching user state after reset
    const userAfterResponse = await fetch(userBeforeUrl, {
      method: 'GET',
      headers: {
        'X-Emby-Token': apiKey,
        'Accept': 'application/json',
      },
    });

    if (!userAfterResponse.ok) {
      console.error('Could not verify password reset, fetch failed');
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Kunne ikke verifisere at passordet ble satt',
          warning: 'Reset ble sendt, men verifisering feilet'
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userAfter = await userAfterResponse.json();
    console.log('User state after reset:', {
      HasPassword: userAfter.HasPassword,
      HasConfiguredPassword: userAfter.HasConfiguredPassword,
    });

    // Check if password was actually set
    if (!userAfter.HasPassword && !userAfter.HasConfiguredPassword) {
      console.error('Password reset failed: HasPassword is still false after reset');
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Passordet ble ikkje satt. Jellyfin godtok ikkje det nye passordet.',
          hasPasswordBefore: userBefore?.HasPassword ?? null,
          hasPasswordAfter: userAfter.HasPassword,
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Password reset successfully verified for user:', jellyfinUserId);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Passord resatt',
        hasPasswordBefore: userBefore?.HasPassword ?? null,
        hasPasswordAfter: userAfter.HasPassword,
        hasConfiguredPasswordBefore: userBefore?.HasConfiguredPassword ?? null,
        hasConfiguredPasswordAfter: userAfter.HasConfiguredPassword,
      }),
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
