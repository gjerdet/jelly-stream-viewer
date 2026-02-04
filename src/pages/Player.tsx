import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useServerSettings } from "@/hooks/useServerSettings";
import { useJellyfinApi } from "@/hooks/useJellyfinApi";
import { useJellyfinSession } from "@/hooks/useJellyfinSession";
import { useChromecast } from "@/hooks/useChromecast";
import { useDebouncedVisibility } from "@/hooks/useDebouncedVisibility";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Subtitles, Cast, Play, Pause, Square, ChevronLeft, ChevronRight, SkipBack, SkipForward, CheckCircle, Search, Download, Loader2, FastForward, Maximize, Minimize, Info, AlertCircle, RefreshCw, Settings, Copy, Volume2, VolumeX, List, Music } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { CastUnsupportedDialog } from "@/components/CastUnsupportedDialog";
import PlayerStatsPanel from "@/components/player/PlayerStatsPanel";
import { formatTime, formatBytes } from "@/lib/playerUtils";
import type { 
  MediaStream, 
  MediaSource, 
  PlaybackInfo, 
  JellyfinItemDetail, 
  Episode, 
  EpisodesResponse,
  RemoteSubtitle,
  MediaSegment,
  MediaSegmentsResponse 
} from "@/types/jellyfin";

const Player = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { user } = useAuth();
  const { serverUrl, apiKey } = useServerSettings();
  const { t } = useLanguage();
  const player = t.player as any;
  const { castState, isLoading: castLoading, requestSession, playOrPause, endSession, loadMedia } = useChromecast();
  const videoRef = useRef<HTMLVideoElement>(null);
  const lastAutoplayUrlRef = useRef<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerElement, setContainerElement] = useState<HTMLDivElement | null>(null);
  const [showControls, setShowControls] = useState(true);
  const [selectedSubtitle, setSelectedSubtitle] = useState<string>("");
  // Audio track selection - initialized from localStorage when item loads
  const [selectedAudioTrack, setSelectedAudioTrack] = useState<string>("");
  // Flag to prevent setting streamUrl before audio track is initialized
  const [audioTrackInitialized, setAudioTrackInitialized] = useState(false);
  const [subtitleUrl, setSubtitleUrl] = useState<string>("");
  const [streamUrl, setStreamUrl] = useState<string>("");
  // Track the last manually set audio to avoid race conditions
  const audioTrackUserSelectedRef = useRef<string | null>(null);
  // Used to preserve playback position when swapping streams (e.g. audio track)
  const pendingSeekSecondsRef = useRef<number | null>(null);
  const resumeAfterStreamSwapRef = useRef<boolean>(true);
  const [watchHistoryId, setWatchHistoryId] = useState<string | null>(null);
  const [showNextEpisodePreview, setShowNextEpisodePreview] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [nextEpisodeDismissed, setNextEpisodeDismissed] = useState(false);
  const [subtitleSearchOpen, setSubtitleSearchOpen] = useState(false);
  const [searchingSubtitles, setSearchingSubtitles] = useState(false);
  const [remoteSubtitles, setRemoteSubtitles] = useState<RemoteSubtitle[]>([]);
  const [downloadingSubtitle, setDownloadingSubtitle] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [castUnsupportedOpen, setCastUnsupportedOpen] = useState(false);
  
  // Custom player controls state
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  
  // Progress bar hover state
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [hoverPosition, setHoverPosition] = useState<number>(0);
  const progressBarRef = useRef<HTMLDivElement>(null);
  
  // Double-tap to seek state
  const [doubleTapSide, setDoubleTapSide] = useState<'left' | 'right' | null>(null);
  const lastTapRef = useRef<{ time: number; x: number } | null>(null);
  const doubleTapTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Segment skip state (intro/credits)
  const [mediaSegments, setMediaSegments] = useState<MediaSegment[]>([]);
  const [currentSegment, setCurrentSegment] = useState<MediaSegment | null>(null);
  const [showSkipButton, setShowSkipButton] = useState(false);
  
  // Streaming status and error state
  const [streamError, setStreamError] = useState<string | null>(null);
  // Status from info endpoint (metadata)
  const [streamHttpStatus, setStreamHttpStatus] = useState<number | null>(null);
  // Status from probing the actual stream URL (Range request)
  const [streamProbeStatus, setStreamProbeStatus] = useState<number | null>(null);
  const [streamProbeContentType, setStreamProbeContentType] = useState<string | null>(null);
  const [streamProbeAcceptRanges, setStreamProbeAcceptRanges] = useState<string | null>(null);
  const [streamProbeContentRange, setStreamProbeContentRange] = useState<string | null>(null);
  
  // HLS is disabled - always use MP4 streaming which works reliably
  const useHls = false;

  const [streamStatus, setStreamStatus] = useState<{
    isTranscoding: boolean;
    codec: string | null;
    bitrate: string | null;
    container: string | null;
    resolution: string | null;
    userIdSource: string | null;
  }>({ isTranscoding: false, codec: null, bitrate: null, container: null, resolution: null, userIdSource: null });
  const [showStreamStatus, setShowStreamStatus] = useState(false);
  const [showStatsPanel, setShowStatsPanel] = useState(false);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [fallbackAttempted, setFallbackAttempted] = useState(false);
  
  // Start position for server-side seeking (when byte-range is not supported)
  const [streamStartPosition, setStreamStartPosition] = useState<number>(0);
  
  // Track if we're using direct streaming (seamless) or proxy (with refreshes)
  const [usingDirectStream, setUsingDirectStream] = useState(false);
  
  // Force direct streaming mode (bypass proxy for better performance)
  const [forceDirectStream, setForceDirectStream] = useState<boolean>(() => {
    const saved = localStorage.getItem('forceDirectStream');
    return saved === 'true';
  });
  
  // Proactive stream refresh to avoid edge function timeout (~150s)
  // We refresh at ~120s to ensure seamless playback (only for proxy streaming)
  const STREAM_REFRESH_INTERVAL = 120; // seconds before proactive refresh
  const streamStartTimeRef = useRef<number>(Date.now());
  const proactiveRefreshTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isSeekingViaReloadRef = useRef(false);
  const [fallbackBitrate, setFallbackBitrate] = useState<number | null>(null);
  
  // Buffering overlay state (debounced to avoid flickering on micro-buffering)
  const { visible: isBuffering, show: showBuffering, hide: hideBuffering } =
    useDebouncedVisibility({ showDelayMs: 350, minVisibleMs: 650 });

  // Seeking state (for showing loading spinner when reloading stream for seek)
  const [isSeekingReload, setIsSeekingReload] = useState(false);
  const [seekTargetTime, setSeekTargetTime] = useState<number | null>(null);
  
  // Slider dragging state for stable seeking (only seek on release for transcoded streams)
  const [isDraggingSlider, setIsDraggingSlider] = useState(false);
  const [sliderDragValue, setSliderDragValue] = useState<number>(0);
  
  // Network stats
  const [networkStats, setNetworkStats] = useState<{
    downloadSpeed: number | null; // bytes per second
    bufferedSeconds: number;
    totalBytes: number;
  }>({ downloadSpeed: null, bufferedSeconds: 0, totalBytes: 0 });
  const lastBytesRef = useRef<{ bytes: number; time: number } | null>(null);
  
  // Quality selection
  type QualityOption = 'auto' | '1080p' | '720p' | '480p' | '360p';
  const [selectedQuality, setSelectedQuality] = useState<QualityOption>(() => {
    const saved = localStorage.getItem('preferredQuality');
    return (saved as QualityOption) || 'auto';
  });
  const qualityOptions: { value: QualityOption; label: string; bitrate: number }[] = [
    { value: 'auto', label: 'Auto', bitrate: 0 },
    { value: '1080p', label: '1080p (8 Mbps)', bitrate: 8000000 },
    { value: '720p', label: '720p (4 Mbps)', bitrate: 4000000 },
    { value: '480p', label: '480p (2 Mbps)', bitrate: 2000000 },
    { value: '360p', label: '360p (1 Mbps)', bitrate: 1000000 },
  ];
  
  const hideControlsTimer = useRef<NodeJS.Timeout>();
  const countdownInterval = useRef<NodeJS.Timeout>();

  // Keep a stable reference to the fullscreen container and also expose it for Sheet portals.
  // (Important: the player initially renders a loading view, so we can't rely on a mount-only effect.)
  const setContainerNode = useCallback((node: HTMLDivElement | null) => {
    containerRef.current = node;
    setContainerElement(node);
  }, []);

  // Fullscreen toggle - makes the container fullscreen so overlays stay visible
  const toggleFullscreen = async () => {
    if (!containerRef.current) return;
    
    try {
      if (!document.fullscreenElement) {
        await containerRef.current.requestFullscreen();
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch (error) {
      console.error('Fullscreen error:', error);
    }
  };

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

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
        toast.info(player.noSubtitlesFound || 'No subtitles found');
      }
    } catch (error) {
      console.error('Error searching subtitles:', error);
      toast.error(player.searchError || 'Could not search for subtitles');
    } finally {
      setSearchingSubtitles(false);
    }
  };

  // Download subtitle via Jellyfin
  const downloadSubtitle = async (subtitleId: string, subtitleName?: string) => {
    if (!id) return;
    
    setDownloadingSubtitle(subtitleId);
    
    const toastId = toast.loading(
      subtitleName 
        ? `${player.downloading || 'Downloading'}: ${subtitleName.substring(0, 50)}${subtitleName.length > 50 ? '...' : ''}`
        : `${player.downloading || 'Downloading'}...`
    );
    
    try {
      const { data, error } = await supabase.functions.invoke('jellyfin-download-subtitle', {
        body: { itemId: id, subtitleId }
      });
      
      if (error) throw error;
      
      if (data?.success) {
        toast.success(player.downloadSuccess || 'Subtitle downloaded! Refresh the page to use it.', { id: toastId });
        setSubtitleSearchOpen(false);
      } else {
        toast.error(data?.error || player.downloadError || 'Could not download subtitle', { id: toastId });
      }
    } catch (error) {
      console.error('Error downloading subtitle:', error);
      toast.error(player.downloadError || 'Could not download subtitle', { id: toastId });
    } finally {
      setDownloadingSubtitle(null);
    }
  };

  // Get userId from localStorage session (not /Users endpoint which requires admin)
  const { userId } = useJellyfinSession();

  // Stream via edge function proxy to avoid Mixed Content / Private Network Access issues
  // IMPORTANT: Wait for audioTrackInitialized to prevent race condition where stream starts before audio preference is loaded
  useEffect(() => {
    const setupStream = async () => {
      if (!id || !audioTrackInitialized) return;
      
      setStreamError(null);
      
      // Check if direct streaming should be used:
      // 1. Force direct stream is enabled (user preference)
      // 2. OR Jellyfin URL is HTTPS (automatic seamless mode)
      const isHttps = serverUrl?.startsWith('https://');
      const useDirectStreaming = forceDirectStream || isHttps;
      
      if (useDirectStreaming && serverUrl && apiKey) {
        // Use direct streaming for seamless playback (no proxy, no timeouts)
        const jellyfinSession = localStorage.getItem('jellyfin_session');
        const jellyfinToken = jellyfinSession ? JSON.parse(jellyfinSession).AccessToken : null;
        
        if (jellyfinToken) {
          const baseUrl = serverUrl.replace(/\/$/, '');
          
          // For seeking support, we need to use the transcoding endpoint with StartTimeTicks
          // Direct static streaming doesn't support seeking reliably
          let streamingUrl: string;
          
          if (streamStartPosition > 0) {
            // Use transcoding endpoint for seeking support - include all required parameters
            const startTicks = Math.floor(streamStartPosition * 10000000);
            const params = new URLSearchParams({
              UserId: userId || '',
              api_key: apiKey,
              VideoCodec: 'h264',
              AudioCodec: 'aac',
              VideoBitrate: '8000000',
              AudioBitrate: '192000',
              TranscodingContainer: 'mp4',
              TranscodingProtocol: 'http',
              StartTimeTicks: startTicks.toString(),
            });
            if (selectedAudioTrack) {
              params.set('AudioStreamIndex', selectedAudioTrack);
            }
            streamingUrl = `${baseUrl}/Videos/${id}/stream.mp4?${params.toString()}`;
            console.log(`Direct stream seeking to ${streamStartPosition}s (ticks: ${startTicks})`);
          } else {
            // Use static stream for initial playback
            streamingUrl = `${baseUrl}/Videos/${id}/stream?Static=true&api_key=${apiKey}`;
            // Add audio stream index if selected
            if (selectedAudioTrack) {
              streamingUrl += `&AudioStreamIndex=${selectedAudioTrack}`;
            }
          }
          
          console.log('Using DIRECT streaming', forceDirectStream ? '(forced by user)' : '(HTTPS detected)', 'startPosition:', streamStartPosition);
          setUsingDirectStream(true);
          setStreamUrl(streamingUrl);
          return;
        }
      }
      
      // Fallback to proxy streaming (with periodic refreshes due to edge function timeout)
      const { data: { session } } = await supabase.auth.getSession();
      const supabaseToken = session?.access_token;
      
      if (!supabaseToken) {
        console.error('No Supabase session token found');
        setStreamError('Ikke innlogget. Vennligst logg inn på nytt.');
        return;
      }
      
      // Use edge function proxy for streaming (handles HTTPS→HTTP, codec detection, transcoding)
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://ypjihlfhxqyrpfjfmjdm.supabase.co';
      let streamingUrl = `${supabaseUrl}/functions/v1/jellyfin-stream?id=${id}&token=${supabaseToken}`;
      
      // Add quality parameter if not auto
      if (selectedQuality !== 'auto') {
        const qualityConfig = qualityOptions.find(q => q.value === selectedQuality);
        if (qualityConfig) {
          streamingUrl += `&bitrate=${qualityConfig.bitrate}`;
        }
      }

      // Always add audio track parameter to ensure correct audio is selected
      if (selectedAudioTrack) {
        streamingUrl += `&audioIndex=${selectedAudioTrack}`;
      }
      
      // Add HLS parameter if enabled
      if (useHls) {
        streamingUrl += '&hls=true';
      }
      
      // Add start position for server-side seeking (used when byte-range is not supported)
      if (streamStartPosition > 0) {
        streamingUrl += `&startPosition=${streamStartPosition}`;
      }
      
      console.log('Using PROXY streaming with quality:', selectedQuality, 'audio:', selectedAudioTrack || 'default', 'HLS:', useHls, 'startPosition:', streamStartPosition);
      setUsingDirectStream(false);
      setStreamUrl(streamingUrl);
    };

    setupStream();
  }, [id, selectedQuality, selectedAudioTrack, audioTrackInitialized, useHls, streamStartPosition, serverUrl, apiKey, forceDirectStream, userId]);

  // Start playback when stream URL changes + setup proactive refresh timer
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !streamUrl) return;

    if (lastAutoplayUrlRef.current === streamUrl) return;
    lastAutoplayUrlRef.current = streamUrl;

    // Track when this stream segment started
    streamStartTimeRef.current = Date.now();
    
    // Clear any existing proactive refresh timer
    if (proactiveRefreshTimerRef.current) {
      clearTimeout(proactiveRefreshTimerRef.current);
      proactiveRefreshTimerRef.current = null;
    }

    // Regular MP4 stream
    console.log('Using direct MP4 streaming');
    try {
      video.pause();
      video.src = streamUrl;
      video.load();
    } catch (e) {
      console.log('Failed to reload video source:', e);
    }

    // If we are about to restore a seek position (audio swap), resume after metadata+seek.
    if (pendingSeekSecondsRef.current !== null) return;

    const p = video.play();
    if (p && typeof (p as any).catch === 'function') {
      (p as Promise<void>).catch((err: any) => {
        console.log('Autoplay blocked:', err?.name || err);
        toast.info('Trykk på videoen for å starte avspilling');
      });
    }
    
    // Setup proactive refresh timer to avoid edge function timeout
    // ONLY for proxy streaming - direct streaming doesn't need this!
    if (!usingDirectStream) {
      proactiveRefreshTimerRef.current = setTimeout(() => {
        const currentVideo = videoRef.current;
        if (!currentVideo || currentVideo.paused || currentVideo.ended) return;
        if (isSeekingReload) return; // Don't refresh if already seeking
        
        console.log('Proactive stream refresh triggered at', currentVideo.currentTime);
        
        // Silently refresh - don't show toast for proactive refresh
        isSeekingViaReloadRef.current = true;
        setIsSeekingReload(true);
        setSeekTargetTime(currentVideo.currentTime);
        setStreamStartPosition(currentVideo.currentTime);
      }, STREAM_REFRESH_INTERVAL * 1000);
    }
    
    return () => {
      if (proactiveRefreshTimerRef.current) {
        clearTimeout(proactiveRefreshTimerRef.current);
        proactiveRefreshTimerRef.current = null;
      }
    };
  }, [streamUrl]);

  // Save quality preference
  useEffect(() => {
    localStorage.setItem('preferredQuality', selectedQuality);
  }, [selectedQuality]);

  // Fetch stream status (codec info) from edge function
  useEffect(() => {
    const fetchStreamStatus = async () => {
      if (!id || !audioTrackInitialized) return;

      const { data: { session } } = await supabase.auth.getSession();
      const supabaseToken = session?.access_token;
      if (!supabaseToken) return;

      try {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://ypjihlfhxqyrpfjfmjdm.supabase.co';

        let infoUrl = `${supabaseUrl}/functions/v1/jellyfin-stream?id=${id}&token=${supabaseToken}&info=true`;

        if (selectedQuality !== 'auto') {
          const qualityConfig = qualityOptions.find(q => q.value === selectedQuality);
          if (qualityConfig) infoUrl += `&bitrate=${qualityConfig.bitrate}`;
        }

        if (selectedAudioTrack) {
          infoUrl += `&audioIndex=${selectedAudioTrack}`;
        }

        const response = await fetch(infoUrl);

        setStreamHttpStatus(response.status);

        if (response.ok) {
          const info = await response.json();
          setStreamStatus({
            isTranscoding: info.isTranscoding || false,
            codec: info.videoCodec || null,
            bitrate: info.bitrate || null,
            container: info.container || null,
            resolution: info.resolution || null,
            userIdSource: info.userIdSource || null,
          });
        }
      } catch (error) {
        console.log('Could not fetch stream status:', error);
        setStreamHttpStatus(-1); // indicates network error
      }
    };

    fetchStreamStatus();
  }, [id, selectedQuality, selectedAudioTrack, audioTrackInitialized]);

  // Probe the actual stream URL on-demand (when diagnostics is opened)
  useEffect(() => {
    const probeStream = async () => {
      if (!showDiagnostics || !id) return;

      setStreamProbeStatus(null);
      setStreamProbeContentType(null);
      setStreamProbeAcceptRanges(null);
      setStreamProbeContentRange(null);

      const { data: { session } } = await supabase.auth.getSession();
      const supabaseToken = session?.access_token;
      if (!supabaseToken) {
        setStreamProbeStatus(401);
        return;
      }

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://ypjihlfhxqyrpfjfmjdm.supabase.co';
      let streamingUrl = `${supabaseUrl}/functions/v1/jellyfin-stream?id=${id}&token=${supabaseToken}`;

      if (selectedQuality !== 'auto') {
        const qualityConfig = qualityOptions.find(q => q.value === selectedQuality);
        if (qualityConfig) streamingUrl += `&bitrate=${qualityConfig.bitrate}`;
      }

      try {
        const response = await fetch(streamingUrl, {
          headers: { Range: 'bytes=0-0' },
        });

        setStreamProbeStatus(response.status);
        setStreamProbeContentType(response.headers.get('content-type'));
        setStreamProbeAcceptRanges(response.headers.get('accept-ranges'));
        setStreamProbeContentRange(response.headers.get('content-range'));

        // Consume the tiny response so the connection closes cleanly
        await response.arrayBuffer().catch(() => null);
      } catch (error) {
        console.log('Could not probe stream:', error);
        setStreamProbeStatus(-1);
        setStreamProbeContentType(null);
      }
    };

    probeStream();
  }, [showDiagnostics, id, selectedQuality]);
  
  // Handle video errors with user-friendly messages and fallback
  const handleVideoError = async (e: React.SyntheticEvent<HTMLVideoElement>) => {
    const video = e.currentTarget;
    const errorCode = video.error?.code;
    const errorMessage = video.error?.message ?? '';

    console.error('Video error:', {
      errorCode,
      errorMessage,
      networkState: video.networkState,
      readyState: video.readyState,
      fallbackAttempted,
    });

    // Attempt fallback on DEMUXER_ERROR or unsupported format BEFORE showing error
    const isDemuxerError = errorMessage.includes('DEMUXER_ERROR') || errorMessage.includes('FFmpegDemuxer');
    const isFormatError = errorCode === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED;

    if ((isDemuxerError || isFormatError) && !fallbackAttempted) {
      console.log('Attempting fallback with lower bitrate transcoding...');
      setFallbackAttempted(true);

      const { data: { session } } = await supabase.auth.getSession();
      const supabaseToken = session?.access_token;

      if (supabaseToken && id) {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://ypjihlfhxqyrpfjfmjdm.supabase.co';
        // Use a lower fallback bitrate (4 Mbps) to encourage a fresh transcode
        const fallbackBitrateValue = 4000000;
        setFallbackBitrate(fallbackBitrateValue);

        const fallbackUrl = `${supabaseUrl}/functions/v1/jellyfin-stream?id=${id}&token=${supabaseToken}&bitrate=${fallbackBitrateValue}`;
        console.log('Fallback stream URL:', fallbackUrl);
        toast.info('Transkoding feilet, prøver lavere kvalitet...');
        setStreamUrl(fallbackUrl);
        return; // don't show error yet
      }
    }

    // Otherwise, show error to user
    let userMessage = 'Kunne ikke spille av video.';

    if (errorCode === MediaError.MEDIA_ERR_NETWORK) {
      userMessage = 'Nettverksfeil. Sjekk internettforbindelsen din.';
    } else if (isDemuxerError || isFormatError) {
      userMessage = 'Videoformatet støttes ikke. Prøv en annen nettleser eller kvalitetsinnstilling.';
    } else if (errorCode === MediaError.MEDIA_ERR_DECODE) {
      userMessage = 'Kunne ikke dekode video. Prøv å laste siden på nytt.';
    } else if (video.networkState === HTMLMediaElement.NETWORK_NO_SOURCE) {
      userMessage = 'Kunne ikke koble til Jellyfin-serveren.';
    }

    setStreamError(userMessage);
  };

  // Copy diagnostics to clipboard
  const copyDiagnosticsToClipboard = async () => {
    const report = [
      `== Diagnoserapport ==`,
      `HTTP (info): ${streamHttpStatus === -1 ? 'Nettverksfeil' : streamHttpStatus ?? '–'}`,
      `HTTP (stream): ${streamProbeStatus === -1 ? 'Nettverksfeil' : streamProbeStatus ?? '–'}`,
      `Content-Type: ${streamProbeContentType || '–'}`,
      `Bruker-id-kilde: ${streamStatus.userIdSource || '–'}`,
      `Video-codec: ${streamStatus.codec || '–'}`,
      `Container: ${streamStatus.container || '–'}`,
      `Oppløsning: ${streamStatus.resolution || '–'}`,
      `Bitrate: ${streamStatus.bitrate || '–'}`,
      `Transkoding: ${streamStatus.isTranscoding ? 'Ja' : 'Nei'}`,
      fallbackAttempted ? `Fallback prøvd: Ja (${fallbackBitrate ? fallbackBitrate / 1000000 : '?'} Mbps)` : '',
      streamError ? `Feil: ${streamError}` : '',
      `Tidspunkt: ${new Date().toISOString()}`,
    ].filter(Boolean).join('\n');

    try {
      await navigator.clipboard.writeText(report);
      toast.success('Diagnoserapport kopiert!');
    } catch (err) {
      console.error('Clipboard copy failed', err);
      toast.error('Kunne ikke kopiere');
    }
  };

  // Retry streaming
  const retryStream = async () => {
    setStreamError(null);
    setStreamUrl('');
    setFallbackAttempted(false);
    setFallbackBitrate(null);

    // Small delay before retrying
    await new Promise(resolve => setTimeout(resolve, 500));

    const { data: { session } } = await supabase.auth.getSession();
    const supabaseToken = session?.access_token;

    if (!supabaseToken) {
      setStreamError('Ikke innlogget. Vennligst logg inn på nytt.');
      return;
    }

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://ypjihlfhxqyrpfjfmjdm.supabase.co';
    let streamingUrl = `${supabaseUrl}/functions/v1/jellyfin-stream?id=${id}&token=${supabaseToken}`;

    // Respect quality selection
    if (selectedQuality !== 'auto') {
      const qualityConfig = qualityOptions.find(q => q.value === selectedQuality);
      if (qualityConfig) streamingUrl += `&bitrate=${qualityConfig.bitrate}`;
    }

    setStreamUrl(streamingUrl);
    toast.info('Prøver på nytt...');
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
  const audioTracks = useMemo(() => 
    item?.MediaStreams?.filter(stream => stream.Type === "Audio") || [], 
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

  // Load saved audio track preference for this media item (or series)
  // Also marks audio as initialized so stream setup can proceed
  useEffect(() => {
    if (!item?.Id || audioTracks.length === 0) return;
    
    // Use series ID for episodes so audio preference persists across episodes
    const mediaKey = item.SeriesId || item.Id;
    const savedAudioIndex = localStorage.getItem(`audioTrack_${mediaKey}`);
    
    if (savedAudioIndex) {
      // Verify the saved index exists in available tracks
      const trackExists = audioTracks.some(t => t.Index.toString() === savedAudioIndex);
      if (trackExists) {
        console.log('Restoring saved audio track:', savedAudioIndex);
        setSelectedAudioTrack(savedAudioIndex);
        audioTrackUserSelectedRef.current = savedAudioIndex;
        setAudioTrackInitialized(true);
        return;
      }
    }
    
    // Default to the first default audio track or first track
    const defaultAudio = audioTracks.find(t => t.IsDefault) || audioTracks[0];
    if (defaultAudio) {
      console.log('Auto-selecting default audio track:', defaultAudio.Index);
      setSelectedAudioTrack(defaultAudio.Index.toString());
    }
    setAudioTrackInitialized(true);
  }, [item?.Id, item?.SeriesId, audioTracks]);

  // Save audio track preference when user changes it
  useEffect(() => {
    if (!item?.Id || !selectedAudioTrack) return;
    
    // Only save if user explicitly selected (not auto-selected)
    if (audioTrackUserSelectedRef.current === selectedAudioTrack) {
      const mediaKey = item.SeriesId || item.Id;
      localStorage.setItem(`audioTrack_${mediaKey}`, selectedAudioTrack);
      console.log('Saved audio track preference:', selectedAudioTrack, 'for', mediaKey);
    }
  }, [selectedAudioTrack, item?.Id, item?.SeriesId]);

  // Fetch media segments (intro, credits, etc.) from Jellyfin via proxy
  useEffect(() => {
    const fetchSegments = async () => {
      if (!serverUrl || !id) return;
      
      const jellyfinSession = localStorage.getItem('jellyfin_session');
      const accessToken = jellyfinSession ? JSON.parse(jellyfinSession).AccessToken : null;
      
      if (!accessToken) return;

      try {
        // Use Supabase proxy to avoid mixed content issues (HTTPS to HTTP)
        // Try Jellyfin 10.9+ MediaSegments API
        const { data: segmentsData, error: segmentsError } = await supabase.functions.invoke('jellyfin-proxy', {
          body: {
            endpoint: `/MediaSegments/${id}`,
            method: 'GET',
          }
        });
        
        if (!segmentsError && segmentsData?.Items && segmentsData.Items.length > 0) {
          console.log('Media segments found:', segmentsData.Items);
          setMediaSegments(segmentsData.Items);
          return;
        }

        // Fallback: Try intro-skipper plugin format
        const { data: introData, error: introError } = await supabase.functions.invoke('jellyfin-proxy', {
          body: {
            endpoint: `/Episode/${id}/IntroTimestamps`,
            method: 'GET',
          }
        });
        
        if (!introError && introData?.Valid && introData?.IntroStart !== undefined) {
          console.log('Intro timestamps found:', introData);
          // Convert to MediaSegment format
          const introSegment: MediaSegment = {
            Type: 'Intro',
            StartTicks: introData.IntroStart * 10000000,
            EndTicks: introData.IntroEnd * 10000000,
          };
          setMediaSegments([introSegment]);
        }
      } catch (error) {
        console.log('Could not fetch media segments:', error);
        // Not an error - segments are optional
      }
    };

    fetchSegments();
  }, [serverUrl, id]);

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
      navigate(`/player/${prevEpisode.Id}`, { replace: true });
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
      // Different episode - navigate with position (replace to keep back button working)
      localStorage.setItem(`player_start_position_${episode.Id}`, targetSeconds.toString());
      navigate(`/player/${episode.Id}`, { replace: true });
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

  // Reset nextEpisodeDismissed when episode changes
  useEffect(() => {
    setNextEpisodeDismissed(false);
  }, [id]);

  const handleVideoEnded = async () => {
    // Always mark as watched when video ends
    if (item && userId && serverUrl) {
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
      navigate(`/player/${nextEpisode.Id}`, { replace: true });
    }
  };

  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (!video) return;

    // Update custom player state
    setCurrentTime(video.currentTime);
    setDuration(video.duration || 0);

    const currentTimeTicks = video.currentTime * 10000000; // Convert to ticks
    
    // Update buffer stats
    if (video.buffered.length > 0) {
      const bufferedEnd = video.buffered.end(video.buffered.length - 1);
      const bufferedSeconds = bufferedEnd - video.currentTime;
      setNetworkStats(prev => ({ ...prev, bufferedSeconds: Math.max(0, bufferedSeconds) }));
    }
    
    // Check for segment skip button (intro/credits)
    if (mediaSegments.length > 0) {
      const activeSegment = mediaSegments.find(
        seg => currentTimeTicks >= seg.StartTicks && currentTimeTicks < seg.EndTicks
      );
      
      if (activeSegment && !currentSegment) {
        setCurrentSegment(activeSegment);
        setShowSkipButton(true);
      } else if (!activeSegment && currentSegment) {
        setCurrentSegment(null);
        setShowSkipButton(false);
      }
    }

    // Show next episode preview when 30 seconds remaining (only for episodes)
    // Don't show if already dismissed by user
    if (isEpisode && !nextEpisodeDismissed) {
      const timeRemaining = video.duration - video.currentTime;
      if (timeRemaining <= 30 && timeRemaining > 0 && !showNextEpisodePreview) {
        const nextEpisode = getNextEpisode();
        if (nextEpisode) {
          setShowNextEpisodePreview(true);
          setCountdown(Math.ceil(timeRemaining));
        }
      }
    }
  };

  // Toggle play/pause
  const togglePlayPause = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play();
    } else {
      video.pause();
    }
  };

  // Some Jellyfin streams report `video.duration` as 0/NaN/Infinity.
  // Seeking must still work, so we fall back to the item's runtime when available.
  const getEffectiveDurationSeconds = useCallback((video: HTMLVideoElement): number | null => {
    const d = video.duration;
    if (Number.isFinite(d) && d > 0) return d;

    const runtimeTicks = item?.RunTimeTicks;
    if (typeof runtimeTicks === "number" && runtimeTicks > 0) {
      return runtimeTicks / 10000000;
    }

    return null;
  }, [item?.RunTimeTicks]);

  // Seek to position (slider input) - for direct streams, seek immediately
  // For transcoded streams, we update the visual but wait for release
  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);

    if (!Number.isFinite(time)) return;

    const needsServerSideSeek = streamStatus.isTranscoding || usingDirectStream;
    
    if (needsServerSideSeek) {
      // Just update the visual position while dragging
      setSliderDragValue(time);
      setCurrentTime(time); // Update display
    } else {
      // Direct stream - seek immediately
      handleSeekToPosition(time);
    }
  };
  
  // Handle slider drag start
  const handleSliderDragStart = () => {
    const needsServerSideSeek = streamStatus.isTranscoding || usingDirectStream;
    if (needsServerSideSeek) {
      setIsDraggingSlider(true);
      setSliderDragValue(currentTime);
    }
  };
  
  // Handle slider drag end - execute the actual seek for transcoded streams
  const handleSliderDragEnd = () => {
    const needsServerSideSeek = streamStatus.isTranscoding || usingDirectStream;
    if (needsServerSideSeek && isDraggingSlider) {
      setIsDraggingSlider(false);
      handleSeekToPosition(sliderDragValue);
    }
  };

  // Toggle mute
  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setIsMuted(video.muted);
  };

  // Skip forward/backward using server-side seeking (reload stream with new start position)
  // This is necessary because transcoded streams don't support byte-range seeking
  const skip = (seconds: number) => {
    const video = videoRef.current;
    if (!video) return;
    
    // Rate-limit: don't start a new seek if one is already in progress
    if (isSeekingReload) {
      console.log('Seek already in progress, ignoring');
      return;
    }

    const effectiveDuration = getEffectiveDurationSeconds(video);
    const target = video.currentTime + seconds;
    const newTime = effectiveDuration
      ? Math.max(0, Math.min(effectiveDuration, target))
      : Math.max(0, target);
    
    // For transcoded streams OR direct streaming, we need to reload with a new start position
    // because byte-range seeking is not reliably supported
    // Note: Even direct HTTPS streams to Jellyfin may be transcoded (HEVC→H264) and not support seeking
    const needsServerSideSeek = streamStatus.isTranscoding || usingDirectStream;
    
    if (needsServerSideSeek) {
      console.log(`Seeking via reload: ${video.currentTime.toFixed(1)}s -> ${newTime.toFixed(1)}s (transcoding: ${streamStatus.isTranscoding}, direct: ${usingDirectStream})`);
      isSeekingViaReloadRef.current = true;
      setIsSeekingReload(true);
      setSeekTargetTime(newTime);
      setStreamStartPosition(newTime);
    } else {
      // Direct stream supports seeking
      video.currentTime = newTime;
    }
  };
  
  // Handle slider seek (also uses server-side seeking for transcoded streams)
  const handleSeekToPosition = (newTime: number) => {
    const video = videoRef.current;
    if (!video || !Number.isFinite(newTime)) return;
    
    // Rate-limit: don't start a new seek if one is already in progress
    if (isSeekingReload) {
      console.log('Seek already in progress, ignoring');
      return;
    }

    const effectiveDuration = getEffectiveDurationSeconds(video);
    const clampedTime = effectiveDuration
      ? Math.max(0, Math.min(effectiveDuration, newTime))
      : Math.max(0, newTime);
    
    // For transcoded streams OR direct streaming, we need to reload with a new start position
    // because byte-range seeking is not reliably supported
    const needsServerSideSeek = streamStatus.isTranscoding || usingDirectStream;
    
    if (needsServerSideSeek) {
      console.log(`Slider seek via reload: ${video.currentTime.toFixed(1)}s -> ${clampedTime.toFixed(1)}s (transcoding: ${streamStatus.isTranscoding}, direct: ${usingDirectStream})`);
      isSeekingViaReloadRef.current = true;
      setIsSeekingReload(true);
      setSeekTargetTime(clampedTime);
      setStreamStartPosition(clampedTime);
    } else {
      video.currentTime = clampedTime;
      setCurrentTime(clampedTime);
    }
  };

  // Handle double-tap to seek on mobile
  const handleDoubleTap = (e: React.TouchEvent<HTMLDivElement>) => {
    const touch = e.touches[0] || e.changedTouches[0];
    if (!touch) return;
    
    const now = Date.now();
    const rect = e.currentTarget.getBoundingClientRect();
    const x = touch.clientX - rect.left;
    const isLeftSide = x < rect.width / 2;
    
    if (lastTapRef.current && now - lastTapRef.current.time < 300) {
      // Double tap detected
      const wasLeftSide = lastTapRef.current.x < rect.width / 2;
      if (isLeftSide === wasLeftSide) {
        // Same side - trigger seek
        e.preventDefault();
        e.stopPropagation();
        
        if (isLeftSide) {
          skip(-10);
          setDoubleTapSide('left');
        } else {
          skip(10);
          setDoubleTapSide('right');
        }
        
        // Clear visual feedback after animation
        if (doubleTapTimeoutRef.current) {
          clearTimeout(doubleTapTimeoutRef.current);
        }
        doubleTapTimeoutRef.current = setTimeout(() => {
          setDoubleTapSide(null);
        }, 500);
        
        lastTapRef.current = null;
        return;
      }
    }
    
    lastTapRef.current = { time: now, x };
  };

  // Track download speed using progress events
  const handleProgress = () => {
    const video = videoRef.current;
    if (!video || !video.buffered.length) return;
    
    // Estimate total bytes downloaded (rough approximation)
    const bufferedEnd = video.buffered.end(video.buffered.length - 1);
    const duration = video.duration || 1;
    const estimatedBytesPerSecond = 1000000; // Assume ~1MB/s baseline
    const estimatedTotalBytes = Math.floor((bufferedEnd / duration) * duration * estimatedBytesPerSecond);
    
    const now = Date.now();
    
    if (lastBytesRef.current) {
      const timeDiff = (now - lastBytesRef.current.time) / 1000;
      const bytesDiff = estimatedTotalBytes - lastBytesRef.current.bytes;
      
      if (timeDiff > 0.5 && bytesDiff > 0) {
        const speed = bytesDiff / timeDiff;
        setNetworkStats(prev => ({ 
          ...prev, 
          downloadSpeed: speed,
          totalBytes: estimatedTotalBytes 
        }));
        lastBytesRef.current = { bytes: estimatedTotalBytes, time: now };
      }
    } else {
      lastBytesRef.current = { bytes: estimatedTotalBytes, time: now };
    }
  };

  // Skip current segment (intro/credits)
  const skipSegment = () => {
    if (!currentSegment || !videoRef.current) return;
    
    const endTimeSeconds = currentSegment.EndTicks / 10000000;
    videoRef.current.currentTime = endTimeSeconds;
    setCurrentSegment(null);
    setShowSkipButton(false);
    
    const segmentType = currentSegment.Type.toLowerCase();
    if (segmentType === 'intro' || segmentType === 'recap') {
      toast.info(player.skippedIntro || 'Skipped intro');
    } else if (segmentType === 'outro' || segmentType === 'credits') {
      toast.info(player.skippedCredits || 'Skipped credits');
    } else {
      toast.info(`${player.skippedSegment || 'Skipped'} ${currentSegment.Type}`);
    }
  };

  // Get segment button label
  const getSkipButtonLabel = () => {
    if (!currentSegment) return player.skip || 'Skip';
    
    switch (currentSegment.Type.toLowerCase()) {
      case 'intro':
        return player.skipIntro || 'Skip intro';
      case 'outro':
      case 'credits':
        return player.skipCredits || 'Skip credits';
      case 'recap':
        return player.skipRecap || 'Skip recap';
      case 'commercial':
        return player.skipCommercial || 'Skip commercial';
      case 'preview':
        return player.skipPreview || 'Skip preview';
      default:
        return `${player.skip || 'Skip'} ${currentSegment.Type}`;
    }
  };

  const playNextEpisode = () => {
    const nextEpisode = getNextEpisode();
    if (nextEpisode) {
      navigate(`/player/${nextEpisode.Id}`, { replace: true });
    }
  };

  // Countdown effect - only start interval once when countdown begins
  useEffect(() => {
    if (countdown === null || countdown <= 0) return;
    
    // Clear any existing interval
    if (countdownInterval.current) {
      clearInterval(countdownInterval.current);
    }
    
    countdownInterval.current = setInterval(() => {
      setCountdown(prev => {
        if (prev === null || prev <= 1) {
          // When countdown reaches 0, auto-play next episode and hide overlay
          clearInterval(countdownInterval.current!);
          playNextEpisode();
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
  }, [showNextEpisodePreview]); // Only re-run when overlay appears, not on every countdown tick

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
    // Auto-hide after 3s even if the user doesn't move the mouse (cleaner playback)
    handleMouseMove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return () => {
      if (hideControlsTimer.current) {
        clearTimeout(hideControlsTimer.current);
      }
      if (proactiveRefreshTimerRef.current) {
        clearTimeout(proactiveRefreshTimerRef.current);
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

  if (!serverUrl || !userId || !id || (!streamUrl && !streamError)) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center text-white">
        <Loader2 className="h-8 w-8 animate-spin mr-3" />
        Laster...
      </div>
    );
  }

  const previousEpisode = getPreviousEpisode();
  const nextEpisode = getNextEpisode();

  return (
    <TooltipProvider>
      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <div ref={setContainerNode} className="relative h-screen bg-black overflow-hidden flex w-full">
          {/* Episodes Sheet - uses container prop so it renders inside fullscreen */}
          <SheetContent 
            side="right" 
            container={containerElement}
            className="w-80 sm:w-96 bg-background/95 backdrop-blur-xl p-0 z-[100]"
          >
            <div className="flex items-center justify-between p-4 border-b">
              <div className="min-w-0">
                <SheetTitle className="text-base font-semibold">{item?.SeriesName}</SheetTitle>
                <SheetDescription className="sr-only">Velg episode å spille av.</SheetDescription>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSidebarOpen(false)}
                className="h-8 w-8 p-0"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <ScrollArea className="h-[calc(100vh-60px)]">
              <div className="space-y-2 p-3">
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
                          navigate(`/player/${episode.Id}`, { replace: true });
                          setSidebarOpen(false);
                        }
                      }}
                      className={`flex gap-3 p-2 rounded-lg cursor-pointer transition-all ${
                        isCurrentEpisode 
                          ? 'bg-primary/20 border-2 border-primary' 
                          : 'hover:bg-secondary/50'
                      }`}
                    >
                      <div className="w-28 h-16 flex-shrink-0 rounded overflow-hidden bg-secondary relative">
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
                            className="absolute bottom-0 left-0 right-0 h-1 bg-secondary/50"
                            onClick={(e) => { e.stopPropagation(); handleProgressClick(episode, e); }}
                          >
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
                        <h3 className="font-semibold text-sm line-clamp-2">
                          {episode.IndexNumber && `${episode.IndexNumber}. `}{episode.Name}
                        </h3>
                        <div className="flex items-center gap-2 mt-1">
                          {episodeRuntime && (
                            <span className="text-xs text-muted-foreground">
                              {episodeRuntime} min
                            </span>
                          )}
                          {isCurrentEpisode && (
                            <span className="text-xs text-primary font-medium">Spiller nå</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </SheetContent>


        <div 
          className="relative h-screen bg-black overflow-hidden flex-1"
          onMouseMove={handleMouseMove}
          onPointerMove={handleMouseMove}
          onPointerDown={handleMouseMove}
          onTouchStart={(e) => {
            handleMouseMove();
            handleDoubleTap(e);
          }}
        >
          {/* Double-tap visual feedback - Left side */}
          {doubleTapSide === 'left' && (
            <div className="absolute left-0 top-0 bottom-0 w-1/3 flex items-center justify-center pointer-events-none z-40 animate-fade-in">
              <div className="bg-white/20 backdrop-blur-sm rounded-full p-4">
                <SkipBack className="h-10 w-10 text-white" />
              </div>
              <span className="absolute bottom-1/3 text-white text-sm font-medium">-10s</span>
            </div>
          )}
          
          {/* Double-tap visual feedback - Right side */}
          {doubleTapSide === 'right' && (
            <div className="absolute right-0 top-0 bottom-0 w-1/3 flex items-center justify-center pointer-events-none z-40 animate-fade-in">
              <div className="bg-white/20 backdrop-blur-sm rounded-full p-4">
                <SkipForward className="h-10 w-10 text-white" />
              </div>
              <span className="absolute bottom-1/3 text-white text-sm font-medium">+10s</span>
            </div>
          )}
          <video
        ref={videoRef}
        src={streamUrl}
        className="w-full h-full object-contain relative z-10"
        autoPlay
        playsInline
        preload="metadata"
        crossOrigin="anonymous"
        controlsList="nodownload"
        onLoadedMetadata={(e) => {
          const video = e.currentTarget;
          // Log audio tracks for debugging
          const audioTracks = (video as any).audioTracks;
          console.log('Video loaded:', {
            duration: video.duration,
            videoWidth: video.videoWidth,
            videoHeight: video.videoHeight,
            muted: video.muted,
            volume: video.volume,
            audioTracks: audioTracks?.length || 'N/A',
            src: streamUrl?.substring(0, 100) + '...',
          });
          // Ensure audio is not muted
          video.muted = false;
          video.volume = 1.0;

          // Restore position after stream swap (e.g. audio track change)
          const pending = pendingSeekSecondsRef.current;
          if (pending !== null && Number.isFinite(pending)) {
            const target = Math.max(0, Math.min(pending, Math.max(0, video.duration - 0.25)));
            pendingSeekSecondsRef.current = null;

            try {
              video.currentTime = target;
            } catch (err) {
              console.log('Failed to restore playback position after stream swap:', err);
            }

            if (resumeAfterStreamSwapRef.current) {
              const p = video.play();
              if (p && typeof (p as any).catch === 'function') {
                (p as Promise<void>).catch(() => {
                  toast.info('Trykk på videoen for å starte avspilling');
                });
              }
            }
          }
        }}
        onError={handleVideoError}
        onEnded={handleVideoEnded}
        onTimeUpdate={handleTimeUpdate}
        onWaiting={() => showBuffering()}
        onStalled={() => {
          // Edge function timeout (~150s) can cause stalled state
          // This is a fallback if proactive refresh didn't trigger
          // ONLY relevant for proxy streaming - direct streaming handles this natively
          if (usingDirectStream) {
            showBuffering();
            return;
          }
          
          const video = videoRef.current;
          if (!video || isSeekingReload) return;
          
          // Check if this is an actual stall (not just buffering briefly)
          const timeSinceStreamStart = (Date.now() - streamStartTimeRef.current) / 1000;
          console.log('Stream stalled after', timeSinceStreamStart.toFixed(0), 'seconds');
          showBuffering();
          
          // Only auto-reconnect if we've been streaming for a while (likely timeout)
          // or if the buffer is nearly empty
          if (timeSinceStreamStart > 30) {
            // Wait briefly to see if it recovers, then reconnect
            setTimeout(() => {
              const currentVideo = videoRef.current;
              if (currentVideo && currentVideo.readyState < 3 && !isSeekingReload) {
                console.log('Stream still stalled, reloading from position', currentVideo.currentTime);
                
                // Reload stream from current position (server-side seeking)
                isSeekingViaReloadRef.current = true;
                setIsSeekingReload(true);
                setSeekTargetTime(currentVideo.currentTime);
                setStreamStartPosition(currentVideo.currentTime);
              }
            }, 2000); // Shorter wait since proactive refresh should handle most cases
          }
        }}
        onPlaying={() => { 
          hideBuffering(); 
          setIsPlaying(true); 
          // Dismiss seeking state when playback starts
          if (isSeekingReload) {
            setIsSeekingReload(false);
            setSeekTargetTime(null);
          }
        }}
        onPause={() => setIsPlaying(false)}
        onCanPlay={() => {
          hideBuffering();
          // Also dismiss seeking state on canplay in case playing doesn't fire immediately
          if (isSeekingReload) {
            setIsSeekingReload(false);
            setSeekTargetTime(null);
          }
        }}
        onProgress={handleProgress}
        onClick={togglePlayPause}
      >
        Din nettleser støtter ikke videoavspilling.
      </video>

      {/* Buffering/Seeking Indicator with seek target time */}
      {(isBuffering || isSeekingReload) && !streamError && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-40">
          <div className="flex flex-col items-center gap-3 bg-black/60 backdrop-blur-sm rounded-2xl p-6">
            <Loader2 className="h-12 w-12 text-white animate-spin" />
            <span className="text-white text-sm font-medium">
              {isSeekingReload && seekTargetTime !== null 
                ? `Lastar frå ${formatTime(Math.floor(seekTargetTime))}...` 
                : isSeekingReload 
                  ? 'Spoler...' 
                  : 'Laster...'}
            </span>
            {networkStats.downloadSpeed && !isSeekingReload && (
              <span className="text-white/70 text-xs">{formatBytes(networkStats.downloadSpeed)}/s</span>
            )}
          </div>
        </div>
      )}

      {/* Stream Error Overlay */}
      {streamError && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/90 z-50">
          <div className="bg-background/95 backdrop-blur-xl rounded-2xl p-6 sm:p-8 max-w-md mx-4 text-center border border-border shadow-2xl">
            <div className="w-16 h-16 mx-auto mb-4 bg-destructive/20 rounded-full flex items-center justify-center">
              <AlertCircle className="h-8 w-8 text-destructive" />
            </div>
            <h2 className="text-xl font-bold text-foreground mb-2">Avspillingsfeil</h2>
            <p className="text-muted-foreground mb-6">{streamError}</p>
            
            <div className="space-y-3">
              <Button
                onClick={retryStream}
                className="w-full gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                Prøv på nytt
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate(-1)}
                className="w-full"
              >
                Gå tilbake
              </Button>
            </div>
            
            <div className="mt-6 pt-4 border-t border-border">
              <p className="text-xs text-muted-foreground">
                <span className="font-medium">Tips:</span> Sjekk at Jellyfin-serveren kjører og er tilgjengelig. 
                Prøv å oppdatere siden eller bruk en annen nettleser.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Stream Status Indicator */}
      {showControls && streamStatus.codec && (
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 pointer-events-auto z-40">
          <button
            onClick={(e) => { e.stopPropagation(); setShowStatsPanel(!showStatsPanel); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
              streamStatus.isTranscoding 
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' 
                : 'bg-green-500/20 text-green-300 border border-green-500/30'
            }`}
          >
            <Info className="h-3 w-3" />
            {streamStatus.isTranscoding ? 'Transkoding' : 'Direktestrøm'}
            {networkStats.downloadSpeed && (
              <span className="text-blue-300 ml-1">• {formatBytes(networkStats.downloadSpeed)}</span>
            )}
          </button>
        </div>
      )}

      {/* Stats Panel */}
      <PlayerStatsPanel
        stats={networkStats}
        streamStatus={streamStatus}
        isOpen={showStatsPanel}
        onClose={() => setShowStatsPanel(false)}
      />

      {/* Diagnostics Panel (always visible when open, independent of showControls for fullscreen) */}

      {showDiagnostics && (
        <div className="absolute top-20 right-3 w-72 bg-black/90 backdrop-blur-md rounded-lg p-3 text-xs text-white border border-white/20 pointer-events-auto z-50 space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-semibold">Feildiagnostikk</span>
            <button onClick={() => setShowDiagnostics(false)} className="text-white/60 hover:text-white">✕</button>
          </div>
          {/* Force Direct Streaming Toggle */}
          <div className="flex items-center justify-between py-2 border-b border-white/10 mb-2">
            <div>
              <p className="font-medium text-white">Direkte streaming</p>
              <p className="text-white/50 text-[10px]">Bypass proxy for mindre buffering</p>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                const newValue = !forceDirectStream;
                setForceDirectStream(newValue);
                localStorage.setItem('forceDirectStream', String(newValue));
                toast.success(newValue ? 'Direkte streaming aktivert' : 'Proxy streaming aktivert');
                // Force stream reload
                setStreamUrl('');
              }}
              className={`w-11 h-6 rounded-full transition-colors ${forceDirectStream ? 'bg-green-500' : 'bg-white/20'}`}
            >
              <div className={`w-5 h-5 rounded-full bg-white transition-transform ${forceDirectStream ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </button>
          </div>
          
          <div className="space-y-1 text-white/80">
            <p className={usingDirectStream ? 'text-green-400' : 'text-amber-400'}>
              <span className="text-white/50">Strømmemodus:</span> {usingDirectStream ? '✓ Direkte' : '⚡ Proxy'}
            </p>
            <p><span className="text-white/50">HTTP (info):</span> {streamHttpStatus === -1 ? 'Nettverksfeil' : streamHttpStatus ?? '–'}</p>
            <p><span className="text-white/50">HTTP (stream):</span> {streamProbeStatus === -1 ? 'Nettverksfeil' : streamProbeStatus ?? 'Åpne diagnose for å teste'}</p>
            <p className={streamProbeStatus === 206 ? 'text-green-400' : streamProbeStatus === 200 ? 'text-amber-400' : ''}>
              <span className="text-white/50">Seek støtte:</span> {streamProbeStatus === 206 ? '✓ Støttet (206)' : streamProbeStatus === 200 ? '⚠ Ikkje støtta' : '–'}
            </p>
            <p><span className="text-white/50">Accept-Ranges:</span> {streamProbeAcceptRanges || '–'}</p>
            <p><span className="text-white/50">Content-Range:</span> {streamProbeContentRange?.substring(0, 30) || '–'}</p>
            <p><span className="text-white/50">Content-Type:</span> {streamProbeContentType || '–'}</p>
            <p><span className="text-white/50">HLS modus:</span> {useHls ? 'Ja' : 'Nei'}</p>
            <p><span className="text-white/50">Bruker-id-kilde:</span> {streamStatus.userIdSource || '–'}</p>
            <p><span className="text-white/50">Video-codec:</span> {streamStatus.codec || '–'}</p>
            <p><span className="text-white/50">Container:</span> {streamStatus.container || '–'}</p>
            <p><span className="text-white/50">Oppløsning:</span> {streamStatus.resolution || '–'}</p>
            <p><span className="text-white/50">Bitrate:</span> {streamStatus.bitrate || '–'}</p>
            <p><span className="text-white/50">Transkoding:</span> {streamStatus.isTranscoding ? 'Ja' : 'Nei'}</p>
            {fallbackAttempted && (
              <p className="text-amber-400"><span className="text-white/50">Fallback:</span> Ja ({fallbackBitrate ? fallbackBitrate / 1000000 : '?'} Mbps)</p>
            )}
          </div>
          {streamError && (
            <div className="mt-2 pt-2 border-t border-white/10 text-red-400">
              <p><span className="text-white/50">Feil:</span> {streamError}</p>
            </div>
          )}
          <div className="flex gap-2 mt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => { e.stopPropagation(); copyDiagnosticsToClipboard(); }}
              className="flex-1 gap-1 text-xs border-white/20 hover:bg-white/10"
            >
              <Copy className="h-3 w-3" />
              Kopier
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={async (e) => {
                e.stopPropagation();
                if (!item?.Id) {
                  toast.error('Mangler media-info');
                  return;
                }
                toast.info('Tester lydspor...');
                try {
                  const audioIdx = selectedAudioTrack || '0';
                  const session = await supabase.auth.getSession();
                  const token = session.data.session?.access_token;
                  if (!token) {
                    toast.error('Ikke innlogget');
                    return;
                  }
                  const testUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/jellyfin-stream?id=${item.Id}&token=${token}&info=true&audioIndex=${audioIdx}`;
                  const res = await fetch(testUrl);
                  const data = await res.json();
                  const audioInfo = data.selectedAudio || {};
                  const msg = `Index: ${audioInfo.index ?? audioIdx}\nSpråk: ${audioInfo.language || '–'}\nCodec: ${audioInfo.codec || '–'}\nKanaler: ${audioInfo.channels || '–'}\nTittel: ${audioInfo.title || '–'}\nTranskoding: ${data.isTranscoding ? 'Ja' : 'Nei'}`;
                  toast.success(msg, { duration: 8000 });
                  console.log('Audio track test result:', data);
                } catch (err) {
                  console.error('Audio track test failed:', err);
                  toast.error('Feil ved testing av lydspor');
                }
              }}
              className="flex-1 gap-1 text-xs border-white/20 hover:bg-white/10"
            >
              <Music className="h-3 w-3" />
              Test lyd
            </Button>
          </div>
        </div>
      )}

      {/* Custom overlay (visual only) */}
      <div
        className={`absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/50 transition-opacity duration-300 pointer-events-none ${
          showControls ? "opacity-100" : "opacity-0"
        }`}
      />

      {/* Bottom control bar - play/pause, progress, volume */}
      <div
        className={`absolute bottom-0 left-0 right-0 p-3 sm:p-4 safe-area-bottom transition-opacity duration-300 z-30 ${
          showControls ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
      >
        <div className="flex items-center gap-2 sm:gap-4">
          {/* Skip back */}
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => { e.stopPropagation(); skip(-10); }}
            className="text-white hover:bg-white/20 h-10 w-10 sm:h-12 sm:w-12 touch-manipulation rounded-lg hidden sm:flex"
          >
            <SkipBack className="h-5 w-5" />
          </Button>

          {/* Play/Pause */}
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => { e.stopPropagation(); togglePlayPause(); }}
            className="text-white hover:bg-white/20 h-12 w-12 sm:h-14 sm:w-14 touch-manipulation rounded-lg bg-white/10"
          >
            {isPlaying ? <Pause className="h-6 w-6 sm:h-7 sm:w-7" /> : <Play className="h-6 w-6 sm:h-7 sm:w-7" />}
          </Button>

          {/* Skip forward */}
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => { e.stopPropagation(); skip(10); }}
            className="text-white hover:bg-white/20 h-10 w-10 sm:h-12 sm:w-12 touch-manipulation rounded-lg hidden sm:flex"
          >
            <SkipForward className="h-5 w-5" />
          </Button>

          {/* Current time */}
          <span className="text-white text-xs sm:text-sm font-mono min-w-[45px] sm:min-w-[55px]">
            {formatTime(Math.floor(currentTime))}
          </span>

          {/* Progress bar with buffer indicator */}
          <div 
            ref={progressBarRef}
            className="flex-1 relative group h-6 flex items-center cursor-pointer"
            onMouseMove={(e) => {
              if (!progressBarRef.current || !duration) return;
              const rect = progressBarRef.current.getBoundingClientRect();
              const x = e.clientX - rect.left;
              const percentage = Math.max(0, Math.min(1, x / rect.width));
              
              // Always update hover time for tooltip
              setHoverTime(percentage * duration);
              setHoverPosition(x);
              
              // Update drag value while dragging
              if (isDraggingSlider) {
                setSliderDragValue(percentage * duration);
              }
            }}
            onMouseLeave={() => setHoverTime(null)}
            onMouseDown={(e) => {
              e.stopPropagation();
              if (!progressBarRef.current || !duration) return;
              const rect = progressBarRef.current.getBoundingClientRect();
              const x = e.clientX - rect.left;
              const percentage = Math.max(0, Math.min(1, x / rect.width));
              const newTime = percentage * duration;
              
              if (streamStatus.isTranscoding) {
                setIsDraggingSlider(true);
                setSliderDragValue(newTime);
                // Don't update currentTime - it comes from video.currentTime
              } else {
                handleSeekToPosition(newTime);
              }
            }}
            onMouseUp={(e) => {
              e.stopPropagation();
              if (streamStatus.isTranscoding && isDraggingSlider) {
                setIsDraggingSlider(false);
                handleSeekToPosition(sliderDragValue);
              }
            }}
            onTouchStart={(e) => {
              if (!progressBarRef.current || !duration) return;
              const touch = e.touches[0];
              const rect = progressBarRef.current.getBoundingClientRect();
              const x = touch.clientX - rect.left;
              const percentage = Math.max(0, Math.min(1, x / rect.width));
              const newTime = percentage * duration;
              
              if (streamStatus.isTranscoding) {
                setIsDraggingSlider(true);
                setSliderDragValue(newTime);
                // Don't update currentTime - it comes from video.currentTime
              }
            }}
            onTouchMove={(e) => {
              // Update drag value while dragging
              if (isDraggingSlider && progressBarRef.current && duration) {
                const touch = e.touches[0];
                const rect = progressBarRef.current.getBoundingClientRect();
                const x = touch.clientX - rect.left;
                const percentage = Math.max(0, Math.min(1, x / rect.width));
                setSliderDragValue(percentage * duration);
              }
            }}
            onTouchEnd={(e) => {
              if (streamStatus.isTranscoding && isDraggingSlider) {
                setIsDraggingSlider(false);
                handleSeekToPosition(sliderDragValue);
              }
            }}
          >
            {/* Hover time preview tooltip */}
            {hoverTime !== null && (
              <div 
                className="absolute bottom-6 -translate-x-1/2 bg-black/90 backdrop-blur-sm text-white text-xs font-mono px-2 py-1 rounded pointer-events-none z-10 animate-fade-in"
                style={{ left: hoverPosition }}
              >
                {formatTime(Math.floor(hoverTime))}
              </div>
            )}
            
            {/* Progress bar track */}
            <div className="w-full h-2 bg-white/20 rounded-full overflow-hidden relative">
              {/* Buffered area (lighter zone) */}
              <div 
                className="absolute top-0 left-0 h-full bg-white/40 rounded-full transition-all duration-300"
                style={{ 
                  width: `${Math.min(100, ((currentTime + networkStats.bufferedSeconds) / (duration || 1)) * 100)}%` 
                }}
              />
              
              {/* Played area (primary color) */}
              <div 
                className="absolute top-0 left-0 h-full bg-primary rounded-full"
                style={{ 
                  width: `${((isDraggingSlider ? sliderDragValue : currentTime) / (duration || 1)) * 100}%` 
                }}
              />
            </div>
            
            {/* Thumb/handle */}
            <div 
              className="absolute w-4 h-4 bg-primary rounded-full shadow-lg transform -translate-x-1/2 pointer-events-none group-hover:scale-125 transition-transform"
              style={{ 
                left: `${((isDraggingSlider ? sliderDragValue : currentTime) / (duration || 1)) * 100}%` 
              }}
            />
          </div>

          {/* Duration */}
          <span className="text-white text-xs sm:text-sm font-mono min-w-[45px] sm:min-w-[55px] text-right">
            {formatTime(Math.floor(duration))}
          </span>

          {/* Volume - mute/unmute toggle (visible on all devices) */}
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => { e.stopPropagation(); toggleMute(); }}
            className="text-white hover:bg-white/20 h-10 w-10 sm:h-12 sm:w-12 touch-manipulation rounded-lg"
          >
            {isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
          </Button>

          {/* Fullscreen button (visible on mobile, hidden on desktop where it's in top bar) */}
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              toggleFullscreen();
            }}
            className="text-white hover:bg-white/20 h-10 w-10 sm:hidden touch-manipulation rounded-lg"
            title={isFullscreen ? "Avslutt fullskjerm" : "Fullskjerm"}
          >
            {isFullscreen ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      {/* Always visible back button - top left */}
      <div className="absolute top-2 left-2 sm:top-4 sm:left-4 z-50 pointer-events-auto safe-area-top">
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            navigate(-1);
          }}
          className="text-white hover:bg-white/20 h-12 w-12 sm:w-auto sm:px-3 bg-black/60 backdrop-blur-sm rounded-lg touch-manipulation border border-white/10"
        >
          <ArrowLeft className="h-5 w-5 sm:mr-2" />
          <span className="hidden sm:inline">Tilbake</span>
        </Button>
      </div>

      {/* Top bar - title only (controls visibility) */}
      <div
        className={`absolute top-2 left-16 right-2 sm:top-4 sm:left-20 sm:right-4 flex items-center justify-center safe-area-top transition-opacity duration-300 ${
          showControls ? "opacity-100" : "opacity-0"
        }`}
      >
        <p className="text-white text-xs sm:text-base font-medium line-clamp-1 bg-black/40 backdrop-blur-sm px-3 py-1 rounded-lg">
          {item?.SeriesName && `${item.SeriesName} - `}
          {item?.IndexNumber && `E${item.IndexNumber}: `}
          {item?.Name}
        </p>
      </div>

      {/* Single horizontal control bar - top right */}
      <div
        className={`absolute top-14 right-2 sm:right-3 z-50 transition-opacity duration-300 ${
          showControls ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
      >
        <div className="flex gap-1.5 items-center bg-black/80 backdrop-blur-md rounded-xl p-2 border border-white/10 shadow-2xl">
          {/* Fullscreen */}
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              toggleFullscreen();
            }}
            className="text-white hover:bg-white/20 h-12 w-12 touch-manipulation rounded-lg"
            title={isFullscreen ? "Avslutt fullskjerm" : "Fullskjerm"}
          >
            {isFullscreen ? <Minimize className="h-6 w-6" /> : <Maximize className="h-6 w-6" />}
          </Button>

          {/* Separator */}
          {isEpisode && <div className="w-px h-8 bg-white/20" />}

          {/* Episode navigation */}
          {isEpisode && (
            <>
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation();
                  playPreviousEpisode();
                }}
                disabled={!previousEpisode}
                className="text-white hover:bg-white/20 disabled:opacity-30 h-12 w-12 touch-manipulation rounded-lg"
                title="Forrige episode"
              >
                <SkipBack className="h-6 w-6" />
              </Button>

              {/* Episode selector */}
              {episodes.length > 0 && (
                <SheetTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                    }}
                    className="text-white hover:bg-white/20 h-12 px-3 touch-manipulation rounded-lg gap-1.5"
                    title="Velg episode"
                  >
                    <List className="h-5 w-5" />
                    <span className="hidden sm:inline text-sm">Episoder</span>
                  </Button>
                </SheetTrigger>
              )}

              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation();
                  playNextEpisode();
                }}
                disabled={!nextEpisode}
                className="text-white hover:bg-white/20 disabled:opacity-30 h-12 w-12 touch-manipulation rounded-lg"
                title="Neste episode"
              >
                <SkipForward className="h-6 w-6" />
              </Button>
            </>
          )}

          {/* Separator */}
          <div className="w-px h-8 bg-white/20" />

          {/* Subtitles dropdown */}
          {subtitles.length > 0 && (
            <Select
              value={selectedSubtitle}
              onValueChange={(value) => {
                console.log("User selected subtitle:", value);
                setSelectedSubtitle(value);
              }}
            >
              <SelectTrigger
                className="w-12 bg-transparent border-0 text-white h-12 touch-manipulation rounded-lg hover:bg-white/20 px-0 justify-center"
                onClick={(e) => e.stopPropagation()}
              >
                <Subtitles className="h-6 w-6" />
              </SelectTrigger>
              <SelectContent className="bg-background z-[2147483647]" container={containerElement}>
                <SelectItem value="none">Ingen</SelectItem>
                {subtitles.map((subtitle) => (
                  <SelectItem key={subtitle.Index} value={subtitle.Index.toString()}>
                    {subtitle.DisplayTitle || subtitle.Language || `Undertekst ${subtitle.Index}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Audio track selector */}
          {audioTracks.length > 1 && (
            <Select
              value={selectedAudioTrack}
              onValueChange={(value) => {
                console.log("User selected audio track:", value);

                const video = videoRef.current;
                if (video) {
                  pendingSeekSecondsRef.current = video.currentTime || 0;
                  resumeAfterStreamSwapRef.current = !video.paused;
                }

                audioTrackUserSelectedRef.current = value;
                setSelectedAudioTrack(value);

                const track = audioTracks.find((a) => a.Index.toString() === value);
                toast.info(`Lydspor: ${track?.DisplayTitle || track?.Language || 'Valgt'}`);
              }}
            >
              <SelectTrigger
                className="w-auto min-w-[50px] bg-transparent border-0 text-white h-12 touch-manipulation rounded-lg hover:bg-white/20 px-2 justify-center gap-1"
                onClick={(e) => e.stopPropagation()}
              >
                <Music className="h-5 w-5" />
                <span className="text-xs font-medium max-w-[80px] truncate hidden sm:inline">
                  {(() => {
                    const track = audioTracks.find(t => t.Index.toString() === selectedAudioTrack);
                    if (!track) return '';
                    // Show language code or first part of display title
                    const lang = track.Language?.toUpperCase() || '';
                    const channels = track.DisplayTitle?.match(/(\d+\.\d+|\d+ ch|stereo|mono)/i)?.[0] || '';
                    return lang + (channels ? ` ${channels}` : '');
                  })()}
                </span>
              </SelectTrigger>
              <SelectContent className="bg-background z-[2147483647]" container={containerElement}>
                {audioTracks.map((audio) => (
                  <SelectItem key={audio.Index} value={audio.Index.toString()}>
                    {audio.DisplayTitle || audio.Language || `Lydspor ${audio.Index}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Quality selector */}
          <Select
            value={selectedQuality}
            onValueChange={(value: QualityOption) => {
              console.log("User selected quality:", value);
              setSelectedQuality(value);
              toast.info(`Kvalitet: ${qualityOptions.find((q) => q.value === value)?.label || value}`);
            }}
          >
            <SelectTrigger
              className="w-auto min-w-[60px] bg-transparent border-0 text-white h-12 touch-manipulation rounded-lg hover:bg-white/20 px-2 justify-center gap-1"
              onClick={(e) => e.stopPropagation()}
            >
              <span className="text-xs font-medium">{selectedQuality === "auto" ? "Auto" : selectedQuality}</span>
            </SelectTrigger>
            <SelectContent className="bg-background z-[2147483647]" container={containerElement}>
              {qualityOptions.map((quality) => (
                <SelectItem key={quality.value} value={quality.value}>
                  {quality.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Separator */}
          <div className="w-px h-8 bg-white/20" />

          {/* Diagnose button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              setShowDiagnostics(!showDiagnostics);
            }}
            className={`text-white hover:bg-white/20 h-12 w-12 touch-manipulation rounded-lg ${showDiagnostics ? "bg-white/20" : ""}`}
            title="Feildiagnostikk"
          >
            <Settings className="h-6 w-6" />
          </Button>

          {/* Cast */}
          <Button
            variant="ghost"
            size="icon"
            onClick={async (e) => {
              e.stopPropagation();
              if (castLoading) return;

              if (castState.isConnected) {
                endSession();
                return;
              }

              const result = await requestSession();
              if (result?.unsupported) {
                setCastUnsupportedOpen(true);
              }
            }}
            className="text-white hover:bg-white/20 h-12 w-12 relative touch-manipulation rounded-lg"
            title={castState.isConnected ? "Koble frå Chromecast" : "Koble til Chromecast"}
          >
            <Cast className="h-6 w-6" />
            {castState.isConnected && !castLoading && (
              <span className="absolute top-2 right-2 h-2 w-2 bg-primary rounded-full" />
            )}
          </Button>
        </div>
      </div>

      {/* Subtitle search dialog - triggered from menu or long-press */}
      <Dialog open={subtitleSearchOpen} onOpenChange={setSubtitleSearchOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-2xl max-h-[90vh] z-[2147483647]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Subtitles className="h-5 w-5" />
              {player.searchSubtitles || "Search subtitles"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-2 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                onClick={() => searchSubtitles("nor")}
                disabled={searchingSubtitles}
              >
                🇳🇴 Norsk
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => searchSubtitles("eng")}
                disabled={searchingSubtitles}
              >
                🇬🇧 English
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => searchSubtitles("swe")}
                disabled={searchingSubtitles}
              >
                🇸🇪 Svenska
              </Button>
            </div>

            <ScrollArea className="h-[50vh] sm:h-[400px] rounded-md border p-2 sm:p-4">
              {searchingSubtitles ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <span className="ml-2">{player.searching || "Searching..."}</span>
                </div>
              ) : remoteSubtitles.length > 0 ? (
                <div className="space-y-2">
                  {remoteSubtitles.map((sub) => (
                    <div
                      key={sub.Id}
                      className="flex items-center justify-between p-2 sm:p-3 rounded-lg bg-secondary/50 hover:bg-secondary/80 transition-colors gap-2"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-xs sm:text-sm truncate">{sub.Name}</p>
                        <div className="flex items-center gap-1 sm:gap-2 text-[10px] sm:text-xs text-muted-foreground flex-wrap">
                          <span>{sub.Language}</span>
                          <span>•</span>
                          <span>{sub.Provider}</span>
                          {sub.Format && (
                            <>
                              <span className="hidden sm:inline">•</span>
                              <span className="hidden sm:inline">{sub.Format}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => downloadSubtitle(sub.Id, sub.Name)}
                        disabled={downloadingSubtitle === sub.Id}
                        className="h-9 w-9 flex-shrink-0"
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
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-center p-4">
                  <Subtitles className="h-12 w-12 mb-2 opacity-50" />
                  <p className="text-sm">{player.selectLanguageToSearch || "Select a language to search"}</p>
                </div>
              )}
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>

      {/* Skip Intro/Credits button - centered at bottom */}
      {showSkipButton && currentSegment && (
        <div className="absolute bottom-24 left-1/2 -translate-x-1/2 pointer-events-auto animate-fade-in z-50">
          <Button
            onClick={(e) => {
              e.stopPropagation();
              skipSegment();
            }}
            className="bg-primary hover:bg-primary/90 text-primary-foreground px-6 py-3 h-12 font-semibold shadow-2xl text-base gap-2 border border-white/20"
          >
            <FastForward className="h-5 w-5" />
            {getSkipButtonLabel()}
          </Button>
        </div>
      )}

      {/* Bottom-right: Next episode button - only show when controls are visible, NOT showing preview, and not dismissed */}
      {showControls && isEpisode && nextEpisode && !showNextEpisodePreview && !nextEpisodeDismissed && (
        <div className="absolute bottom-24 right-3 pointer-events-auto z-50">
          <div className="flex items-center gap-2">
            <Button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                playNextEpisode();
              }}
              onTouchEnd={(e) => {
                e.preventDefault();
                e.stopPropagation();
                playNextEpisode();
              }}
              className="bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 h-10 font-semibold shadow-2xl border border-white/20 gap-2 cursor-pointer touch-manipulation"
            >
              <SkipForward className="h-4 w-4" />
              <span className="hidden sm:inline">{player.nextEpisode || "Next episode"}</span>
              <span className="sm:hidden">{player.next || "Next"}</span>
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation();
                setNextEpisodeDismissed(true);
              }}
              className="h-10 w-10 text-white/60 hover:text-white hover:bg-white/10 bg-black/50 backdrop-blur-sm border border-white/20"
            >
              ✕
            </Button>
          </div>
        </div>
      )}

      {/* Cast Controls */}
      {castState.isConnected && castState.mediaInfo && (
        <div className="absolute bottom-0 left-0 right-0 p-3 sm:p-6 space-y-4 pointer-events-auto safe-area-bottom">
          <div className="bg-background/90 backdrop-blur-md rounded-lg p-3 sm:p-4 space-y-3 border border-border shadow-2xl">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground truncate">
                  Caster til {castState.deviceName || "Chromecast"}
                </p>
                <p className="text-sm font-semibold truncate">
                  {castState.mediaInfo.title || item?.Name || "Avspilling"}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  endSession();
                }}
                className="gap-2"
              >
                <Square className="h-4 w-4" />
                Stopp
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation();
                  playOrPause();
                }}
                className="h-12 w-12"
              >
                {castState.mediaInfo.isPaused ? <Play className="h-6 w-6" /> : <Pause className="h-6 w-6" />}
              </Button>

              <div className="flex-1 text-xs text-muted-foreground font-mono">
                {formatTime(Math.floor(castState.mediaInfo.currentTime))} / {formatTime(Math.floor(castState.mediaInfo.duration))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Next Episode Preview - Compact top-right toast */}
      {showNextEpisodePreview && (() => {
        const nextEpisode = getNextEpisode();
        if (!nextEpisode) return null;

        const nextEpisodeImageUrl = nextEpisode.ImageTags?.Primary && serverUrl
          ? `${serverUrl.replace(/\/$/, '')}/Items/${nextEpisode.Id}/Images/Primary?maxHeight=100`
          : null;

        return (
          <div className="absolute top-40 right-2 sm:right-3 w-64 sm:w-72 bg-black/90 backdrop-blur-xl rounded-lg p-2 shadow-2xl border border-white/20 animate-fade-in pointer-events-auto z-50">
            <div className="flex items-center gap-2">
              {/* Thumbnail */}
              <div className="w-16 h-10 flex-shrink-0 rounded overflow-hidden bg-secondary">
                {nextEpisodeImageUrl ? (
                  <img
                    src={nextEpisodeImageUrl}
                    alt={nextEpisode.Name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground text-[10px]">
                    {player.noImage || 'No image'}
                  </div>
                )}
              </div>
              
              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-[10px] text-white/60">{player.next || 'Neste'}</p>
                <p className="text-xs text-white font-medium truncate">
                  {nextEpisode.IndexNumber && `${nextEpisode.IndexNumber}. `}{nextEpisode.Name}
                </p>
              </div>
              
              {/* Countdown */}
              {countdown !== null && countdown > 0 && (
                <span className="text-sm font-bold text-primary min-w-[24px] text-center">
                  {countdown}s
                </span>
              )}
              
              {/* Actions */}
              <div className="flex items-center gap-1">
                <Button
                  size="icon"
                  onClick={playNextEpisode}
                  className="h-8 w-8 bg-primary hover:bg-primary/90"
                >
                  <Play className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => {
                    setShowNextEpisodePreview(false);
                    setNextEpisodeDismissed(true);
                    setCountdown(null);
                    if (countdownInterval.current) {
                      clearInterval(countdownInterval.current);
                    }
                  }}
                  className="h-8 w-8 text-white/60 hover:text-white hover:bg-white/10"
                >
                  ✕
                </Button>
              </div>
            </div>
          </div>
        );
      })()}
        </div>
      </div>
      </Sheet>

      {/* Cast Unsupported Dialog - for Firefox/Safari users */}
      <CastUnsupportedDialog 
        open={castUnsupportedOpen} 
        onOpenChange={setCastUnsupportedOpen} 
      />
    </TooltipProvider>
  );
};

export default Player;
