import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface SiteSetting {
  setting_key: string;
  setting_value: string;
}

export const useSiteSettings = () => {
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useQuery({
    queryKey: ["site-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("site_settings")
        .select("*");

      if (error) throw error;
      
      // Convert array to object for easier access
      const settingsObj: Record<string, string> = {};
      data?.forEach((setting: SiteSetting) => {
        settingsObj[setting.setting_key] = setting.setting_value;
      });
      
      return settingsObj;
    },
  });

  const updateSetting = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: string }) => {
      const { error } = await supabase
        .from("site_settings")
        .upsert({ 
          setting_key: key,
          setting_value: value,
          updated_at: new Date().toISOString()
        }, {
          onConflict: "setting_key"
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["site-settings"] });
      toast.success("Innstilling oppdatert");
    },
    onError: () => {
      toast.error("Kunne ikke oppdatere innstilling");
    },
  });

  return {
    siteName: settings?.site_name || "Jelly Stream Viewer",
    logoUrl: settings?.site_logo_url || "",
    headerTitle: settings?.site_header_title || "Jelly Stream Viewer",
    loginBackgroundUrl: settings?.login_background_url || "",
    loginTransparency: parseInt(settings?.login_transparency || "95", 10),
    isLoading,
    updateSetting: updateSetting.mutate,
  };
};
