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
    const { username, password } = await req.json();

    if (!username || !password) {
      return new Response(
        JSON.stringify({ error: 'Username and password are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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

    const { data: apiKeyData, error: apiKeyError } = await supabaseAdmin
      .from('server_settings')
      .select('setting_value')
      .eq('setting_key', 'jellyfin_api_key')
      .single();

    if (serverUrlError || apiKeyError || !serverUrlData || !apiKeyData) {
      console.error('Failed to fetch server settings:', { serverUrlError, apiKeyError });
      return new Response(
        JSON.stringify({ error: 'Tjenesten er midlertidig utilgjengelig' }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const serverUrl = serverUrlData.setting_value.replace(/\/$/, ''); // Remove trailing slash
    const jellyfinApiKey = apiKeyData.setting_value;
    
    console.log('Authenticating with Jellyfin:', serverUrl);

    // Authenticate with Jellyfin
    const authUrl = `${serverUrl}/Users/AuthenticateByName`;
    const authHeader = `MediaBrowser Client="Jellyfin Web", Device="Lovable", DeviceId="lovable-web", Version="1.0.0", Token="${jellyfinApiKey}"`;
    
    console.log('Auth header:', authHeader);
    console.log('Full URL:', authUrl);
    console.log('Request body:', JSON.stringify({ Username: username.trim(), Pw: '***' }));
    
    const jellyfinResponse = await fetch(authUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Emby-Authorization': authHeader,
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        Username: username.trim(),
        Pw: password,
      }),
    });

    console.log('Response status:', jellyfinResponse.status);
    console.log('Response headers:', Object.fromEntries(jellyfinResponse.headers.entries()));

    if (!jellyfinResponse.ok) {
      const errorText = await jellyfinResponse.text();
      console.error('Jellyfin authentication failed:', jellyfinResponse.status, errorText);
      console.error('Request details:', { authUrl, username });
      return new Response(
        JSON.stringify({ error: 'Ugyldig brukernavn eller passord' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const jellyfinData = await jellyfinResponse.json();
    console.log('Jellyfin authentication successful for user:', jellyfinData.User?.Name);

    // Create or sign in Supabase user
    // We'll use a deterministic email based on Jellyfin user ID
    const userEmail = `${jellyfinData.User.Id}@jellyfin.local`;
    const userPassword = `jellyfin_${jellyfinData.User.Id}_${jellyfinApiKey.slice(0, 8)}`;

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    // Try to sign in first
    const signInResult = await supabaseClient.auth.signInWithPassword({
      email: userEmail,
      password: userPassword,
    });

    let supabaseSession = signInResult.data.session;

    // If user doesn't exist, create them
    if (signInResult.error && signInResult.error.message.includes('Invalid login credentials')) {
      const signUpResult = await supabaseClient.auth.signUp({
        email: userEmail,
        password: userPassword,
        options: {
          data: {
            jellyfin_user_id: jellyfinData.User.Id,
            jellyfin_username: jellyfinData.User.Name,
          },
        },
      });

      // If user already exists with different password, that's okay - they're authenticated via Jellyfin
      if (signUpResult.error && signUpResult.error.message.includes('User already registered')) {
        console.log('User already exists, but Jellyfin auth succeeded. Continuing with Jellyfin session.');
        // Return Jellyfin session only (user can still use the app)
        return new Response(
          JSON.stringify({
            supabase_session: null,
            jellyfin_session: {
              AccessToken: jellyfinData.AccessToken,
              UserId: jellyfinData.User.Id,
              Username: jellyfinData.User.Name,
              ServerId: jellyfinData.ServerId,
            },
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (signUpResult.error || !signUpResult.data.session) {
        console.error('Failed to create Supabase user:', signUpResult.error);
        return new Response(
          JSON.stringify({ error: 'Failed to create user session' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      supabaseSession = signUpResult.data.session;
    } else if (signInResult.error) {
      console.error('Supabase sign in error:', signInResult.error);
      return new Response(
        JSON.stringify({ error: 'Failed to create user session' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Return both Jellyfin and Supabase session data
    return new Response(
      JSON.stringify({
        supabase_session: supabaseSession,
        jellyfin_session: {
          AccessToken: jellyfinData.AccessToken,
          UserId: jellyfinData.User.Id,
          Username: jellyfinData.User.Name,
          ServerId: jellyfinData.ServerId,
        },
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in jellyfin-authenticate:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
