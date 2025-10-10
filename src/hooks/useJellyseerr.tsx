import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface JellyseerrRequestParams {
  mediaType: 'movie' | 'tv';
  mediaId: number;
  seasons?: number[] | 'all';
}

export const useJellyseerrRequest = () => {
  return useMutation({
    mutationFn: async ({ mediaType, mediaId, seasons }: JellyseerrRequestParams) => {
      const { data, error } = await supabase.functions.invoke("jellyseerr-request", {
        body: { mediaType, mediaId, seasons },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success(data.message || "Forespørsel sendt til Jellyseerr!");
    },
    onError: (error: any) => {
      console.error('Jellyseerr request error:', error);
      const errorMessage = error?.message || error?.error || "Kunne ikke sende forespørsel";
      toast.error(errorMessage);
    },
  });
};
