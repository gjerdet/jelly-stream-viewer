/**
 * Jellyfin API Client
 * Centralized client for all Jellyfin API interactions
 * Supports both direct connection (local network) and edge function proxy
 */

export interface JellyfinAuthResponse {
  AccessToken: string;
  ServerId: string;
  User: {
    Id: string;
    Name: string;
  };
}

export interface JellyfinItem {
  Id: string;
  Name: string;
  Type: string;
  UserData?: {
    PlaybackPositionTicks?: number;
    PlayedPercentage?: number;
    IsFavorite?: boolean;
    Played?: boolean;
  };
  [key: string]: any;
}

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
 * Get authentication token from localStorage
 */
function getAuthToken(): string | null {
  const jellyfinSession = localStorage.getItem('jellyfin_session');
  return jellyfinSession ? JSON.parse(jellyfinSession).AccessToken : null;
}

/**
 * Normalize server URL (ensure http:// or https:// prefix)
 */
function normalizeServerUrl(serverUrl: string): string {
  if (!serverUrl.startsWith('http://') && !serverUrl.startsWith('https://')) {
    return `http://${serverUrl}`;
  }
  return serverUrl.replace(/\/$/, '');
}

/**
 * Generic Jellyfin API request handler
 */
async function jellyfinRequest<T>(
  serverUrl: string,
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const accessToken = getAuthToken();
  if (!accessToken) {
    throw new Error('Ikke logget inn');
  }

  const normalizedUrl = normalizeServerUrl(serverUrl);
  const url = `${normalizedUrl}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      'X-Emby-Token': accessToken,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`Jellyfin API error: ${response.status} ${response.statusText}`);
  }

  return response.json() as T;
}

/**
 * Authenticate user with Jellyfin server
 */
export async function authenticateJellyfin(
  serverUrl: string,
  username: string,
  password: string
): Promise<JellyfinAuthResponse> {
  const normalizedUrl = normalizeServerUrl(serverUrl);
  const url = `${normalizedUrl}/Users/AuthenticateByName`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Emby-Authorization': `MediaBrowser Client="Jelly Stream Viewer", Device="Web", DeviceId="web-client", Version="1.0.0"`,
    },
    body: JSON.stringify({
      Username: username,
      Pw: password,
    }),
  });

  if (!response.ok) {
    throw new Error('Autentisering feilet. Sjekk brukernavn og passord.');
  }

  return response.json();
}

/**
 * Get items from Jellyfin (movies, series, etc.)
 */
export async function getItems(
  serverUrl: string,
  params: Record<string, any> = {}
): Promise<{ Items: JellyfinItem[]; TotalRecordCount: number }> {
  const queryParams = new URLSearchParams(params as any).toString();
  return jellyfinRequest(serverUrl, `/Items?${queryParams}`);
}

/**
 * Get a single item by ID
 */
export async function getItemById(
  serverUrl: string,
  itemId: string
): Promise<JellyfinItem> {
  return jellyfinRequest(serverUrl, `/Users/{userId}/Items/${itemId}`);
}

/**
 * Search for subtitles for a specific item
 */
export async function searchSubtitles(
  serverUrl: string,
  itemId: string
): Promise<SubtitleSearchResult[]> {
  const results = await jellyfinRequest<SubtitleSearchResult[]>(
    serverUrl,
    `/Items/${itemId}/RemoteSearch/Subtitles`
  );
  return results || [];
}

/**
 * Download a subtitle for a specific item
 */
export async function downloadSubtitle(
  serverUrl: string,
  itemId: string,
  subtitleId: string
): Promise<{ success: boolean; message: string }> {
  await jellyfinRequest(
    serverUrl,
    `/Items/${itemId}/RemoteSearch/Subtitles/${subtitleId}`,
    { method: 'POST' }
  );

  return {
    success: true,
    message: 'Undertekst lastet ned',
  };
}

/**
 * Mark item as favorite
 */
export async function markAsFavorite(
  serverUrl: string,
  itemId: string,
  isFavorite: boolean
): Promise<void> {
  const endpoint = isFavorite
    ? `/Users/{userId}/FavoriteItems/${itemId}`
    : `/Users/{userId}/FavoriteItems/${itemId}/Delete`;

  await jellyfinRequest(serverUrl, endpoint, {
    method: 'POST',
  });
}

/**
 * Report playback started - tells Jellyfin a session has started playing
 */
export async function reportPlaybackStarted(
  serverUrl: string,
  itemId: string,
  audioStreamIndex?: number,
  subtitleStreamIndex?: number
): Promise<void> {
  await jellyfinRequest(
    serverUrl,
    `/Sessions/Playing`,
    {
      method: 'POST',
      body: JSON.stringify({
        ItemId: itemId,
        AudioStreamIndex: audioStreamIndex,
        SubtitleStreamIndex: subtitleStreamIndex,
        CanSeek: true,
        PlayMethod: 'DirectStream',
      }),
    }
  );
}

/**
 * Update playback progress
 */
export async function updatePlaybackProgress(
  serverUrl: string,
  itemId: string,
  positionTicks: number,
  isPaused: boolean
): Promise<void> {
  await jellyfinRequest(
    serverUrl,
    `/Sessions/Playing/Progress`,
    {
      method: 'POST',
      body: JSON.stringify({
        ItemId: itemId,
        PositionTicks: positionTicks,
        IsPaused: isPaused,
      }),
    }
  );
}

/**
 * Report playback stopped - tells Jellyfin a session has ended
 */
export async function reportPlaybackStopped(
  serverUrl: string,
  itemId: string,
  positionTicks: number
): Promise<void> {
  await jellyfinRequest(
    serverUrl,
    `/Sessions/Playing/Stopped`,
    {
      method: 'POST',
      body: JSON.stringify({
        ItemId: itemId,
        PositionTicks: positionTicks,
      }),
    }
  );
}

/**
 * Get user's viewing history
 */
export async function getPlaybackHistory(
  serverUrl: string,
  limit: number = 20
): Promise<JellyfinItem[]> {
  const data = await jellyfinRequest<{ Items: JellyfinItem[] }>(
    serverUrl,
    `/Users/{userId}/Items/Latest?Limit=${limit}`
  );
  return data.Items || [];
}
