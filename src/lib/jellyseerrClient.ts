/**
 * Jellyseerr API Client
 * Centralized client for all Jellyseerr API interactions
 */

export interface JellyseerrMedia {
  id: number;
  mediaType: 'movie' | 'tv';
  title: string;
  originalTitle?: string;
  overview?: string;
  posterPath?: string;
  backdropPath?: string;
  releaseDate?: string;
  voteAverage?: number;
  popularity?: number;
  genres?: Array<{ id: number; name: string }>;
  status?: string;
}

export interface JellyseerrSeason {
  id: number;
  seasonNumber: number;
  name: string;
  overview?: string;
  posterPath?: string;
  airDate?: string;
  episodeCount?: number;
}

export interface JellyseerrRequest {
  id: string;
  media_type: string;
  media_id: number;
  media_title: string;
  media_poster?: string | null;
  media_overview?: string | null;
  seasons?: any;
  status: string;
  created_at: string;
  approved_at?: string | null;
  approved_by?: string | null;
  rejection_reason?: string | null;
  user_id: string;
}

/**
 * Get Jellyseerr base URL and API key from server settings
 */
async function getJellyseerrConfig(): Promise<{ url: string; apiKey: string } | null> {
  try {
    const { supabase } = await import('@/integrations/supabase/client');
    const { data: urlData } = await supabase
      .from('server_settings')
      .select('setting_value')
      .eq('setting_key', 'jellyseerr_url')
      .single();

    const { data: apiKeyData } = await supabase
      .from('server_settings')
      .select('setting_value')
      .eq('setting_key', 'jellyseerr_api_key')
      .single();

    if (!urlData?.setting_value || !apiKeyData?.setting_value) {
      return null;
    }

    return {
      url: urlData.setting_value,
      apiKey: apiKeyData.setting_value,
    };
  } catch (error) {
    console.error('Failed to get Jellyseerr config:', error);
    return null;
  }
}

/**
 * Generic Jellyseerr API request handler
 */
async function jellyseerrRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const config = await getJellyseerrConfig();
  if (!config) {
    throw new Error('Jellyseerr er ikke konfigurert');
  }

  const url = `${config.url.replace(/\/$/, '')}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      'X-Api-Key': config.apiKey,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`Jellyseerr API error: ${response.status} ${response.statusText}`);
  }

  return response.json() as T;
}

/**
 * Search for media in Jellyseerr
 */
export async function searchMedia(query: string): Promise<JellyseerrMedia[]> {
  const data = await jellyseerrRequest<{ results: JellyseerrMedia[] }>(
    `/api/v1/search?query=${encodeURIComponent(query)}`
  );
  return data.results || [];
}

/**
 * Get popular movies
 */
export async function getPopularMovies(page: number = 1): Promise<JellyseerrMedia[]> {
  const data = await jellyseerrRequest<{ results: JellyseerrMedia[] }>(
    `/api/v1/movie/popular?page=${page}`
  );
  return data.results || [];
}

/**
 * Get popular TV shows
 */
export async function getPopularTvShows(page: number = 1): Promise<JellyseerrMedia[]> {
  const data = await jellyseerrRequest<{ results: JellyseerrMedia[] }>(
    `/api/v1/tv/popular?page=${page}`
  );
  return data.results || [];
}

/**
 * Get movie details
 */
export async function getMovieDetails(movieId: number): Promise<JellyseerrMedia> {
  return jellyseerrRequest(`/api/v1/movie/${movieId}`);
}

/**
 * Get TV show details
 */
export async function getTvDetails(tvId: number): Promise<JellyseerrMedia> {
  return jellyseerrRequest(`/api/v1/tv/${tvId}`);
}

/**
 * Get TV show season details
 */
export async function getSeasonDetails(
  tvId: number,
  seasonNumber: number
): Promise<JellyseerrSeason> {
  return jellyseerrRequest(`/api/v1/tv/${tvId}/season/${seasonNumber}`);
}

/**
 * Request media through Jellyseerr
 * Note: This stores the request in our database for admin approval
 * rather than directly submitting to Jellyseerr
 */
export async function requestMedia(params: {
  mediaType: 'movie' | 'tv';
  mediaId: number;
  mediaTitle: string;
  mediaPoster?: string;
  mediaOverview?: string;
  seasons?: any;
}): Promise<JellyseerrRequest> {
  const { supabase } = await import('@/integrations/supabase/client');
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    throw new Error('Du må være logget inn');
  }

  const { data, error } = await supabase
    .from('jellyseerr_requests')
    .insert({
      user_id: user.id,
      media_type: params.mediaType,
      media_id: params.mediaId,
      media_title: params.mediaTitle,
      media_poster: params.mediaPoster,
      media_overview: params.mediaOverview,
      seasons: params.seasons ? JSON.stringify(params.seasons) : null,
      status: 'pending',
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Get user's requests
 */
export async function getUserRequests(): Promise<JellyseerrRequest[]> {
  const { supabase } = await import('@/integrations/supabase/client');
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    throw new Error('Du må være logget inn');
  }

  const { data, error } = await supabase
    .from('jellyseerr_requests')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

/**
 * Get all requests (admin only)
 */
export async function getAllRequests(): Promise<JellyseerrRequest[]> {
  const { supabase } = await import('@/integrations/supabase/client');
  
  const { data, error } = await supabase
    .from('jellyseerr_requests')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}
