import { useChromecast } from "@/hooks/useChromecast";
import { ChromecastController } from "@/components/ChromecastController";

interface FloatingCastControllerProps {
  audioTracks?: {
    index: number;
    language: string;
    displayTitle: string;
    codec?: string;
    channels?: number;
  }[];
  selectedAudioTrack?: number;
  onAudioTrackChange?: (index: number) => void;
  hasPreviousEpisode?: boolean;
  hasNextEpisode?: boolean;
  onPreviousEpisode?: () => void;
  onNextEpisode?: () => void;
  episodeInfo?: {
    current: number;
    total: number;
    seasonNumber?: number;
  };
}

export const FloatingCastController = ({
  audioTracks = [],
  selectedAudioTrack,
  onAudioTrackChange,
  hasPreviousEpisode = false,
  hasNextEpisode = false,
  onPreviousEpisode,
  onNextEpisode,
  episodeInfo,
}: FloatingCastControllerProps) => {
  const {
    castState,
    remotePlayer,
    remotePlayerController,
    playOrPause,
    endSession,
  } = useChromecast();

  // Don't render if not connected
  if (!castState.isConnected) return null;

  return (
    <ChromecastController
      castState={castState}
      remotePlayer={remotePlayer}
      remotePlayerController={remotePlayerController}
      onPlayPause={playOrPause}
      onEndSession={endSession}
      audioTracks={audioTracks}
      selectedAudioTrack={selectedAudioTrack}
      onAudioTrackChange={onAudioTrackChange}
      hasPreviousEpisode={hasPreviousEpisode}
      hasNextEpisode={hasNextEpisode}
      onPreviousEpisode={onPreviousEpisode}
      onNextEpisode={onNextEpisode}
      episodeInfo={episodeInfo}
      floating={true}
    />
  );
};
