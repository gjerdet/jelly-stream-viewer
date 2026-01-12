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
      return data?.setting_value || "";
    },
  });

  const { data: apiKey } = useQuery({
    queryKey: ["server-settings", "jellyfin_api_key"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("server_settings")
        .select("setting_value")
        .eq("setting_key", "jellyfin_api_key")
        .maybeSingle();

      if (error) throw error;
      return data?.setting_value || "";
    },
  });

  // Direct stream URL (optional HTTPS URL for seamless streaming without proxy)
  const { data: directStreamUrl } = useQuery({
    queryKey: ["server-settings", "jellyfin_direct_stream_url"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("server_settings")
        .select("setting_value")
        .eq("setting_key", "jellyfin_direct_stream_url")
        .maybeSingle();

      if (error) throw error;
      return data?.setting_value || "";
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

  const updateDirectStreamUrl = useMutation({
    mutationFn: async (newUrl: string) => {
      // Check if setting exists first
      const { data: existing } = await supabase
        .from("server_settings")
        .select("id")
        .eq("setting_key", "jellyfin_direct_stream_url")
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("server_settings")
          .update({ 
            setting_value: newUrl,
            updated_at: new Date().toISOString()
          })
          .eq("setting_key", "jellyfin_direct_stream_url");
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("server_settings")
          .insert({ 
            setting_key: "jellyfin_direct_stream_url",
            setting_value: newUrl,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["server-settings"] });
      toast.success("Direkte stream URL oppdatert!");
    },
    onError: () => {
      toast.error("Kunne ikke oppdatere direkte stream URL");
    },
  });

  return { 
    serverUrl, 
    apiKey, 
    directStreamUrl,
    isLoading, 
    updateServerUrl,
    updateDirectStreamUrl 
  };
};

// Helper function to generate Jellyfin image URL
export const getJellyfinImageUrl = (serverUrl: string, itemId: string, imageType: 'Primary' | 'Backdrop', params?: Record<string, string>) => {
  const queryParams = new URLSearchParams(params || {});
  return `${serverUrl.replace(/\/$/, '')}/Items/${itemId}/Images/${imageType}?${queryParams.toString()}`;
};
