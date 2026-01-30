import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import type { RemoteSubtitle } from "@/types/jellyfin";

interface UseSubtitleManagerOptions {
  itemId?: string;
  onDownloadSuccess?: () => void;
}

interface SubtitleManager {
  // State
  remoteSubtitles: RemoteSubtitle[];
  searchingSubtitles: boolean;
  downloadingSubtitle: string | null;
  
  // Actions
  searchSubtitles: (language?: string, targetItemId?: string) => Promise<void>;
  downloadSubtitle: (subtitleId: string, targetItemId?: string, subtitleName?: string) => Promise<void>;
  clearSubtitles: () => void;
}

/**
 * Hook for managing subtitle search and download operations
 * Shared between Player and Detail pages
 */
export const useSubtitleManager = (options: UseSubtitleManagerOptions = {}): SubtitleManager => {
  const { itemId, onDownloadSuccess } = options;
  const queryClient = useQueryClient();
  
  const [remoteSubtitles, setRemoteSubtitles] = useState<RemoteSubtitle[]>([]);
  const [searchingSubtitles, setSearchingSubtitles] = useState(false);
  const [downloadingSubtitle, setDownloadingSubtitle] = useState<string | null>(null);

  const searchSubtitles = useCallback(async (language: string = 'nor', targetItemId?: string) => {
    const searchId = targetItemId || itemId;
    if (!searchId) return;
    
    setSearchingSubtitles(true);
    setRemoteSubtitles([]);
    
    try {
      const { data, error } = await supabase.functions.invoke('jellyfin-search-subtitles', {
        body: { itemId: searchId, language }
      });
      
      if (error) throw error;
      
      if (data?.error) {
        toast.error(data.error);
        return;
      }
      
      setRemoteSubtitles(data?.subtitles || []);
      
      if (data?.subtitles?.length === 0) {
        toast.info('Ingen undertekster funnet for dette språket');
      }
    } catch (error) {
      console.error('Error searching subtitles:', error);
      toast.error('Kunne ikke søke etter undertekster');
    } finally {
      setSearchingSubtitles(false);
    }
  }, [itemId]);

  const downloadSubtitle = useCallback(async (
    subtitleId: string, 
    targetItemId?: string, 
    subtitleName?: string
  ) => {
    const downloadId = targetItemId || itemId;
    if (!downloadId) return;
    
    setDownloadingSubtitle(subtitleId);
    
    const loadingMessage = subtitleName 
      ? `Laster ned: ${subtitleName.substring(0, 50)}${subtitleName.length > 50 ? '...' : ''}`
      : 'Laster ned undertekst...';
    const toastId = toast.loading(loadingMessage);
    
    try {
      const { data, error } = await supabase.functions.invoke('jellyfin-download-subtitle', {
        body: { itemId: downloadId, subtitleId }
      });
      
      if (error) throw error;
      
      if (data?.success) {
        toast.success('Undertekst lastet ned og lagt til!', { id: toastId });
        
        // Invalidate relevant queries
        queryClient.invalidateQueries({ queryKey: ['item-detail', downloadId] });
        if (targetItemId) {
          queryClient.invalidateQueries({ queryKey: ['item-detail-player', targetItemId] });
        }
        
        onDownloadSuccess?.();
      } else {
        toast.error(data?.error || 'Kunne ikke laste ned undertekst', { id: toastId });
      }
    } catch (error) {
      console.error('Error downloading subtitle:', error);
      toast.error('Kunne ikke laste ned undertekst', { id: toastId });
    } finally {
      setDownloadingSubtitle(null);
    }
  }, [itemId, queryClient, onDownloadSuccess]);

  const clearSubtitles = useCallback(() => {
    setRemoteSubtitles([]);
  }, []);

  return {
    remoteSubtitles,
    searchingSubtitles,
    downloadingSubtitle,
    searchSubtitles,
    downloadSubtitle,
    clearSubtitles,
  };
};
