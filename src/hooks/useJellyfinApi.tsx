import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface JellyfinRequest {
  endpoint: string;
  method?: string;
  body?: any;
}

export const useJellyfinApi = <T,>(
  queryKey: string[],
  request: JellyfinRequest,
  enabled: boolean = true
) => {
  return useQuery<T>({
    queryKey,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("jellyfin-proxy", {
        body: request,
      });

      if (error) throw error;
      return data as T;
    },
    enabled,
  });
};
