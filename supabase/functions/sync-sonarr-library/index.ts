import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SonarrSeries {
  id: number;
  tvdbId: number;
  title: string;
  year: number;
  monitored: boolean;
  status: string;
  added: string;
  statistics?: {
    episodeCount: number;
    episodeFileCount: number;
    sizeOnDisk: number;
  };
  qualityProfileId: number;
}

interface QualityProfile {
  id: number;
  name: string;
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

    // Fetch Sonarr settings
    const { data: sonarrUrlData } = await supabaseAdmin
      .from('server_settings')
      .select('setting_value')
      .eq('setting_key', 'sonarr_url')
      .single();

    const { data: sonarrApiKeyData } = await supabaseAdmin
      .from('server_settings')
      .select('setting_value')
      .eq('setting_key', 'sonarr_api_key')
      .single();

    if (!sonarrUrlData || !sonarrApiKeyData) {
      return new Response(
        JSON.stringify({ error: 'Sonarr not configured' }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const sonarrUrl = sonarrUrlData.setting_value.replace(/\/$/, '');
    const apiKey = sonarrApiKeyData.setting_value;

    console.log('Fetching series from Sonarr...');

    // Fetch quality profiles first
    const profilesResponse = await fetch(`${sonarrUrl}/api/v3/qualityprofile`, {
      headers: { 'X-Api-Key': apiKey },
    });
    
    const qualityProfiles: QualityProfile[] = profilesResponse.ok 
      ? await profilesResponse.json() 
      : [];
    
    const profileMap = new Map(qualityProfiles.map(p => [p.id, p.name]));

    // Fetch all series
    const seriesResponse = await fetch(`${sonarrUrl}/api/v3/series`, {
      headers: { 'X-Api-Key': apiKey },
    });

    if (!seriesResponse.ok) {
      console.error('Failed to fetch Sonarr series:', seriesResponse.status);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch Sonarr series' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const series: SonarrSeries[] = await seriesResponse.json();
    console.log(`Found ${series.length} series in Sonarr`);

    // Upsert series to database
    let upsertedCount = 0;
    const batchSize = 100;
    
    for (let i = 0; i < series.length; i += batchSize) {
      const batch = series.slice(i, i + batchSize);
      const records = batch.map(s => ({
        sonarr_id: s.id,
        tvdb_id: s.tvdbId,
        title: s.title,
        year: s.year,
        quality_profile: profileMap.get(s.qualityProfileId) || null,
        status: s.status,
        monitored: s.monitored,
        episode_count: s.statistics?.episodeCount || 0,
        episode_file_count: s.statistics?.episodeFileCount || 0,
        size_on_disk_bytes: s.statistics?.sizeOnDisk || 0,
        added_at: s.added,
        synced_at: new Date().toISOString(),
      }));

      const { error } = await supabaseAdmin
        .from('sonarr_series')
        .upsert(records, { onConflict: 'sonarr_id' });

      if (error) {
        console.error('Error upserting batch:', error);
      } else {
        upsertedCount += batch.length;
      }
    }

    // Remove series no longer in Sonarr
    const sonarrIds = series.map(s => s.id);
    const { data: existingSeries } = await supabaseAdmin
      .from('sonarr_series')
      .select('sonarr_id');
    
    const existingIds = (existingSeries || []).map(s => s.sonarr_id);
    const removedIds = existingIds.filter(id => !sonarrIds.includes(id));
    
    if (removedIds.length > 0) {
      await supabaseAdmin
        .from('sonarr_series')
        .delete()
        .in('sonarr_id', removedIds);
    }

    // Calculate stats
    const totalEpisodes = series.reduce((sum, s) => sum + (s.statistics?.episodeCount || 0), 0);
    const downloadedEpisodes = series.reduce((sum, s) => sum + (s.statistics?.episodeFileCount || 0), 0);

    // Update sync schedule status
    await supabaseAdmin
      .from('sync_schedule')
      .update({
        last_run_at: new Date().toISOString(),
        last_run_status: 'completed',
        last_run_details: {
          total_series: series.length,
          total_episodes: totalEpisodes,
          downloaded_episodes: downloadedEpisodes,
          missing_episodes: totalEpisodes - downloadedEpisodes,
          monitored: series.filter(s => s.monitored).length,
          removed: removedIds.length,
        },
      })
      .eq('sync_type', 'sonarr_library');

    console.log(`Sonarr sync complete: ${upsertedCount} series synced, ${removedIds.length} removed`);

    return new Response(
      JSON.stringify({
        success: true,
        total_series: series.length,
        total_episodes: totalEpisodes,
        downloaded_episodes: downloadedEpisodes,
        synced: upsertedCount,
        removed: removedIds.length,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error syncing Sonarr library:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
