import { useQuery } from "@tanstack/react-query";
import { useServerSettings } from "./useServerSettings";

interface JellyfinRequest {
  endpoint: string;
  method?: string;
  body?: any;
}

/**
 * Direct connection to Jellyfin server - for local network deployments
 * No proxy, no edge functions, just straight HTTP to Jellyfin
 */
export const useJellyfinDirect = <T,>(
  queryKey: string[],
  request: JellyfinRequest,
  enabled: boolean = true
) => {
  const { serverUrl, apiKey } = useServerSettings();

  return useQuery<T>({
    queryKey,
    queryFn: async () => {
      if (!serverUrl || !apiKey) {
        throw new Error("Jellyfin server URL or API key not configured");
      }

      const url = `${serverUrl.replace(/\/$/, '')}${request.endpoint}`;
      const method = request.method || "GET";

      const headers: Record<string, string> = {
        "X-Emby-Token": apiKey,
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
    enabled: enabled && !!serverUrl && !!apiKey,
  });
};
