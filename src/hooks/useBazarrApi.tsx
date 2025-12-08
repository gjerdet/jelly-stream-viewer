import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export const useBazarrApi = () => {
  // Make a request via the Edge Function proxy
  const bazarrRequest = useCallback(async (
    action: string,
    params: Record<string, unknown> = {}
  ): Promise<{ data: unknown; error: Error | null }> => {
    try {
      console.log(`Bazarr proxy request: ${action}`, params);
      
      const { data, error } = await supabase.functions.invoke('bazarr-proxy', {
        body: { action, params }
      });
      
      if (error) {
        console.error('Bazarr proxy error:', error);
        return { data: null, error };
      }

      // Check if the response contains an error message from the edge function
      if (data?.error) {
        return { data: null, error: new Error(data.error) };
      }

      return { data, error: null };
    } catch (err) {
      console.error('Bazarr request failed:', err);
      return { data: null, error: err instanceof Error ? err : new Error('Unknown error') };
    }
  }, []);

  return {
    bazarrRequest
  };
};
