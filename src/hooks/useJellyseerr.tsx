import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import * as jellyseerrClient from "@/lib/jellyseerrClient";

interface JellyseerrRequestParams {
  mediaType: 'movie' | 'tv';
  mediaId: number;
  seasons?: number[] | 'all' | { [seasonNumber: number]: number[] } | { fullSeasons: number[]; episodes: { [seasonNumber: number]: number[] } };
  mediaTitle: string;
  mediaPoster?: string;
  mediaOverview?: string;
}

export const useJellyseerrRequest = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ mediaType, mediaId, seasons, mediaTitle, mediaPoster, mediaOverview }: JellyseerrRequestParams) => {
      return jellyseerrClient.requestMedia({
        mediaType,
        mediaId,
        mediaTitle,
        mediaPoster,
        mediaOverview,
        seasons,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jellyseerr-requests'] });
      toast.success("Forespørsel sendt til godkjenning!");
    },
    onError: (error: any) => {
      console.error('Jellyseerr request error:', error);
      const errorMessage = error?.message || "Kunne ikke sende forespørsel";
      toast.error(errorMessage);
    },
  });
};
