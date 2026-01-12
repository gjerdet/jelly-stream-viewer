import { useEffect, useState, useCallback } from "react";
import { useChromecast } from "@/hooks/useChromecast";
import { ChromecastController } from "@/components/ChromecastController";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

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

interface FloatingCastControllerProps {
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
  itemId?: string;
  itemName?: string;
  itemType?: string;
  imageUrl?: string;
  seriesId?: string;
  seriesName?: string;
  seasonId?: string;
}

// Storage key for cast position
const getCastPositionKey = (itemId: string) => `cast_position_${itemId}`;

export const FloatingCastController = ({
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
  itemId,
  itemName,
  itemType,
  imageUrl,
  seriesId,
  seriesName,
  seasonId,
}: FloatingCastControllerProps) => {
  const { user } = useAuth();
  const [watchHistoryId, setWatchHistoryId] = useState<string | null>(null);
  const {
    castState,
    remotePlayer,
    remotePlayerController,
    playOrPause,
    endSession,
  } = useChromecast();

  // Create or update watch history entry when casting starts
  useEffect(() => {
    const createWatchHistoryEntry = async () => {
      if (!user || !itemId || !itemName || !itemType || !castState.isConnected) return;
      
      try {
        // Check if entry already exists
        const { data: existing } = await supabase
          .from("watch_history")
          .select("id")
          .eq("user_id", user.id)
          .eq("jellyfin_item_id", itemId)
          .maybeSingle();
        
        if (existing) {
          setWatchHistoryId(existing.id);
          return;
        }

        // Create new entry
        const { data, error } = await supabase
          .from("watch_history")
          .upsert({
            user_id: user.id,
            jellyfin_item_id: itemId,
            jellyfin_item_name: itemName,
            jellyfin_item_type: itemType,
            image_url: imageUrl,
            jellyfin_series_id: seriesId,
            jellyfin_series_name: seriesName,
            jellyfin_season_id: seasonId,
            watched_at: new Date().toISOString(),
          }, { onConflict: 'user_id,jellyfin_item_id' })
          .select('id')
          .single();
        
        if (!error && data) {
          setWatchHistoryId(data.id);
        }
      } catch (error) {
        console.error("[FloatingCast] Error creating watch history:", error);
      }
    };

    createWatchHistoryEntry();
  }, [user, itemId, itemName, itemType, imageUrl, seriesId, seriesName, seasonId, castState.isConnected]);

  // Handle position updates - save to localStorage and database
  const handlePositionUpdate = useCallback(async (positionSeconds: number) => {
    if (!itemId) return;
    
    // Save to localStorage for quick restore
    localStorage.setItem(getCastPositionKey(itemId), positionSeconds.toString());
    
    // Save to database if we have a watch history entry
    if (watchHistoryId && user) {
      const positionTicks = Math.floor(positionSeconds * 10000000);
      try {
        await supabase
          .from("watch_history")
          .update({ 
            last_position_ticks: positionTicks,
            watched_at: new Date().toISOString()
          })
          .eq("id", watchHistoryId);
      } catch (error) {
        console.error("[FloatingCast] Error updating position:", error);
      }
    }
  }, [itemId, watchHistoryId, user]);

  // Handle end session - save final position
  const handleEndSession = useCallback(async () => {
    if (castState.mediaInfo && itemId) {
      await handlePositionUpdate(castState.mediaInfo.currentTime);
    }
    endSession();
  }, [castState.mediaInfo, itemId, handlePositionUpdate, endSession]);

  // Don't render if not connected
  if (!castState.isConnected) return null;

  return (
    <ChromecastController
      castState={castState}
      remotePlayer={remotePlayer}
      remotePlayerController={remotePlayerController}
      onPlayPause={playOrPause}
      onEndSession={handleEndSession}
      audioTracks={audioTracks}
      selectedAudioTrack={selectedAudioTrack}
      onAudioTrackChange={onAudioTrackChange}
      subtitleTracks={subtitleTracks}
      selectedSubtitle={selectedSubtitle}
      onSubtitleChange={onSubtitleChange}
      hasPreviousEpisode={hasPreviousEpisode}
      hasNextEpisode={hasNextEpisode}
      onPreviousEpisode={onPreviousEpisode}
      onNextEpisode={onNextEpisode}
      episodeInfo={episodeInfo}
      nextEpisodeCountdown={nextEpisodeCountdown}
      nextEpisodeName={nextEpisodeName}
      onCancelNextEpisode={onCancelNextEpisode}
      floating={true}
      onPositionUpdate={handlePositionUpdate}
      itemId={itemId}
    />
  );
};

// Utility function to get persisted cast position
export const getPersistedCastPosition = (itemId: string): number | null => {
  const stored = localStorage.getItem(getCastPositionKey(itemId));
  return stored ? parseFloat(stored) : null;
};

// Utility function to clear persisted cast position
export const clearPersistedCastPosition = (itemId: string): void => {
  localStorage.removeItem(getCastPositionKey(itemId));
};
