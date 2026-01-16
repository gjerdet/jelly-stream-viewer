import { useCallback, useEffect, useRef, useState } from "react";

export interface DebouncedVisibilityOptions {
  /** Wait this long before showing (prevents flicker on short buffering spikes) */
  showDelayMs?: number;
  /** Once shown, keep visible for at least this long (prevents rapid hide/show loops) */
  minVisibleMs?: number;
  initialVisible?: boolean;
}

/**
 * Debounces turning an overlay on, and enforces a minimum visible duration.
 * Intended for loading/buffering indicators.
 */
export function useDebouncedVisibility(options: DebouncedVisibilityOptions = {}) {
  const { showDelayMs = 300, minVisibleMs = 600, initialVisible = false } = options;

  const [visible, setVisible] = useState<boolean>(initialVisible);

  const showTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const visibleSinceRef = useRef<number | null>(initialVisible ? Date.now() : null);
  const shouldBeVisibleRef = useRef<boolean>(initialVisible);

  const show = useCallback(() => {
    shouldBeVisibleRef.current = true;

    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }

    if (visible) return;

    if (showTimerRef.current) return;
    showTimerRef.current = setTimeout(() => {
      showTimerRef.current = null;
      if (!shouldBeVisibleRef.current) return;

      visibleSinceRef.current = Date.now();
      setVisible(true);
    }, showDelayMs);
  }, [showDelayMs, visible]);

  const hide = useCallback(() => {
    shouldBeVisibleRef.current = false;

    if (showTimerRef.current) {
      clearTimeout(showTimerRef.current);
      showTimerRef.current = null;
    }

    if (!visible) return;

    const since = visibleSinceRef.current ?? Date.now();
    const elapsed = Date.now() - since;
    const remaining = Math.max(0, minVisibleMs - elapsed);

    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }

    hideTimerRef.current = setTimeout(() => {
      hideTimerRef.current = null;
      visibleSinceRef.current = null;
      setVisible(false);
    }, remaining);
  }, [minVisibleMs, visible]);

  useEffect(() => {
    return () => {
      if (showTimerRef.current) clearTimeout(showTimerRef.current);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, []);

  return { visible, show, hide };
}
