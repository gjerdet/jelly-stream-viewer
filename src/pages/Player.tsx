import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useServerSettings } from "@/hooks/useServerSettings";
import { useJellyfinApi } from "@/hooks/useJellyfinApi";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Subtitles, List, Cast, Play, Pause, Square } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

interface MediaStream {
  Index: number;
  Type: string;
  DisplayTitle?: string;
  Language?: string;
  Codec?: string;
  IsDefault?: boolean;
}

interface MediaSource {
  Id: string;
  DirectStreamUrl?: string;
  TranscodingUrl?: string;
}

interface PlaybackInfo {
  MediaSources: MediaSource[];
}

interface JellyfinItemDetail {
  Id: string;
  Name: string;
  Type: string;
  SeriesId?: string;
  SeriesName?: string;
  SeasonId?: string;
  IndexNumber?: number;
  RunTimeTicks?: number;
  ImageTags?: { Primary?: string };
  MediaStreams?: MediaStream[];
  UserData?: {
    Played?: boolean;
    PlaybackPositionTicks?: number;
  };
}

interface Episode {
  Id: string;
  Name: string;
  IndexNumber?: number;
  SeasonId: string;
  ImageTags?: { Primary?: string };
  RunTimeTicks?: number;
  UserData?: {
    Played?: boolean;
    PlaybackPositionTicks?: number;
  };
}

interface EpisodesResponse {
  Items: Episode[];
}

