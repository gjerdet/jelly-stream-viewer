import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useServerSettings } from "./useServerSettings";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface JellyfinRequest {
  endpoint: string;
  method?: string;
  body?: any;
}

/**
 * Jellyfin API hook using edge function proxy
 * This ensures compatibility with Chrome's Private Network Access restrictions
 */
export const useJellyfinApi = <T,>(
  queryKey: string[],
  request: JellyfinRequest,
  enabled: boolean = true
) => {
  const { serverUrl } = useServerSettings();
  const navigate = useNavigate();

  return useQuery<T>({
    queryKey,
    queryFn: async () => {
      if (!serverUrl) {
        throw new Error("Jellyfin server URL mangler");
      }

      // Skip empty endpoints
      if (!request.endpoint) {
        throw new Error("Endpoint mangler");
      }

      // Use edge function proxy to avoid Chrome CORS/PNA issues
      const { data, error } = await supabase.functions.invoke('jellyfin-proxy', {
        body: {
          endpoint: request.endpoint,
          method: request.method || 'GET',
          body: request.body,
        },
      });

      if (error) {
        console.error('Jellyfin proxy error:', error);
        
        // Check for auth errors (401/403)
        const isAuthError = error.message?.includes('401') || 
                           error.message?.includes('403') ||
                           error.message?.includes('Unauthorized') ||
                           error.message?.includes('non-2xx');
        
        if (isAuthError) {
          // Check if session is still valid
          const { data: sessionData } = await supabase.auth.getSession();
          
          if (!sessionData.session) {
            toast.error('Økten din har utløpt. Vennligst logg inn på nytt.');
            // Clear jellyfin session as well
            localStorage.removeItem('jellyfin_session');
            window.dispatchEvent(new Event('jellyfin-session-change'));
            navigate('/');
            throw new Error('Session expired');
          }
          
          // Try to refresh token
          const { error: refreshError } = await supabase.auth.refreshSession();
          
          if (refreshError) {
            toast.error('Kunne ikke forny økten. Vennligst logg inn på nytt.');
            localStorage.removeItem('jellyfin_session');
            window.dispatchEvent(new Event('jellyfin-session-change'));
            navigate('/');
            throw new Error('Token refresh failed');
          }
          
          // Retry the request once after refresh
          const { data: retryData, error: retryError } = await supabase.functions.invoke('jellyfin-proxy', {
            body: {
              endpoint: request.endpoint,
              method: request.method || 'GET',
              body: request.body,
            },
          });
          
          if (retryError) {
            console.error('Jellyfin proxy retry error:', retryError);
            toast.error('Kunne ikke hente data fra biblioteket. Prøv å logge inn på nytt.');
            throw new Error(`Jellyfin API error: ${retryError.message}`);
          }
          
          return retryData as T;
        }
        
        throw new Error(`Jellyfin API error: ${error.message}`);
      }

      return data as T;
    },
    enabled: enabled && !!serverUrl && !!request.endpoint,
    retry: 1,
    retryDelay: 1000,
  });
};
