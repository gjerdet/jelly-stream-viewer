import { useQuery } from "@tanstack/react-query";
import { useServerSettings } from "./useServerSettings";
import * as jellyfinClient from "@/lib/jellyfinClient";

interface JellyfinRequest {
  endpoint: string;
  method?: string;
  body?: any;
}

/**
 * Direct connection to Jellyfin server - uses centralized jellyfinClient
 */
export const useJellyfinDirect = <T,>(
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

      // Get auth token from localStorage
      const jellyfinSession = localStorage.getItem('jellyfin_session');
      const accessToken = jellyfinSession ? JSON.parse(jellyfinSession).AccessToken : null;
      
      if (!accessToken) {
        throw new Error("Ikke logget inn");
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
