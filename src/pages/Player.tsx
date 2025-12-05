import { useEffect, useRef, useState, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useServerSettings } from "@/hooks/useServerSettings";
import { useJellyfinApi } from "@/hooks/useJellyfinApi";
import { useChromecast } from "@/hooks/useChromecast";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Subtitles, Cast, Play, Pause, Square, ChevronLeft, ChevronRight, SkipBack, SkipForward, CheckCircle, Search, Download, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarProvider,
  useSidebar,
} from "@/components/ui/sidebar";

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
  Overview?: string;
  UserData?: {
    Played?: boolean;
    PlaybackPositionTicks?: number;
  };
}

interface EpisodesResponse {
  Items: Episode[];
}

interface RemoteSubtitle {
  Id: string;
  Name: string;
  Language: string;
  Provider: string;
  Comment?: string;
  DownloadCount?: number;
  Format?: string;
}

const Player = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { user } = useAuth();
  const { serverUrl } = useServerSettings();
  const { castState, playOrPause, endSession, loadMedia } = useChromecast();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [showControls, setShowControls] = useState(true);
  const [selectedSubtitle, setSelectedSubtitle] = useState<string>("");
  const [subtitleUrl, setSubtitleUrl] = useState<string>("");
  const [streamUrl, setStreamUrl] = useState<string>("");
  const [watchHistoryId, setWatchHistoryId] = useState<string | null>(null);
  const [showNextEpisodePreview, setShowNextEpisodePreview] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [autoMarkWatched, setAutoMarkWatched] = useState(() => {
    const saved = localStorage.getItem('autoMarkWatched');
    return saved === 'true';
  });
  const [subtitleSearchOpen, setSubtitleSearchOpen] = useState(false);
  const [searchingSubtitles, setSearchingSubtitles] = useState(false);
  const [remoteSubtitles, setRemoteSubtitles] = useState<RemoteSubtitle[]>([]);
  const [downloadingSubtitle, setDownloadingSubtitle] = useState<string | null>(null);
  const hideControlsTimer = useRef<NodeJS.Timeout>();
  const countdownInterval = useRef<NodeJS.Timeout>();

  // Search for subtitles via Jellyfin
  const searchSubtitles = async (language: string = 'nor') => {
    if (!id) return;
    
    setSearchingSubtitles(true);
    setRemoteSubtitles([]);
    
    try {
      const { data, error } = await supabase.functions.invoke('jellyfin-search-subtitles', {
        body: { itemId: id, language }
      });
      
      if (error) throw error;
      
      if (data?.error) {
        toast.error(data.error);
        return;
      }
      
      setRemoteSubtitles(data?.subtitles || []);
      
      if (data?.subtitles?.length === 0) {
        toast.info('Ingen undertekster funnet');
      }
    } catch (error) {
      console.error('Error searching subtitles:', error);
      toast.error('Kunne ikke søke etter undertekster');
    } finally {
      setSearchingSubtitles(false);
    }
  };

  // Download subtitle via Jellyfin
  const downloadSubtitle = async (subtitleId: string) => {
    if (!id) return;
    
    setDownloadingSubtitle(subtitleId);
    
    try {
      const { data, error } = await supabase.functions.invoke('jellyfin-download-subtitle', {
        body: { itemId: id, subtitleId }
      });
      
      if (error) throw error;
      
      if (data?.success) {
        toast.success('Undertekst lastet ned! Refresh siden for å bruke den.');
        setSubtitleSearchOpen(false);
      } else {
        toast.error(data?.error || 'Kunne ikke laste ned undertekst');
      }
    } catch (error) {
      console.error('Error downloading subtitle:', error);
      toast.error('Kunne ikke laste ned undertekst');
    } finally {
      setDownloadingSubtitle(null);
    }
  };

  // Fetch users to get user ID
  const { data: usersData } = useJellyfinApi<{ Id: string }[]>(
    ["jellyfin-users"],
    { endpoint: `/Users` },
    !!user
  );
  const userId = usersData?.[0]?.Id;

  // Direct streaming from Jellyfin with smart codec handling
  useEffect(() => {
    const setupStream = async () => {
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
      
      try {
        // Get media info to check codec
        const infoUrl = `${normalizedUrl.replace(/\/$/, '')}/Users/${userId}/Items/${id}?Fields=MediaStreams&api_key=${accessToken}`;
        const infoResponse = await fetch(infoUrl);
        const itemInfo = await infoResponse.json();
        
        const videoStream = itemInfo.MediaStreams?.find((s: any) => s.Type === 'Video');
        const videoCodec = videoStream?.Codec?.toLowerCase();
        
        console.log(`Video codec: ${videoCodec}, container: ${itemInfo.Container}`);
        
        let streamingUrl;
        // Browser-compatible codecs: H264, VP8, VP9, AV1
        if (videoCodec && ['h264', 'vp8', 'vp9', 'av1'].includes(videoCodec)) {
          // Direct stream for compatible codecs
          streamingUrl = `${normalizedUrl.replace(/\/$/, '')}/Videos/${id}/stream?`
            + `UserId=${userId}`
            + `&Static=true`
            + `&MediaSourceId=${id}`
            + `&api_key=${accessToken}`;
          console.log('Direct streaming (high quality)');
        } else {
          // Transcode to MP4 with seeking support
          streamingUrl = `${normalizedUrl.replace(/\/$/, '')}/Videos/${id}/stream.mp4?`
            + `UserId=${userId}`
            + `&MediaSourceId=${id}`
            + `&VideoCodec=h264`
            + `&AudioCodec=aac`
            + `&VideoBitrate=8000000`
            + `&AudioBitrate=192000`
            + `&MaxAudioChannels=2`
            + `&SegmentContainer=mp4`
            + `&api_key=${accessToken}`;
          console.log(`Transcoding ${videoCodec} to MP4 with seeking support`);
        }
        
        setStreamUrl(streamingUrl);
      } catch (error) {
        console.error('Failed to get codec info:', error);
        // Fallback to MP4 transcoding via Jellyfin
        let normalizedUrl = serverUrl;
        if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
          normalizedUrl = `http://${normalizedUrl}`;
        }
        const jellyfinSession = localStorage.getItem('jellyfin_session');
        const accessToken = jellyfinSession ? JSON.parse(jellyfinSession).AccessToken : null;
        
        const streamingUrl = `${normalizedUrl.replace(/\/$/, '')}/Videos/${id}/stream.mp4?`
          + `UserId=${userId}`
          + `&MediaSourceId=${id}`
          + `&VideoCodec=h264`
          + `&AudioCodec=aac`
          + `&VideoBitrate=8000000`
          + `&AudioBitrate=192000`
          + `&MaxAudioChannels=2`
          + `&SegmentContainer=mp4`
          + `&api_key=${accessToken}`;
        setStreamUrl(streamingUrl);
      }
    };

    setupStream();
  }, [serverUrl, id, userId]);
  
  // Handle video errors
  const handleVideoError = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    const video = e.currentTarget;
    console.error('Video error:', {
      errorCode: video.error?.code,
      errorMessage: video.error?.message,
      networkState: video.networkState,
      readyState: video.readyState,
    });
  };

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

  const subtitles = useMemo(() => 
    item?.MediaStreams?.filter(stream => stream.Type === "Subtitle") || [], 
    [item?.MediaStreams]
  );
  const isEpisode = item?.Type === "Episode";
  const episodes = episodesData?.Items || [];

  // Debug: Log MediaStreams (only once when item changes)
  useEffect(() => {
    if (item?.Id) {
      console.log('Item loaded:', item.Name);
      console.log('All MediaStreams:', item.MediaStreams);
      console.log('Subtitle streams with details:');
      subtitles.forEach((s, i) => {
        console.log(`  [${i}] Index: ${s.Index}, Language: ${s.Language}, Title: ${s.DisplayTitle}, Codec: ${s.Codec}`);
      });
    }
  }, [item?.Id, subtitles.length]);

  // Auto-select default subtitle or first Norwegian subtitle
  useEffect(() => {
    if (subtitles.length > 0 && !selectedSubtitle) {
      console.log('Auto-selecting, available subtitles:', subtitles.length);
      // First try to find default subtitle
      const defaultSub = subtitles.find(s => s.IsDefault);
      if (defaultSub) {
        console.log('Auto-selecting default subtitle index:', defaultSub.Index);
        setSelectedSubtitle(defaultSub.Index.toString());
        return;
      }
      // Then try Norwegian
      const norwegianSub = subtitles.find(s => 
        s.Language?.toLowerCase() === 'nor' || 
        s.Language?.toLowerCase() === 'no' ||
        s.DisplayTitle?.toLowerCase().includes('norsk') ||
        s.DisplayTitle?.toLowerCase().includes('norwegian')
      );
      if (norwegianSub) {
        console.log('Auto-selecting Norwegian subtitle index:', norwegianSub.Index);
        setSelectedSubtitle(norwegianSub.Index.toString());
      }
    }
  }, [subtitles]);

  // Find next episode for autoplay
  const getNextEpisode = () => {
    if (!isEpisode || episodes.length === 0 || !item?.IndexNumber) return null;
    
    const currentIndex = episodes.findIndex(ep => ep.Id === id);
    if (currentIndex === -1 || currentIndex === episodes.length - 1) return null;
    
    return episodes[currentIndex + 1];
  };

  // Find previous episode
  const getPreviousEpisode = () => {
    if (!isEpisode || episodes.length === 0 || !item?.IndexNumber) return null;
    
    const currentIndex = episodes.findIndex(ep => ep.Id === id);
    if (currentIndex === -1 || currentIndex === 0) return null;
    
    return episodes[currentIndex - 1];
  };

  const playPreviousEpisode = () => {
    const prevEpisode = getPreviousEpisode();
    if (prevEpisode) {
      navigate(`/player/${prevEpisode.Id}`);
    }
  };

  const handleProgressClick = (episode: Episode, event: React.MouseEvent<HTMLDivElement>) => {
    event.stopPropagation();
    
    if (!episode.RunTimeTicks) return;
    
    const rect = event.currentTarget.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const percentage = clickX / rect.width;
    const targetTicks = Math.floor(episode.RunTimeTicks * percentage);
    const targetSeconds = targetTicks / 10000000;
    
    if (episode.Id === id) {
      // Current episode - seek to position
      if (videoRef.current) {
        videoRef.current.currentTime = targetSeconds;
      }
    } else {
      // Different episode - navigate with position
      localStorage.setItem(`player_start_position_${episode.Id}`, targetSeconds.toString());
      navigate(`/player/${episode.Id}`);
    }
  };

  // Restore playback position from localStorage
  useEffect(() => {
    if (!id || !videoRef.current) return;
    
    const savedPosition = localStorage.getItem(`player_start_position_${id}`);
    if (savedPosition) {
      const position = parseFloat(savedPosition);
      videoRef.current.currentTime = position;
      localStorage.removeItem(`player_start_position_${id}`);
    }
  }, [id, streamUrl]);

  // Save auto-mark setting to localStorage
  useEffect(() => {
    localStorage.setItem('autoMarkWatched', autoMarkWatched.toString());
  }, [autoMarkWatched]);

  const handleVideoEnded = async () => {
    // Mark as watched if auto-mark is enabled
    if (autoMarkWatched && item && userId && serverUrl) {
      try {
        const jellyfinSession = localStorage.getItem('jellyfin_session');
        const accessToken = jellyfinSession ? JSON.parse(jellyfinSession).AccessToken : null;
        
        if (accessToken) {
          let normalizedUrl = serverUrl;
          if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
            normalizedUrl = `http://${normalizedUrl}`;
          }
          
          // Mark as played in Jellyfin
          await fetch(
            `${normalizedUrl.replace(/\/$/, '')}/Users/${userId}/PlayedItems/${item.Id}`,
            {
              method: 'POST',
              headers: {
                'X-Emby-Token': accessToken,
              },
            }
          );
          console.log('Marked as watched:', item.Name);
        }
      } catch (error) {
        console.error('Failed to mark as watched:', error);
      }
    }

    const nextEpisode = getNextEpisode();
    if (nextEpisode) {
      console.log('Autoplay: Playing next episode', nextEpisode.Name);
      navigate(`/player/${nextEpisode.Id}`);
    }
  };

  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (!video || !isEpisode) return;

    const timeRemaining = video.duration - video.currentTime;
    // Show preview when 30 seconds remaining
    if (timeRemaining <= 30 && timeRemaining > 0 && !showNextEpisodePreview) {
      const nextEpisode = getNextEpisode();
      if (nextEpisode) {
        setShowNextEpisodePreview(true);
        setCountdown(Math.ceil(timeRemaining));
      }
    }
  };

  const playNextEpisode = () => {
    const nextEpisode = getNextEpisode();
    if (nextEpisode) {
      navigate(`/player/${nextEpisode.Id}`);
    }
  };

  // Countdown effect
  useEffect(() => {
    if (countdown !== null && countdown > 0) {
      countdownInterval.current = setInterval(() => {
        setCountdown(prev => {
          if (prev === null || prev <= 1) {
            return null;
          }
          return prev - 1;
        });
      }, 1000);

      return () => {
        if (countdownInterval.current) {
          clearInterval(countdownInterval.current);
        }
      };
    }
  }, [countdown]);

  // Cleanup countdown on unmount
  useEffect(() => {
    return () => {
      if (countdownInterval.current) {
        clearInterval(countdownInterval.current);
      }
    };
  }, []);

  // Get subtitle URL using edge function
  const getSubtitleUrl = async (subtitleIndex: number): Promise<string> => {
    if (!serverUrl || !id || !user) return '';
    
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return '';
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    // Token in URL is required for browser subtitle tracks (can't send custom headers)
    return `${supabaseUrl}/functions/v1/jellyfin-subtitle?id=${id}&index=${subtitleIndex}&token=${session.access_token}`;
  };

  // Load subtitle URL when selection changes
  useEffect(() => {
    const loadSubtitle = async () => {
      if (selectedSubtitle && selectedSubtitle !== 'none') {
        const subtitleIndex = parseInt(selectedSubtitle, 10);
        console.log('Loading subtitle index:', subtitleIndex);
        const url = await getSubtitleUrl(subtitleIndex);
        console.log('Fetching subtitle from:', url);
        
        try {
          // Fetch subtitle content and create blob URL to avoid CORS issues
          const response = await fetch(url);
          if (!response.ok) {
            console.error('Failed to fetch subtitle:', response.status);
            return;
          }
          const text = await response.text();
          console.log('Subtitle content length:', text.length);
          const blob = new Blob([text], { type: 'text/vtt' });
          const blobUrl = URL.createObjectURL(blob);
          setSubtitleUrl(blobUrl);
        } catch (error) {
          console.error('Error fetching subtitle:', error);
        }
      } else {
        setSubtitleUrl('');
      }
    };
    loadSubtitle();
  }, [selectedSubtitle, serverUrl, id, user]);

  // Programmatically add/update subtitle track
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // First disable all existing text tracks
    for (let i = 0; i < video.textTracks.length; i++) {
      video.textTracks[i].mode = 'disabled';
    }

    // Remove existing track elements
    const existingTracks = video.querySelectorAll('track');
    existingTracks.forEach(track => track.remove());

    if (subtitleUrl) {
      console.log('Adding subtitle track with blob URL');
      const track = document.createElement('track');
      track.kind = 'subtitles';
      track.src = subtitleUrl;
      track.srclang = 'no';
      track.label = 'Undertekster';
      track.default = true;
      video.appendChild(track);
      
      // Enable the track after a short delay
      setTimeout(() => {
        if (video.textTracks.length > 0) {
          video.textTracks[0].mode = 'showing';
          console.log('Subtitle track enabled');
        }
      }, 100);
    } else {
      console.log('Subtitles disabled');
    }

    // Cleanup blob URL when unmounting
    return () => {
      if (subtitleUrl && subtitleUrl.startsWith('blob:')) {
        URL.revokeObjectURL(subtitleUrl);
      }
    };
  }, [subtitleUrl]);


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

  // Load media to cast when connected and stream is ready
  useEffect(() => {
    if (castState.isConnected && streamUrl && item && !castState.mediaInfo) {
      const imageUrl = item.ImageTags?.Primary && serverUrl
        ? `${serverUrl.replace(/\/$/, '')}/Items/${item.Id}/Images/Primary?maxHeight=600`
        : undefined;

      loadMedia(streamUrl, {
        title: item.Name,
        subtitle: item.SeriesName 
          ? `${item.SeriesName}${item.IndexNumber ? ` - Episode ${item.IndexNumber}` : ''}`
          : undefined,
        imageUrl,
        currentTime: item.UserData?.PlaybackPositionTicks ? item.UserData.PlaybackPositionTicks / 10000000 : undefined,
      }).catch(error => console.error('Failed to load media to cast:', error));
    }
  }, [castState.isConnected, streamUrl, item, castState.mediaInfo, loadMedia, serverUrl]);

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

  const previousEpisode = getPreviousEpisode();
  const nextEpisode = getNextEpisode();

  return (
    <TooltipProvider>
      <SidebarProvider open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <div className="relative h-screen bg-black overflow-hidden flex w-full">
        {/* Sidebar Overlay - Click to close */}
        {sidebarOpen && isEpisode && episodes.length > 0 && (
          <div 
            className="fixed inset-0 bg-black/50 z-40 cursor-pointer"
            onClick={() => setSidebarOpen(false)}
          />
        )}
        {/* Episodes Sidebar */}
        {isEpisode && episodes.length > 0 && (
          <Sidebar 
            side="right"
            className="fixed right-0 top-0 h-screen border-l border-border z-50"
            collapsible="offcanvas"
          >
            <SidebarContent className="bg-background/95 backdrop-blur-xl">
              <SidebarGroup>
                <SidebarGroupLabel className="text-base flex items-center justify-between pr-2">
                  {item?.SeriesName}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSidebarOpen(false)}
                    className="h-6 w-6 p-0"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </SidebarGroupLabel>
                <SidebarGroupContent>
                  <div className="space-y-2 p-2">
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
                        <Tooltip key={episode.Id} delayDuration={300}>
                          <TooltipTrigger asChild>
                            <div
                              onClick={() => {
                                if (!isCurrentEpisode) {
                                  navigate(`/player/${episode.Id}`);
                                }
                              }}
                              className={`flex gap-3 p-2 rounded-lg cursor-pointer transition-all ${
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
                                   <div 
                                     className="absolute bottom-0 left-0 right-0 h-1 bg-secondary/50 cursor-pointer hover:h-1.5 transition-all"
                                     onClick={(e) => handleProgressClick(episode, e)}
                                     title={`Hopp til ${Math.floor(watchedPercentage)}%`}
                                   >
                                     <div 
                                       className="h-full bg-primary"
                                       style={{ width: `${watchedPercentage}%` }}
                                     />
                                   </div>
                                 )}
                                 {watchedPercentage === 0 && episode.RunTimeTicks && (
                                   <div 
                                     className="absolute bottom-0 left-0 right-0 h-0.5 bg-secondary/50 hover:h-1.5 cursor-pointer transition-all"
                                     onClick={(e) => handleProgressClick(episode, e)}
                                     title="Klikk for å hoppe til en posisjon"
                                   />
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
                          </TooltipTrigger>
                          {episode.Overview && (
                            <TooltipContent side="left" className="max-w-sm">
                              <p className="text-sm">{episode.Overview}</p>
                            </TooltipContent>
                          )}
                        </Tooltip>
                      );
                    })}
                  </div>
                </SidebarGroupContent>
              </SidebarGroup>
            </SidebarContent>
          </Sidebar>
        )}

        <div 
          className="relative h-screen bg-black overflow-hidden flex-1"
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setShowControls(false)}
        >
          <video
        ref={videoRef}
        key={streamUrl}
        src={streamUrl}
        className="w-full h-full object-contain"
        controls
        autoPlay
        playsInline
        preload="metadata"
        crossOrigin="anonymous"
        onLoadedMetadata={(e) => {
          const video = e.currentTarget;
          console.log('Video loaded:', {
            duration: video.duration,
            videoWidth: video.videoWidth,
            videoHeight: video.videoHeight,
            src: streamUrl?.substring(0, 50) + '...',
            subtitleUrl: subtitleUrl?.substring(0, 50) + '...'
          });
        }}
        onError={handleVideoError}
        onEnded={handleVideoEnded}
        onTimeUpdate={handleTimeUpdate}
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

          <div className="flex gap-2 items-center">
            {/* Auto-mark watched setting */}
            {isEpisode && (
              <div className="flex items-center gap-2 bg-black/50 backdrop-blur-sm rounded-md px-3 py-1.5 border border-white/20">
                <Label htmlFor="auto-mark" className="text-white text-xs whitespace-nowrap cursor-pointer">
                  Auto-marker som sett
                </Label>
                <Switch
                  id="auto-mark"
                  checked={autoMarkWatched}
                  onCheckedChange={setAutoMarkWatched}
                  className="data-[state=checked]:bg-green-600"
                />
              </div>
            )}

            {/* Previous/Next Episode Buttons */}
            {isEpisode && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={playPreviousEpisode}
                  disabled={!previousEpisode}
                  className="text-white hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Forrige episode"
                >
                  <SkipBack className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={playNextEpisode}
                  disabled={!nextEpisode}
                  className="text-white hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Neste episode"
                >
                  <SkipForward className="h-4 w-4" />
                </Button>
              </>
            )}

            {/* Chromecast Button */}
            <Button
              variant="ghost"
              size="sm"
              className={`text-white hover:bg-white/20 ${castState.isConnected ? 'bg-primary/20' : ''}`}
              title={castState.isConnected ? "Koblet til Chromecast" : "Cast allerede tilkoblet i header"}
              disabled
            >
              <Cast className="h-4 w-4" />
            </Button>

            {isEpisode && episodes.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="text-white hover:bg-white/20"
              >
                {sidebarOpen ? <ChevronRight className="h-4 w-4 mr-2" /> : <ChevronLeft className="h-4 w-4 mr-2" />}
                Episoder
              </Button>
            )}
            
            {subtitles.length > 0 && (
              <Select 
                value={selectedSubtitle} 
                onValueChange={(value) => {
                  console.log('User selected subtitle:', value);
                  const sub = subtitles.find(s => s.Index.toString() === value);
                  if (sub) {
                    console.log('Subtitle details:', sub.DisplayTitle, 'Language:', sub.Language, 'Index:', sub.Index);
                  }
                  setSelectedSubtitle(value);
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

            {/* Subtitle Search Dialog */}
            <Dialog open={subtitleSearchOpen} onOpenChange={setSubtitleSearchOpen}>
              <DialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-white hover:bg-white/20"
                  onClick={() => {
                    setSubtitleSearchOpen(true);
                    searchSubtitles('nor');
                  }}
                >
                  <Search className="h-4 w-4 mr-2" />
                  Søk undertekster
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[80vh]">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Subtitles className="h-5 w-5" />
                    Søk etter undertekster
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => searchSubtitles('nor')}
                      disabled={searchingSubtitles}
                    >
                      Norsk
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => searchSubtitles('eng')}
                      disabled={searchingSubtitles}
                    >
                      English
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => searchSubtitles('swe')}
                      disabled={searchingSubtitles}
                    >
                      Svenska
                    </Button>
                  </div>
                  
                  <ScrollArea className="h-[400px] rounded-md border p-4">
                    {searchingSubtitles ? (
                      <div className="flex items-center justify-center h-full">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        <span className="ml-2">Søker...</span>
                      </div>
                    ) : remoteSubtitles.length > 0 ? (
                      <div className="space-y-2">
                        {remoteSubtitles.map((sub) => (
                          <div
                            key={sub.Id}
                            className="flex items-center justify-between p-3 rounded-lg bg-secondary/50 hover:bg-secondary/80 transition-colors"
                          >
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm truncate">{sub.Name}</p>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <span>{sub.Language}</span>
                                <span>•</span>
                                <span>{sub.Provider}</span>
                                {sub.Format && (
                                  <>
                                    <span>•</span>
                                    <span>{sub.Format}</span>
                                  </>
                                )}
                                {sub.DownloadCount && (
                                  <>
                                    <span>•</span>
                                    <span>{sub.DownloadCount} nedlastinger</span>
                                  </>
                                )}
                              </div>
                              {sub.Comment && (
                                <p className="text-xs text-muted-foreground mt-1 truncate">{sub.Comment}</p>
                              )}
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => downloadSubtitle(sub.Id)}
                              disabled={downloadingSubtitle === sub.Id}
                            >
                              {downloadingSubtitle === sub.Id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Download className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                        <Subtitles className="h-12 w-12 mb-2 opacity-50" />
                        <p>Velg et språk for å søke etter undertekster</p>
                        <p className="text-xs mt-1">Krever at Jellyfin har et undertekstplugin installert</p>
                      </div>
                    )}
                  </ScrollArea>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Cast Controls */}
        {castState.isConnected && castState.mediaInfo && (
          <div className="absolute bottom-0 left-0 right-0 p-6 space-y-4 pointer-events-auto">
            <div className="bg-black/80 backdrop-blur-md rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between text-white">
                <span className="text-sm">Caster til {castState.deviceName}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => endSession()}
                  className="text-white hover:bg-white/20"
                >
                  <Square className="h-4 w-4 mr-2" />
                  Stopp casting
                </Button>
              </div>

              {/* Progress bar */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs text-white/70">
                  <span>{formatTime(castState.mediaInfo.currentTime)}</span>
                  <span>{formatTime(castState.mediaInfo.duration)}</span>
                </div>
              </div>

              {/* Play/Pause button */}
              <div className="flex justify-center">
                <Button
                  variant="ghost"
                  size="lg"
                  onClick={playOrPause}
                  className="text-white hover:bg-white/20 w-16 h-16"
                >
                  {castState.mediaInfo.isPaused ? (
                    <Play className="h-8 w-8" />
                  ) : (
                    <Pause className="h-8 w-8" />
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Next Episode Preview */}
      {showNextEpisodePreview && (() => {
        const nextEpisode = getNextEpisode();
        if (!nextEpisode) return null;

        const nextEpisodeImageUrl = nextEpisode.ImageTags?.Primary && serverUrl
          ? `${serverUrl.replace(/\/$/, '')}/Items/${nextEpisode.Id}/Images/Primary?maxHeight=200`
          : null;

        return (
          <div className="absolute bottom-24 right-6 w-80 bg-background/95 backdrop-blur-xl rounded-lg p-4 shadow-2xl border border-border animate-fade-in pointer-events-auto">
            <div className="flex items-start gap-3">
              <div className="w-32 h-20 flex-shrink-0 rounded overflow-hidden bg-secondary">
                {nextEpisodeImageUrl ? (
                  <img
                    src={nextEpisodeImageUrl}
                    alt={nextEpisode.Name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">
                    Ingen bilde
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs text-muted-foreground">Neste episode</p>
                  {countdown !== null && countdown > 0 && (
                    <span className="text-xs font-semibold text-primary">
                      {countdown}s
                    </span>
                  )}
                </div>
                <h3 className="font-semibold text-sm line-clamp-2 mb-3">
                  {nextEpisode.IndexNumber && `${nextEpisode.IndexNumber}. `}{nextEpisode.Name}
                </h3>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={playNextEpisode}
                    className="h-8 text-xs flex-1"
                  >
                    <Play className="h-3 w-3 mr-1" />
                    Spill nå
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setShowNextEpisodePreview(false);
                      setCountdown(null);
                      if (countdownInterval.current) {
                        clearInterval(countdownInterval.current);
                      }
                    }}
                    className="h-8 text-xs"
                  >
                    Lukk
                  </Button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
        </div>
      </div>
    </SidebarProvider>
    </TooltipProvider>
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
