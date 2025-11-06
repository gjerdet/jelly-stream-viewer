import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Du må være logget inn");

      const { data, error } = await supabase
        .from('jellyseerr_requests')
        .insert({
          user_id: user.id,
          media_type: mediaType,
          media_id: mediaId,
          seasons: seasons ? JSON.stringify(seasons) : null,
          media_title: mediaTitle,
          media_poster: mediaPoster,
          media_overview: mediaOverview,
          status: 'pending'
        })
        .select()
        .single();

      if (error) throw error;
      return data;
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
