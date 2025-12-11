import { useState, useEffect } from "react";

interface JellyfinSession {
  AccessToken: string;
  UserId: string;
  Username: string;
  ServerId: string;
}

export const useJellyfinSession = () => {
  const [session, setSession] = useState<JellyfinSession | null>(null);

  useEffect(() => {
    const loadSession = () => {
      const stored = localStorage.getItem('jellyfin_session');
      if (stored) {
        try {
          setSession(JSON.parse(stored));
        } catch {
          setSession(null);
        }
      } else {
        setSession(null);
      }
    };

    loadSession();

    // Listen for storage changes (logout, etc.)
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'jellyfin_session') {
        loadSession();
      }
    };

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  return {
    session,
    userId: session?.UserId ?? null,
    accessToken: session?.AccessToken ?? null,
    username: session?.Username ?? null,
  };
};
