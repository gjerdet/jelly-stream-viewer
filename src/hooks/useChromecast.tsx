import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { waitForCastSdk } from "@/lib/castSdkLoader";

interface CastState {
  isAvailable: boolean;
  isConnected: boolean;
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
      const cast = (window as any).chrome?.cast;
      console.log('[Chromecast] chrome.cast available:', !!cast);
      console.log('[Chromecast] cast.framework available:', !!(cast?.framework));
      
      if (!cast?.framework) {
        console.error('[Chromecast] Cast framework not available');
        if (mounted) {
          toast.error('Chromecast ikke tilgjengelig - krever Chrome browser med Cast-støtte');
          setIsLoading(false);
        }
        return;
      }

      try {
        const context = cast.framework.CastContext.getInstance();
        console.log('[Chromecast] Got CastContext instance');

        context.setOptions({
          receiverApplicationId: cast.framework.CastContext.DEFAULT_MEDIA_RECEIVER_APP_ID,
          autoJoinPolicy: cast.framework.AutoJoinPolicy.ORIGIN_SCOPED,
        });
        console.log('[Chromecast] Options set');

        const player = new cast.framework.RemotePlayer();
        const playerController = new cast.framework.RemotePlayerController(player);
        console.log('[Chromecast] RemotePlayer and controller created');

        if (!mounted) return;

        setCastContext(context);
        setRemotePlayer(player);
        setRemotePlayerController(playerController);

        // Listen for cast state changes
        context.addEventListener(
          cast.framework.CastContextEventType.CAST_STATE_CHANGED,
          (event: any) => {
            console.log('[Chromecast] Cast state changed:', event.castState);
            const isConnected = event.castState === cast.framework.CastState.CONNECTED;
            const session = context.getCurrentSession();
            
            if (isConnected && session) {
              const deviceName = session.getCastDevice().friendlyName;
              localStorage.setItem('last_cast_device', deviceName);
              console.log('[Chromecast] Connected to:', deviceName);
              
              setCastState(prev => ({
                ...prev,
                isAvailable: true,
                isConnected,
                deviceName,
              }));
            } else {
              setCastState(prev => ({
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
          cast.framework.RemotePlayerEventType.ANY_CHANGE,
          () => {
            if (player.isConnected && player.isMediaLoaded) {
              setCastState(prev => ({
                ...prev,
                mediaInfo: {
                  title: player.title || null,
                  isPaused: player.isPaused,
                  currentTime: player.currentTime,
                  duration: player.duration,
                },
              }));
            } else {
              setCastState(prev => ({
                ...prev,
                mediaInfo: null,
              }));
            }
          }
        );

        setCastState(prev => ({ ...prev, isAvailable: true }));
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
        console.warn('[Chromecast] Cast SDK not available');
        toast.error('Chromecast ikke tilgjengelig - bruker du Chrome?');
        setIsLoading(false);
      }
    });

    return () => {
      mounted = false;
    };
  }, []);

  const requestSession = useCallback(async () => {
    if (!castContext) {
      console.warn('[Chromecast] requestSession called but context not initialized');
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

  const loadMedia = useCallback((mediaUrl: string, metadata: {
    title: string;
    subtitle?: string;
    imageUrl?: string;
    currentTime?: number;
  }) => {
    if (!castContext) return Promise.reject('Cast context not initialized');

    const session = castContext.getCurrentSession();
    if (!session) return Promise.reject('No active cast session');

    const cast = (window as any).chrome.cast;
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

    return session.loadMedia(request).then(
      () => console.log('Media loaded to Cast'),
      (error: any) => {
        console.error('Cast load error:', error);
        throw error;
      }
    );
  }, [castContext]);

  return {
    castState,
    isLoading,
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
