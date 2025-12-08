import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

interface BazarrSettings {
  url: string | null;
  apiKey: string | null;
}

export const useBazarrApi = () => {
  const [settings, setSettings] = useState<BazarrSettings | null>(null);
  
  // Fetch Bazarr settings from database
  const fetchSettings = useCallback(async (): Promise<BazarrSettings> => {
    if (settings?.url && settings?.apiKey) {
      return settings;
    }
    
    const { data, error } = await supabase
      .from('server_settings')
      .select('setting_key, setting_value')
      .in('setting_key', ['bazarr_url', 'bazarr_api_key']);
    
    if (error) {
      console.error('Failed to fetch Bazarr settings:', error);
      return { url: null, apiKey: null };
    }
    
    const url = data?.find(s => s.setting_key === 'bazarr_url')?.setting_value || null;
    const apiKey = data?.find(s => s.setting_key === 'bazarr_api_key')?.setting_value || null;
    
    const newSettings = { url, apiKey };
    setSettings(newSettings);
    return newSettings;
  }, [settings]);

  // Clear cached settings (useful when settings are updated)
  const clearSettings = useCallback(() => {
    setSettings(null);
  }, []);

  // Make a direct API call to Bazarr
  const bazarrRequest = useCallback(async (
    action: string,
    params: Record<string, unknown> = {}
  ): Promise<{ data: unknown; error: Error | null }> => {
    try {
      const { url: bazarrUrl, apiKey: bazarrApiKey } = await fetchSettings();
      
      if (!bazarrUrl || !bazarrApiKey) {
        return { 
          data: null, 
          error: new Error('Bazarr ikke konfigurert. Gå til Admin → Servere for å sette opp.') 
        };
      }

      const baseUrl = bazarrUrl.replace(/\/$/, '');
      let endpoint = '';
      let method = 'GET';
      let body: string | undefined;

      switch (action) {
        case 'status':
          endpoint = '/api/system/status';
          break;
        case 'movies-wanted':
          endpoint = '/api/movies/wanted';
          break;
        case 'episodes-wanted':
          endpoint = '/api/episodes/wanted';
          break;
        case 'movies-history':
          endpoint = '/api/history/movies';
          break;
        case 'episodes-history':
          endpoint = '/api/history/series';
          break;
        case 'movie':
          endpoint = `/api/movies?radarrid=${params.radarrId}`;
          break;
        case 'series':
          endpoint = `/api/series?seriesid=${params.sonarrId}`;
          break;
        case 'episodes':
          endpoint = `/api/episodes?seriesid=${params.sonarrId}`;
          break;
        case 'search-movie':
          endpoint = '/api/movies/subtitles';
          method = 'PATCH';
          body = JSON.stringify({
            radarrid: params.radarrId,
            profileid: params.profileId
          });
          break;
        case 'search-episode':
          endpoint = '/api/episodes/subtitles';
          method = 'PATCH';
          body = JSON.stringify({
            seriesid: params.sonarrId,
            episodeid: params.episodeId,
            profileid: params.profileId
          });
          break;
        case 'download-movie-subtitle':
          endpoint = '/api/movies/subtitles';
          method = 'POST';
          body = JSON.stringify({
            radarrid: params.radarrId,
            language: params.language,
            hi: params.hi || false,
            forced: params.forced || false,
            provider: params.provider,
            subtitle: params.subtitle
          });
          break;
        case 'download-episode-subtitle':
          endpoint = '/api/episodes/subtitles';
          method = 'POST';
          body = JSON.stringify({
            seriesid: params.sonarrId,
            episodeid: params.episodeId,
            language: params.language,
            hi: params.hi || false,
            forced: params.forced || false,
            provider: params.provider,
            subtitle: params.subtitle
          });
          break;
        case 'delete-movie-subtitle':
          endpoint = '/api/movies/subtitles';
          method = 'DELETE';
          body = JSON.stringify({
            radarrid: params.radarrId,
            language: params.language,
            forced: params.forced || false,
            hi: params.hi || false,
            path: params.path
          });
          break;
        case 'delete-episode-subtitle':
          endpoint = '/api/episodes/subtitles';
          method = 'DELETE';
          body = JSON.stringify({
            seriesid: params.sonarrId,
            episodeid: params.episodeId,
            language: params.language,
            forced: params.forced || false,
            hi: params.hi || false,
            path: params.path
          });
          break;
        case 'manual-search-movie':
          endpoint = `/api/providers/movies?radarrid=${params.radarrId}`;
          break;
        case 'manual-search-episode':
          endpoint = `/api/providers/episodes?episodeid=${params.episodeId}`;
          break;
        case 'providers':
          endpoint = '/api/providers';
          break;
        case 'languages':
          endpoint = '/api/system/languages';
          break;
        default:
          return { data: null, error: new Error(`Unknown action: ${action}`) };
      }

      const url = `${baseUrl}${endpoint}`;
      console.log(`Bazarr direct request: ${method} ${url}`);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const response = await fetch(url, {
        method,
        headers: {
          'X-API-KEY': bazarrApiKey,
          'Content-Type': 'application/json',
        },
        body,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Bazarr error: ${response.status} - ${errorText}`);
        return { 
          data: null, 
          error: new Error(`Bazarr error: ${response.status}`) 
        };
      }

      const data = await response.json();
      return { data, error: null };
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return { data: null, error: new Error('Timeout: Bazarr svarer ikke') };
      }
      console.error('Bazarr request failed:', err);
      return { data: null, error: err instanceof Error ? err : new Error('Unknown error') };
    }
  }, [fetchSettings]);

  return {
    bazarrRequest,
    clearSettings,
    fetchSettings
  };
};
