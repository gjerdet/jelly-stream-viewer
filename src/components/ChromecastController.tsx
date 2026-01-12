import { useEffect, useState, useCallback } from "react";
import { Play, Pause, Square, Volume2, VolumeX, SkipBack, SkipForward, Cast, ChevronLeft, ChevronRight, Volume1, Languages, Subtitles, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface AudioTrack {
  index: number;
  language: string;
  displayTitle: string;
  codec?: string;
  channels?: number;
}

interface SubtitleTrack {
  index: number;
  language: string;
  displayTitle: string;
  codec?: string;
  isDefault?: boolean;
}

interface CastState {
  isAvailable: boolean;
  isConnected: boolean;
  isScanning: boolean;
  deviceName: string | null;
  isBrowserSupported: boolean;
  mediaInfo: {
    title: string | null;
    isPaused: boolean;
    currentTime: number;
    duration: number;
  } | null;
}

interface ChromecastControllerProps {
  castState: CastState;
  remotePlayer: any;
  remotePlayerController: any;
  onPlayPause: () => void;
  onEndSession: () => void;
  audioTracks?: AudioTrack[];
  selectedAudioTrack?: number;
  onAudioTrackChange?: (index: number) => void;
  subtitleTracks?: SubtitleTrack[];
  selectedSubtitle?: string;
  onSubtitleChange?: (index: string) => void;
  hasPreviousEpisode?: boolean;
  hasNextEpisode?: boolean;
  onPreviousEpisode?: () => void;
  onNextEpisode?: () => void;
  episodeInfo?: {
    current: number;
    total: number;
    seasonNumber?: number;
  };
  // Next episode countdown
  nextEpisodeCountdown?: number | null;
  nextEpisodeName?: string;
  onCancelNextEpisode?: () => void;
  compact?: boolean;
  floating?: boolean;
  className?: string;
  // Persisted position
  onPositionUpdate?: (positionSeconds: number) => void;
  itemId?: string;
}

export const ChromecastController = ({
  castState,
  remotePlayer,
  remotePlayerController,
  onPlayPause,
  onEndSession,
  audioTracks = [],
  selectedAudioTrack,
  onAudioTrackChange,
  subtitleTracks = [],
  selectedSubtitle,
  onSubtitleChange,
  hasPreviousEpisode = false,
  hasNextEpisode = false,
  onPreviousEpisode,
  onNextEpisode,
  episodeInfo,
  nextEpisodeCountdown,
  nextEpisodeName,
  onCancelNextEpisode,
  compact = false,
  floating = false,
  className,
  onPositionUpdate,
  itemId,
}: ChromecastControllerProps) => {
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isSeeking, setIsSeeking] = useState(false);
  const [seekValue, setSeekValue] = useState(0);
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);
  const [lastPositionUpdate, setLastPositionUpdate] = useState(0);

  // Sync volume from remote player
  useEffect(() => {
    if (remotePlayer) {
      setVolume(remotePlayer.volumeLevel || 1);
      setIsMuted(remotePlayer.isMuted || false);
    }
  }, [remotePlayer?.volumeLevel, remotePlayer?.isMuted]);

  // Update seek value when not actively seeking
  useEffect(() => {
    if (!isSeeking && castState.mediaInfo) {
      setSeekValue(castState.mediaInfo.currentTime);
    }
  }, [castState.mediaInfo?.currentTime, isSeeking]);

  // Persist playback position periodically
  useEffect(() => {
    if (!castState.mediaInfo || !onPositionUpdate || !itemId) return;
    
    const currentTime = castState.mediaInfo.currentTime;
    const now = Date.now();
    
    // Update every 10 seconds
    if (now - lastPositionUpdate >= 10000 && currentTime > 0) {
      onPositionUpdate(currentTime);
      setLastPositionUpdate(now);
    }
  }, [castState.mediaInfo?.currentTime, onPositionUpdate, itemId, lastPositionUpdate]);

  const handleVolumeChange = useCallback((value: number[]) => {
    const newVolume = value[0];
    setVolume(newVolume);
    
    if (remotePlayer && remotePlayerController) {
      remotePlayer.volumeLevel = newVolume;
      remotePlayerController.setVolumeLevel();
    }
  }, [remotePlayer, remotePlayerController]);

  const handleMuteToggle = useCallback(() => {
    if (remotePlayer && remotePlayerController) {
      remotePlayerController.muteOrUnmute();
      setIsMuted(!remotePlayer.isMuted);
    }
  }, [remotePlayer, remotePlayerController]);

  const handleSeekStart = useCallback(() => {
    setIsSeeking(true);
  }, []);

  const handleSeekChange = useCallback((value: number[]) => {
    setSeekValue(value[0]);
  }, []);

  const handleSeekEnd = useCallback((value: number[]) => {
    if (remotePlayer && remotePlayerController) {
      remotePlayer.currentTime = value[0];
      remotePlayerController.seek();
    }
    setIsSeeking(false);
  }, [remotePlayer, remotePlayerController]);

  const handleSkip = useCallback((seconds: number) => {
    if (remotePlayer && remotePlayerController && castState.mediaInfo) {
      const newTime = Math.max(0, Math.min(
        castState.mediaInfo.currentTime + seconds,
        castState.mediaInfo.duration
      ));
      remotePlayer.currentTime = newTime;
      remotePlayerController.seek();
    }
  }, [remotePlayer, remotePlayerController, castState.mediaInfo]);

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const getVolumeIcon = () => {
    if (isMuted || volume === 0) return <VolumeX className="h-4 w-4" />;
    if (volume < 0.5) return <Volume1 className="h-4 w-4" />;
    return <Volume2 className="h-4 w-4" />;
  };

  if (!castState.isConnected) return null;

  const progress = castState.mediaInfo 
    ? (castState.mediaInfo.currentTime / castState.mediaInfo.duration) * 100 
    : 0;

  // Floating mini controller for bottom of screen
  if (floating) {
    return (
      <div className={cn(
        "fixed bottom-0 left-0 right-0 z-50",
        className
      )}>
        {/* Next episode countdown banner */}
        {nextEpisodeCountdown !== null && nextEpisodeCountdown !== undefined && nextEpisodeCountdown > 0 && (
          <div className="bg-primary text-primary-foreground px-4 py-2 flex items-center justify-between animate-in slide-in-from-bottom duration-200">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center h-8 w-8 rounded-full bg-primary-foreground/20 font-bold text-lg">
                {nextEpisodeCountdown}
              </div>
              <div className="text-sm">
                <span className="font-medium">Neste episode:</span>
                <span className="ml-1 opacity-90">{nextEpisodeName || 'Laster...'}</span>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-primary-foreground hover:bg-primary-foreground/20 hover:text-primary-foreground"
              onClick={onCancelNextEpisode}
            >
              <X className="h-4 w-4 mr-1" />
              Avbryt
            </Button>
          </div>
        )}
        
        <div className="bg-background/95 backdrop-blur-lg border-t shadow-2xl">
          <div className="container mx-auto px-3 py-2 sm:px-4 sm:py-3">
            {/* Progress bar at top */}
            {castState.mediaInfo && (
              <div 
                className="absolute top-0 left-0 right-0 h-1 bg-secondary cursor-pointer group"
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const percent = (e.clientX - rect.left) / rect.width;
                  const newTime = percent * (castState.mediaInfo?.duration || 0);
                  if (remotePlayer && remotePlayerController) {
                    remotePlayer.currentTime = newTime;
                    remotePlayerController.seek();
                  }
                }}
              >
                <div 
                  className="h-full bg-primary transition-all"
                  style={{ width: `${progress}%` }}
                />
                <div 
                  className="absolute top-1/2 -translate-y-1/2 h-3 w-3 bg-primary rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ left: `${progress}%`, marginLeft: '-6px' }}
                />
              </div>
            )}

          <div className="flex items-center gap-2 sm:gap-4">
            {/* Cast icon + Title */}
            <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
              <div className="p-1.5 sm:p-2 rounded-lg bg-primary/10 flex-shrink-0">
                <Cast className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {castState.mediaInfo?.title || "Ingen media"}
                </p>
                <p className="text-xs text-muted-foreground hidden sm:block">
                  {castState.deviceName}
                  {castState.mediaInfo && ` • ${formatTime(castState.mediaInfo.currentTime)} / ${formatTime(castState.mediaInfo.duration)}`}
                </p>
              </div>
            </div>

            {/* Episode navigation - only show if available */}
            {(hasPreviousEpisode || hasNextEpisode) && (
              <div className="hidden sm:flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={onPreviousEpisode}
                  disabled={!hasPreviousEpisode}
                  title="Forrige episode"
                >
                  <ChevronLeft className="h-5 w-5" />
                </Button>
                {episodeInfo && (
                  <span className="text-xs text-muted-foreground px-1">
                    {episodeInfo.seasonNumber && `S${episodeInfo.seasonNumber} `}E{episodeInfo.current}/{episodeInfo.total}
                  </span>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={onNextEpisode}
                  disabled={!hasNextEpisode}
                  title="Neste episode"
                >
                  <ChevronRight className="h-5 w-5" />
                </Button>
              </div>
            )}

            {/* Playback controls */}
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 hidden sm:flex"
                onClick={() => handleSkip(-10)}
                disabled={!castState.mediaInfo}
              >
                <SkipBack className="h-4 w-4" />
              </Button>
              
              <Button
                variant="default"
                size="icon"
                className="h-10 w-10 rounded-full"
                onClick={onPlayPause}
                disabled={!castState.mediaInfo}
              >
                {castState.mediaInfo?.isPaused ? (
                  <Play className="h-5 w-5 ml-0.5" />
                ) : (
                  <Pause className="h-5 w-5" />
                )}
              </Button>
              
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 hidden sm:flex"
                onClick={() => handleSkip(10)}
                disabled={!castState.mediaInfo}
              >
                <SkipForward className="h-4 w-4" />
              </Button>
            </div>

            {/* Volume control */}
            <Popover open={showVolumeSlider} onOpenChange={setShowVolumeSlider}>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 hidden sm:flex"
                >
                  {getVolumeIcon()}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-40 p-3" align="end">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium">Volum</span>
                    <span className="text-xs text-muted-foreground">{Math.round(volume * 100)}%</span>
                  </div>
                  <Slider
                    value={[isMuted ? 0 : volume]}
                    max={1}
                    step={0.01}
                    onValueChange={handleVolumeChange}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full text-xs"
                    onClick={handleMuteToggle}
                  >
                    {isMuted ? "Slå på lyd" : "Demp"}
                  </Button>
                </div>
              </PopoverContent>
            </Popover>

            {/* Audio track selector */}
            {audioTracks.length > 1 && onAudioTrackChange && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={selectedAudioTrack !== undefined ? "secondary" : "ghost"}
                    size="icon"
                    className="h-8 w-8 hidden md:flex relative"
                    title="Velg lydspor"
                  >
                    <Languages className="h-4 w-4" />
                    {selectedAudioTrack !== undefined && (
                      <span className="absolute -top-0.5 -right-0.5 h-2 w-2 bg-primary rounded-full" />
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-56 p-2" align="end">
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground px-2 pb-1">Lydspor</p>
                    {audioTracks.map((track) => (
                      <Button
                        key={track.index}
                        variant={selectedAudioTrack === track.index ? "secondary" : "ghost"}
                        size="sm"
                        className="w-full justify-between gap-2"
                        onClick={() => onAudioTrackChange(track.index)}
                      >
                        <span className="truncate text-left flex-1">{track.displayTitle}</span>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {track.channels && (
                            <span className="text-xs text-muted-foreground">
                              {track.channels >= 6 ? '5.1' : track.channels >= 8 ? '7.1' : 'Stereo'}
                            </span>
                          )}
                          {selectedAudioTrack === track.index && (
                            <Check className="h-4 w-4 text-primary" />
                          )}
                        </div>
                      </Button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            )}

            {/* Subtitle selector */}
            {subtitleTracks.length > 0 && onSubtitleChange && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={selectedSubtitle ? "secondary" : "ghost"}
                    size="icon"
                    className="h-8 w-8 hidden md:flex relative"
                    title="Velg undertekst"
                  >
                    <Subtitles className="h-4 w-4" />
                    {selectedSubtitle && (
                      <span className="absolute -top-0.5 -right-0.5 h-2 w-2 bg-primary rounded-full" />
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-56 p-2" align="end">
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground px-2 pb-1">Undertekster</p>
                    <Button
                      variant={selectedSubtitle === "" ? "secondary" : "ghost"}
                      size="sm"
                      className="w-full justify-between gap-2"
                      onClick={() => onSubtitleChange("")}
                    >
                      <span>Ingen</span>
                      {selectedSubtitle === "" && (
                        <Check className="h-4 w-4 text-primary" />
                      )}
                    </Button>
                    {subtitleTracks.map((track) => (
                      <Button
                        key={track.index}
                        variant={selectedSubtitle === track.index.toString() ? "secondary" : "ghost"}
                        size="sm"
                        className="w-full justify-between gap-2"
                        onClick={() => onSubtitleChange(track.index.toString())}
                      >
                        <span className="truncate text-left flex-1">{track.displayTitle}</span>
                        {selectedSubtitle === track.index.toString() && (
                          <Check className="h-4 w-4 text-primary flex-shrink-0" />
                        )}
                      </Button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            )}

            {/* Stop button */}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={onEndSession}
              title="Stopp casting"
            >
              <Square className="h-4 w-4" />
            </Button>
          </div>
        </div>
        </div>
      </div>
    );
  }

  // Compact mode
  if (compact) {
    return (
      <Card className={cn("p-3", className)}>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Cast className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">
              {castState.mediaInfo?.title || "Ingen media"}
            </p>
            <p className="text-xs text-muted-foreground">
              {castState.deviceName}
            </p>
          </div>
          <div className="flex items-center gap-1">
            {hasPreviousEpisode && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={onPreviousEpisode}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={onPlayPause}
            >
              {castState.mediaInfo?.isPaused ? (
                <Play className="h-4 w-4" />
              ) : (
                <Pause className="h-4 w-4" />
              )}
            </Button>
            {hasNextEpisode && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={onNextEpisode}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={onEndSession}
            >
              <Square className="h-4 w-4" />
            </Button>
          </div>
        </div>
        {castState.mediaInfo && (
          <Progress value={progress} className="h-1 mt-2" />
        )}
      </Card>
    );
  }

  // Full controller with mobile scroll support
  return (
    <Card className={cn("p-4 max-h-[70vh] overflow-y-auto", className)}>
      <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primary/10">
          <Cast className="h-6 w-6 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold truncate">
            {castState.mediaInfo?.title || "Ingen media"}
          </p>
          <p className="text-sm text-muted-foreground">
            Caster til {castState.deviceName}
          </p>
        </div>
      </div>

      {/* Progress bar */}
      {castState.mediaInfo && (
        <div className="space-y-2">
          <Slider
            value={[isSeeking ? seekValue : castState.mediaInfo.currentTime]}
            max={castState.mediaInfo.duration || 100}
            step={1}
            onPointerDown={handleSeekStart}
            onValueChange={handleSeekChange}
            onValueCommit={handleSeekEnd}
            className="cursor-pointer"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{formatTime(isSeeking ? seekValue : castState.mediaInfo.currentTime)}</span>
            <span>{formatTime(castState.mediaInfo.duration)}</span>
          </div>
        </div>
      )}

      {/* Episode navigation */}
      {(hasPreviousEpisode || hasNextEpisode) && (
        <div className="flex items-center justify-center gap-2 py-2 border-y border-border/50">
          <Button
            variant="outline"
            size="sm"
            onClick={onPreviousEpisode}
            disabled={!hasPreviousEpisode}
            className="gap-2"
          >
            <ChevronLeft className="h-4 w-4" />
            Forrige
          </Button>
          {episodeInfo && (
            <span className="text-sm text-muted-foreground px-2">
              {episodeInfo.seasonNumber && `S${episodeInfo.seasonNumber} `}
              Episode {episodeInfo.current} av {episodeInfo.total}
            </span>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={onNextEpisode}
            disabled={!hasNextEpisode}
            className="gap-2"
          >
            Neste
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Controls */}
      <div className="flex items-center justify-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10"
          onClick={() => handleSkip(-10)}
          disabled={!castState.mediaInfo}
        >
          <SkipBack className="h-5 w-5" />
        </Button>
        
        <Button
          variant="default"
          size="icon"
          className="h-12 w-12 rounded-full"
          onClick={onPlayPause}
          disabled={!castState.mediaInfo}
        >
          {castState.mediaInfo?.isPaused ? (
            <Play className="h-6 w-6 ml-0.5" />
          ) : (
            <Pause className="h-6 w-6" />
          )}
        </Button>
        
        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10"
          onClick={() => handleSkip(10)}
          disabled={!castState.mediaInfo}
        >
          <SkipForward className="h-5 w-5" />
        </Button>
      </div>

      {/* Volume */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 flex-shrink-0"
          onClick={handleMuteToggle}
        >
          {getVolumeIcon()}
        </Button>
        <Slider
          value={[isMuted ? 0 : volume]}
          max={1}
          step={0.01}
          onValueChange={handleVolumeChange}
          className="flex-1"
        />
        <span className="text-xs text-muted-foreground w-8 text-right">
          {Math.round((isMuted ? 0 : volume) * 100)}%
        </span>
      </div>

      {/* Audio track selector */}
      {audioTracks.length > 1 && onAudioTrackChange && (
        <div className="flex items-center gap-3">
          <div className="relative flex-shrink-0">
            <Languages className="h-4 w-4 text-muted-foreground" />
            {selectedAudioTrack !== undefined && (
              <span className="absolute -top-1 -right-1 h-2 w-2 bg-primary rounded-full" />
            )}
          </div>
          <Select
            value={selectedAudioTrack?.toString()}
            onValueChange={(value) => onAudioTrackChange(parseInt(value))}
          >
            <SelectTrigger className="flex-1">
              <SelectValue placeholder="Velg lydspor" />
            </SelectTrigger>
            <SelectContent>
              {audioTracks.map((track) => (
                <SelectItem key={track.index} value={track.index.toString()}>
                  <div className="flex items-center justify-between w-full gap-2">
                    <span>{track.displayTitle}</span>
                    {track.channels && (
                      <span className="text-xs text-muted-foreground">
                        {track.channels >= 6 ? '5.1' : track.channels >= 8 ? '7.1' : 'Stereo'}
                      </span>
                    )}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Subtitle selector */}
      {subtitleTracks.length > 0 && onSubtitleChange && (
        <div className="flex items-center gap-3">
          <div className="relative flex-shrink-0">
            <Subtitles className="h-4 w-4 text-muted-foreground" />
            {selectedSubtitle && (
              <span className="absolute -top-1 -right-1 h-2 w-2 bg-primary rounded-full" />
            )}
          </div>
          <Select
            value={selectedSubtitle || ""}
            onValueChange={onSubtitleChange}
          >
            <SelectTrigger className="flex-1">
              <SelectValue placeholder="Velg undertekst" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Ingen undertekst</SelectItem>
              {subtitleTracks.map((track) => (
                <SelectItem key={track.index} value={track.index.toString()}>
                  {track.displayTitle}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Stop button */}
      <Button
        variant="outline"
        className="w-full"
        onClick={onEndSession}
      >
        <Square className="h-4 w-4 mr-2" />
        Stopp casting
      </Button>
      </div>
    </Card>
  );
};
