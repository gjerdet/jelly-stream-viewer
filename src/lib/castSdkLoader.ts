// Global Cast SDK state - handles the case where SDK loads before React mounts

interface CastSdkState {
  isLoaded: boolean;
  isAvailable: boolean;
  loadPromise: Promise<boolean> | null;
}

declare global {
  interface Window {
    __castSdkState?: CastSdkState;
    __onGCastApiAvailable?: (isAvailable: boolean) => void;
  }
}

// Initialize global state
if (typeof window !== 'undefined' && !window.__castSdkState) {
  window.__castSdkState = {
    isLoaded: false,
    isAvailable: false,
    loadPromise: null,
  };

  // Set up the callback immediately
  window.__onGCastApiAvailable = (isAvailable: boolean) => {
    console.log('[CastSDK] __onGCastApiAvailable called, isAvailable:', isAvailable);
    if (window.__castSdkState) {
      window.__castSdkState.isLoaded = true;
      window.__castSdkState.isAvailable = isAvailable;
    }
  };
}

export const waitForCastSdk = (): Promise<boolean> => {
  // Return existing promise if already waiting
  if (window.__castSdkState?.loadPromise) {
    return window.__castSdkState.loadPromise;
  }

  const promise = new Promise<boolean>((resolve) => {
    // Check if already loaded
    if (window.__castSdkState?.isLoaded) {
      console.log('[CastSDK] SDK already loaded, available:', window.__castSdkState.isAvailable);
      resolve(window.__castSdkState.isAvailable);
      return;
    }

    // Check if chrome.cast is already available (SDK loaded but callback missed)
    const existingCast = (window as any).chrome?.cast;
    if (existingCast?.framework) {
      console.log('[CastSDK] SDK found (framework available)');
      if (window.__castSdkState) {
        window.__castSdkState.isLoaded = true;
        window.__castSdkState.isAvailable = true;
      }
      resolve(true);
      return;
    }

    // Override the callback to resolve the promise
    const originalCallback = window.__onGCastApiAvailable;
    window.__onGCastApiAvailable = (isAvailable: boolean) => {
      console.log('[CastSDK] Callback received, isAvailable:', isAvailable);
      if (window.__castSdkState) {
        window.__castSdkState.isLoaded = true;
        window.__castSdkState.isAvailable = isAvailable;
      }
      originalCallback?.(isAvailable);
      resolve(isAvailable);
    };

    // Timeout after 10 seconds
    setTimeout(() => {
      const cast = (window as any).chrome?.cast;
      if (cast?.framework) {
        console.log('[CastSDK] SDK found after timeout');
        if (window.__castSdkState) {
          window.__castSdkState.isLoaded = true;
          window.__castSdkState.isAvailable = true;
        }
        resolve(true);
      } else {
        console.warn('[CastSDK] SDK not available after timeout');
        if (window.__castSdkState) {
          window.__castSdkState.isLoaded = true;
          window.__castSdkState.isAvailable = false;
        }
        resolve(false);
      }
    }, 10000);
  });

  if (window.__castSdkState) {
    window.__castSdkState.loadPromise = promise;
  }

  return promise;
};

export const isCastSdkAvailable = (): boolean => {
  return window.__castSdkState?.isAvailable ?? false;
};

export const isCastSdkLoaded = (): boolean => {
  return window.__castSdkState?.isLoaded ?? false;
};
