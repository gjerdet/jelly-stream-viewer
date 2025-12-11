import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface RadarrMovie {
  id: number;
  title: string;
  year: number;
  monitored: boolean;
  hasFile: boolean;
  sizeOnDisk: number;
  movieFile?: {
    quality: {
      quality: {
        name: string;
      };
    };
    size: number;
    dateAdded: string;
  };
  images: Array<{
    coverType: string;
    remoteUrl: string;
  }>;
}

export interface RadarrHistoryRecord {
  id: number;
  movieId: number;
  sourceTitle: string;
  quality: {
    quality: {
      name: string;
    };
  };
  date: string;
  eventType: string;
  movie?: RadarrMovie;
}

export interface RadarrQueueItem {
  id: number;
  movieId: number;
  title: string;
  status: string;
  sizeleft: number;
  size: number;
  timeleft?: string;
  movie?: RadarrMovie;
}

export const useRadarrApi = () => {
  const radarrRequest = useCallback(async <T = unknown>(
    action: string,
    params: Record<string, unknown> = {}
  ): Promise<{ data: T | null; error: Error | null }> => {
    try {
      console.log(`Radarr proxy request: ${action}`, params);
      
      const { data, error } = await supabase.functions.invoke('radarr-proxy', {
        body: { action, params }
      });
      
      if (error) {
        console.error('Radarr proxy error:', error);
        return { data: null, error };
      }

      if (data?.error) {
        return { data: null, error: new Error(data.error) };
      }

      return { data: data as T, error: null };
    } catch (err) {
      console.error('Radarr request failed:', err);
      return { data: null, error: err instanceof Error ? err : new Error('Unknown error') };
    }
  }, []);

  const getHealth = useCallback(() => radarrRequest('health'), [radarrRequest]);
  
  const getMovies = useCallback(() => radarrRequest<RadarrMovie[]>('movies'), [radarrRequest]);
  
  const getMovie = useCallback((movieId: number) => 
    radarrRequest<RadarrMovie>('movie', { movieId }), [radarrRequest]);
  
  const getHistory = useCallback((page = 1, pageSize = 50, eventType?: string) => 
    radarrRequest<{ records: RadarrHistoryRecord[]; totalRecords: number }>('history', { page, pageSize, eventType }), [radarrRequest]);
  
  const getQueue = useCallback(() => 
    radarrRequest<{ records: RadarrQueueItem[] }>('queue'), [radarrRequest]);
  
  const toggleMonitored = useCallback((movieId: number, monitored?: boolean) => 
    radarrRequest<RadarrMovie>('toggleMonitored', { movieId, monitored }), [radarrRequest]);
  
  const getQualityProfiles = useCallback(() => 
    radarrRequest<Array<{ id: number; name: string }>>('qualityProfiles'), [radarrRequest]);

  return {
    radarrRequest,
    getHealth,
    getMovies,
    getMovie,
    getHistory,
    getQueue,
    toggleMonitored,
    getQualityProfiles,
  };
};
