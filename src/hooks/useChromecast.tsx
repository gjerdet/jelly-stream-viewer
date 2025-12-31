import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { waitForCastSdk } from "@/lib/castSdkLoader";

interface CastState {
  isAvailable: boolean;
  isConnected: boolean;
  isScanning: boolean;
  deviceName: string | null;
  isBrowserSupported: boolean; // New: tracks if browser actually supports Cast
  mediaInfo: {
    title: string | null;
    isPaused: boolean;
    currentTime: number;
    duration: number;
  } | null;
}

// Detect if we're in a Chromium-based browser
const isChromiumBrowser = (): boolean => {
  const userAgent = navigator.userAgent.toLowerCase();
  // Chrome, Edge, Opera, Brave, etc. all have "chrome" in their user agent
  // But we need to exclude non-Chromium Edge (legacy)
  const isChromium = /chrome|chromium|crios/i.test(userAgent);
  const isEdge = /edg/i.test(userAgent); // New Edge is Chromium-based
  const isOpera = /opr\//i.test(userAgent);
  
  // Firefox and Safari don't support Cast SDK
  const isFirefox = /firefox/i.test(userAgent);
  const isSafari = /safari/i.test(userAgent) && !/chrome/i.test(userAgent);
  
  if (isFirefox || isSafari) return false;
  return isChromium || isEdge || isOpera;
};

