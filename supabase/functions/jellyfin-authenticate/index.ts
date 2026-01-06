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

    let jellyfinData: any = null;
    let usedApiKeyAuth = false;

    // First, try normal password authentication
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

    if (jellyfinResponse.ok) {
      jellyfinData = await jellyfinResponse.json();
      console.log('Jellyfin authentication successful for user:', jellyfinData.User?.Name);
    } else {
      // Normal auth failed - try API key authentication for new/unactivated users
      console.log('Normal auth failed, trying API key lookup for new users...');
      
      // Fetch all users via admin API
      const usersUrl = `${serverUrl}/Users`;
      console.log('Fetching users from:', usersUrl);
      
      const usersResponse = await fetch(usersUrl, {
        headers: {
          'X-Emby-Token': jellyfinApiKey,
          'Accept': 'application/json',
        },
      });

      console.log('Users API response status:', usersResponse.status);

      if (usersResponse.ok) {
        const allUsers = await usersResponse.json();
        console.log('Found', allUsers.length, 'users in Jellyfin');
        
        const matchedUser = allUsers.find((u: any) => 
          u.Name.toLowerCase() === username.trim().toLowerCase()
        );

        if (matchedUser) {
          console.log('Found matching user:', matchedUser.Name, 'ID:', matchedUser.Id);
          
          // Verify password by attempting to authenticate the user
          // Use admin API to check if credentials are valid
          const authByIdUrl = `${serverUrl}/Users/${matchedUser.Id}/Authenticate`;
          console.log('Authenticating user by ID:', authByIdUrl);
          
          const authByIdResponse = await fetch(authByIdUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Emby-Token': jellyfinApiKey,
              'Accept': 'application/json',
            },
            body: JSON.stringify({
              Pw: password,
            }),
          });

          console.log('Auth by ID response status:', authByIdResponse.status);

          if (authByIdResponse.ok) {
            const authResult = await authByIdResponse.json();
            jellyfinData = {
              AccessToken: authResult.AccessToken || jellyfinApiKey,
              User: matchedUser,
              ServerId: authResult.ServerId || matchedUser.ServerId,
            };
            usedApiKeyAuth = true;
            console.log('API key authentication successful for new user:', matchedUser.Name);
          } else {
            const authError = await authByIdResponse.text();
            console.log('Password verification failed for user:', matchedUser.Name, 'Error:', authError);
          }
        } else {
          console.log('No matching user found for username:', username.trim());
        }
      } else {
        const usersError = await usersResponse.text();
        console.log('Failed to fetch users list:', usersResponse.status, usersError);
      }

      if (!jellyfinData) {
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
    }


    // Create or sign in Supabase user using the deterministic email
    const userEmail = `${jellyfinData.User.Id}@jellyfin.local`;
    const userPassword = `jellyfin_${jellyfinData.User.Id}_${jellyfinApiKey.slice(0, 8)}`;

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    // --- Prevent duplicates: look up by jellyfin_user_id first ---
    const { data: profileByJellyfinId } = await supabaseAdmin
      .from('profiles')
      .select('id, email')
      .eq('jellyfin_user_id', jellyfinData.User.Id)
      .limit(1)
      .maybeSingle();

    let supabaseSession: Awaited<ReturnType<typeof supabaseClient.auth.signInWithPassword>>['data']['session'] = null;

    if (profileByJellyfinId) {
      // User already exists (by Jellyfin user id) – ensure password matches & sign in
      console.log('Found existing profile by jellyfin_user_id:', profileByJellyfinId.id);

      const existingUserEmail = profileByJellyfinId.email;

      // Update password so API key changes don't lock out the user
      const { error: updatePwError } = await supabaseAdmin.auth.admin.updateUserById(
        profileByJellyfinId.id,
        { password: userPassword }
      );
      if (updatePwError) {
        console.error('Failed to update password for existing user:', updatePwError);
      }

      // Sign in using the email from the existing profile
      let signInResult = await supabaseClient.auth.signInWithPassword({
        email: existingUserEmail,
        password: userPassword,
      });

      if (signInResult.error) {
        console.error('Sign in failed for existing user:', signInResult.error.message);
        // One more attempt after short wait (edge case)
        await new Promise((r) => setTimeout(r, 300));
        signInResult = await supabaseClient.auth.signInWithPassword({
          email: existingUserEmail,
          password: userPassword,
        });
      }

      supabaseSession = signInResult.data.session;

      // Ensure profile row has current jellyfin_user_id + jellyfin_username (in case of legacy data)
      if (supabaseSession) {
        await supabaseAdmin
          .from('profiles')
          .update({
            jellyfin_user_id: jellyfinData.User.Id,
            jellyfin_username: jellyfinData.User.Name,
          })
          .eq('id', profileByJellyfinId.id);
      }
    } else {
      // No existing profile for this Jellyfin user – create account
      console.log('No profile found for jellyfin_user_id, creating new user');

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

      if (signUpResult.error) {
        // May already exist by email – try sign in
        console.log('Sign up error, trying sign in:', signUpResult.error.message);
        const signInResult = await supabaseClient.auth.signInWithPassword({
          email: userEmail,
          password: userPassword,
        });
        supabaseSession = signInResult.data.session;

        // Sync profile if sign-in succeeded
        if (signInResult.data.user) {
          await supabaseAdmin
            .from('profiles')
            .update({
              jellyfin_user_id: jellyfinData.User.Id,
              jellyfin_username: jellyfinData.User.Name,
            })
            .eq('id', signInResult.data.user.id);
        }
      } else {
        supabaseSession = signUpResult.data.session;
        console.log('New user created successfully');
        // handle_new_user trigger already inserts profile from user_metadata
      }
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
