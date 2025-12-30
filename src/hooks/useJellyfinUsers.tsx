import { useQuery } from "@tanstack/react-query";
import { useServerSettings } from "./useServerSettings";
import { supabase } from "@/integrations/supabase/client";

interface JellyfinUser {
  Id: string;
  Name: string;
  LastActivityDate: string | null;
  LastLoginDate: string | null;
  Policy: {
    IsAdministrator: boolean;
    IsDisabled: boolean;
  };
}

export const useJellyfinUsers = () => {
  const { serverUrl, apiKey } = useServerSettings();

  return useQuery({
    queryKey: ["jellyfin-users", serverUrl, apiKey],
    queryFn: async () => {
      if (!serverUrl || !apiKey) {
        throw new Error("Jellyfin innstillinger mangler");
      }

      // Use jellyfin-proxy for Chrome compatibility
      const { data, error } = await supabase.functions.invoke('jellyfin-proxy', {
        body: {
          endpoint: '/Users',
          method: 'GET'
        }
      });

      if (error) {
        console.error('Jellyfin proxy error:', error);
        throw new Error(`Jellyfin API feil: ${error.message}`);
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      const users: JellyfinUser[] = Array.isArray(data) ? data : [];
      
      console.log('Jellyfin API returned users:', users.length, users);
      
      const mappedUsers = users.map(user => ({
        id: user.Id,
        name: user.Name,
        lastActivity: user.LastActivityDate,
        lastLogin: user.LastLoginDate,
        isAdministrator: user.Policy?.IsAdministrator || false,
        isDisabled: user.Policy?.IsDisabled || false,
      }));
      
      console.log('Mapped users:', mappedUsers);
      return mappedUsers;
    },
    enabled: !!serverUrl && !!apiKey,
  });
};
