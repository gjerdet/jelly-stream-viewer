import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface JellyfinUser {
  Id: string;
  Name: string;
  HasPassword: boolean;
  HasConfiguredPassword: boolean;
  HasConfiguredEasyPassword: boolean;
  EnableAutoLogin: boolean;
  LastLoginDate?: string;
  LastActivityDate?: string;
  Policy?: {
    IsAdministrator: boolean;
    IsDisabled: boolean;
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Fetch Jellyfin settings
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
        JSON.stringify({ error: 'Jellyfin not configured' }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const serverUrl = serverUrlData.setting_value.replace(/\/$/, '');
    const apiKey = apiKeyData.setting_value;

    console.log('Fetching users from Jellyfin...');

    // Fetch all users from Jellyfin
    const usersResponse = await fetch(`${serverUrl}/Users`, {
      headers: {
        'X-Emby-Token': apiKey,
        'Accept': 'application/json',
      },
    });

    if (!usersResponse.ok) {
      console.error('Failed to fetch Jellyfin users:', usersResponse.status);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch Jellyfin users' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const jellyfinUsers: JellyfinUser[] = await usersResponse.json();
    console.log(`Found ${jellyfinUsers.length} users in Jellyfin`);

    // Get existing profiles
    const { data: existingProfiles } = await supabaseAdmin
      .from('profiles')
      .select('id, jellyfin_user_id, jellyfin_username');

    const existingJellyfinIds = new Set(
      (existingProfiles || [])
        .filter(p => p.jellyfin_user_id)
        .map(p => p.jellyfin_user_id)
    );

    const jellyfinUserIds = new Set(jellyfinUsers.map(u => u.Id));

    // Find new users (in Jellyfin but not in our database)
    const newUsers = jellyfinUsers.filter(u => !existingJellyfinIds.has(u.Id));
    
    // Find deleted users (in our database but not in Jellyfin)
    const deletedProfiles = (existingProfiles || []).filter(
      p => p.jellyfin_user_id && !jellyfinUserIds.has(p.jellyfin_user_id)
    );

    // Update existing profiles with current Jellyfin username
    let updatedCount = 0;
    for (const profile of existingProfiles || []) {
      if (!profile.jellyfin_user_id) continue;
      
      const jellyfinUser = jellyfinUsers.find(u => u.Id === profile.jellyfin_user_id);
      if (jellyfinUser && jellyfinUser.Name !== profile.jellyfin_username) {
        await supabaseAdmin
          .from('profiles')
          .update({ jellyfin_username: jellyfinUser.Name })
          .eq('id', profile.id);
        updatedCount++;
      }
    }

    // Delete orphaned users (profiles with jellyfin_user_id that no longer exist in Jellyfin)
    let deletedCount = 0;
    const deletedUsernames: string[] = [];
    
    for (const profile of deletedProfiles) {
      console.log(`Deleting orphaned user: ${profile.jellyfin_username} (${profile.id})`);
      
      // Delete from auth.users (this will cascade to profiles due to foreign key)
      const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(profile.id);
      
      if (deleteError) {
        console.error(`Failed to delete user ${profile.id}:`, deleteError);
      } else {
        deletedCount++;
        deletedUsernames.push(profile.jellyfin_username || 'Unknown');
      }
    }

    // Update sync schedule status
    await supabaseAdmin
      .from('sync_schedule')
      .update({
        last_run_at: new Date().toISOString(),
        last_run_status: 'completed',
        last_run_details: {
          jellyfin_users: jellyfinUsers.length,
          new_users: newUsers.length,
          deleted_users: deletedCount,
          updated_usernames: updatedCount,
          new_user_names: newUsers.map(u => u.Name),
          deleted_user_names: deletedUsernames,
        },
      })
      .eq('sync_type', 'jellyfin_users');

    console.log(`Sync complete: ${newUsers.length} new, ${deletedCount} deleted, ${updatedCount} updated`);

    return new Response(
      JSON.stringify({
        success: true,
        jellyfin_users: jellyfinUsers.length,
        new_users: newUsers.map(u => ({ id: u.Id, name: u.Name })),
        deleted_users: deletedCount,
        deleted_usernames: deletedUsernames,
        updated_usernames: updatedCount,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error syncing Jellyfin users:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
