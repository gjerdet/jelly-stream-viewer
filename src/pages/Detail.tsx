import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useEffect, useState, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useServerSettings, getJellyfinImageUrl } from "@/hooks/useServerSettings";
import { useJellyfinApi } from "@/hooks/useJellyfinApi";
import { useJellyfinSession } from "@/hooks/useJellyfinSession";
import { useChromecast } from "@/hooks/useChromecast";
import { Button } from "@/components/ui/button";
import { Play, Plus, ThumbsUp, ChevronLeft, Subtitles, User, CheckCircle, Check, Cast, Film, Search, Download, Loader2, Flag, Copy } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ReportMediaDialog } from "@/components/ReportMediaDialog";
import { ReportDuplicateDialog } from "@/components/ReportDuplicateDialog";
import { CastUnsupportedDialog } from "@/components/CastUnsupportedDialog";
import { EpisodeCard } from "@/components/EpisodeCard";
import { ChromecastController } from "@/components/ChromecastController";
import { getPersistedCastPosition } from "@/components/FloatingCastController";

interface MediaStream {
  Index: number;
  Type: string;
  DisplayTitle?: string;
  Language?: string;
  Codec?: string;
  IsDefault?: boolean;
}

interface JellyfinItemDetail {
  Id: string;
  Name: string;
  Type: string;
  ProductionYear?: number;
  CommunityRating?: number;
  Overview?: string;
  ImageTags?: { Primary?: string; Backdrop?: string };
  BackdropImageTags?: string[];
  RunTimeTicks?: number;
  OfficialRating?: string;
  Genres?: string[];
  Studios?: { Name: string }[];
  People?: { 
    Name: string; 
    Role: string; 
    Type: string; 
    Id?: string;
    PrimaryImageTag?: string;
  }[];
  MediaStreams?: MediaStream[];
  ChildCount?: number;
  RecursiveItemCount?: number;
  UserData?: {
    Played?: boolean;
    PlaybackPositionTicks?: number;
  };
}

interface Season {
  Id: string;
  Name: string;
  IndexNumber?: number;
  ImageTags?: { Primary?: string };
}

interface Episode {
  Id: string;
  Name: string;
  IndexNumber?: number;
  SeasonId: string;
  Overview?: string;
  ImageTags?: { Primary?: string };
  RunTimeTicks?: number;
  UserData?: {
    Played?: boolean;
    PlaybackPositionTicks?: number;
  };
  MediaStreams?: MediaStream[];
}

