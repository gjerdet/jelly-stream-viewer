import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.74.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface JellyfinPlaybackItem {
  Id: string;
  Name: string;
  Type: string;
  RunTimeTicks?: number;
  SeriesId?: string;
  SeriesName?: string;
  SeasonId?: string;
  UserData?: {
    LastPlayedDate?: string;
    PlaybackPositionTicks?: number;
  };
  ImageTags?: {
    Primary?: string;
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get Jellyfin settings
    const { data: settings, error: settingsError } = await supabaseClient
      .from('server_settings')
      .select('setting_key, setting_value')
      .in('setting_key', ['jellyfin_server_url', 'jellyfin_api_key']);

    if (settingsError) throw settingsError;

    const serverUrl = settings?.find(s => s.setting_key === 'jellyfin_server_url')?.setting_value;
    const apiKey = settings?.find(s => s.setting_key === 'jellyfin_api_key')?.setting_value;

    if (!serverUrl || !apiKey) {
      throw new Error('Jellyfin settings not configured');
    }

    const cleanServerUrl = serverUrl.replace(/\/$/, '');

    // Get all users from profiles
    const { data: profiles, error: profilesError } = await supabaseClient
      .from('profiles')
      .select('id, jellyfin_user_id');

    if (profilesError) throw profilesError;

    let totalSynced = 0;

    // Sync watch history for each user
    for (const profile of profiles || []) {
      if (!profile.jellyfin_user_id) continue;

      // Get user's recently played items from Jellyfin
      const jellyfinResponse = await fetch(
        `${cleanServerUrl}/Users/${profile.jellyfin_user_id}/Items?Recursive=true&IncludeItemTypes=Movie,Episode&Filters=IsPlayed&Limit=200&Fields=BasicSyncInfo,UserData`,
        {
          headers: {
            'X-Emby-Token': apiKey,
          },
        }
      );

      if (!jellyfinResponse.ok) {
        console.error(`Failed to fetch history for user ${profile.id}`);
        continue;
      }

      const jellyfinData = await jellyfinResponse.json();
      const items: JellyfinPlaybackItem[] = jellyfinData.Items || [];

      // Prepare data for upsert
      const watchHistoryData = items
        .filter(item => item.UserData?.LastPlayedDate)
        .map(item => {
          const imageUrl = item.ImageTags?.Primary
            ? `${cleanServerUrl}/Items/${item.Id}/Images/Primary?maxHeight=600`
            : null;

          return {
            user_id: profile.id,
            jellyfin_item_id: item.Id,
            jellyfin_item_name: item.Name,
            jellyfin_item_type: item.Type,
            jellyfin_series_id: item.SeriesId || null,
            jellyfin_series_name: item.SeriesName || null,
            jellyfin_season_id: item.SeasonId || null,
            image_url: imageUrl,
            runtime_ticks: item.RunTimeTicks || null,
            last_position_ticks: item.UserData?.PlaybackPositionTicks || 0,
            watched_at: item.UserData?.LastPlayedDate || new Date().toISOString(),
          };
        });

      if (watchHistoryData.length > 0) {
        // Upsert watch history
        const { error: upsertError } = await supabaseClient
          .from('watch_history')
          .upsert(watchHistoryData, {
            onConflict: 'jellyfin_item_id,user_id',
            ignoreDuplicates: false
          });

        if (upsertError) {
          console.error(`Error upserting history for user ${profile.id}:`, upsertError);
        } else {
          totalSynced += watchHistoryData.length;
          console.log(`Synced ${watchHistoryData.length} items for user ${profile.id}`);
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Synced ${totalSynced} watch history items`,
        totalSynced,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error syncing Jellyfin history:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
