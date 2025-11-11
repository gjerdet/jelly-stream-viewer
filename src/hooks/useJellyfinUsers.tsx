import { useQuery } from "@tanstack/react-query";
import { useServerSettings } from "./useServerSettings";

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

      const cleanServerUrl = serverUrl.replace(/\/$/, '');
      
      const response = await fetch(`${cleanServerUrl}/Users`, {
        headers: {
          'X-Emby-Token': apiKey,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Jellyfin API feil: ${response.status}`);
      }

      const users: JellyfinUser[] = await response.json();
      
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
