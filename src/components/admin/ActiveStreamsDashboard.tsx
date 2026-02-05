import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Activity,
  RefreshCw,
  Loader2,
  Play,
  Pause,
  Tv,
  Smartphone,
  Monitor,
  Laptop,
  Users,
  Clock,
  Wifi,
  Video,
  Music,
  Film,
  Zap,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatTime } from "@/lib/playerUtils";

interface PlayState {
  positionTicks: number;
  isPaused: boolean;
  isMuted: boolean;
  playMethod: string;
  repeatMode?: string;
}

interface NowPlaying {
  id: string;
  name: string;
  type: string;
  seriesName?: string;
  seasonNumber?: number;
  episodeNumber?: number;
  runTimeTicks?: number;
  mediaStreams?: {
    type: string;
    codec: string;
    language?: string;
    displayTitle?: string;
    bitRate?: number;
    width?: number;
    height?: number;
  }[];
}

interface TranscodingInfo {
  audioCodec: string;
  videoCodec: string;
  container: string;
  isVideoDirect: boolean;
  isAudioDirect: boolean;
  bitrate?: number;
  completionPercentage?: number;
  width?: number;
  height?: number;
  framerate?: number;
  transcodeReasons?: string[];
}

interface ActiveSession {
  id: string;
  userId: string;
  userName: string;
  client: string;
  deviceName: string;
  deviceId: string;
  applicationVersion?: string;
  remoteEndPoint?: string;
  playState: PlayState;
  nowPlaying: NowPlaying | null;
  transcodingInfo: TranscodingInfo | null;
  lastActivityDate?: string;
}

interface SessionSummary {
  totalSessions: number;
  activeStreams: number;
  idleSessions: number;
}

