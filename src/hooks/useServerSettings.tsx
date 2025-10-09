import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const useServerSettings = () => {
  const queryClient = useQueryClient();

  const { data: serverUrl, isLoading } = useQuery({
    queryKey: ["server-settings", "jellyfin_server_url"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("server_settings")
        .select("setting_value")
        .eq("setting_key", "jellyfin_server_url")
        .maybeSingle();

      if (error) throw error;
      return data?.setting_value || "http://jellyfin.gjerdet.casa/";
    },
  });

  const updateServerUrl = useMutation({
    mutationFn: async (newUrl: string) => {
      const { error } = await supabase
        .from("server_settings")
        .update({ 
          setting_value: newUrl,
          updated_at: new Date().toISOString()
        })
        .eq("setting_key", "jellyfin_server_url");

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["server-settings"] });
      toast.success("Server URL oppdatert!");
    },
    onError: () => {
      toast.error("Kunne ikke oppdatere server URL");
    },
  });

  return { serverUrl, isLoading, updateServerUrl };
};
