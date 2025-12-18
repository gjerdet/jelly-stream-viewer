import { useQuery } from "@tanstack/react-query";
import { useServerSettings } from "./useServerSettings";
import { supabase } from "@/integrations/supabase/client";

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
        throw new Error(`Jellyfin API error: ${error.message}`);
      }

      return data as T;
    },
    enabled: enabled && !!serverUrl && !!request.endpoint,
  });
};