export const ActiveStreamsDashboard = () => {
  const [sessions, setSessions] = useState<ActiveSession[]>([]);
  const [summary, setSummary] = useState<SessionSummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchSessions = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("jellyfin-sessions");

      if (error) throw error;

      if (data?.error) {
        toast.error(data.error);
        return;
      }

      setSessions(data.activeSessions || []);
      setSummary(data.summary || null);
      setLastUpdated(new Date());
    } catch (error) {
      console.error("Error fetching sessions:", error);
      toast.error("Kunne ikke hente aktive strømmer");
    } finally {
      setIsLoading(false);
    }
  };

  // Initial fetch and auto-refresh
  useEffect(() => {
    fetchSessions();

    let interval: NodeJS.Timeout | null = null;
    if (autoRefresh) {
      interval = setInterval(fetchSessions, 10000); // Refresh every 10 seconds
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh]);

  const getDeviceIcon = (client: string, deviceName: string) => {
    const lowerClient = client?.toLowerCase() || "";
    const lowerDevice = deviceName?.toLowerCase() || "";

    if (lowerClient.includes("android") || lowerDevice.includes("phone")) {
      return <Smartphone className="h-4 w-4" />;
    }
    if (lowerClient.includes("ios") || lowerClient.includes("iphone") || lowerClient.includes("ipad")) {
      return <Smartphone className="h-4 w-4" />;
    }
    if (lowerClient.includes("tv") || lowerDevice.includes("tv") || lowerClient.includes("chromecast")) {
      return <Tv className="h-4 w-4" />;
    }
    if (lowerClient.includes("web") || lowerClient.includes("browser")) {
      return <Monitor className="h-4 w-4" />;
    }
    return <Laptop className="h-4 w-4" />;
  };

  const getMediaIcon = (type: string) => {
    switch (type?.toLowerCase()) {
      case "movie":
        return <Film className="h-4 w-4" />;
      case "episode":
        return <Tv className="h-4 w-4" />;
      case "audio":
        return <Music className="h-4 w-4" />;
      default:
        return <Video className="h-4 w-4" />;
    }
  };

  const formatBitrate = (bitrate?: number) => {
    if (!bitrate) return null;
    if (bitrate >= 1000000) {
      return `${(bitrate / 1000000).toFixed(1)} Mbps`;
    }
    return `${(bitrate / 1000).toFixed(0)} Kbps`;
  };

  const getPlayProgress = (session: ActiveSession) => {
    if (!session.nowPlaying?.runTimeTicks || !session.playState.positionTicks) {
      return 0;
    }
    return (session.playState.positionTicks / session.nowPlaying.runTimeTicks) * 100;
  };

  const formatPosition = (ticks: number) => {
    const seconds = Math.floor(ticks / 10000000);
    return formatTime(seconds);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Activity className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="flex items-center gap-2">
                Aktive Strømmer
                {summary && summary.activeStreams > 0 && (
                  <Badge variant="default" className="bg-green-500/10 text-green-500 border-green-500/20">
                    {summary.activeStreams} aktiv{summary.activeStreams !== 1 ? "e" : ""}
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>
                Sanntidsoversikt over alle aktive avspillinger
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={autoRefresh ? "default" : "outline"}
              size="sm"
              onClick={() => setAutoRefresh(!autoRefresh)}
              className="gap-1"
            >
              <Zap className={`h-3 w-3 ${autoRefresh ? "animate-pulse" : ""}`} />
              Auto
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchSessions}
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary */}
        {summary && (
          <div className="grid grid-cols-3 gap-3">
            <div className="flex items-center gap-2 p-3 rounded-lg bg-secondary/50">
              <Users className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Totalt</p>
                <p className="font-semibold">{summary.totalSessions}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 p-3 rounded-lg bg-green-500/10">
              <Play className="h-4 w-4 text-green-500" />
              <div>
                <p className="text-xs text-muted-foreground">Strømmer</p>
                <p className="font-semibold text-green-500">{summary.activeStreams}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 p-3 rounded-lg bg-secondary/50">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Inaktive</p>
                <p className="font-semibold">{summary.idleSessions}</p>
              </div>
            </div>
          </div>
        )}

        <Separator />

        {/* Active Sessions List */}
        {sessions.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Video className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>Ingen aktive strømmer akkurat nå</p>
            {lastUpdated && (
              <p className="text-xs mt-2">
                Sist oppdatert: {lastUpdated.toLocaleTimeString("no-NO")}
              </p>
            )}
          </div>
        ) : (
          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-4">
              {sessions.map((session) => (
                <Card key={session.id} className="relative overflow-hidden">
                  <div
                    className={`absolute top-0 left-0 w-1 h-full ${
                      session.playState.isPaused ? "bg-yellow-500" : "bg-green-500"
                    }`}
                  />
                  <CardContent className="pt-4 pl-5">
                    {/* User and Device Info */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        {getDeviceIcon(session.client, session.deviceName)}
                        <div>
                          <p className="font-semibold">{session.userName}</p>
                          <p className="text-xs text-muted-foreground">
                            {session.client} • {session.deviceName}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {session.playState.isPaused ? (
                          <Badge variant="outline" className="gap-1">
                            <Pause className="h-3 w-3" />
                            Pauset
                          </Badge>
                        ) : (
                          <Badge className="bg-green-500/10 text-green-500 border-green-500/20 gap-1">
                            <Play className="h-3 w-3" />
                            Spiller
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* Now Playing */}
                    {session.nowPlaying && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          {getMediaIcon(session.nowPlaying.type)}
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">
                              {session.nowPlaying.seriesName
                                ? `${session.nowPlaying.seriesName}`
                                : session.nowPlaying.name}
                            </p>
                            {session.nowPlaying.seriesName && (
                              <p className="text-sm text-muted-foreground truncate">
                                S{session.nowPlaying.seasonNumber}E{session.nowPlaying.episodeNumber}: {session.nowPlaying.name}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Progress */}
                        <div className="space-y-1">
                          <Progress value={getPlayProgress(session)} className="h-1.5" />
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>{formatPosition(session.playState.positionTicks)}</span>
                            {session.nowPlaying.runTimeTicks && (
                              <span>{formatPosition(session.nowPlaying.runTimeTicks)}</span>
                            )}
                          </div>
                        </div>

                        {/* Playback Method - Server vs Client */}
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {session.playState.playMethod === "Transcode" ? (
                            <Badge className="bg-orange-500/10 text-orange-500 border-orange-500/20 text-xs gap-1">
                              <Zap className="h-3 w-3" />
                              Server Transkoding
                            </Badge>
                          ) : session.playState.playMethod === "DirectStream" ? (
                            <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20 text-xs gap-1">
                              <Video className="h-3 w-3" />
                              Direct Stream
                            </Badge>
                          ) : (
                            <Badge className="bg-green-500/10 text-green-500 border-green-500/20 text-xs gap-1">
                              <Play className="h-3 w-3" />
                              Direct Play
                            </Badge>
                          )}
                          
                          {/* Codec details when transcoding */}
                          {session.transcodingInfo && (
                            <>
                              {!session.transcodingInfo.isVideoDirect && (
                                <Badge variant="secondary" className="text-xs">
                                  Video: {session.transcodingInfo.videoCodec}
                                </Badge>
                              )}
                              {!session.transcodingInfo.isAudioDirect && (
                                <Badge variant="secondary" className="text-xs">
                                  Audio: {session.transcodingInfo.audioCodec}
                                </Badge>
                              )}
                              {session.transcodingInfo.width && session.transcodingInfo.height && (
                                <Badge variant="outline" className="text-xs">
                                  {session.transcodingInfo.width}x{session.transcodingInfo.height}
                                </Badge>
                              )}
                              {session.transcodingInfo.bitrate && (
                                <Badge variant="outline" className="text-xs">
                                  {formatBitrate(session.transcodingInfo.bitrate)}
                                </Badge>
                              )}
                            </>
                          )}
                        </div>

                        {/* Play Method */}
                        <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                          <Wifi className="h-3 w-3" />
                          <span>{session.playState.playMethod}</span>
                          {session.remoteEndPoint && (
                            <>
                              <span>•</span>
                              <span>{session.remoteEndPoint}</span>
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </ScrollArea>
        )}

        {lastUpdated && sessions.length > 0 && (
          <p className="text-xs text-center text-muted-foreground">
            Sist oppdatert: {lastUpdated.toLocaleTimeString("no-NO")}
            {autoRefresh && " • Auto-oppdatering aktivert"}
          </p>
        )}
      </CardContent>
    </Card>
  );
};
