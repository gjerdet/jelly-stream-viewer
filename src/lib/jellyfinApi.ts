/**
 * Direct Jellyfin API helpers - for local network deployments
 * These functions talk directly to Jellyfin server without edge function proxy
 */

export interface SubtitleSearchResult {
  Id: string;
  ProviderName: string;
  Name: string;
  Format?: string;
  Language?: string;
  IsHashMatch?: boolean;
  Author?: string;
  Comment?: string;
  DownloadCount?: number;
}

/**
 * Search for subtitles for a specific item
 */
export async function searchSubtitles(
  serverUrl: string,
  apiKey: string,
  itemId: string
): Promise<{ success: boolean; results: SubtitleSearchResult[] }> {
  const url = `${serverUrl.replace(/\/$/, '')}/Items/${itemId}/RemoteSearch/Subtitles`;
  
  const response = await fetch(url, {
    method: "GET",
    headers: {
      "X-Emby-Token": apiKey,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to search subtitles: ${response.status} ${response.statusText}`);
  }

  const results = await response.json();
  return {
    success: true,
    results: results || [],
  };
}

/**
 * Download a subtitle for a specific item
 */
export async function downloadSubtitle(
  serverUrl: string,
  apiKey: string,
  itemId: string,
  subtitleId: string
): Promise<{ success: boolean; message: string }> {
  const url = `${serverUrl.replace(/\/$/, '')}/Items/${itemId}/RemoteSearch/Subtitles/${subtitleId}`;
  
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "X-Emby-Token": apiKey,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to download subtitle: ${response.status} ${response.statusText}`);
  }

  return {
    success: true,
    message: "Undertekst lastet ned",
  };
}
