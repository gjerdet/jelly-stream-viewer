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
  itemId: string
): Promise<{ success: boolean; results: SubtitleSearchResult[] }> {
  // Hent AccessToken fra localStorage
  const jellyfinSession = localStorage.getItem('jellyfin_session');
  const accessToken = jellyfinSession ? JSON.parse(jellyfinSession).AccessToken : null;

  if (!accessToken) {
    throw new Error('Ikke logget inn');
  }

  let normalizedUrl = serverUrl;
  if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
    normalizedUrl = `http://${normalizedUrl}`;
  }

  const url = `${normalizedUrl.replace(/\/$/, '')}/Items/${itemId}/RemoteSearch/Subtitles`;
  
  const response = await fetch(url, {
    method: "GET",
    headers: {
      "X-Emby-Token": accessToken,
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
  itemId: string,
  subtitleId: string
): Promise<{ success: boolean; message: string }> {
  // Hent AccessToken fra localStorage
  const jellyfinSession = localStorage.getItem('jellyfin_session');
  const accessToken = jellyfinSession ? JSON.parse(jellyfinSession).AccessToken : null;

  if (!accessToken) {
    throw new Error('Ikke logget inn');
  }

  let normalizedUrl = serverUrl;
  if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
    normalizedUrl = `http://${normalizedUrl}`;
  }

  const url = `${normalizedUrl.replace(/\/$/, '')}/Items/${itemId}/RemoteSearch/Subtitles/${subtitleId}`;
  
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "X-Emby-Token": accessToken,
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
