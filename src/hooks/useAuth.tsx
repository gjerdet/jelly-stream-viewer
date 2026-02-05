import { useState, useEffect } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    // Clear local state first
    localStorage.removeItem('jellyfin_session');
    window.dispatchEvent(new Event('jellyfin-session-change'));
    
    // Try to sign out from Supabase, but don't fail if session is already gone
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.log('Sign out completed (session may have already expired)');
    }
    
    // Clear local auth state regardless
    setSession(null);
    setUser(null);
  };

  return { user, session, loading, signOut };
};
