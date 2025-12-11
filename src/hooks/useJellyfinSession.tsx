import { useState, useEffect, useMemo } from "react";

interface JellyfinSession {
  AccessToken: string;
  UserId: string;
  Username: string;
  ServerId: string;
}

// Read session synchronously for initial value
const getInitialSession = (): JellyfinSession | null => {
  if (typeof window === 'undefined') return null;
  const stored = localStorage.getItem('jellyfin_session');
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      return null;
    }
  }
  return null;
};

export const useJellyfinSession = () => {
  const [session, setSession] = useState<JellyfinSession | null>(getInitialSession);

  useEffect(() => {
    // Listen for storage changes (logout, login from other tabs, etc.)
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'jellyfin_session') {
        setSession(getInitialSession());
      }
    };

    // Also listen for custom events when session changes in same tab
    const handleSessionChange = () => {
      setSession(getInitialSession());
    };

    window.addEventListener('storage', handleStorage);
    window.addEventListener('jellyfin-session-change', handleSessionChange);
    
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('jellyfin-session-change', handleSessionChange);
    };
  }, []);

  return useMemo(() => ({
    session,
    userId: session?.UserId ?? null,
    accessToken: session?.AccessToken ?? null,
    username: session?.Username ?? null,
  }), [session]);
};
