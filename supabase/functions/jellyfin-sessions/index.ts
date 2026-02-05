import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify user is authenticated
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Verify user session
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if user is admin
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (roleData?.role !== "admin") {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get Jellyfin server settings
    const { data: settings } = await supabase
      .from("server_settings")
      .select("setting_key, setting_value")
      .in("setting_key", ["jellyfin_server_url", "jellyfin_api_key"]);

    const serverUrl = settings?.find(s => s.setting_key === "jellyfin_server_url")?.setting_value;
    const apiKey = settings?.find(s => s.setting_key === "jellyfin_api_key")?.setting_value;

    if (!serverUrl || !apiKey) {
      return new Response(JSON.stringify({ error: "Jellyfin not configured" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch active sessions from Jellyfin
    const sessionsUrl = `${serverUrl.replace(/\/$/, "")}/Sessions?api_key=${apiKey}`;
    const response = await fetch(sessionsUrl, {
      headers: {
        "X-Emby-Token": apiKey,
      },
    });

    if (!response.ok) {
      throw new Error(`Jellyfin API error: ${response.status}`);
    }

    const sessions = await response.json();

    // Log raw session data for debugging
    console.log(`Found ${sessions.length} total sessions from Jellyfin`);
    sessions.forEach((s: any, i: number) => {
      console.log(`Session ${i + 1}: User=${s.UserName}, Client=${s.Client}, Device=${s.DeviceName}, HasNowPlaying=${!!s.NowPlayingItem}, NowPlayingItem=${s.NowPlayingItem?.Name || 'none'}`);
    });

    // Filter and format sessions - only include those with NowPlayingItem (active playback)
    const activeSessions = sessions
      .filter((session: any) => session.NowPlayingItem)
      .map((session: any) => ({
        id: session.Id,
        userId: session.UserId,
        userName: session.UserName,
        client: session.Client,
        deviceName: session.DeviceName,
        deviceId: session.DeviceId,
        applicationVersion: session.ApplicationVersion,
        remoteEndPoint: session.RemoteEndPoint,
        playState: {
          positionTicks: session.PlayState?.PositionTicks || 0,
          isPaused: session.PlayState?.IsPaused || false,
          isMuted: session.PlayState?.IsMuted || false,
          playMethod: session.PlayState?.PlayMethod || "Unknown",
          repeatMode: session.PlayState?.RepeatMode,
        },
        nowPlaying: session.NowPlayingItem ? {
          id: session.NowPlayingItem.Id,
          name: session.NowPlayingItem.Name,
          type: session.NowPlayingItem.Type,
          seriesName: session.NowPlayingItem.SeriesName,
          seasonNumber: session.NowPlayingItem.ParentIndexNumber,
          episodeNumber: session.NowPlayingItem.IndexNumber,
          runTimeTicks: session.NowPlayingItem.RunTimeTicks,
          mediaStreams: session.NowPlayingItem.MediaStreams?.map((stream: any) => ({
            type: stream.Type,
            codec: stream.Codec,
            language: stream.Language,
            displayTitle: stream.DisplayTitle,
            bitRate: stream.BitRate,
            width: stream.Width,
            height: stream.Height,
          })),
        } : null,
        transcodingInfo: session.TranscodingInfo ? {
          audioCodec: session.TranscodingInfo.AudioCodec,
          videoCodec: session.TranscodingInfo.VideoCodec,
          container: session.TranscodingInfo.Container,
          isVideoDirect: session.TranscodingInfo.IsVideoDirect,
          isAudioDirect: session.TranscodingInfo.IsAudioDirect,
          bitrate: session.TranscodingInfo.Bitrate,
          completionPercentage: session.TranscodingInfo.CompletionPercentage,
          width: session.TranscodingInfo.Width,
          height: session.TranscodingInfo.Height,
          framerate: session.TranscodingInfo.Framerate,
          transcodeReasons: session.TranscodingInfo.TranscodeReasons,
        } : null,
        lastActivityDate: session.LastActivityDate,
      }));

    // Also get total session count (including idle)
    const totalSessions = sessions.length;
    const idleSessions = sessions.filter((s: any) => !s.NowPlayingItem);

    return new Response(
      JSON.stringify({
        activeSessions,
        summary: {
          totalSessions,
          activeStreams: activeSessions.length,
          idleSessions: idleSessions.length,
        },
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error fetching sessions:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to fetch sessions";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