export const useChromecast = () => {
  const browserSupported = isChromiumBrowser();
  
  const [castState, setCastState] = useState<CastState>({
    isAvailable: true, // Always show as available for UI purposes
    isConnected: false,
    isScanning: false,
    deviceName: null,
    isBrowserSupported: browserSupported,
    mediaInfo: null,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [castContext, setCastContext] = useState<any>(null);
  const [remotePlayer, setRemotePlayer] = useState<any>(null);
  const [remotePlayerController, setRemotePlayerController] = useState<any>(null);

  // Initialize Chromecast (only if browser supports it)
  useEffect(() => {
    console.log('[Chromecast] Starting initialization...');
    console.log('[Chromecast] Protocol:', window.location.protocol);
    console.log('[Chromecast] Hostname:', window.location.hostname);
    console.log('[Chromecast] Browser supported:', browserSupported);
    
    // If browser doesn't support Cast, mark as loaded but keep isAvailable true for UI
    if (!browserSupported) {
      console.log('[Chromecast] Browser does not support Cast SDK - showing fallback UI');
      setIsLoading(false);
      return;
    }
    
    let mounted = true;

    const initializeCast = () => {
      console.log('[Chromecast] initializeCast called');

      const chromeCast = (window as any).chrome?.cast;
      const castFramework = (window as any).cast?.framework;

      console.log('[Chromecast] chrome.cast available:', !!chromeCast);
      console.log('[Chromecast] window.cast.framework available:', !!castFramework);

      if (!castFramework) {
        console.log('[Chromecast] Cast framework not available');
        if (mounted) {
          setIsLoading(false);
        }
        return;
      }

      try {
        const context = castFramework.CastContext.getInstance();
        console.log('[Chromecast] Got CastContext instance');

        // Default Media Receiver App ID - this is the official Google default
        const DEFAULT_RECEIVER_APP_ID = 'CC1AD845';
        
        const autoJoinPolicy =
          chromeCast?.AutoJoinPolicy?.ORIGIN_SCOPED ??
          chromeCast?.AutoJoinPolicy?.TAB_AND_ORIGIN_SCOPED ??
          castFramework.AutoJoinPolicy?.ORIGIN_SCOPED;

        context.setOptions({
          receiverApplicationId: DEFAULT_RECEIVER_APP_ID,
          ...(autoJoinPolicy ? { autoJoinPolicy } : {}),
        });
        console.log('[Chromecast] Options set');

        const player = new castFramework.RemotePlayer();
        const playerController = new castFramework.RemotePlayerController(player);
        console.log('[Chromecast] RemotePlayer and controller created');

        if (!mounted) return;

        setCastContext(context);
        setRemotePlayer(player);
        setRemotePlayerController(playerController);

        // Listen for cast state changes
        context.addEventListener(
          castFramework.CastContextEventType.CAST_STATE_CHANGED,
          (event: any) => {
            console.log('[Chromecast] Cast state changed:', event.castState);
            const isConnected = event.castState === castFramework.CastState.CONNECTED;
            const session = context.getCurrentSession();

            if (isConnected && session) {
              const deviceName = session.getCastDevice().friendlyName;
              localStorage.setItem('last_cast_device', deviceName);
              console.log('[Chromecast] Connected to:', deviceName);

              setCastState((prev) => ({
                ...prev,
                isAvailable: true,
                isConnected,
                deviceName,
              }));
            } else {
              setCastState((prev) => ({
                ...prev,
                isAvailable: true,
                isConnected: false,
                deviceName: null,
              }));
            }
          }
        );

        // Listen for media info changes
        playerController.addEventListener(
          castFramework.RemotePlayerEventType.ANY_CHANGE,
          () => {
            if (player.isConnected && player.isMediaLoaded) {
              setCastState((prev) => ({
                ...prev,
                mediaInfo: {
                  title: player.title || null,
                  isPaused: player.isPaused,
                  currentTime: player.currentTime,
                  duration: player.duration,
                },
              }));
            } else {
              setCastState((prev) => ({
                ...prev,
                mediaInfo: null,
              }));
            }
          }
        );

        setCastState((prev) => ({ ...prev, isAvailable: true }));
        setIsLoading(false);

        const lastDevice = localStorage.getItem('last_cast_device');
        if (lastDevice) {
          toast.success(`Chromecast klar! Sist brukt: ${lastDevice}`);
        } else {
          toast.success('Chromecast klar!');
        }

        console.log('[Chromecast] Initialized successfully');
      } catch (error) {
        console.error('[Chromecast] Initialization error:', error);
        if (mounted) {
          toast.error('Kunne ikke initialisere Chromecast');
          setIsLoading(false);
        }
      }
    };

    // Wait for Cast SDK using the global loader
    waitForCastSdk().then((isAvailable) => {
      if (!mounted) return;
      
      if (isAvailable) {
        initializeCast();
      } else {
        console.log('[Chromecast] Cast SDK not available');
        setIsLoading(false);
      }
    });

    return () => {
      mounted = false;
    };
  }, [browserSupported]);

  // Scan for available Chromecast devices
  const scanForDevices = useCallback(async () => {
    // If browser doesn't support Cast, show info message
    if (!browserSupported) {
      return { unsupported: true };
    }
    
    if (!castContext) {
      return { unsupported: true };
    }

    setCastState(prev => ({ ...prev, isScanning: true }));
    toast.info('Søker etter Chromecast-enheter...', { duration: 2000 });

    try {
      // The Cast SDK automatically discovers devices when we request a session
      // Opening the Cast dialog shows all available devices
      await castContext.requestSession();
      
      const session = castContext.getCurrentSession();
      const deviceName = session?.getCastDevice().friendlyName;
      
      if (deviceName) {
        const lastDevice = localStorage.getItem('last_cast_device');
        if (lastDevice && lastDevice === deviceName) {
          toast.success(`Koblet til ${deviceName} igjen!`);
        } else {
          toast.success(`Koblet til ${deviceName}`);
        }
      } else {
        toast.success('Koblet til Chromecast');
      }
      
      console.log('[Chromecast] Cast session started via scan');
      return { unsupported: false };
    } catch (error: any) {
      if (error === 'cancel') {
        toast.info('Søk avbrutt');
      } else {
        console.error('[Chromecast] Scan error:', error);
        toast.error('Fant ingen Chromecast-enheter');
      }
      return { unsupported: false };
    } finally {
      setCastState(prev => ({ ...prev, isScanning: false }));
    }
  }, [castContext, browserSupported]);

  const requestSession = useCallback(async () => {
    // If browser doesn't support Cast, return indicator
    if (!browserSupported) {
      return { unsupported: true };
    }
    
    if (!castContext) {
      return { unsupported: true };
    }
    
    const lastDevice = localStorage.getItem('last_cast_device');
    
    try {
      await castContext.requestSession();
      const session = castContext.getCurrentSession();
      const deviceName = session?.getCastDevice().friendlyName;
      
      if (deviceName) {
        if (lastDevice && lastDevice === deviceName) {
          toast.success(`Koblet til ${deviceName} igjen!`);
        } else {
          toast.success(`Koblet til ${deviceName}`);
        }
      } else {
        toast.success('Koblet til Chromecast');
      }
      
      console.log('[Chromecast] Cast session started');
      return { unsupported: false };
    } catch (error: any) {
      if (error !== 'cancel') {
        console.error('[Chromecast] Cast session error:', error);
      }
      return { unsupported: false };
    }
  }, [castContext, browserSupported]);

  const endSession = useCallback(() => {
    if (!castContext) return;
    const session = castContext.getCurrentSession();
    if (session) {
      const deviceName = session.getCastDevice().friendlyName;
      session.endSession(true);
      toast.info(`Koblet fra ${deviceName}`);
    }
  }, [castContext]);

  const playOrPause = useCallback(() => {
    if (!remotePlayerController || !remotePlayer) return;
    remotePlayerController.playOrPause();
  }, [remotePlayerController, remotePlayer]);

  const seek = useCallback((time: number) => {
    if (!remotePlayerController || !remotePlayer) return;
    remotePlayer.currentTime = time;
    remotePlayerController.seek();
  }, [remotePlayerController, remotePlayer]);

  const loadMedia = useCallback(async (mediaUrl: string, metadata: {
    title: string;
    subtitle?: string;
    imageUrl?: string;
    currentTime?: number;
  }) => {
    if (!castContext) {
      console.warn('[Chromecast] loadMedia called but context not initialized');
      return;
    }

    const session = castContext.getCurrentSession();
    if (!session) {
      console.warn('[Chromecast] loadMedia called but no active session');
      return;
    }

    try {
      const cast = (window as any).chrome?.cast;
      if (!cast?.media) {
        console.warn('[Chromecast] chrome.cast.media not available');
        return;
      }

      const mediaInfo = new cast.media.MediaInfo(mediaUrl, 'video/mp4');
      mediaInfo.metadata = new cast.media.GenericMediaMetadata();
      mediaInfo.metadata.title = metadata.title;
      
      if (metadata.subtitle) {
        mediaInfo.metadata.subtitle = metadata.subtitle;
      }

      if (metadata.imageUrl) {
        mediaInfo.metadata.images = [new cast.Image(metadata.imageUrl)];
      }

      const request = new cast.media.LoadRequest(mediaInfo);
      
      if (metadata.currentTime) {
        request.currentTime = metadata.currentTime;
      }

      await session.loadMedia(request);
      console.log('[Chromecast] Media loaded to Cast');
    } catch (error) {
      console.error('[Chromecast] Cast load error:', error);
    }
  }, [castContext]);

  return {
    castState,
    isLoading,
    scanForDevices,
    requestSession,
    endSession,
    playOrPause,
    seek,
    loadMedia,
    castContext,
    remotePlayer,
    remotePlayerController,
  };
};
