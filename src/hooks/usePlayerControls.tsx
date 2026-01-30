import { useState, useRef, useCallback } from "react";

interface UsePlayerControlsOptions {
  hideAfterMs?: number;
}

interface PlayerControlsState {
  showControls: boolean;
  isFullscreen: boolean;
  doubleTapSide: 'left' | 'right' | null;
}

interface PlayerControlsActions {
  handleMouseMove: () => void;
  handleDoubleTap: (e: React.TouchEvent<HTMLDivElement>, onSkip: (seconds: number) => void) => void;
  toggleFullscreen: (containerRef: React.RefObject<HTMLDivElement>) => Promise<void>;
  setIsFullscreen: (value: boolean) => void;
}

/**
 * Hook for managing player control visibility and interactions
 * Handles auto-hide, fullscreen toggle, and double-tap gestures
 */
export const usePlayerControls = (
  options: UsePlayerControlsOptions = {}
): PlayerControlsState & PlayerControlsActions => {
  const { hideAfterMs = 3000 } = options;
  
  const [showControls, setShowControls] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [doubleTapSide, setDoubleTapSide] = useState<'left' | 'right' | null>(null);
  
  const hideControlsTimer = useRef<NodeJS.Timeout>();
  const lastTapRef = useRef<{ time: number; x: number } | null>(null);
  const doubleTapTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleMouseMove = useCallback(() => {
    setShowControls(true);
    if (hideControlsTimer.current) {
      clearTimeout(hideControlsTimer.current);
    }
    hideControlsTimer.current = setTimeout(() => {
      setShowControls(false);
    }, hideAfterMs);
  }, [hideAfterMs]);

  const handleDoubleTap = useCallback((
    e: React.TouchEvent<HTMLDivElement>,
    onSkip: (seconds: number) => void
  ) => {
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
          onSkip(-10);
          setDoubleTapSide('left');
        } else {
          onSkip(10);
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
  }, []);

  const toggleFullscreen = useCallback(async (
    containerRef: React.RefObject<HTMLDivElement>
  ) => {
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
  }, []);

  return {
    showControls,
    isFullscreen,
    doubleTapSide,
    handleMouseMove,
    handleDoubleTap,
    toggleFullscreen,
    setIsFullscreen,
  };
};
