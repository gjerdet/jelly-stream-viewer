import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.47.10';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    // Get Jellyfin settings
    const { data: serverUrlData } = await supabaseClient
      .from('server_settings')
      .select('setting_value')
      .eq('setting_key', 'jellyfin_server_url')
      .single();

    const { data: apiKeyData } = await supabaseClient
      .from('server_settings')
      .select('setting_value')
      .eq('setting_key', 'jellyfin_api_key')
      .single();

    if (!serverUrlData || !apiKeyData) {
      throw new Error('Jellyfin innstillinger ikke funnet');
    }

    const serverUrl = serverUrlData.setting_value.replace(/\/$/, '');
    const apiKey = apiKeyData.setting_value;

    // Fetch users from Jellyfin
    const response = await fetch(`${serverUrl}/Users`, {
      headers: {
        'X-Emby-Token': apiKey,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Jellyfin API feil: ${response.status}`);
    }

    const users = await response.json();

    // Get our profiles to match with Jellyfin users
    const { data: profiles } = await supabaseClient
      .from('profiles')
      .select('jellyfin_user_id, id');

    // Get user roles
    const { data: userRoles } = await supabaseClient
      .from('user_roles')
      .select('user_id, role');

    const profileMap = new Map(profiles?.map(p => [p.jellyfin_user_id, { id: p.id }]) || []);
    const rolesMap = new Map();
    
    userRoles?.forEach(ur => {
      if (!rolesMap.has(ur.user_id)) {
        rolesMap.set(ur.user_id, []);
      }
      rolesMap.get(ur.user_id).push(ur.role);
    });

    // Map Jellyfin users to our format
    const mappedUsers = users.map((user: any) => {
      const profile = profileMap.get(user.Id);
      const profileId = profile?.id;
      
      return {
        id: user.Id,
        profile_id: profileId,
        name: user.Name,
        last_activity: user.LastActivityDate,
        last_login: user.LastLoginDate,
        is_administrator: user.Policy?.IsAdministrator || false,
        is_disabled: user.Policy?.IsDisabled || false,
        roles: profileId ? rolesMap.get(profileId) || [] : [],
      };
    });

    return new Response(JSON.stringify(mappedUsers), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error fetching Jellyfin users:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