const Player = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { user } = useAuth();
  const { serverUrl } = useServerSettings();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [showControls, setShowControls] = useState(true);
  const [selectedSubtitle, setSelectedSubtitle] = useState<string>("");
  const [streamUrl, setStreamUrl] = useState<string>("");
  const [watchHistoryId, setWatchHistoryId] = useState<string | null>(null);
  const [showEpisodes, setShowEpisodes] = useState(false);
  const [isCasting, setIsCasting] = useState(false);
  const [castPlayerState, setCastPlayerState] = useState<any>(null);
  const hideControlsTimer = useRef<NodeJS.Timeout>();
  const castPlayerRef = useRef<any>(null);
  const castRemotePlayerRef = useRef<any>(null);
  const castContextRef = useRef<any>(null);

  // Fetch users to get user ID
  const { data: usersData } = useJellyfinApi<{ Id: string }[]>(
    ["jellyfin-users"],
    { endpoint: `/Users` },
    !!user
  );
  const userId = usersData?.[0]?.Id;

  // Direct streaming from Jellyfin with reasonable bitrate
  useEffect(() => {
    if (!serverUrl || !id || !userId) return;
    
    const jellyfinSession = localStorage.getItem('jellyfin_session');
    const accessToken = jellyfinSession ? JSON.parse(jellyfinSession).AccessToken : null;
    
    if (!accessToken) {
      console.error('No Jellyfin access token found');
      return;
    }

    let normalizedUrl = serverUrl;
    if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
      normalizedUrl = `http://${normalizedUrl}`;
    }
    
    // Use direct stream with reasonable bitrate (40 Mbps = høy kvalitet uten buffering)
    const streamingUrl = `${normalizedUrl.replace(/\/$/, '')}/Videos/${id}/stream?`
      + `UserId=${userId}`
      + `&Static=true`
      + `&MediaSourceId=${id}`
      + `&api_key=${accessToken}`;
    
    console.log('Stream URL:', streamingUrl.replace(accessToken, '***'));
    setStreamUrl(streamingUrl);
  }, [serverUrl, id, userId]);

  // Fetch item details with media streams
  const { data: item } = useJellyfinApi<JellyfinItemDetail>(
    ["item-detail-player", id || ""],
    {
      endpoint: id && userId ? `/Users/${userId}/Items/${id}?Fields=MediaStreams,Overview&EnableImageTypes=Primary` : "",
    },
    !!user && !!userId && !!id
  );

  // Fetch all episodes in the season if this is an episode
  const { data: episodesData } = useJellyfinApi<EpisodesResponse>(
    ["season-episodes-player", item?.SeasonId || ""],
    {
      endpoint: item?.SeriesId && item?.SeasonId && userId
        ? `/Shows/${item.SeriesId}/Episodes?SeasonId=${item.SeasonId}&UserId=${userId}&Fields=Overview,PrimaryImageAspectRatio`
        : "",
    },
    !!item?.SeriesId && !!item?.SeasonId && !!userId
  );

  const subtitles = item?.MediaStreams?.filter(stream => stream.Type === "Subtitle") || [];
  const isEpisode = item?.Type === "Episode";
  const episodes = episodesData?.Items || [];

  // Get subtitle URL using edge function
  const getSubtitleUrl = (subtitleIndex: number) => {
    if (!serverUrl || !id || !user) return '';
    
    return supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.access_token) return '';
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      // Token in URL is required for browser subtitle tracks (can't send custom headers)
      return `${supabaseUrl}/functions/v1/jellyfin-subtitle?id=${id}&index=${subtitleIndex}&token=${session.access_token}`;
    });
  };


  const handleMouseMove = () => {
    setShowControls(true);
    if (hideControlsTimer.current) {
      clearTimeout(hideControlsTimer.current);
    }
    hideControlsTimer.current = setTimeout(() => {
      setShowControls(false);
    }, 3000);
  };

  useEffect(() => {
    return () => {
      if (hideControlsTimer.current) {
        clearTimeout(hideControlsTimer.current);
      }
    };
  }, []);

  // Initialize Chromecast
  useEffect(() => {
    const initializeCast = () => {
      const cast = (window as any).chrome?.cast;
      if (!cast) {
        console.log('Cast SDK not loaded yet');
        return;
      }

      try {
        castContextRef.current = cast.framework.CastContext.getInstance();
        castContextRef.current.setOptions({
          receiverApplicationId: cast.framework.CastContext.DEFAULT_MEDIA_RECEIVER_APP_ID,
          autoJoinPolicy: cast.framework.AutoJoinPolicy.ORIGIN_SCOPED,
        });

        const player = new cast.framework.RemotePlayer();
        castRemotePlayerRef.current = player;
        castPlayerRef.current = new cast.framework.RemotePlayerController(player);

        // Track all player state changes
        castPlayerRef.current.addEventListener(
          cast.framework.RemotePlayerEventType.ANY_CHANGE,
          () => {
            setCastPlayerState({
              isConnected: player.isConnected,
              isPaused: player.isPaused,
              currentTime: player.currentTime,
              duration: player.duration,
              canPause: player.canPause,
              canSeek: player.canSeek,
            });
          }
        );

        castPlayerRef.current.addEventListener(
          cast.framework.RemotePlayerEventType.IS_CONNECTED_CHANGED,
          (event: any) => {
            setIsCasting(event.value);
            if (event.value && streamUrl && item) {
              loadMediaToCast();
            }
          }
        );

        console.log('Cast initialized');
      } catch (error) {
        console.error('Cast initialization error:', error);
      }
    };

    // Wait for Cast SDK to load
    if ((window as any)['__onGCastApiAvailable']) {
      initializeCast();
    } else {
      (window as any)['__onGCastApiAvailable'] = (isAvailable: boolean) => {
        if (isAvailable) {
          initializeCast();
        }
      };
    }
  }, []);

  const loadMediaToCast = () => {
    if (!streamUrl || !item || !castContextRef.current) return;

    const cast = (window as any).chrome.cast;
    const session = castContextRef.current.getCurrentSession();
    
    if (!session) return;

    const mediaInfo = new cast.media.MediaInfo(streamUrl, 'video/mp4');
    mediaInfo.metadata = new cast.media.GenericMediaMetadata();
    mediaInfo.metadata.title = item.Name;
    
    if (item.SeriesName) {
      mediaInfo.metadata.subtitle = `${item.SeriesName}${item.IndexNumber ? ` - Episode ${item.IndexNumber}` : ''}`;
    }

    if (item.ImageTags?.Primary && serverUrl) {
      const imageUrl = `${serverUrl.replace(/\/$/, '')}/Items/${item.Id}/Images/Primary?maxHeight=600`;
      mediaInfo.metadata.images = [new cast.Image(imageUrl)];
    }

    const request = new cast.media.LoadRequest(mediaInfo);
    
    // Resume from last position if available
    if (item.UserData?.PlaybackPositionTicks) {
      request.currentTime = item.UserData.PlaybackPositionTicks / 10000000;
    }

    session.loadMedia(request).then(
      () => console.log('Media loaded to Cast'),
      (error: any) => console.error('Cast load error:', error)
    );
  };

  const handleCastClick = () => {
    if (!castContextRef.current) return;
    
    const cast = (window as any).chrome.cast;
    castContextRef.current.requestSession().then(
      () => {
        console.log('Cast session started');
        if (streamUrl && item) {
          loadMediaToCast();
        }
      },
      (error: any) => console.error('Cast session error:', error)
    );
  };

  const handleCastPlayPause = () => {
    if (!castPlayerRef.current || !castRemotePlayerRef.current) return;
    castPlayerRef.current.playOrPause();
  };

  const handleCastStop = () => {
    if (!castContextRef.current) return;
    const session = castContextRef.current.getCurrentSession();
    if (session) {
      session.endSession(true);
    }
  };

  const handleCastSeek = (time: number) => {
    if (!castPlayerRef.current || !castRemotePlayerRef.current) return;
    castRemotePlayerRef.current.currentTime = time;
    castPlayerRef.current.seek();
  };

  const handleCastSubtitleChange = async (subtitleIndex: string) => {
    if (!castContextRef.current || subtitleIndex === 'none') return;
    
    const session = castContextRef.current.getCurrentSession();
    if (!session) return;

    const media = session.getMediaSession();
    if (!media) return;

    try {
      const subtitleUrl = await getSubtitleUrl(parseInt(subtitleIndex));
      if (!subtitleUrl) return;

      const cast = (window as any).chrome.cast;
      const track = new cast.media.Track(parseInt(subtitleIndex), cast.media.TrackType.TEXT);
      track.trackContentId = subtitleUrl;
      track.trackContentType = 'text/vtt';
      track.subtype = cast.media.TextTrackType.SUBTITLES;
      track.name = subtitles.find(s => s.Index === parseInt(subtitleIndex))?.DisplayTitle || 'Subtitle';

      const tracksInfoRequest = new cast.media.EditTracksInfoRequest([parseInt(subtitleIndex)]);
      media.editTracksInfo(tracksInfoRequest,
        () => console.log('Subtitle changed'),
        (error: any) => console.error('Subtitle change error:', error)
      );
    } catch (error) {
      console.error('Error changing subtitle:', error);
    }
  };

  // Register watch history when playback starts
  useEffect(() => {
    if (!user || !item || !serverUrl || watchHistoryId) return;

    const registerWatch = async () => {
      const imageUrl = item.ImageTags?.Primary && serverUrl
        ? `${serverUrl.replace(/\/$/, '')}/Items/${item.Id}/Images/Primary?maxHeight=600`
        : undefined;

      const { data, error } = await supabase
        .from("watch_history")
        .upsert({
          user_id: user.id,
          jellyfin_item_id: item.Id,
          jellyfin_item_name: item.Name,
          jellyfin_item_type: item.Type,
          jellyfin_series_id: item.SeriesId,
          jellyfin_series_name: item.SeriesName,
          jellyfin_season_id: item.SeasonId,
          image_url: imageUrl,
          runtime_ticks: item.RunTimeTicks,
          watched_at: new Date().toISOString(),
        }, {
          onConflict: 'jellyfin_item_id,user_id',
          ignoreDuplicates: false
        })
        .select()
        .single();

      if (!error && data) {
        setWatchHistoryId(data.id);
      }
    };

    registerWatch();
  }, [user, item, serverUrl, watchHistoryId]);

  // Update playback position periodically
  useEffect(() => {
    if (!watchHistoryId || !videoRef.current) return;

    const updatePosition = async () => {
      const currentTime = videoRef.current?.currentTime;
      if (currentTime === undefined) return;

      const positionTicks = Math.floor(currentTime * 10000000);

      await supabase
        .from("watch_history")
        .update({ 
          last_position_ticks: positionTicks,
          watched_at: new Date().toISOString()
        })
        .eq("id", watchHistoryId);
    };

    const interval = setInterval(updatePosition, 10000); // Update every 10 seconds

    return () => clearInterval(interval);
  }, [watchHistoryId]);

  if (!serverUrl || !userId || !id || !streamUrl) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center text-white">
        Laster...
      </div>
    );
  }

  return (
    <div 
      className="relative h-screen bg-black overflow-hidden"
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setShowControls(false)}
    >
      <video
        ref={videoRef}
        key={streamUrl}
        src={streamUrl}
        className="w-full h-full"
        controls
        autoPlay
        crossOrigin="anonymous"
        onLoadedMetadata={(e) => {
          const video = e.currentTarget;
          console.log('Video loaded:', {
            duration: video.duration,
            videoWidth: video.videoWidth,
            videoHeight: video.videoHeight,
            src: streamUrl.substring(0, 50) + '...'
          });
        }}
        onError={(e) => {
          const video = e.currentTarget;
          console.error('Video playback error:', {
            error: e,
            networkState: video.networkState,
            readyState: video.readyState,
            errorCode: video.error?.code,
            errorMessage: video.error?.message,
          });
        }}
      >
        Din nettleser støtter ikke videoavspilling.
      </video>

      {/* Custom overlay controls */}
      <div 
        className={`absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/50 transition-opacity duration-300 pointer-events-none ${
          showControls ? 'opacity-100' : 'opacity-0'
        }`}
      >
        {/* Top bar */}
        <div className="absolute top-0 left-0 right-0 p-6 flex items-center justify-between pointer-events-auto">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(-1)}
            className="text-white hover:bg-white/20"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Tilbake
          </Button>

          <div className="flex-1 text-center">
            <h1 className="text-2xl font-bold text-white">
              {item?.SeriesName && `${item.SeriesName} - `}
              {item?.IndexNumber && `E${item.IndexNumber}: `}
              {item?.Name}
            </h1>
          </div>

          <div className="flex gap-2">
            {/* Chromecast Button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCastClick}
              className={`text-white hover:bg-white/20 ${isCasting ? 'bg-primary/20' : ''}`}
              title="Cast til TV"
            >
              <Cast className="h-4 w-4" />
            </Button>

            {isEpisode && episodes.length > 0 && (
              <Sheet open={showEpisodes} onOpenChange={setShowEpisodes}>
                <SheetTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-white hover:bg-white/20"
                  >
                    <List className="mr-2 h-4 w-4" />
                    Episoder
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-[400px] bg-background/95 backdrop-blur-xl overflow-y-auto">
                  <SheetHeader>
                    <SheetTitle>Episoder</SheetTitle>
                    <SheetDescription>
                      {item?.SeriesName}
                    </SheetDescription>
                  </SheetHeader>
                  <div className="mt-6 space-y-2">
                    {episodes.map((episode) => {
                      const episodeImageUrl = episode.ImageTags?.Primary && serverUrl
                        ? `${serverUrl.replace(/\/$/, '')}/Items/${episode.Id}/Images/Primary?maxHeight=200`
                        : null;
                      const episodeRuntime = episode.RunTimeTicks 
                        ? Math.round(episode.RunTimeTicks / 600000000) 
                        : null;
                      const isCurrentEpisode = episode.Id === id;
                      const watchedPercentage = episode.UserData?.PlaybackPositionTicks && episode.RunTimeTicks
                        ? (episode.UserData.PlaybackPositionTicks / episode.RunTimeTicks) * 100
                        : 0;
                      const isWatched = episode.UserData?.Played || watchedPercentage >= 95;

                      return (
                        <div
                          key={episode.Id}
                          onClick={() => {
                            if (!isCurrentEpisode) {
                              navigate(`/player/${episode.Id}`);
                              setShowEpisodes(false);
                            }
                          }}
                          className={`flex gap-3 p-2 rounded-lg cursor-pointer smooth-transition ${
                            isCurrentEpisode 
                              ? 'bg-primary/20 border-2 border-primary' 
                              : 'hover:bg-secondary/50'
                          }`}
                        >
                          <div className="w-32 h-20 flex-shrink-0 rounded overflow-hidden bg-secondary relative">
                            {episodeImageUrl ? (
                              <img
                                src={episodeImageUrl}
                                alt={episode.Name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">
                                Ingen bilde
                              </div>
                            )}
                            {watchedPercentage > 0 && watchedPercentage < 95 && (
                              <div className="absolute bottom-0 left-0 right-0 h-1 bg-secondary/50">
                                <div 
                                  className="h-full bg-primary"
                                  style={{ width: `${watchedPercentage}%` }}
                                />
                              </div>
                            )}
                            {isWatched && (
                              <div className="absolute top-1 right-1 bg-green-600 rounded-full p-0.5">
                                <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <h3 className="font-semibold text-sm line-clamp-1">
                                {episode.IndexNumber && `${episode.IndexNumber}. `}{episode.Name}
                              </h3>
                              {episodeRuntime && (
                                <span className="text-xs text-muted-foreground whitespace-nowrap">
                                  {episodeRuntime} min
                                </span>
                              )}
                            </div>
                            {isCurrentEpisode && (
                              <p className="text-xs text-primary mt-1">Spiller nå</p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </SheetContent>
              </Sheet>
            )}
            
            {subtitles.length > 0 && (
              <Select 
                value={selectedSubtitle} 
                onValueChange={(value) => {
                  setSelectedSubtitle(value);
                  if (isCasting) {
                    handleCastSubtitleChange(value);
                  }
                }}
              >
                <SelectTrigger className="w-[180px] bg-black/50 backdrop-blur-sm border-white/20 text-white">
                  <Subtitles className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Undertekster" />
                </SelectTrigger>
                <SelectContent className="bg-background z-50">
                  <SelectItem value="none">Ingen</SelectItem>
                  {subtitles.map((subtitle) => (
                    <SelectItem key={subtitle.Index} value={subtitle.Index.toString()}>
                      {subtitle.DisplayTitle || subtitle.Language || `Undertekst ${subtitle.Index}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        {/* Cast Controls */}
        {isCasting && castPlayerState && (
          <div className="absolute bottom-0 left-0 right-0 p-6 space-y-4 pointer-events-auto">
            <div className="bg-black/80 backdrop-blur-md rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between text-white">
                <span className="text-sm">Caster til TV</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCastStop}
                  className="text-white hover:bg-white/20"
                >
                  <Square className="h-4 w-4 mr-2" />
                  Stopp casting
                </Button>
              </div>

              {/* Progress bar */}
              {castPlayerState.canSeek && (
                <div className="space-y-2">
                  <input
                    type="range"
                    min="0"
                    max={castPlayerState.duration || 0}
                    value={castPlayerState.currentTime || 0}
                    onChange={(e) => handleCastSeek(parseFloat(e.target.value))}
                    className="w-full h-2 bg-white/20 rounded-lg appearance-none cursor-pointer accent-primary"
                  />
                  <div className="flex justify-between text-xs text-white/70">
                    <span>{formatTime(castPlayerState.currentTime || 0)}</span>
                    <span>{formatTime(castPlayerState.duration || 0)}</span>
                  </div>
                </div>
              )}

              {/* Play/Pause button */}
              {castPlayerState.canPause && (
                <div className="flex justify-center">
                  <Button
                    variant="ghost"
                    size="lg"
                    onClick={handleCastPlayPause}
                    className="text-white hover:bg-white/20 w-16 h-16"
                  >
                    {castPlayerState.isPaused ? (
                      <Play className="h-8 w-8" />
                    ) : (
                      <Pause className="h-8 w-8" />
                    )}
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Helper function to format time
const formatTime = (seconds: number) => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
};

export default Player;