interface SeasonsResponse {
  Items: Season[];
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

const Detail = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const episodeId = searchParams.get('episodeId');
  const seasonIdFromUrl = searchParams.get('seasonId');
  const { user, loading } = useAuth();
  const { serverUrl, apiKey } = useServerSettings();
  const { castState, requestSession, loadMedia, playOrPause, endSession, remotePlayer, remotePlayerController } = useChromecast();
  const { serverUrl: castServerUrl, apiKey: castApiKey } = useServerSettings();
  const [selectedSubtitle, setSelectedSubtitle] = useState<string>("");
  const [selectedCastAudioTrack, setSelectedCastAudioTrack] = useState<number | undefined>(undefined);
  const [selectedCastSubtitle, setSelectedCastSubtitle] = useState<string>("");
  const [selectedSeasonId, setSelectedSeasonId] = useState<string>("");
  const [isOverviewExpanded, setIsOverviewExpanded] = useState(false);
  const [subtitleSearchOpen, setSubtitleSearchOpen] = useState(false);
  const [searchingSubtitles, setSearchingSubtitles] = useState(false);
  const [remoteSubtitles, setRemoteSubtitles] = useState<RemoteSubtitle[]>([]);
  const [downloadingSubtitle, setDownloadingSubtitle] = useState<string | null>(null);
  const [subtitleTab, setSubtitleTab] = useState<'existing' | 'search'>('existing');
  const [episodeSubtitleSearchOpen, setEpisodeSubtitleSearchOpen] = useState<string | null>(null);
  const [episodeSubtitleTarget, setEpisodeSubtitleTarget] = useState<{ id: string; name: string } | null>(null);
  const [episodeSubtitles, setEpisodeSubtitles] = useState<MediaStream[]>([]);
  const [episodeSubtitleTab, setEpisodeSubtitleTab] = useState<'existing' | 'search'>('existing');
  const [loadingEpisodeSubtitles, setLoadingEpisodeSubtitles] = useState(false);
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false);
  const [castUnsupportedOpen, setCastUnsupportedOpen] = useState(false);
  const [currentCastEpisodeIndex, setCurrentCastEpisodeIndex] = useState<number | null>(null);
  const [currentCastItemId, setCurrentCastItemId] = useState<string | null>(null);
  const [nextEpisodeCountdown, setNextEpisodeCountdown] = useState<number | null>(null);
  const [nextEpisodeDismissed, setNextEpisodeDismissed] = useState(false);
  const episodeRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const queryClient = useQueryClient();

  // Search for remote subtitles via Jellyfin
  const searchSubtitles = async (language: string = 'nor', targetItemId?: string) => {
    const searchId = targetItemId || id;
    if (!searchId) return;
    
    setSearchingSubtitles(true);
    setRemoteSubtitles([]);
    
    try {
      const { data, error } = await supabase.functions.invoke('jellyfin-search-subtitles', {
        body: { itemId: searchId, language }
      });
      
      if (error) throw error;
      
      if (data?.error) {
        toast.error(data.error);
        return;
      }
      
      setRemoteSubtitles(data?.subtitles || []);
      
      if (data?.subtitles?.length === 0) {
        toast.info('Ingen undertekster funnet for dette språket');
      }
    } catch (error) {
      console.error('Error searching subtitles:', error);
      toast.error('Kunne ikke søke etter undertekster');
    } finally {
      setSearchingSubtitles(false);
    }
  };

  // Download subtitle via Jellyfin
  const downloadSubtitle = async (subtitleId: string, targetItemId?: string, subtitleName?: string) => {
    const downloadId = targetItemId || id;
    if (!downloadId) return;
    
    setDownloadingSubtitle(subtitleId);
    
    // Show loading toast immediately
    console.log('Starting subtitle download:', subtitleName);
    const loadingMessage = subtitleName 
      ? `Laster ned: ${subtitleName.substring(0, 50)}${subtitleName.length > 50 ? '...' : ''}`
      : 'Laster ned undertekst...';
    const toastId = toast.loading(loadingMessage);
    console.log('Toast shown with id:', toastId);
    
    try {
      const { data, error } = await supabase.functions.invoke('jellyfin-download-subtitle', {
        body: { itemId: downloadId, subtitleId }
      });
      
      if (error) throw error;
      
      if (data?.success) {
        toast.success('Undertekst lastet ned og lagt til!', { id: toastId });
        // Refresh item data to show new subtitle
        queryClient.invalidateQueries({ queryKey: ['item-detail', id] });
        if (targetItemId) {
          queryClient.invalidateQueries({ queryKey: ['item-detail-player', targetItemId] });
        }
      } else {
        toast.error(data?.error || 'Kunne ikke laste ned undertekst', { id: toastId });
      }
    } catch (error) {
      console.error('Error downloading subtitle:', error);
      toast.error('Kunne ikke laste ned undertekst', { id: toastId });
    } finally {
      setDownloadingSubtitle(null);
    }
  };

  // Open episode subtitle search and fetch existing subtitles
  const openEpisodeSubtitleSearch = async (episodeId: string, episodeName: string) => {
    setEpisodeSubtitleTarget({ id: episodeId, name: episodeName });
    setRemoteSubtitles([]);
    setEpisodeSubtitles([]);
    setEpisodeSubtitleTab('existing');
    setEpisodeSubtitleSearchOpen(episodeId);
    setLoadingEpisodeSubtitles(true);
    setEpisodeSubtitles([]);
    
    // Fetch episode details to get existing subtitles via proxy
    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      
      if (token) {
        const response = await supabase.functions.invoke('jellyfin-proxy', {
          body: {
            endpoint: `/Items/${episodeId}?Fields=MediaStreams`,
            method: 'GET'
          }
        });
        
        if (response.data && !response.error) {
          const subs = response.data.MediaStreams?.filter((s: MediaStream) => s.Type === 'Subtitle') || [];
          console.log('Found existing subtitles:', subs.length, subs);
          setEpisodeSubtitles(subs);
        } else {
          console.error('Error fetching episode via proxy:', response.error);
        }
      }
    } catch (error) {
      console.error('Error fetching episode subtitles:', error);
    } finally {
      setLoadingEpisodeSubtitles(false);
    }
  };

  useEffect(() => {
    if (!loading && !user) {
      navigate("/");
    }
  }, [user, loading, navigate]);

  const handleCastClick = async () => {
    const result = await requestSession();
    if (result?.unsupported) {
      setCastUnsupportedOpen(true);
    }
  };

  // Handle play - either cast or navigate to player
  const handlePlayClick = async () => {
    // For series, we need to find an episode to play
    if (item?.Type === 'Series') {
      // If we have episodes loaded, find the first unwatched or continue from where left off
      if (episodesData?.Items && episodesData.Items.length > 0) {
        // Find first episode with progress (continue watching)
        const continueEpisode = episodesData.Items.find(ep => 
          ep.UserData?.PlaybackPositionTicks && ep.UserData.PlaybackPositionTicks > 0
        );
        
        // Find first unwatched episode
        const firstUnwatched = episodesData.Items.find(ep => !ep.UserData?.Played);
        
        // Use continue episode, then first unwatched, then first episode
        const episodeToPlay = continueEpisode || firstUnwatched || episodesData.Items[0];
        
        if (castState.isConnected) {
          const streamUrl = `${castServerUrl}/Videos/${episodeToPlay.Id}/stream?Static=true&api_key=${castApiKey}`;
          const imageUrl = episodeToPlay.ImageTags?.Primary && castServerUrl
            ? `${castServerUrl.replace(/\/$/, '')}/Items/${episodeToPlay.Id}/Images/Primary?maxHeight=600`
            : undefined;
          
          // Check for persisted position from previous cast session
          const persistedPosition = getPersistedCastPosition(episodeToPlay.Id);
          const resumeTime = persistedPosition || (episodeToPlay.UserData?.PlaybackPositionTicks 
            ? episodeToPlay.UserData.PlaybackPositionTicks / 10000000 
            : undefined);
          
          await loadMedia(streamUrl, {
            title: episodeToPlay.Name,
            subtitle: `${item.Name} - Episode ${episodeToPlay.IndexNumber}`,
            imageUrl,
            currentTime: resumeTime,
          });
          toast.success(`Spiller av "${episodeToPlay.Name}" på ${castState.deviceName}`);
        } else {
          navigate(`/player/${episodeToPlay.Id}`);
        }
        return;
      }
      
      // No episodes loaded yet - show toast and don't navigate
      toast.info('Velg en episode å spille av');
      return;
    }
    
    // For movies and other content
    if (castState.isConnected && item) {
      // Build stream URL for casting
      const streamUrl = `${castServerUrl}/Videos/${id}/stream?Static=true&api_key=${castApiKey}`;
      const imageUrl = item.ImageTags?.Primary && castServerUrl
        ? `${castServerUrl.replace(/\/$/, '')}/Items/${item.Id}/Images/Primary?maxHeight=600`
        : undefined;
      
      // Check for persisted position from previous cast session
      const persistedPosition = id ? getPersistedCastPosition(id) : null;
      const resumeTime = persistedPosition || (item.UserData?.PlaybackPositionTicks 
        ? item.UserData.PlaybackPositionTicks / 10000000 
        : undefined);
      
      await loadMedia(streamUrl, {
        title: item.Name,
        subtitle: item.ProductionYear?.toString(),
        imageUrl,
        currentTime: resumeTime,
      });
      toast.success(`Spiller av "${item.Name}" på ${castState.deviceName}`);
    } else {
      navigate(`/player/${id}`);
    }
  };

  // Handle episode play - either cast or navigate to player
  const handleEpisodePlayClick = async (episode: Episode, episodeIndex?: number, audioTrackIndex?: number) => {
    if (castState.isConnected && item) {
      // Build stream URL with optional audio track
      let streamUrl = `${castServerUrl}/Videos/${episode.Id}/stream?Static=true&api_key=${castApiKey}`;
      if (audioTrackIndex !== undefined) {
        streamUrl += `&AudioStreamIndex=${audioTrackIndex}`;
      }
      
      const imageUrl = episode.ImageTags?.Primary && castServerUrl
        ? `${castServerUrl.replace(/\/$/, '')}/Items/${episode.Id}/Images/Primary?maxHeight=600`
        : undefined;
      
      // Check for persisted position from previous cast session or current playback
      const persistedPosition = getPersistedCastPosition(episode.Id);
      const currentPlaybackTime = castState.mediaInfo?.currentTime;
      const resumeTime = currentPlaybackTime || persistedPosition || (episode.UserData?.PlaybackPositionTicks 
        ? episode.UserData.PlaybackPositionTicks / 10000000 
        : undefined);
      
      await loadMedia(streamUrl, {
        title: episode.Name,
        subtitle: `${item.Name} - Episode ${episode.IndexNumber}`,
        imageUrl,
        currentTime: resumeTime,
      });
      
      // Track current episode and item for audio track changes
      setCurrentCastItemId(episode.Id);
      if (episodeIndex !== undefined) {
        setCurrentCastEpisodeIndex(episodeIndex);
      } else if (episodesData?.Items) {
        const idx = episodesData.Items.findIndex(ep => ep.Id === episode.Id);
        if (idx >= 0) setCurrentCastEpisodeIndex(idx);
      }
      
      // Update selected audio track
      if (audioTrackIndex !== undefined) {
        setSelectedCastAudioTrack(audioTrackIndex);
      }
      
      if (audioTrackIndex === undefined) {
        toast.success(`Spiller av "${episode.Name}" på ${castState.deviceName}`);
      }
    } else {
      navigate(`/player/${episode.Id}`);
    }
  };

  // Episode navigation for Chromecast
  const handleCastPreviousEpisode = () => {
    if (currentCastEpisodeIndex !== null && currentCastEpisodeIndex > 0 && episodesData?.Items) {
      const prevEpisode = episodesData.Items[currentCastEpisodeIndex - 1];
      handleEpisodePlayClick(prevEpisode, currentCastEpisodeIndex - 1);
    }
  };

  const handleCastNextEpisode = () => {
    if (currentCastEpisodeIndex !== null && episodesData?.Items && currentCastEpisodeIndex < episodesData.Items.length - 1) {
      const nextEpisode = episodesData.Items[currentCastEpisodeIndex + 1];
      handleEpisodePlayClick(nextEpisode, currentCastEpisodeIndex + 1);
    }
  };

  // Handle audio track change during Chromecast playback - reload stream with new audio
  const handleCastAudioTrackChange = async (audioIndex: number) => {
    if (!castState.isConnected) return;
    
    // For series episodes
    if (currentCastEpisodeIndex !== null && episodesData?.Items) {
      const currentEpisode = episodesData.Items[currentCastEpisodeIndex];
      if (currentEpisode) {
        toast.info('Bytter lydspor...');
        await reloadCastWithParams(currentEpisode.Id, audioIndex, selectedCastSubtitle ? parseInt(selectedCastSubtitle) : undefined);
        setSelectedCastAudioTrack(audioIndex);
        toast.success('Lydspor byttet');
        return;
      }
    }
    
    // For movies (non-series)
    if (item && item.Type !== 'Series' && id) {
      toast.info('Bytter lydspor...');
      await reloadCastWithParams(id, audioIndex, selectedCastSubtitle ? parseInt(selectedCastSubtitle) : undefined);
      setSelectedCastAudioTrack(audioIndex);
      toast.success('Lydspor byttet');
    }
  };

  // Handle subtitle change during Chromecast playback - reload stream with new subtitle
  const handleCastSubtitleChange = async (subtitleIndex: string) => {
    if (!castState.isConnected) return;
    
    const subIndex = subtitleIndex ? parseInt(subtitleIndex) : undefined;
    
    // For series episodes
    if (currentCastEpisodeIndex !== null && episodesData?.Items) {
      const currentEpisode = episodesData.Items[currentCastEpisodeIndex];
      if (currentEpisode) {
        toast.info('Bytter undertekst...');
        await reloadCastWithParams(currentEpisode.Id, selectedCastAudioTrack, subIndex);
        setSelectedCastSubtitle(subtitleIndex);
        toast.success(subtitleIndex ? 'Undertekst byttet' : 'Undertekst deaktivert');
        return;
      }
    }
    
    // For movies (non-series)
    if (item && item.Type !== 'Series' && id) {
      toast.info('Bytter undertekst...');
      await reloadCastWithParams(id, selectedCastAudioTrack, subIndex);
      setSelectedCastSubtitle(subtitleIndex);
      toast.success(subtitleIndex ? 'Undertekst byttet' : 'Undertekst deaktivert');
    }
  };

  // Reload cast stream with new audio/subtitle parameters
  const reloadCastWithParams = async (itemId: string, audioIndex?: number, subtitleIndex?: number) => {
    let streamUrl = `${castServerUrl}/Videos/${itemId}/stream?Static=true&api_key=${castApiKey}`;
    if (audioIndex !== undefined) {
      streamUrl += `&AudioStreamIndex=${audioIndex}`;
    }
    if (subtitleIndex !== undefined) {
      streamUrl += `&SubtitleStreamIndex=${subtitleIndex}`;
    }
    
    // Preserve current playback position
    const currentPlaybackTime = castState.mediaInfo?.currentTime;
    const persistedPosition = getPersistedCastPosition(itemId);
    const resumeTime = currentPlaybackTime || persistedPosition;
    
    // Get title info
    let title = item?.Name || '';
    let subtitle = '';
    let imageUrl: string | undefined;
    
    if (currentCastEpisodeIndex !== null && episodesData?.Items) {
      const episode = episodesData.Items[currentCastEpisodeIndex];
      if (episode) {
        title = episode.Name;
        subtitle = `${item?.Name} - Episode ${episode.IndexNumber}`;
        imageUrl = episode.ImageTags?.Primary && castServerUrl
          ? `${castServerUrl.replace(/\/$/, '')}/Items/${episode.Id}/Images/Primary?maxHeight=600`
          : undefined;
      }
    } else {
      subtitle = item?.ProductionYear?.toString() || '';
      imageUrl = item?.ImageTags?.Primary && castServerUrl
        ? `${castServerUrl.replace(/\/$/, '')}/Items/${item.Id}/Images/Primary?maxHeight=600`
        : undefined;
    }
    
    await loadMedia(streamUrl, {
      title,
      subtitle,
      imageUrl,
      currentTime: resumeTime,
    });
    
    setCurrentCastItemId(itemId);
  };


  // Scroll to top when opening a detail page
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [id]);

  // Check if item is in favorites
  const { data: isFavorite } = useQuery({
    queryKey: ["is-favorite", id, user?.id],
    queryFn: async () => {
      if (!user || !id) return false;
      const { data, error } = await supabase
        .from("user_favorites")
        .select("id")
        .eq("user_id", user.id)
        .eq("jellyfin_item_id", id)
        .maybeSingle();
      
      if (error) console.error("Error checking favorite:", error);
      return !!data;
    },
    enabled: !!user && !!id,
  });

  // Check if item is liked
  const { data: isLiked } = useQuery({
    queryKey: ["is-liked", id, user?.id],
    queryFn: async () => {
      if (!user || !id) return false;
      const { data, error } = await supabase
        .from("user_likes")
        .select("id")
        .eq("user_id", user.id)
        .eq("jellyfin_item_id", id)
        .maybeSingle();
      
      if (error) console.error("Error checking like:", error);
      return !!data;
    },
    enabled: !!user && !!id,
  });

  // Toggle favorite mutation
  const toggleFavorite = useMutation({
    mutationFn: async () => {
      if (!user || !id || !item) return;

      if (isFavorite) {
        const { error } = await supabase
          .from("user_favorites")
          .delete()
          .eq("user_id", user.id)
          .eq("jellyfin_item_id", id);
        
        if (error) throw error;
      } else {
        const imageUrl = item.ImageTags?.Primary && serverUrl
          ? getJellyfinImageUrl(serverUrl, item.Id, 'Primary', { maxHeight: '600' })
          : undefined;

        const { error } = await supabase
          .from("user_favorites")
          .insert({
            user_id: user.id,
            jellyfin_item_id: id,
            jellyfin_item_name: item.Name,
            jellyfin_item_type: item.Type,
            image_url: imageUrl,
          });
        
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["is-favorite", id, user?.id] });
      toast.success(isFavorite ? "Fjernet fra Min liste" : "Lagt til i Min liste");
    },
    onError: () => {
      toast.error("Noe gikk galt");
    },
  });

  // Toggle like mutation
  const toggleLike = useMutation({
    mutationFn: async () => {
      if (!user || !id) return;

      if (isLiked) {
        const { error } = await supabase
          .from("user_likes")
          .delete()
          .eq("user_id", user.id)
          .eq("jellyfin_item_id", id);
        
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("user_likes")
          .insert({
            user_id: user.id,
            jellyfin_item_id: id,
          });
        
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["is-liked", id, user?.id] });
      toast.success(isLiked ? "Like fjernet" : "Liked!");
    },
    onError: () => {
      toast.error("Noe gikk galt");
    },
  });

  // Get userId from localStorage session (not /Users endpoint which requires admin)
  const { userId } = useJellyfinSession();
  
  // Debug: log session state
  console.log('[Detail] Session state:', { 
    userId, 
    user: user?.id, 
    id,
    jellyfinSessionRaw: localStorage.getItem('jellyfin_session')?.substring(0, 100) 
  });

  // Fetch item details with media streams and backdrop images
  const { data: item, isLoading: itemLoading, error: itemError } = useJellyfinApi<JellyfinItemDetail>(
    ["item-detail", id || ""],
    {
      endpoint: id && userId 
        ? `/Users/${userId}/Items/${id}?Fields=MediaStreams,Overview,Genres,People,Studios,ChildCount,RecursiveItemCount&EnableImageTypes=Primary,Backdrop,Thumb` 
        : "",
    },
    !!user && !!userId && !!id
  );
  
  // Debug: log API state
  console.log('[Detail] Item fetch state:', { itemLoading, hasItem: !!item, error: itemError?.message });

  // Fetch seasons if this is a series
  const { data: seasonsData } = useJellyfinApi<SeasonsResponse>(
    ["series-seasons", id || ""],
    {
      endpoint: id && userId && item?.Type === "Series"
        ? `/Shows/${id}/Seasons?UserId=${userId}&Fields=PrimaryImageAspectRatio`
        : "",
    },
    !!user && !!userId && !!id && item?.Type === "Series"
  );

  // Fetch episodes for selected season with MediaStreams for subtitle info
  const { data: episodesData } = useJellyfinApi<EpisodesResponse>(
    ["season-episodes", selectedSeasonId],
    {
      endpoint: selectedSeasonId && userId
        ? `/Shows/${id}/Episodes?SeasonId=${selectedSeasonId}&UserId=${userId}&Fields=Overview,PrimaryImageAspectRatio,MediaStreams`
        : "",
    },
    !!selectedSeasonId && !!userId
  );

  // Fetch similar items
  const { data: similarItems } = useJellyfinApi<{ Items: JellyfinItemDetail[] }>(
    ["similar-items", id || ""],
    {
      endpoint: id && userId
        ? `/Items/${id}/Similar?UserId=${userId}&Limit=12&Fields=PrimaryImageAspectRatio,Overview`
        : "",
    },
    !!user && !!userId && !!id
  );

  // Auto-select season based on URL parameter or first season
  useEffect(() => {
    if (seasonsData?.Items && seasonsData.Items.length > 0) {
      if (seasonIdFromUrl) {
        // If seasonId is in URL, select that season
        const season = seasonsData.Items.find(s => s.Id === seasonIdFromUrl);
        if (season) {
          setSelectedSeasonId(season.Id);
        }
      } else {
        // Otherwise select first season
        setSelectedSeasonId(seasonsData.Items[0].Id);
      }
    }
  }, [seasonsData, seasonIdFromUrl]);

  // Scroll to episode when episodes load and episodeId is in URL
  useEffect(() => {
    if (episodeId && episodesData?.Items && episodesData.Items.length > 0) {
      const episode = episodesData.Items.find(e => e.Id === episodeId);
      if (episode && episodeRefs.current[episodeId]) {
        setTimeout(() => {
          episodeRefs.current[episodeId]?.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'center' 
          });
        }, 300);
      }
    }
  }, [episodeId, episodesData]);

  // Auto-next episode when Chromecast media ends - start countdown
  useEffect(() => {
    const handleMediaEnded = () => {
      // Only auto-advance for series with a next episode
      if (
        castState.isConnected &&
        item?.Type === 'Series' &&
        currentCastEpisodeIndex !== null &&
        episodesData?.Items &&
        currentCastEpisodeIndex < episodesData.Items.length - 1 &&
        !nextEpisodeDismissed
      ) {
        // Start countdown
        setNextEpisodeCountdown(10);
      }
    };

    window.addEventListener('chromecast-media-ended', handleMediaEnded);
    return () => {
      window.removeEventListener('chromecast-media-ended', handleMediaEnded);
    };
  }, [castState.isConnected, item?.Type, currentCastEpisodeIndex, episodesData?.Items, nextEpisodeDismissed]);

  // Countdown timer for next episode
  useEffect(() => {
    if (nextEpisodeCountdown === null || nextEpisodeCountdown <= 0) return;

    const timer = setInterval(() => {
      setNextEpisodeCountdown(prev => {
        if (prev === null) return null;
        if (prev <= 1) {
          // Play next episode
          if (
            currentCastEpisodeIndex !== null &&
            episodesData?.Items &&
            currentCastEpisodeIndex < episodesData.Items.length - 1
          ) {
            const nextEpisode = episodesData.Items[currentCastEpisodeIndex + 1];
            if (nextEpisode) {
              handleEpisodePlayClick(nextEpisode, currentCastEpisodeIndex + 1);
            }
          }
          return null;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [nextEpisodeCountdown, currentCastEpisodeIndex, episodesData?.Items]);

  // Reset dismissed state when episode changes
  useEffect(() => {
    setNextEpisodeDismissed(false);
    setNextEpisodeCountdown(null);
  }, [currentCastEpisodeIndex]);

  // Cancel next episode countdown
  const handleCancelNextEpisode = () => {
    setNextEpisodeCountdown(null);
    setNextEpisodeDismissed(true);
  };

  // Get next episode name for display
  const nextEpisodeName = currentCastEpisodeIndex !== null && 
    episodesData?.Items && 
    currentCastEpisodeIndex < episodesData.Items.length - 1
    ? episodesData.Items[currentCastEpisodeIndex + 1]?.Name
    : undefined;

  // Get audio tracks from current media (must be after item is defined)
  const audioTracks = item?.MediaStreams?.filter(s => s.Type === 'Audio').map((stream, idx) => ({
    index: stream.Index,
    language: stream.Language || 'Unknown',
    displayTitle: stream.DisplayTitle || stream.Language || `Audio ${idx + 1}`,
    codec: stream.Codec,
    channels: undefined, // Jellyfin doesn't always provide this
  })) || [];

  // Get subtitle tracks from current media
  const subtitleTracks = item?.MediaStreams?.filter(s => s.Type === 'Subtitle').map((stream, idx) => ({
    index: stream.Index,
    language: stream.Language || 'Unknown',
    displayTitle: stream.DisplayTitle || stream.Language || `Subtitle ${idx + 1}`,
    codec: stream.Codec,
    isDefault: stream.IsDefault,
  })) || [];

  if (loading || itemLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Laster...</p>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-20">
          <p className="text-center text-muted-foreground">Innhold ikke funnet</p>
        </div>
      </div>
    );
  }

  const backdropUrl = item.BackdropImageTags?.[0] && serverUrl
    ? getJellyfinImageUrl(serverUrl, item.Id, 'Backdrop', { maxHeight: '1080' })
    : item.ImageTags?.Primary && serverUrl
    ? getJellyfinImageUrl(serverUrl, item.Id, 'Primary', { maxHeight: '1080' })
    : "https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=1920&h=1080&fit=crop";

  // Check if we're using the primary image as backdrop (needs blur effect)
  const isUsingPrimaryAsBackdrop = !item.BackdropImageTags?.[0] && item.ImageTags?.Primary;

  const runtime = item.RunTimeTicks ? Math.round(item.RunTimeTicks / 600000000) : null;

  // Filter subtitle streams
  const subtitles = item.MediaStreams?.filter(stream => stream.Type === "Subtitle") || [];

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section with Backdrop */}
      <div className="relative min-h-[60vh] sm:min-h-[70vh] overflow-hidden">
        {/* Backdrop Image with Blur */}
        <div className="absolute inset-0">
          <img
            src={backdropUrl}
            alt={item.Name}
            className={`w-full h-full object-cover animate-fade-in ${
              isUsingPrimaryAsBackdrop 
                ? 'scale-150 blur-2xl brightness-75' 
                : 'scale-110'
            }`}
          />
          {/* Multiple gradient layers for depth */}
          <div className="absolute inset-0 bg-gradient-to-r from-background via-background/50 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-l from-transparent via-transparent to-background/60" />
          {/* Vignette effect */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(0,0,0,0.3)_100%)]" />
          {/* Stronger overlay when using primary as backdrop */}
          {isUsingPrimaryAsBackdrop && (
            <div className="absolute inset-0 bg-background/40" />
          )}
          {/* Subtle noise texture */}
          <div className="absolute inset-0 opacity-[0.02] bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMDAiIGhlaWdodD0iMzAwIj48ZmlsdGVyIGlkPSJhIiB4PSIwIiB5PSIwIj48ZmVUdXJidWxlbmNlIGJhc2VGcmVxdWVuY3k9Ii43NSIgc3RpdGNoVGlsZXM9InN0aXRjaCIgdHlwZT0iZnJhY3RhbE5vaXNlIi8+PGZlQ29sb3JNYXRyaXggdHlwZT0ic2F0dXJhdGUiIHZhbHVlcz0iMCIvPjwvZmlsdGVyPjxwYXRoIGQ9Ik0wIDBoMzAwdjMwMEgweiIgZmlsdGVyPSJ1cmwoI2EpIiBvcGFjaXR5PSIuMDUiLz48L3N2Zz4=')]" />
        </div>

        <div className="relative container mx-auto px-3 sm:px-4 h-full flex flex-col justify-end pb-6 sm:pb-8 pt-16 sm:pt-20">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(-1)}
            className="absolute top-3 left-3 sm:top-4 sm:left-4 text-white hover:bg-white/20 h-9 px-2 sm:px-3"
          >
            <ChevronLeft className="mr-1 sm:mr-2 h-4 w-4" />
            <span className="hidden sm:inline">Tilbake</span>
          </Button>

          {/* Cover Image + Info Layout - Stack on mobile */}
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-6">
            {item.ImageTags?.Primary && serverUrl && (
              <div className="w-32 h-48 sm:w-40 sm:h-60 md:w-48 md:h-72 flex-shrink-0 rounded-lg overflow-hidden shadow-2xl border-2 border-white/20">
                <img
                  src={getJellyfinImageUrl(serverUrl, item.Id, 'Primary', { maxHeight: '600' })}
                  alt={item.Name}
                  className="w-full h-full object-cover"
                />
              </div>
            )}
            
            <div className="flex-1 text-center sm:text-left">
              <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold mb-2 sm:mb-4 text-white drop-shadow-lg line-clamp-2">
                {item.Name}
              </h1>

              <div className="flex items-center justify-center sm:justify-start gap-2 sm:gap-4 mb-4 sm:mb-6 text-xs sm:text-sm text-white/90 flex-wrap">
                {item.CommunityRating && (
                  <span className="font-semibold text-green-400">
                    {item.CommunityRating.toFixed(1)} ⭐
                  </span>
                )}
                {item.ProductionYear && <span>{item.ProductionYear}</span>}
                {item.OfficialRating && (
                  <span className="px-1.5 sm:px-2 py-0.5 sm:py-1 border border-white/50 rounded text-xs">
                    {item.OfficialRating}
                  </span>
                )}
                {runtime && <span>{runtime} min</span>}
              </div>

              {/* Action Buttons - Better mobile grid */}
              <div className="flex flex-wrap gap-2 sm:gap-3 mb-4 sm:mb-6">
                <Button 
                  size="default"
                  className="gap-1.5 sm:gap-2 text-sm sm:text-base h-10 sm:h-11 flex-1 min-w-[120px] sm:flex-none"
                  onClick={handlePlayClick}
                >
                  {castState.isConnected ? <Cast className="h-4 w-4 sm:h-5 sm:w-5" /> : <Play className="h-4 w-4 sm:h-5 sm:w-5" />}
                  <span className="truncate">
                    {castState.isConnected ? `Cast` : 'Spill av'}
                  </span>
                </Button>

                {/* Chromecast Button - only show when available */}
                {castState.isAvailable && (
                  <Button
                    variant={castState.isConnected ? "default" : "secondary"}
                    size="default"
                    onClick={handleCastClick}
                    className="gap-1.5 sm:gap-2 h-10 sm:h-11"
                    title={castState.isConnected ? "Koblet til Chromecast" : "Koble til Chromecast"}
                  >
                    <Cast className="h-4 w-4 sm:h-5 sm:w-5" />
                    <span className="hidden sm:inline">{castState.isConnected ? "Koblet til" : "Cast"}</span>
                  </Button>
                )}
                <Button 
                  size="default"
                  variant={isFavorite ? "default" : "outline"}
                  className="gap-1.5 sm:gap-2 h-10 sm:h-11"
                  onClick={() => toggleFavorite.mutate()}
                  disabled={toggleFavorite.isPending}
                >
                  {isFavorite ? <Check className="h-4 w-4 sm:h-5 sm:w-5" /> : <Plus className="h-4 w-4 sm:h-5 sm:w-5" />}
                  <span className="hidden sm:inline">Min liste</span>
                </Button>
                <Button 
                  size="default"
                  variant={isLiked ? "default" : "outline"}
                  onClick={() => toggleLike.mutate()}
                  disabled={toggleLike.isPending}
                  className="h-10 sm:h-11"
                >
                  <ThumbsUp className={`h-4 w-4 sm:h-5 sm:w-5 ${isLiked ? 'fill-current' : ''}`} />
                </Button>

                {/* Report Problem Button */}
                <Button
                  size="default"
                  variant="outline"
                  className="gap-1.5 sm:gap-2 h-10 sm:h-11"
                  onClick={() => setReportDialogOpen(true)}
                >
                  <Flag className="h-4 w-4 sm:h-5 sm:w-5" />
                  <span className="hidden sm:inline">Rapporter</span>
                </Button>

                {/* Report Duplicate Button */}
                <Button
                  size="default"
                  variant="outline"
                  className="gap-1.5 sm:gap-2 h-10 sm:h-11"
                  onClick={() => setDuplicateDialogOpen(true)}
                >
                  <Copy className="h-4 w-4 sm:h-5 sm:w-5" />
                  <span className="hidden sm:inline">Duplikat</span>
                </Button>

                {/* Subtitle Dialog - Show existing subtitles and search for new */}
                {item.Type === 'Movie' && (
                  <Dialog open={subtitleSearchOpen} onOpenChange={(open) => {
                    setSubtitleSearchOpen(open);
                    if (!open) {
                      setRemoteSubtitles([]);
                      setSubtitleTab('existing');
                    }
                  }}>
                    <DialogTrigger asChild>
                      <Button
                        size="lg"
                        variant="outline"
                        className="gap-2"
                      >
                        <Subtitles className="h-5 w-5" />
                        Undertekster
                        {subtitles.length > 0 && (
                          <span className="ml-1 px-1.5 py-0.5 text-xs bg-primary/20 rounded">
                            {subtitles.length}
                          </span>
                        )}
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl">
                      <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                          <Subtitles className="h-5 w-5" />
                          Undertekster
                        </DialogTitle>
                      </DialogHeader>
                      
                      {/* Tabs */}
                      <div className="flex gap-2 border-b pb-2">
                        <Button
                          variant={subtitleTab === 'existing' ? 'default' : 'ghost'}
                          size="sm"
                          onClick={() => setSubtitleTab('existing')}
                        >
                          Tilgjengelige ({subtitles.length})
                        </Button>
                        <Button
                          variant={subtitleTab === 'search' ? 'default' : 'ghost'}
                          size="sm"
                          onClick={() => setSubtitleTab('search')}
                        >
                          <Search className="h-4 w-4 mr-2" />
                          Søk og last ned
                        </Button>
                      </div>

                      <div className="space-y-4">
                        {subtitleTab === 'existing' ? (
                          // Existing subtitles tab
                          subtitles.length > 0 ? (
                            <ScrollArea className="h-[350px]">
                              <div className="space-y-2">
                                {subtitles.map((sub) => (
                                  <div
                                    key={sub.Index}
                                    className="flex items-center justify-between p-3 rounded-lg bg-secondary/50"
                                  >
                                    <div className="flex-1 min-w-0">
                                      <p className="font-medium text-sm">
                                        {sub.DisplayTitle || sub.Language || `Undertekst ${sub.Index}`}
                                      </p>
                                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                        {sub.Language && <span>{sub.Language}</span>}
                                        {sub.Codec && (
                                          <>
                                            <span>•</span>
                                            <span className="uppercase">{sub.Codec}</span>
                                          </>
                                        )}
                                        {sub.IsDefault && (
                                          <span className="px-1.5 py-0.5 bg-primary/20 rounded text-primary text-xs">
                                            Standard
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                    <CheckCircle className="h-4 w-4 text-green-500" />
                                  </div>
                                ))}
                              </div>
                            </ScrollArea>
                          ) : (
                            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                              <Subtitles className="h-12 w-12 mb-4 opacity-50" />
                              <p className="text-center">Ingen undertekster tilgjengelig</p>
                              <p className="text-xs mt-2 text-center">Bruk "Søk og last ned" for å finne undertekster</p>
                            </div>
                          )
                        ) : (
                          // Search subtitles tab
                          <>
                            <p className="text-sm text-muted-foreground">
                              Søk etter undertekster via Jellyfin (krever undertekst-plugin som OpenSubtitles)
                            </p>
                            <div className="flex gap-2 flex-wrap">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => searchSubtitles('nor')}
                                disabled={searchingSubtitles}
                              >
                                🇳🇴 Norsk
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => searchSubtitles('eng')}
                                disabled={searchingSubtitles}
                              >
                                🇬🇧 English
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => searchSubtitles('swe')}
                                disabled={searchingSubtitles}
                              >
                                🇸🇪 Svenska
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => searchSubtitles('dan')}
                                disabled={searchingSubtitles}
                              >
                                🇩🇰 Dansk
                              </Button>
                            </div>
                            
                            <ScrollArea className="h-[350px] rounded-md border p-4">
                              {searchingSubtitles ? (
                                <div className="flex flex-col items-center justify-center h-full">
                                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                  <span className="mt-2 text-muted-foreground">Søker...</span>
                                </div>
                              ) : remoteSubtitles.length > 0 ? (
                                <div className="space-y-2">
                                  {remoteSubtitles.map((sub) => (
                                    <div
                                      key={sub.Id}
                                      className="flex items-center justify-between p-3 rounded-lg bg-secondary/50 hover:bg-secondary/80 transition-colors"
                                    >
                                      <div className="flex-1 min-w-0 mr-4">
                                        <p className="font-medium text-sm truncate">{sub.Name}</p>
                                        <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
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
                                              <span>{sub.DownloadCount.toLocaleString()} nedlastinger</span>
                                            </>
                                          )}
                                        </div>
                                      </div>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => downloadSubtitle(sub.Id, undefined, sub.Name)}
                                        disabled={downloadingSubtitle === sub.Id}
                                        className="gap-2"
                                      >
                                        {downloadingSubtitle === sub.Id ? (
                                          <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : (
                                          <Download className="h-4 w-4" />
                                        )}
                                        Last ned
                                      </Button>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                                  <Search className="h-12 w-12 mb-4 opacity-50" />
                                  <p className="text-center">Velg et språk for å søke</p>
                                </div>
                              )}
                            </ScrollArea>
                          </>
                        )}
                      </div>
                    </DialogContent>
                  </Dialog>
                )}
              </div>

              {item.Overview && (
                <div className="max-w-2xl">
                  <div className={`text-white/90 text-lg leading-relaxed overflow-y-auto transition-all duration-300 ${
                    isOverviewExpanded ? 'max-h-96' : 'max-h-24'
                  }`}>
                    <p>{item.Overview}</p>
                  </div>
                  {item.Overview.length > 200 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsOverviewExpanded(!isOverviewExpanded)}
                      className="mt-2 text-white/70 hover:text-white"
                    >
                      {isOverviewExpanded ? 'Vis mindre' : 'Les mer'}
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Seasons and Episodes for Series - BEFORE cast for series */}
      {item.Type === "Series" && seasonsData?.Items && seasonsData.Items.length > 0 && (
        <div className="container mx-auto px-4 py-8 sm:py-12 border-t border-border">
          <h2 className="text-2xl font-bold mb-6">Episoder</h2>
          
          {/* Season Selector */}
          <div className="flex gap-2 mb-6 overflow-x-auto scrollbar-hide pb-2">
            {seasonsData.Items.map((season) => (
              <Button
                key={season.Id}
                variant={selectedSeasonId === season.Id ? "default" : "outline"}
                onClick={() => setSelectedSeasonId(season.Id)}
                className="whitespace-nowrap"
              >
                {season.Name}
              </Button>
            ))}
          </div>

          {/* Chromecast Controller - show when connected */}
          {castState.isConnected && episodesData?.Items && (
            <div className="mb-6">
              <ChromecastController
                castState={castState}
                remotePlayer={remotePlayer}
                remotePlayerController={remotePlayerController}
                onPlayPause={playOrPause}
                onEndSession={endSession}
                audioTracks={audioTracks}
                selectedAudioTrack={selectedCastAudioTrack}
                onAudioTrackChange={handleCastAudioTrackChange}
                subtitleTracks={subtitleTracks}
                selectedSubtitle={selectedCastSubtitle}
                onSubtitleChange={handleCastSubtitleChange}
                hasPreviousEpisode={currentCastEpisodeIndex !== null && currentCastEpisodeIndex > 0}
                hasNextEpisode={currentCastEpisodeIndex !== null && episodesData.Items.length > 0 && currentCastEpisodeIndex < episodesData.Items.length - 1}
                onPreviousEpisode={handleCastPreviousEpisode}
                onNextEpisode={handleCastNextEpisode}
                episodeInfo={currentCastEpisodeIndex !== null ? {
                  current: currentCastEpisodeIndex + 1,
                  total: episodesData.Items.length,
                  seasonNumber: seasonsData?.Items?.find(s => s.Id === selectedSeasonId)?.IndexNumber
                } : undefined}
                nextEpisodeCountdown={nextEpisodeCountdown}
                nextEpisodeName={nextEpisodeName}
                onCancelNextEpisode={handleCancelNextEpisode}
                compact={false}
                itemId={episodesData.Items[currentCastEpisodeIndex || 0]?.Id}
              />
            </div>
          )}

          {/* Episodes List */}
          {episodesData?.Items && episodesData.Items.length > 0 && (
            <div className="space-y-2 sm:space-y-3">
              {episodesData.Items.map((episode, index) => {
                const episodeImageUrl = episode.ImageTags?.Primary && serverUrl
                  ? getJellyfinImageUrl(serverUrl, episode.Id, 'Primary', { maxHeight: '300' })
                  : null;

                return (
                  <EpisodeCard
                    key={episode.Id}
                    episode={episode}
                    seriesName={item?.Name}
                    episodeImageUrl={episodeImageUrl}
                    isSelected={episodeId === episode.Id}
                    isConnectedToCast={castState.isConnected}
                    onPlay={() => handleEpisodePlayClick(episode, index)}
                    onSubtitleSearch={() => openEpisodeSubtitleSearch(episode.Id, `${episode.IndexNumber ? episode.IndexNumber + '. ' : ''}${episode.Name}`)}
                    refCallback={(el) => episodeRefs.current[episode.Id] = el}
                  />
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Additional Info (for Series: shown after episodes) */}
      <div className="container mx-auto px-4 py-8 sm:py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {item.Type === 'Series' && (item.RecursiveItemCount || item.ChildCount) && (
            <div>
              <h3 className="text-lg font-semibold mb-2 text-muted-foreground">Episoder</h3>
              <p>{item.RecursiveItemCount || item.ChildCount} totalt</p>
            </div>
          )}

          {item.Genres && item.Genres.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold mb-2 text-muted-foreground">Sjangere</h3>
              <p>{item.Genres.join(", ")}</p>
            </div>
          )}

          {item.Studios && item.Studios.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold mb-2 text-muted-foreground">Studio</h3>
              <p>{item.Studios.map(s => s.Name).join(", ")}</p>
            </div>
          )}

          {item.People && item.People.length > 0 && (
            <div className="md:col-span-4">
              <h3 className="text-lg font-semibold mb-4 text-muted-foreground">Skuespillere</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {item.People.filter(p => p.Type === "Actor").map((person, index) => {
                  const personImageUrl = person.Id && person.PrimaryImageTag && serverUrl
                    ? getJellyfinImageUrl(serverUrl, person.Id, 'Primary', { tag: person.PrimaryImageTag, maxHeight: '300' })
                    : null;
                  
                  return (
                    <div 
                      key={index} 
                      onClick={() => person.Id && navigate(`/person/${person.Id}`)}
                      className="text-sm space-y-2 cursor-pointer group"
                    >
                      <div className="aspect-[2/3] rounded-lg overflow-hidden bg-secondary smooth-transition group-hover:ring-2 group-hover:ring-primary">
                        {personImageUrl ? (
                          <img
                            src={personImageUrl}
                            alt={person.Name}
                            className="w-full h-full object-cover group-hover:scale-105 smooth-transition"
                            onError={(e) => {
                              const parent = e.currentTarget.parentElement;
                              if (parent) {
                                parent.innerHTML = `<div class="w-full h-full flex items-center justify-center"><svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-muted-foreground"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg></div>`;
                              }
                            }}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <User className="h-12 w-12 text-muted-foreground" />
                          </div>
                        )}
                      </div>
                      <div>
                        <p className="font-medium truncate group-hover:text-primary smooth-transition">{person.Name}</p>
                        {person.Role && (
                          <p className="text-muted-foreground text-xs truncate">{person.Role}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Episode Subtitle Search Dialog */}
      <Dialog 
        open={!!episodeSubtitleSearchOpen} 
        onOpenChange={(open) => {
          if (!open) {
            setEpisodeSubtitleSearchOpen(null);
            setEpisodeSubtitleTarget(null);
            setRemoteSubtitles([]);
            setEpisodeSubtitles([]);
            setEpisodeSubtitleTab('existing');
          }
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Subtitles className="h-5 w-5" />
              Undertekster
            </DialogTitle>
            {episodeSubtitleTarget && (
              <p className="text-sm text-muted-foreground">{episodeSubtitleTarget.name}</p>
            )}
          </DialogHeader>
          
          {/* Tabs */}
          <div className="flex gap-2 border-b pb-2">
            <Button
              variant={episodeSubtitleTab === 'existing' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setEpisodeSubtitleTab('existing')}
            >
              Tilgjengelige ({episodeSubtitles.length})
            </Button>
            <Button
              variant={episodeSubtitleTab === 'search' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setEpisodeSubtitleTab('search')}
            >
              <Search className="h-4 w-4 mr-2" />
              Søk og last ned
            </Button>
          </div>

          <div className="space-y-4">
            {episodeSubtitleTab === 'existing' ? (
              // Existing subtitles tab
              loadingEpisodeSubtitles ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <span className="mt-2 text-muted-foreground">Henter undertekster...</span>
                </div>
              ) : episodeSubtitles.length > 0 ? (
                <ScrollArea className="h-[350px]">
                  <div className="space-y-2">
                    {episodeSubtitles.map((sub) => (
                      <div
                        key={sub.Index}
                        className="flex items-center justify-between p-3 rounded-lg bg-secondary/50"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm">
                            {sub.DisplayTitle || sub.Language || `Undertekst ${sub.Index}`}
                          </p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            {sub.Language && <span>{sub.Language}</span>}
                            {sub.Codec && (
                              <>
                                <span>•</span>
                                <span className="uppercase">{sub.Codec}</span>
                              </>
                            )}
                            {sub.IsDefault && (
                              <span className="px-1.5 py-0.5 bg-primary/20 rounded text-primary text-xs">
                                Standard
                              </span>
                            )}
                          </div>
                        </div>
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                  <Subtitles className="h-12 w-12 mb-4 opacity-50" />
                  <p className="text-center">Ingen undertekster tilgjengelig</p>
                  <p className="text-xs mt-2 text-center">Bruk "Søk og last ned" for å finne undertekster</p>
                </div>
              )
            ) : (
              // Search subtitles tab
              <>
                <div className="flex gap-2 flex-wrap">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => episodeSubtitleTarget && searchSubtitles('nor', episodeSubtitleTarget.id)}
                    disabled={searchingSubtitles}
                  >
                    Norsk
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => episodeSubtitleTarget && searchSubtitles('eng', episodeSubtitleTarget.id)}
                    disabled={searchingSubtitles}
                  >
                    English
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => episodeSubtitleTarget && searchSubtitles('swe', episodeSubtitleTarget.id)}
                    disabled={searchingSubtitles}
                  >
                    Svenska
                  </Button>
                </div>
                
                <ScrollArea className="h-[350px] rounded-md border p-4">
                  {searchingSubtitles ? (
                    <div className="flex flex-col items-center justify-center py-12">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                      <span className="mt-2 text-muted-foreground">Søker...</span>
                    </div>
                  ) : remoteSubtitles.length > 0 ? (
                    <div className="space-y-2">
                      {remoteSubtitles.map((sub) => (
                        <div
                          key={sub.Id}
                          className="flex items-center justify-between p-3 rounded-lg bg-secondary/50 hover:bg-secondary/80 transition-colors"
                        >
                          <div className="flex-1 min-w-0 mr-4">
                            <p className="font-medium text-sm truncate">{sub.Name}</p>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
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
                                  <span>{sub.DownloadCount.toLocaleString()} nedlastinger</span>
                                </>
                              )}
                            </div>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => episodeSubtitleTarget && downloadSubtitle(sub.Id, episodeSubtitleTarget.id, sub.Name)}
                            disabled={downloadingSubtitle === sub.Id}
                            className="gap-2"
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
                    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                      <Search className="h-12 w-12 mb-4 opacity-50" />
                      <p className="text-center">Velg et språk for å søke</p>
                    </div>
                  )}
                </ScrollArea>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Similar Items Section */}
      {similarItems?.Items && similarItems.Items.length > 0 && (
        <div className="container mx-auto px-4 py-12">
          <h2 className="text-2xl font-bold mb-6">Mer som dette</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {similarItems.Items.map((similar) => {
              const similarImageUrl = similar.ImageTags?.Primary && serverUrl
                ? getJellyfinImageUrl(serverUrl, similar.Id, 'Primary', { maxHeight: '400' })
                : null;

              return (
                <div
                  key={similar.Id}
                  onClick={() => navigate(`/detail/${similar.Id}`)}
                  className="cursor-pointer group"
                >
                  <div className="aspect-[2/3] rounded-lg overflow-hidden bg-secondary mb-2 smooth-transition group-hover:ring-2 group-hover:ring-primary">
                    {similarImageUrl ? (
                      <img
                        src={similarImageUrl}
                        alt={similar.Name}
                        className="w-full h-full object-cover group-hover:scale-105 smooth-transition"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Film className="h-12 w-12 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  <h3 className="font-medium text-sm line-clamp-2 group-hover:text-primary smooth-transition">
                    {similar.Name}
                  </h3>
                  {similar.ProductionYear && (
                    <p className="text-xs text-muted-foreground">{similar.ProductionYear}</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Report Media Dialog */}
      <ReportMediaDialog
        open={reportDialogOpen}
        onOpenChange={setReportDialogOpen}
        itemId={item.Id}
        itemName={item.Name}
        itemType={item.Type}
        imageUrl={item.ImageTags?.Primary && serverUrl 
          ? getJellyfinImageUrl(serverUrl, item.Id, 'Primary', { maxHeight: '600' })
          : undefined
        }
      />

      {/* Report Duplicate Dialog */}
      <ReportDuplicateDialog
        open={duplicateDialogOpen}
        onOpenChange={setDuplicateDialogOpen}
        itemId={item.Id}
        itemName={item.Name}
        itemType={item.Type}
        imageUrl={item.ImageTags?.Primary && serverUrl 
          ? getJellyfinImageUrl(serverUrl, item.Id, 'Primary', { maxHeight: '600' })
          : undefined
        }
      />

      {/* Cast Unsupported Dialog - for Firefox/Safari users */}
      <CastUnsupportedDialog 
        open={castUnsupportedOpen} 
        onOpenChange={setCastUnsupportedOpen} 
      />
    </div>
  );
};

export default Detail;
