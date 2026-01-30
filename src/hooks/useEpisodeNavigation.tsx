import { useState, useRef, useCallback, useEffect } from "react";
import type { MediaSegment } from "@/types/jellyfin";

interface UseEpisodeNavigationOptions {
  currentEpisodeId?: string;
  episodes: { Id: string; IndexNumber?: number }[];
  onNavigate: (episodeId: string) => void;
}

interface EpisodeNavigationState {
  showNextEpisodePreview: boolean;
  countdown: number | null;
  nextEpisodeDismissed: boolean;
}

interface EpisodeNavigationActions {
  getNextEpisode: () => { Id: string; IndexNumber?: number } | null;
  getPreviousEpisode: () => { Id: string; IndexNumber?: number } | null;
  playNextEpisode: () => void;
  playPreviousEpisode: () => void;
  dismissNextEpisode: () => void;
  triggerNextEpisodePreview: (timeRemaining: number) => void;
  resetDismissed: () => void;
}

/**
 * Hook for managing episode navigation and autoplay
 */
export const useEpisodeNavigation = (
  options: UseEpisodeNavigationOptions
): EpisodeNavigationState & EpisodeNavigationActions => {
  const { currentEpisodeId, episodes, onNavigate } = options;
  
  const [showNextEpisodePreview, setShowNextEpisodePreview] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [nextEpisodeDismissed, setNextEpisodeDismissed] = useState(false);
  
  const countdownInterval = useRef<NodeJS.Timeout>();

  const getNextEpisode = useCallback(() => {
    if (episodes.length === 0 || !currentEpisodeId) return null;
    
    const currentIndex = episodes.findIndex(ep => ep.Id === currentEpisodeId);
    if (currentIndex === -1 || currentIndex === episodes.length - 1) return null;
    
    return episodes[currentIndex + 1];
  }, [currentEpisodeId, episodes]);

  const getPreviousEpisode = useCallback(() => {
    if (episodes.length === 0 || !currentEpisodeId) return null;
    
    const currentIndex = episodes.findIndex(ep => ep.Id === currentEpisodeId);
    if (currentIndex === -1 || currentIndex === 0) return null;
    
    return episodes[currentIndex - 1];
  }, [currentEpisodeId, episodes]);

  const playNextEpisode = useCallback(() => {
    const nextEpisode = getNextEpisode();
    if (nextEpisode) {
      onNavigate(nextEpisode.Id);
    }
  }, [getNextEpisode, onNavigate]);

  const playPreviousEpisode = useCallback(() => {
    const prevEpisode = getPreviousEpisode();
    if (prevEpisode) {
      onNavigate(prevEpisode.Id);
    }
  }, [getPreviousEpisode, onNavigate]);

  const dismissNextEpisode = useCallback(() => {
    setShowNextEpisodePreview(false);
    setNextEpisodeDismissed(true);
    setCountdown(null);
    if (countdownInterval.current) {
      clearInterval(countdownInterval.current);
    }
  }, []);

  const triggerNextEpisodePreview = useCallback((timeRemaining: number) => {
    if (nextEpisodeDismissed || showNextEpisodePreview) return;
    
    const nextEpisode = getNextEpisode();
    if (nextEpisode && timeRemaining <= 30 && timeRemaining > 0) {
      setShowNextEpisodePreview(true);
      setCountdown(Math.ceil(timeRemaining));
    }
  }, [nextEpisodeDismissed, showNextEpisodePreview, getNextEpisode]);

  const resetDismissed = useCallback(() => {
    setNextEpisodeDismissed(false);
  }, []);

  // Countdown effect
  useEffect(() => {
    if (countdown === null || countdown <= 0) return;
    
    if (countdownInterval.current) {
      clearInterval(countdownInterval.current);
    }
    
    countdownInterval.current = setInterval(() => {
      setCountdown(prev => {
        if (prev === null || prev <= 1) {
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
  }, [showNextEpisodePreview, playNextEpisode]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (countdownInterval.current) {
        clearInterval(countdownInterval.current);
      }
    };
  }, []);

  return {
    showNextEpisodePreview,
    countdown,
    nextEpisodeDismissed,
    getNextEpisode,
    getPreviousEpisode,
    playNextEpisode,
    playPreviousEpisode,
    dismissNextEpisode,
    triggerNextEpisodePreview,
    resetDismissed,
  };
};

/**
 * Hook for managing media segment skip functionality (intro, credits, etc.)
 */
export const useMediaSegments = () => {
  const [mediaSegments, setMediaSegments] = useState<MediaSegment[]>([]);
  const [currentSegment, setCurrentSegment] = useState<MediaSegment | null>(null);
  const [showSkipButton, setShowSkipButton] = useState(false);

  const checkSegment = useCallback((currentTimeTicks: number) => {
    if (mediaSegments.length === 0) return;
    
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
  }, [mediaSegments, currentSegment]);

  const skipSegment = useCallback((videoRef: React.RefObject<HTMLVideoElement>) => {
    if (!currentSegment || !videoRef.current) return null;
    
    const endTimeSeconds = currentSegment.EndTicks / 10000000;
    videoRef.current.currentTime = endTimeSeconds;
    
    const segmentType = currentSegment.Type;
    setCurrentSegment(null);
    setShowSkipButton(false);
    
    return segmentType;
  }, [currentSegment]);

  const getSkipButtonLabel = useCallback((translations: Record<string, string>) => {
    if (!currentSegment) return translations.skip || 'Skip';
    
    switch (currentSegment.Type.toLowerCase()) {
      case 'intro':
        return translations.skipIntro || 'Skip intro';
      case 'outro':
      case 'credits':
        return translations.skipCredits || 'Skip credits';
      case 'recap':
        return translations.skipRecap || 'Skip recap';
      case 'commercial':
        return translations.skipCommercial || 'Skip commercial';
      case 'preview':
        return translations.skipPreview || 'Skip preview';
      default:
        return `${translations.skip || 'Skip'} ${currentSegment.Type}`;
    }
  }, [currentSegment]);

  return {
    mediaSegments,
    currentSegment,
    showSkipButton,
    setMediaSegments,
    checkSegment,
    skipSegment,
    getSkipButtonLabel,
  };
};
