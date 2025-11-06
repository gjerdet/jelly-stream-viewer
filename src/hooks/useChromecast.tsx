import { useEffect, useState, useCallback } from "react";

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
    const initializeCast = () => {
      const cast = (window as any).chrome?.cast;
      if (!cast) {
        console.log('Cast SDK not available yet');
        return;
      }

      try {
        const context = cast.framework.CastContext.getInstance();
        setCastContext(context);

        context.setOptions({
          receiverApplicationId: cast.framework.CastContext.DEFAULT_MEDIA_RECEIVER_APP_ID,
          autoJoinPolicy: cast.framework.AutoJoinPolicy.ORIGIN_SCOPED,
        });

        const player = new cast.framework.RemotePlayer();
        const playerController = new cast.framework.RemotePlayerController(player);
        
        setRemotePlayer(player);
        setRemotePlayerController(playerController);

        // Listen for cast state changes
        context.addEventListener(
          cast.framework.CastContextEventType.CAST_STATE_CHANGED,
          (event: any) => {
            const isConnected = event.castState === cast.framework.CastState.CONNECTED;
            const session = context.getCurrentSession();
            
            setCastState(prev => ({
              ...prev,
              isAvailable: true,
              isConnected,
              deviceName: isConnected && session ? session.getCastDevice().friendlyName : null,
            }));
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
        console.log('Chromecast initialized successfully');
      } catch (error) {
        console.error('Cast initialization error:', error);
      }
    };

    // Wait for Cast SDK to load - check multiple times
    const checkInterval = setInterval(() => {
      if ((window as any).chrome?.cast?.framework) {
        clearInterval(checkInterval);
        setIsLoading(false);
        initializeCast();
      }
    }, 100);

    // Cleanup after 10 seconds
    const timeout = setTimeout(() => {
      clearInterval(checkInterval);
      setIsLoading(false);
      console.log('Cast SDK did not load within 10 seconds');
    }, 10000);

    return () => {
      clearInterval(checkInterval);
      clearTimeout(timeout);
    };
  }, []);

  const requestSession = useCallback(() => {
    if (!castContext) return Promise.reject('Cast context not initialized');
    
    return castContext.requestSession().then(
      () => {
        console.log('Cast session started');
      },
      (error: any) => {
        if (error !== 'cancel') {
          console.error('Cast session error:', error);
          throw error;
        }
      }
    );
  }, [castContext]);

  const endSession = useCallback(() => {
    if (!castContext) return;
    const session = castContext.getCurrentSession();
    if (session) {
      session.endSession(true);
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
