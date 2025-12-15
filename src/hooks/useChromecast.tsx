import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { waitForCastSdk } from "@/lib/castSdkLoader";

interface CastState {
  isAvailable: boolean;
  isConnected: boolean;
  isScanning: boolean;
  deviceName: string | null;
  mediaInfo: {
    title: string | null;
    isPaused: boolean;
    currentTime: number;
    duration: number;
  } | null;
}

export const useChromecast = () => {
  const [castState, setCastState] = useState<CastState>({
    isAvailable: false,
    isConnected: false,
    isScanning: false,
    deviceName: null,
    mediaInfo: null,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [castContext, setCastContext] = useState<any>(null);
  const [remotePlayer, setRemotePlayer] = useState<any>(null);
  const [remotePlayerController, setRemotePlayerController] = useState<any>(null);

  // Initialize Chromecast
  useEffect(() => {
    console.log('[Chromecast] Starting initialization...');
    console.log('[Chromecast] Protocol:', window.location.protocol);
    console.log('[Chromecast] Hostname:', window.location.hostname);
    
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
          // Don't show toast - just silently disable
        }
        return;
      }

      try {
        const context = castFramework.CastContext.getInstance();
        console.log('[Chromecast] Got CastContext instance');

        context.setOptions({
          receiverApplicationId: castFramework.CastContext.DEFAULT_MEDIA_RECEIVER_APP_ID,
          autoJoinPolicy: castFramework.AutoJoinPolicy.ORIGIN_SCOPED,
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
        console.log('[Chromecast] Cast SDK not available - hiding Chromecast features');
        setIsLoading(false);
        // Don't show any toast - just silently disable the feature
      }
    });

    return () => {
      mounted = false;
    };
  }, []);

  // Scan for available Chromecast devices
  const scanForDevices = useCallback(async () => {
    if (!castContext) {
      toast.error('Chromecast er ikke tilgjengelig i denne nettleseren. Bruk Chrome eller Edge.');
      return;
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
    } catch (error: any) {
      if (error === 'cancel') {
        toast.info('Søk avbrutt');
      } else {
        console.error('[Chromecast] Scan error:', error);
        toast.error('Fant ingen Chromecast-enheter');
      }
    } finally {
      setCastState(prev => ({ ...prev, isScanning: false }));
    }
  }, [castContext]);

  const requestSession = useCallback(async () => {
    if (!castContext) {
      // Silently return if cast not available - this is expected in non-Chrome browsers
      return;
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
    } catch (error: any) {
      if (error !== 'cancel') {
        console.error('[Chromecast] Cast session error:', error);
      }
    }
  }, [castContext]);

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
