import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Codecs that can be played directly in browsers
const COMPATIBLE_VIDEO_CODECS = ["h264", "vp8", "vp9", "av1"];
const COMPATIBLE_AUDIO_CODECS = ["aac", "mp3", "opus", "vorbis", "flac"];
const COMPATIBLE_CONTAINERS = ["mp4", "webm", "mkv", "mov"];

// Codecs that always need transcoding
const INCOMPATIBLE_VIDEO_CODECS = ["hevc", "h265", "mpeg4", "mpeg2video", "vc1", "wmv3", "msmpeg4v3"];
const INCOMPATIBLE_AUDIO_CODECS = ["dts", "truehd", "eac3", "ac3", "dca"];

interface MediaItem {
  Id: string;
  Name: string;
  Type: string;
  SeriesName?: string;
  SeriesId?: string;
  SeasonId?: string;
  MediaStreams?: Array<{
    Type: string;
    Codec?: string;
    IsDefault?: boolean;
  }>;
  Container?: string;
  ImageTags?: { Primary?: string };
}

function determineCompatibility(item: MediaItem): {
  status: "compatible" | "needs_transcode" | "unknown";
  videoCodec: string | null;
  audioCodec: string | null;
  container: string | null;
  reason: string | null;
} {
  const streams = item.MediaStreams || [];
  const videoStream = streams.find(s => s.Type === "Video");
  const audioStream = streams.find(s => s.Type === "Audio" && s.IsDefault) || streams.find(s => s.Type === "Audio");
  
  const videoCodec = videoStream?.Codec?.toLowerCase() || null;
  const audioCodec = audioStream?.Codec?.toLowerCase() || null;
  const container = item.Container?.toLowerCase() || null;

  // If no streams, can't determine
  if (!videoStream && !audioStream) {
    return { status: "unknown", videoCodec, audioCodec, container, reason: "Ingen mediastrømmer funnet" };
  }

  const reasons: string[] = [];

  // Check video codec
  if (videoCodec) {
    if (INCOMPATIBLE_VIDEO_CODECS.includes(videoCodec)) {
      reasons.push(`Video-kodek (${videoCodec}) trenger transkoding`);
    } else if (!COMPATIBLE_VIDEO_CODECS.includes(videoCodec)) {
      reasons.push(`Ukjent video-kodek (${videoCodec})`);
    }
  }

  // Check audio codec
  if (audioCodec) {
    if (INCOMPATIBLE_AUDIO_CODECS.includes(audioCodec)) {
      reasons.push(`Lyd-kodek (${audioCodec}) trenger transkoding`);
    } else if (!COMPATIBLE_AUDIO_CODECS.includes(audioCodec)) {
      reasons.push(`Ukjent lyd-kodek (${audioCodec})`);
    }
  }

  if (reasons.length > 0) {
    return { 
      status: "needs_transcode", 
      videoCodec, 
      audioCodec, 
      container, 
      reason: reasons.join("; ") 
    };
  }

  return { status: "compatible", videoCodec, audioCodec, container, reason: null };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify user is admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authorization required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } }
    });
    
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid authorization" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check admin role
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) {
      return new Response(
        JSON.stringify({ error: "Admin access required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get Jellyfin settings
    const { data: settings } = await supabase
      .from("server_settings")
      .select("setting_key, setting_value")
      .in("setting_key", ["jellyfin_server_url", "jellyfin_api_key"]);

    const jellyfinUrl = settings?.find(s => s.setting_key === "jellyfin_server_url")?.setting_value;
    const apiKey = settings?.find(s => s.setting_key === "jellyfin_api_key")?.setting_value;

    if (!jellyfinUrl || !apiKey) {
      return new Response(
        JSON.stringify({ error: "Jellyfin not configured" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get users from Jellyfin
    const usersResponse = await fetch(`${jellyfinUrl}/Users`, {
      headers: { "X-Emby-Token": apiKey }
    });
    const users = await usersResponse.json();
    const jellyfinUserId = users[0]?.Id;

    if (!jellyfinUserId) {
      return new Response(
        JSON.stringify({ error: "No Jellyfin users found" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Starting media compatibility scan...");

    let totalScanned = 0;
    let issuesFound = 0;
    const batchSize = 100;
    let startIndex = 0;
    let hasMore = true;

    // Scan all playable items (Movies and Episodes)
    while (hasMore) {
      const itemsResponse = await fetch(
        `${jellyfinUrl}/Users/${jellyfinUserId}/Items?` + 
        `IncludeItemTypes=Movie,Episode&` +
        `Recursive=true&` +
        `Fields=MediaStreams,Container&` +
        `StartIndex=${startIndex}&` +
        `Limit=${batchSize}`,
        { headers: { "X-Emby-Token": apiKey } }
      );

      const itemsData = await itemsResponse.json();
      const items: MediaItem[] = itemsData.Items || [];
      
      if (items.length === 0) {
        hasMore = false;
        break;
      }

      console.log(`Processing batch: ${startIndex} - ${startIndex + items.length}`);

      for (const item of items) {
        const { status, videoCodec, audioCodec, container, reason } = determineCompatibility(item);
        
        // Build image URL
        let imageUrl = null;
        if (item.ImageTags?.Primary) {
          imageUrl = `${jellyfinUrl}/Items/${item.Id}/Images/Primary?maxHeight=300&tag=${item.ImageTags.Primary}`;
        }

        // Upsert to database
        const { error: upsertError } = await supabase
          .from("media_compatibility")
          .upsert({
            jellyfin_item_id: item.Id,
            jellyfin_item_name: item.Name,
            jellyfin_item_type: item.Type,
            jellyfin_series_name: item.SeriesName || null,
            jellyfin_series_id: item.SeriesId || null,
            jellyfin_season_id: item.SeasonId || null,
            image_url: imageUrl,
            video_codec: videoCodec,
            audio_codec: audioCodec,
            container: container,
            status: status,
            transcode_reason: reason,
            last_scanned_at: new Date().toISOString(),
          }, { 
            onConflict: "jellyfin_item_id" 
          });

        if (upsertError) {
          console.error(`Error upserting item ${item.Id}:`, upsertError);
        }

        totalScanned++;
        if (status === "needs_transcode") {
          issuesFound++;
        }
      }

      startIndex += batchSize;
      
      if (items.length < batchSize) {
        hasMore = false;
      }
    }

    // Update scan schedule with results
    await supabase
      .from("scan_schedule")
      .update({
        last_run_at: new Date().toISOString(),
        last_run_status: "completed",
        last_run_items_scanned: totalScanned,
        last_run_issues_found: issuesFound,
      })
      .eq("id", (await supabase.from("scan_schedule").select("id").limit(1).single()).data?.id);

    console.log(`Scan complete: ${totalScanned} items scanned, ${issuesFound} issues found`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        itemsScanned: totalScanned, 
        issuesFound: issuesFound 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Scan error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
