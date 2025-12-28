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

    // IMPORTANT: Do NOT send a Token here.
    // This endpoint is used to obtain a user access token; sending an (invalid) token can cause a 401.
    const authHeader = `MediaBrowser Client="kjeller-stream", Device="Web", DeviceId="kjeller-stream-web", Version="1.0.0"`;

    console.log('Full URL:', authUrl);
    console.log('Request user:', username.trim());

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
      const contentType = jellyfinResponse.headers.get('content-type') ?? '';
      const serverHeader = (jellyfinResponse.headers.get('server') ?? '').toLowerCase();
      const hasWwwAuth = !!jellyfinResponse.headers.get('www-authenticate');

      const looksLikeProxyAuth =
        jellyfinResponse.status === 401 &&
        (contentType.includes('text/plain') || serverHeader.includes('openresty') || hasWwwAuth);

      console.error('Jellyfin authentication failed:', {
        status: jellyfinResponse.status,
        statusText: jellyfinResponse.statusText,
        error: errorText,
        username,
        serverUrl,
        apiKeyPrefix: jellyfinApiKey.slice(0, 8),
        looksLikeProxyAuth,
      });

      return new Response(
        JSON.stringify({
          error: looksLikeProxyAuth
            ? 'Jellyfin-proxyen avviser API-innlogging (401). Sjekk reverse proxy/basic auth, eller bruk en URL som gir direkte tilgang til Jellyfin.'
            : 'Ugyldig brukernavn eller passord',
        }),
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
    console.log('Attempting to sign in Supabase user:', userEmail);
    
    // Check if user exists first by trying to sign in
    let signInResult = await supabaseClient.auth.signInWithPassword({
      email: userEmail,
      password: userPassword,
    });

    console.log('Initial sign in result:', { 
      hasSession: !!signInResult.data.session, 
      hasError: !!signInResult.error,
      errorMessage: signInResult.error?.message 
    });

    let supabaseSession = signInResult.data.session;

    // If sign in failed with invalid credentials, the user might exist with old password
    // or doesn't exist at all
    if (signInResult.error) {
      console.log('Sign in failed, checking if user exists...');
      
      // Check if user exists using admin API
      const { data: userData } = await supabaseAdmin.auth.admin.listUsers();
      const existingUser = userData?.users?.find(u => u.email === userEmail);
      
      if (existingUser) {
        // User exists but password is different (API key changed)
        console.log('User exists, updating password...');
        const updateResult = await supabaseAdmin.auth.admin.updateUserById(existingUser.id, {
          password: userPassword,
        });
        
        if (updateResult.error) {
          console.error('Failed to update user password:', updateResult.error);
          return new Response(
            JSON.stringify({ error: 'Failed to update user credentials' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        // Now sign in with the updated password
        console.log('Password updated, signing in...');
        signInResult = await supabaseClient.auth.signInWithPassword({
          email: userEmail,
          password: userPassword,
        });
        
        if (signInResult.data.session) {
          supabaseSession = signInResult.data.session;
          console.log('Successfully signed in after password update');
        } else {
          console.error('Failed to sign in after password update:', signInResult.error);
          return new Response(
            JSON.stringify({ error: 'Failed to create user session' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      } else {
        // User doesn't exist, create them
        console.log('User does not exist, creating new user...');
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

        if (signUpResult.error || !signUpResult.data.session) {
          console.error('Failed to create Supabase user:', signUpResult.error);
          return new Response(
            JSON.stringify({ error: 'Failed to create user session' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        supabaseSession = signUpResult.data.session;
        console.log('New user created successfully');
      }
    } else {
      console.log('Sign in successful');
    }

    if (!supabaseSession) {
      console.error('No Supabase session after authentication flow');
      return new Response(
        JSON.stringify({ error: 'Failed to create user session' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Returning successful authentication response');
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
