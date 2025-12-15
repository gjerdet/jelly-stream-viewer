// Global Cast SDK state - handles the case where SDK loads before React mounts

interface CastSdkState {
  isLoaded: boolean;
  isAvailable: boolean;
  loadPromise: Promise<boolean> | null;
  resolvers: ((value: boolean) => void)[];
}

declare global {
  interface Window {
    __castSdkState?: CastSdkState;
    __onGCastApiAvailable?: (isAvailable: boolean) => void;
    // Cast Framework API
    cast?: {
      framework?: any;
    };
    // Legacy / chrome.cast API
    chrome?: {
      cast?: {
        isAvailable?: boolean;
      };
    };
  }
}

// Check if cast is already available (SDK loaded before our code ran)
const checkExistingCast = (): boolean => {
  console.log('[CastSDK] Checking for existing Cast SDK...');
  console.log('[CastSDK] window.chrome exists:', !!window.chrome);
  console.log('[CastSDK] window.chrome.cast exists:', !!window.chrome?.cast);
  console.log('[CastSDK] window.cast exists:', !!(window as any).cast);
  console.log('[CastSDK] window.cast.framework exists:', !!(window as any).cast?.framework);

  const chromeCast = window.chrome?.cast;
  if (chromeCast) {
    console.log('[CastSDK] chrome.cast.isAvailable:', chromeCast.isAvailable);
  }

  const hasFramework = !!(window as any).cast?.framework;
  const isAvailable = !!chromeCast?.isAvailable;

  if (hasFramework || isAvailable) {
    console.log('[CastSDK] Found existing Cast SDK');
    return true;
  }

  return false;
};

// Initialize global state immediately
if (typeof window !== 'undefined') {
  // Check if SDK already loaded before our code
  const alreadyAvailable = checkExistingCast();
  
  if (!window.__castSdkState) {
    window.__castSdkState = {
      isLoaded: alreadyAvailable,
      isAvailable: alreadyAvailable,
      loadPromise: null,
      resolvers: [],
    };
  }

  // Set up the callback - this might be called by SDK or might have already been called
  const existingCallback = window.__onGCastApiAvailable;
  window.__onGCastApiAvailable = (isAvailable: boolean) => {
    console.log('[CastSDK] __onGCastApiAvailable called, isAvailable:', isAvailable);
    if (window.__castSdkState) {
      window.__castSdkState.isLoaded = true;
      window.__castSdkState.isAvailable = isAvailable;
      // Resolve all pending promises
      window.__castSdkState.resolvers.forEach(resolve => resolve(isAvailable));
      window.__castSdkState.resolvers = [];
    }
    existingCallback?.(isAvailable);
  };
  
  // If SDK was already available, trigger the callback manually
  if (alreadyAvailable && !window.__castSdkState.isLoaded) {
    window.__onGCastApiAvailable(true);
  }
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

    // Double-check for existing cast (race condition)
    if (checkExistingCast()) {
      console.log('[CastSDK] Found Cast SDK on second check');
      if (window.__castSdkState) {
        window.__castSdkState.isLoaded = true;
        window.__castSdkState.isAvailable = true;
      }
      resolve(true);
      return;
    }

    // Add resolver to be called when SDK loads
    window.__castSdkState?.resolvers.push(resolve);

    // Timeout after 5 seconds (reduced from 10)
    setTimeout(() => {
      // Final check before giving up
      if (checkExistingCast()) {
        console.log('[CastSDK] Found Cast SDK before timeout');
        if (window.__castSdkState) {
          window.__castSdkState.isLoaded = true;
          window.__castSdkState.isAvailable = true;
        }
        resolve(true);
      } else {
        console.warn('[CastSDK] SDK not available - ensure you are using Chrome/Chromium');
        if (window.__castSdkState) {
          window.__castSdkState.isLoaded = true;
          window.__castSdkState.isAvailable = false;
        }
        resolve(false);
      }
    }, 5000);
  });

  if (window.__castSdkState) {
    window.__castSdkState.loadPromise = promise;
  }

  return promise;
};

export const isCastSdkAvailable = (): boolean => {
  // Always do a fresh check
  if (checkExistingCast()) {
    if (window.__castSdkState) {
      window.__castSdkState.isAvailable = true;
    }
    return true;
  }
  return window.__castSdkState?.isAvailable ?? false;
};

export const isCastSdkLoaded = (): boolean => {
  return window.__castSdkState?.isLoaded ?? false;
};
