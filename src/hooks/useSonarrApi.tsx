import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface SonarrSeason {
  seasonNumber: number;
  monitored: boolean;
  statistics?: {
    episodeFileCount: number;
    episodeCount: number;
    totalEpisodeCount: number;
    sizeOnDisk: number;
    percentOfEpisodes: number;
  };
}

export interface SonarrSeries {
  id: number;
  title: string;
  year: number;
  monitored: boolean;
  seasonCount: number;
  episodeCount: number;
  episodeFileCount: number;
  sizeOnDisk: number;
  status: string;
  seasons?: SonarrSeason[];
  images: Array<{
    coverType: string;
    remoteUrl: string;
  }>;
}

export interface SonarrHistoryRecord {
  id: number;
  seriesId: number;
  episodeId: number;
  sourceTitle: string;
  quality: {
    quality: {
      name: string;
    };
  };
  date: string;
  eventType: string;
  series?: SonarrSeries;
  episode?: {
    title: string;
    seasonNumber: number;
    episodeNumber: number;
  };
}

export interface SonarrQueueItem {
  id: number;
  seriesId: number;
  episodeId: number;
  title: string;
  status: string;
  sizeleft: number;
  size: number;
  timeleft?: string;
  series?: SonarrSeries;
  episode?: {
    title: string;
    seasonNumber: number;
    episodeNumber: number;
  };
}

export interface SonarrCalendarItem {
  id: number;
  seriesId: number;
  title: string;
  seasonNumber: number;
  episodeNumber: number;
  airDateUtc: string;
  hasFile: boolean;
  series?: SonarrSeries;
}

export const useSonarrApi = () => {
  const sonarrRequest = useCallback(async <T = unknown>(
    action: string,
    params: Record<string, unknown> = {}
  ): Promise<{ data: T | null; error: Error | null }> => {
    try {
      console.log(`Sonarr proxy request: ${action}`, params);
      
      const { data, error } = await supabase.functions.invoke('sonarr-proxy', {
        body: { action, params }
      });
      
      if (error) {
        console.error('Sonarr proxy error:', error);
        return { data: null, error };
      }

      if (data?.error) {
        return { data: null, error: new Error(data.error) };
      }

      return { data: data as T, error: null };
    } catch (err) {
      console.error('Sonarr request failed:', err);
      return { data: null, error: err instanceof Error ? err : new Error('Unknown error') };
    }
  }, []);

  const getHealth = useCallback(() => sonarrRequest('health'), [sonarrRequest]);
  
  const getSeries = useCallback(() => sonarrRequest<SonarrSeries[]>('series'), [sonarrRequest]);
  
  const getSerie = useCallback((seriesId: number) => 
    sonarrRequest<SonarrSeries>('serie', { seriesId }), [sonarrRequest]);
  
  const getHistory = useCallback((page = 1, pageSize = 50, eventType?: string) => 
    sonarrRequest<{ records: SonarrHistoryRecord[]; totalRecords: number }>('history', { page, pageSize, eventType }), [sonarrRequest]);
  
  const getQueue = useCallback(() => 
    sonarrRequest<{ records: SonarrQueueItem[] }>('queue'), [sonarrRequest]);
  
  const toggleMonitored = useCallback((seriesId: number, monitored?: boolean) => 
    sonarrRequest<SonarrSeries>('toggleMonitored', { seriesId, monitored }), [sonarrRequest]);
  
  const toggleSeasonMonitored = useCallback((seriesId: number, seasonNumber: number, monitored: boolean) => 
    sonarrRequest<SonarrSeries>('toggleSeasonMonitored', { seriesId, seasonNumber, monitored }), [sonarrRequest]);
  
  const toggleAllSeasonsMonitored = useCallback((seriesId: number, monitored: boolean) => 
    sonarrRequest<SonarrSeries>('toggleAllSeasonsMonitored', { seriesId, monitored }), [sonarrRequest]);
  
  const getQualityProfiles = useCallback(() => 
    sonarrRequest<Array<{ id: number; name: string }>>('qualityProfiles'), [sonarrRequest]);

  const getCalendar = useCallback((start?: string, end?: string) => 
    sonarrRequest<SonarrCalendarItem[]>('calendar', { start, end }), [sonarrRequest]);

  return {
    sonarrRequest,
    getHealth,
    getSeries,
    getSerie,
    getHistory,
    getQueue,
    toggleMonitored,
    toggleSeasonMonitored,
    toggleAllSeasonsMonitored,
    getQualityProfiles,
    getCalendar,
  };
};
