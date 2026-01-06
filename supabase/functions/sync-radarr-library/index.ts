import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RadarrMovie {
  id: number;
  tmdbId: number;
  title: string;
  year: number;
  hasFile: boolean;
  monitored: boolean;
  status: string;
  added: string;
  movieFile?: {
    path: string;
    size: number;
    mediaInfo?: {
      videoCodec: string;
      audioCodec: string;
      resolution: string;
    };
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

    // Fetch Radarr settings
    const { data: radarrUrlData } = await supabaseAdmin
      .from('server_settings')
      .select('setting_value')
      .eq('setting_key', 'radarr_url')
      .single();

    const { data: radarrApiKeyData } = await supabaseAdmin
      .from('server_settings')
      .select('setting_value')
      .eq('setting_key', 'radarr_api_key')
      .single();

    if (!radarrUrlData || !radarrApiKeyData) {
      return new Response(
        JSON.stringify({ error: 'Radarr not configured' }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const radarrUrl = radarrUrlData.setting_value.replace(/\/$/, '');
    const apiKey = radarrApiKeyData.setting_value;

    console.log('Fetching movies from Radarr...');

    // Fetch quality profiles first
    const profilesResponse = await fetch(`${radarrUrl}/api/v3/qualityprofile`, {
      headers: { 'X-Api-Key': apiKey },
    });
    
    const qualityProfiles: QualityProfile[] = profilesResponse.ok 
      ? await profilesResponse.json() 
      : [];
    
    const profileMap = new Map(qualityProfiles.map(p => [p.id, p.name]));

    // Fetch all movies
    const moviesResponse = await fetch(`${radarrUrl}/api/v3/movie`, {
      headers: { 'X-Api-Key': apiKey },
    });

    if (!moviesResponse.ok) {
      console.error('Failed to fetch Radarr movies:', moviesResponse.status);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch Radarr movies' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const movies: RadarrMovie[] = await moviesResponse.json();
    console.log(`Found ${movies.length} movies in Radarr`);

    // Upsert movies to database
    let upsertedCount = 0;
    const batchSize = 100;
    
    for (let i = 0; i < movies.length; i += batchSize) {
      const batch = movies.slice(i, i + batchSize);
      const records = batch.map(movie => ({
        radarr_id: movie.id,
        tmdb_id: movie.tmdbId,
        title: movie.title,
        year: movie.year,
        quality_profile: profileMap.get(movie.qualityProfileId) || null,
        has_file: movie.hasFile,
        file_path: movie.movieFile?.path || null,
        file_size_bytes: movie.movieFile?.size || null,
        video_codec: movie.movieFile?.mediaInfo?.videoCodec || null,
        audio_codec: movie.movieFile?.mediaInfo?.audioCodec || null,
        resolution: movie.movieFile?.mediaInfo?.resolution || null,
        status: movie.status,
        monitored: movie.monitored,
        added_at: movie.added,
        synced_at: new Date().toISOString(),
      }));

      const { error } = await supabaseAdmin
        .from('radarr_movies')
        .upsert(records, { onConflict: 'radarr_id' });

      if (error) {
        console.error('Error upserting batch:', error);
      } else {
        upsertedCount += batch.length;
      }
    }

    // Remove movies no longer in Radarr
    const radarrIds = movies.map(m => m.id);
    const { data: existingMovies } = await supabaseAdmin
      .from('radarr_movies')
      .select('radarr_id');
    
    const existingIds = (existingMovies || []).map(m => m.radarr_id);
    const removedIds = existingIds.filter(id => !radarrIds.includes(id));
    
    if (removedIds.length > 0) {
      await supabaseAdmin
        .from('radarr_movies')
        .delete()
        .in('radarr_id', removedIds);
    }

    // Calculate stats
    const withFiles = movies.filter(m => m.hasFile).length;
    const needsUpgrade = movies.filter(m => m.hasFile && m.status === 'released' && m.monitored).length;

    // Update sync schedule status
    await supabaseAdmin
      .from('sync_schedule')
      .update({
        last_run_at: new Date().toISOString(),
        last_run_status: 'completed',
        last_run_details: {
          total_movies: movies.length,
          with_files: withFiles,
          without_files: movies.length - withFiles,
          monitored: movies.filter(m => m.monitored).length,
          removed: removedIds.length,
        },
      })
      .eq('sync_type', 'radarr_library');

    console.log(`Radarr sync complete: ${upsertedCount} movies synced, ${removedIds.length} removed`);

    return new Response(
      JSON.stringify({
        success: true,
        total_movies: movies.length,
        with_files: withFiles,
        without_files: movies.length - withFiles,
        synced: upsertedCount,
        removed: removedIds.length,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error syncing Radarr library:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
