import { useEffect, useState, useCallback } from "react";
import { Play, Pause, Square, Volume2, VolumeX, SkipBack, SkipForward, Cast } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

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
  compact?: boolean;
  className?: string;
}

export const ChromecastController = ({
  castState,
  remotePlayer,
  remotePlayerController,
  onPlayPause,
  onEndSession,
  compact = false,
  className,
}: ChromecastControllerProps) => {
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isSeeking, setIsSeeking] = useState(false);
  const [seekValue, setSeekValue] = useState(0);

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

  if (!castState.isConnected) return null;

  const progress = castState.mediaInfo 
    ? (castState.mediaInfo.currentTime / castState.mediaInfo.duration) * 100 
    : 0;

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

  return (
    <Card className={cn("p-4 space-y-4", className)}>
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
          {isMuted || volume === 0 ? (
            <VolumeX className="h-4 w-4" />
          ) : (
            <Volume2 className="h-4 w-4" />
          )}
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

      {/* Stop button */}
      <Button
        variant="outline"
        className="w-full"
        onClick={onEndSession}
      >
        <Square className="h-4 w-4 mr-2" />
        Stopp casting
      </Button>
    </Card>
  );
};
