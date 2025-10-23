import { useQuery } from "@tanstack/react-query";
import { useServerSettings } from "./useServerSettings";

interface JellyfinRequest {
  endpoint: string;
  method?: string;
  body?: any;
}

/**
 * @deprecated Use useJellyfinDirect instead for local network deployments
 * This hook uses edge function proxy which won't work with local Jellyfin
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
      // Hent AccessToken fra localStorage (satt ved innlogging)
      const jellyfinSession = localStorage.getItem('jellyfin_session');
      const accessToken = jellyfinSession ? JSON.parse(jellyfinSession).AccessToken : null;

      if (!serverUrl || !accessToken) {
        throw new Error("Jellyfin server URL eller access token mangler");
      }

      let normalizedUrl = serverUrl;
      if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
        normalizedUrl = `http://${normalizedUrl}`;
      }

      const url = `${normalizedUrl.replace(/\/$/, '')}${request.endpoint}`;
      const method = request.method || "GET";

      const headers: Record<string, string> = {
        "X-Emby-Token": accessToken,
        "Content-Type": "application/json",
      };

      const options: RequestInit = {
        method,
        headers,
      };

      if (request.body && method !== "GET") {
        options.body = JSON.stringify(request.body);
      }

      const response = await fetch(url, options);

      if (!response.ok) {
        throw new Error(`Jellyfin API error: ${response.status} ${response.statusText}`);
      }

      return response.json() as T;
    },
    enabled: enabled && !!serverUrl,
  });
};
