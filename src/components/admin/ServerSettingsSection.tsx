import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Server, Loader2, Film, Tv } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import { useServerSettings } from "@/hooks/useServerSettings";
import { SystemDiagnosticsPanel } from "./SystemDiagnosticsPanel";
import { ProxyHealthCheck } from "./ProxyHealthCheck";

interface ServerSettingsSectionProps {
  userRole?: string | null;
}

export const ServerSettingsSection = ({ userRole }: ServerSettingsSectionProps) => {
  const { t, language } = useLanguage();
  const admin = t.admin as any;
  const common = t.common as any;
  const queryClient = useQueryClient();
  const { serverUrl, updateServerUrl } = useServerSettings();

  const [newServerUrl, setNewServerUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [jellyseerrUrl, setJellyseerrUrl] = useState("");
  const [jellyseerrApiKey, setJellyseerrApiKey] = useState("");
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<string | null>(null);
  const [testingJellyseerr, setTestingJellyseerr] = useState(false);
  const [jellyseerrStatus, setJellyseerrStatus] = useState<string | null>(null);
  
  // Bazarr
  const [bazarrUrl, setBazarrUrl] = useState("");
  const [bazarrApiKey, setBazarrApiKey] = useState("");
  const [testingBazarr, setTestingBazarr] = useState(false);
  const [bazarrStatus, setBazarrStatus] = useState<string | null>(null);
  
  // Radarr
  const [radarrUrl, setRadarrUrl] = useState("");
  const [radarrApiKey, setRadarrApiKey] = useState("");
  const [testingRadarr, setTestingRadarr] = useState(false);
  const [radarrStatus, setRadarrStatus] = useState<string | null>(null);
  
  // Sonarr
  const [sonarrUrl, setSonarrUrl] = useState("");
  const [sonarrApiKey, setSonarrApiKey] = useState("");
  const [testingSonarr, setTestingSonarr] = useState(false);
  const [sonarrStatus, setSonarrStatus] = useState<string | null>(null);

  // GitHub settings
  const [githubRepoUrl, setGithubRepoUrl] = useState("");
  const [updateWebhookUrl, setUpdateWebhookUrl] = useState("");
  const [updateWebhookSecret, setUpdateWebhookSecret] = useState("");

  const jellyseerrDebounceTimer = useRef<NodeJS.Timeout | null>(null);

  // Fetch API key
  const { data: currentApiKey } = useQuery({
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
    enabled: userRole === "admin",
  });

  // Fetch Jellyseerr URL
  const { data: currentJellyseerrUrl } = useQuery({
    queryKey: ["server-settings", "jellyseerr_url"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("server_settings")
        .select("setting_value")
        .eq("setting_key", "jellyseerr_url")
        .maybeSingle();

      if (error) throw error;
      return data?.setting_value || "";
    },
    enabled: userRole === "admin",
  });

  // Fetch Jellyseerr API key
  const { data: currentJellyseerrApiKey } = useQuery({
    queryKey: ["server-settings", "jellyseerr_api_key"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("server_settings")
        .select("setting_value")
        .eq("setting_key", "jellyseerr_api_key")
        .maybeSingle();

      if (error) throw error;
      return data?.setting_value || "";
    },
    enabled: userRole === "admin",
  });

  // Update API key mutation
  const updateApiKey = useMutation({
    mutationFn: async (newApiKey: string) => {
      const { error } = await supabase
        .from("server_settings")
        .upsert({ 
          setting_key: "jellyfin_api_key",
          setting_value: newApiKey,
          updated_at: new Date().toISOString()
        }, {
          onConflict: "setting_key"
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["server-settings"] });
      toast.success("Jellyfin API-nøkkel oppdatert!");
    },
    onError: () => {
      toast.error("Kunne ikke oppdatere API-nøkkel");
    },
  });

  // Update Jellyseerr URL mutation
  const updateJellyseerrUrl = useMutation({
    mutationFn: async (newUrl: string) => {
      const { error } = await supabase
        .from("server_settings")
        .upsert({ 
          setting_key: "jellyseerr_url",
          setting_value: newUrl,
          updated_at: new Date().toISOString()
        }, {
          onConflict: "setting_key"
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["server-settings"] });
      toast.success("Jellyseerr URL oppdatert!");
    },
    onError: () => {
      toast.error("Kunne ikke oppdatere Jellyseerr URL");
    },
  });

  // Update Jellyseerr API key mutation
  const updateJellyseerrApiKey = useMutation({
    mutationFn: async (newApiKey: string) => {
      const { error } = await supabase
        .from("server_settings")
        .upsert({ 
          setting_key: "jellyseerr_api_key",
          setting_value: newApiKey,
          updated_at: new Date().toISOString()
        }, {
          onConflict: "setting_key"
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["server-settings"] });
      toast.success("Jellyseerr API-nøkkel oppdatert!");
    },
    onError: () => {
      toast.error("Kunne ikke oppdatere Jellyseerr API-nøkkel");
    },
  });

  // GitHub settings mutations
  const updateGithubSettings = useMutation({
    mutationFn: async ({ repoUrl, webhookUrl, webhookSecret }: { repoUrl: string; webhookUrl: string; webhookSecret: string }) => {
      const updates = [
        { setting_key: "github_repo_url", setting_value: repoUrl, updated_at: new Date().toISOString() },
        { setting_key: "update_webhook_url", setting_value: webhookUrl, updated_at: new Date().toISOString() },
        { setting_key: "update_webhook_secret", setting_value: webhookSecret, updated_at: new Date().toISOString() }
      ];

      for (const update of updates) {
        const { error } = await supabase
          .from("server_settings")
          .upsert(update, { onConflict: "setting_key" });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["server-settings"] });
      toast.success("GitHub-innstillinger oppdatert!");
    },
    onError: () => {
      toast.error("Kunne ikke oppdatere GitHub-innstillinger");
    },
  });

  // Radarr mutations
  const updateRadarrUrl = useMutation({
    mutationFn: async (newUrl: string) => {
      const { error } = await supabase
        .from("server_settings")
        .upsert({ 
          setting_key: "radarr_url",
          setting_value: newUrl,
          updated_at: new Date().toISOString()
        }, {
          onConflict: "setting_key"
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["server-settings"] });
      toast.success("Radarr URL oppdatert!");
    },
    onError: () => {
      toast.error("Kunne ikke oppdatere Radarr URL");
    },
  });

  const updateRadarrApiKey = useMutation({
    mutationFn: async (newApiKey: string) => {
      const { error } = await supabase
        .from("server_settings")
        .upsert({ 
          setting_key: "radarr_api_key",
          setting_value: newApiKey,
          updated_at: new Date().toISOString()
        }, {
          onConflict: "setting_key"
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["server-settings"] });
      toast.success("Radarr API-nøkkel oppdatert!");
    },
    onError: () => {
      toast.error("Kunne ikke oppdatere Radarr API-nøkkel");
    },
  });

  // Sonarr mutations
  const updateSonarrUrl = useMutation({
    mutationFn: async (newUrl: string) => {
      const { error } = await supabase
        .from("server_settings")
        .upsert({ 
          setting_key: "sonarr_url",
          setting_value: newUrl,
          updated_at: new Date().toISOString()
        }, {
          onConflict: "setting_key"
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["server-settings"] });
      toast.success("Sonarr URL oppdatert!");
    },
    onError: () => {
      toast.error("Kunne ikke oppdatere Sonarr URL");
    },
  });

  const updateSonarrApiKey = useMutation({
    mutationFn: async (newApiKey: string) => {
      const { error } = await supabase
        .from("server_settings")
        .upsert({ 
          setting_key: "sonarr_api_key",
          setting_value: newApiKey,
          updated_at: new Date().toISOString()
        }, {
          onConflict: "setting_key"
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["server-settings"] });
      toast.success("Sonarr API-nøkkel oppdatert!");
    },
    onError: () => {
      toast.error("Kunne ikke oppdatere Sonarr API-nøkkel");
    },
  });

  // Bazarr mutations
  const updateBazarrUrl = useMutation({
    mutationFn: async (newUrl: string) => {
      const { error } = await supabase
        .from("server_settings")
        .upsert({ 
          setting_key: "bazarr_url",
          setting_value: newUrl,
          updated_at: new Date().toISOString()
        }, {
          onConflict: "setting_key"
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["server-settings"] });
      toast.success("Bazarr URL oppdatert!");
    },
    onError: () => {
      toast.error("Kunne ikke oppdatere Bazarr URL");
    },
  });

  const updateBazarrApiKey = useMutation({
    mutationFn: async (newApiKey: string) => {
      const { error } = await supabase
        .from("server_settings")
        .upsert({ 
          setting_key: "bazarr_api_key",
          setting_value: newApiKey,
          updated_at: new Date().toISOString()
        }, {
          onConflict: "setting_key"
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["server-settings"] });
      toast.success("Bazarr API-nøkkel oppdatert!");
    },
    onError: () => {
      toast.error("Kunne ikke oppdatere Bazarr API-nøkkel");
    },
  });

  useEffect(() => {
    if (serverUrl && !newServerUrl) {
      setNewServerUrl(serverUrl);
    }
  }, [serverUrl, newServerUrl]);

  useEffect(() => {
    if (currentApiKey && !apiKey) {
      setApiKey(currentApiKey);
    }
  }, [currentApiKey, apiKey]);

  useEffect(() => {
    if (currentJellyseerrUrl && !jellyseerrUrl) {
      setJellyseerrUrl(currentJellyseerrUrl);
    }
  }, [currentJellyseerrUrl, jellyseerrUrl]);

  useEffect(() => {
    if (currentJellyseerrApiKey && !jellyseerrApiKey) {
      setJellyseerrApiKey(currentJellyseerrApiKey);
    }
  }, [currentJellyseerrApiKey, jellyseerrApiKey]);

  // Load additional settings
  useEffect(() => {
    const loadAdditionalSettings = async () => {
      if (userRole !== "admin") return;
      
      const { data } = await supabase
        .from("server_settings")
        .select("setting_key, setting_value")
        .in("setting_key", [
          "github_repo_url", 
          "update_webhook_url",
          "update_webhook_secret",
          "bazarr_url",
          "bazarr_api_key",
          "radarr_url",
          "radarr_api_key",
          "sonarr_url",
          "sonarr_api_key"
        ]);
      
      data?.forEach(setting => {
        if (setting.setting_key === "github_repo_url") setGithubRepoUrl(setting.setting_value || "");
        if (setting.setting_key === "update_webhook_url") setUpdateWebhookUrl(setting.setting_value || "");
        if (setting.setting_key === "update_webhook_secret") setUpdateWebhookSecret(setting.setting_value || "");
        if (setting.setting_key === "bazarr_url") setBazarrUrl(setting.setting_value || "");
        if (setting.setting_key === "bazarr_api_key") setBazarrApiKey(setting.setting_value || "");
        if (setting.setting_key === "radarr_url") setRadarrUrl(setting.setting_value || "");
        if (setting.setting_key === "radarr_api_key") setRadarrApiKey(setting.setting_value || "");
        if (setting.setting_key === "sonarr_url") setSonarrUrl(setting.setting_value || "");
        if (setting.setting_key === "sonarr_api_key") setSonarrApiKey(setting.setting_value || "");
      });
    };
    
    loadAdditionalSettings();
  }, [userRole]);

  // Auto-validate Jellyseerr connection when URL or API key changes
  useEffect(() => {
    if (jellyseerrDebounceTimer.current) {
      clearTimeout(jellyseerrDebounceTimer.current);
    }

    if (jellyseerrUrl.trim() && jellyseerrApiKey.trim()) {
      jellyseerrDebounceTimer.current = setTimeout(() => {
        handleTestJellyseerr();
      }, 1500);
    } else {
      setJellyseerrStatus(null);
    }

    return () => {
      if (jellyseerrDebounceTimer.current) {
        clearTimeout(jellyseerrDebounceTimer.current);
      }
    };
  }, [jellyseerrUrl, jellyseerrApiKey]);

  const handleUpdateUrl = () => {
    updateServerUrl.mutate(newServerUrl);
  };

  const handleUpdateApiKey = () => {
    if (apiKey.trim()) {
      updateApiKey.mutate(apiKey.trim());
    }
  };

  const handleUpdateJellyseerrUrl = () => {
    if (jellyseerrUrl.trim()) {
      updateJellyseerrUrl.mutate(jellyseerrUrl.trim());
    }
  };

  const handleUpdateJellyseerrApiKey = () => {
    if (jellyseerrApiKey.trim()) {
      updateJellyseerrApiKey.mutate(jellyseerrApiKey.trim());
    }
  };

  const handleTestConnection = async () => {
    if (!newServerUrl.trim() || !apiKey.trim()) {
      setConnectionStatus("❌ URL og API-nøkkel må være satt");
      return;
    }

    setTestingConnection(true);
    setConnectionStatus(null);

    try {
      const response = await fetch(`${newServerUrl.trim().replace(/\/$/, '')}/System/Info`, {
        method: "GET",
        headers: {
          "X-Emby-Token": apiKey.trim(),
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        setConnectionStatus(`❌ Feil: HTTP ${response.status}`);
        return;
      }

      const data = await response.json();
      setConnectionStatus(`✅ Tilkoblet! Server: ${data.ServerName || 'Jellyfin'}`);
      toast.success("Jellyfin-tilkobling OK!");
    } catch (error) {
      setConnectionStatus(`❌ Feil: ${error instanceof Error ? error.message : 'Ukjent feil'}`);
    } finally {
      setTestingConnection(false);
    }
  };

  const handleTestJellyseerr = async () => {
    if (!jellyseerrUrl.trim() || !jellyseerrApiKey.trim()) {
      setJellyseerrStatus("❌ URL og API-nøkkel må være satt");
      return;
    }

    setTestingJellyseerr(true);
    setJellyseerrStatus(null);

    try {
      const response = await supabase.functions.invoke('jellyseerr-test', {
        body: { url: jellyseerrUrl.trim(), apiKey: jellyseerrApiKey.trim() }
      });

      if (response.error) {
        setJellyseerrStatus(`❌ Feil: ${response.error.message}`);
        return;
      }

      if (response.data?.success) {
        setJellyseerrStatus(`✅ Tilkoblet! ${response.data.message || 'Jellyseerr'}`);
        toast.success("Jellyseerr-tilkobling OK!");
      } else {
        setJellyseerrStatus(`❌ ${response.data?.message || 'Kunne ikke koble til'}`);
      }
    } catch (error) {
      setJellyseerrStatus(`❌ Feil: ${error instanceof Error ? error.message : 'Ukjent feil'}`);
    } finally {
      setTestingJellyseerr(false);
    }
  };

  const handleRefreshConfig = async () => {
    toast.info("Henter konfigurasjon...");
    try {
      const response = await fetch(`${newServerUrl.trim().replace(/\/$/, '')}/System/Info`, {
        headers: { "X-Emby-Token": apiKey.trim() },
      });
      if (response.ok) {
        toast.success("Konfigurasjon hentet!");
      } else {
        toast.error("Kunne ikke hente konfigurasjon");
      }
    } catch {
      toast.error("Feil ved henting av konfigurasjon");
    }
  };

  const handleTestRadarr = async () => {
    if (!radarrUrl.trim() || !radarrApiKey.trim()) {
      setRadarrStatus("❌ Radarr URL og API-nøkkel må være satt");
      return;
    }

    setTestingRadarr(true);
    setRadarrStatus(null);

    try {
      await updateRadarrUrl.mutateAsync(radarrUrl.trim());
      await updateRadarrApiKey.mutateAsync(radarrApiKey.trim());
      
      const baseUrl = radarrUrl.trim().replace(/\/$/, '');
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      
      const response = await fetch(`${baseUrl}/api/v3/system/status`, {
        method: 'GET',
        headers: {
          'X-Api-Key': radarrApiKey.trim(),
          'Content-Type': 'application/json',
        },
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);

      if (!response.ok) {
        setRadarrStatus(`❌ Feil: HTTP ${response.status}`);
        return;
      }

      const data = await response.json();
      setRadarrStatus(`✅ Tilkoblet! Radarr v${data.version || 'ukjent'}`);
      toast.success("Radarr-tilkobling OK!");
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        setRadarrStatus("❌ Timeout: Radarr svarer ikke");
      } else {
        setRadarrStatus(`❌ Feil: ${error instanceof Error ? error.message : 'Ukjent feil'}`);
      }
    } finally {
      setTestingRadarr(false);
    }
  };

  const handleTestSonarr = async () => {
    if (!sonarrUrl.trim() || !sonarrApiKey.trim()) {
      setSonarrStatus("❌ Sonarr URL og API-nøkkel må være satt");
      return;
    }

    setTestingSonarr(true);
    setSonarrStatus(null);

    try {
      await updateSonarrUrl.mutateAsync(sonarrUrl.trim());
      await updateSonarrApiKey.mutateAsync(sonarrApiKey.trim());
      
      const baseUrl = sonarrUrl.trim().replace(/\/$/, '');
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      
      const response = await fetch(`${baseUrl}/api/v3/system/status`, {
        method: 'GET',
        headers: {
          'X-Api-Key': sonarrApiKey.trim(),
          'Content-Type': 'application/json',
        },
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);

      if (!response.ok) {
        setSonarrStatus(`❌ Feil: HTTP ${response.status}`);
        return;
      }

      const data = await response.json();
      setSonarrStatus(`✅ Tilkoblet! Sonarr v${data.version || 'ukjent'}`);
      toast.success("Sonarr-tilkobling OK!");
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        setSonarrStatus("❌ Timeout: Sonarr svarer ikke");
      } else {
        setSonarrStatus(`❌ Feil: ${error instanceof Error ? error.message : 'Ukjent feil'}`);
      }
    } finally {
      setTestingSonarr(false);
    }
  };

  const handleTestBazarr = async () => {
    if (!bazarrUrl.trim() || !bazarrApiKey.trim()) {
      setBazarrStatus("❌ Bazarr URL og API-nøkkel må være satt");
      return;
    }

    setTestingBazarr(true);
    setBazarrStatus(null);

    try {
      await updateBazarrUrl.mutateAsync(bazarrUrl.trim());
      await updateBazarrApiKey.mutateAsync(bazarrApiKey.trim());
      
      const baseUrl = bazarrUrl.trim().replace(/\/$/, '');
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      
      const response = await fetch(`${baseUrl}/api/system/status`, {
        method: 'GET',
        headers: {
          'X-API-KEY': bazarrApiKey.trim(),
          'Content-Type': 'application/json',
        },
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);

      if (!response.ok) {
        setBazarrStatus(`❌ Feil: HTTP ${response.status}`);
        return;
      }

      const data = await response.json();
      setBazarrStatus(`✅ Tilkoblet! Bazarr v${data.data?.bazarr_version || 'ukjent'}`);
      toast.success("Bazarr-tilkobling OK!");
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        setBazarrStatus("❌ Timeout: Bazarr svarer ikke");
      } else {
        setBazarrStatus(`❌ Feil: ${error instanceof Error ? error.message : 'Ukjent feil'}`);
      }
    } finally {
      setTestingBazarr(false);
    }
  };

  return (
    <div className="space-y-6">
      <SystemDiagnosticsPanel />
      <ProxyHealthCheck />

      <Card className="border-border/50">
        <CardHeader>
          <CardTitle>{admin.serverConfiguration || "Server Configuration"}</CardTitle>
          <CardDescription>
            {admin.updateJellyfinUrl || "Update Jellyfin server URL for all users"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="server-url">{admin.jellyfinUrl || "Jellyfin Server URL"}</Label>
            <Input
              id="server-url"
              type="url"
              placeholder={admin.jellyfinUrlPlaceholder || "http://your-server:8096"}
              value={newServerUrl}
              onChange={(e) => setNewServerUrl(e.target.value)}
              className="bg-secondary/50 border-border/50"
            />
          </div>
          <div className="flex gap-2">
            <Button 
              onClick={handleUpdateUrl}
              disabled={updateServerUrl.isPending || newServerUrl === serverUrl}
              className="cinema-glow flex-1"
            >
              {updateServerUrl.isPending ? (admin.updating || "Updating...") : (admin.updateUrl || "Update URL")}
            </Button>
            <Button 
              onClick={handleTestConnection}
              disabled={testingConnection}
              variant="outline"
              className="flex-1"
            >
              {testingConnection ? (admin.testing || "Testing...") : (admin.testConnection || "Test Connection")}
            </Button>
          </div>
          
          {connectionStatus && (
            <div className={`p-3 rounded-lg text-sm ${
              connectionStatus.startsWith('✅') 
                ? 'bg-green-500/10 text-green-400 border border-green-500/20' 
                : 'bg-red-500/10 text-red-400 border border-red-500/20'
            }`}>
              {connectionStatus}
            </div>
          )}
          
          <Button 
            onClick={handleRefreshConfig}
            disabled={testingConnection || !apiKey || !newServerUrl}
            variant="secondary"
            className="w-full"
          >
            {testingConnection ? (admin.fetching || "Fetching...") : (admin.refreshConfigButton || "🔄 Fetch new configuration from Jellyfin")}
          </Button>
        </CardContent>
      </Card>

      <Card className="border-border/50">
        <CardHeader>
          <CardTitle>{admin.jellyfinSettings || "Jellyfin API Key"}</CardTitle>
          <CardDescription>
            {admin.jellyfinApiDescription || "Configure the API key to authenticate against the Jellyfin server"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="api-key">{admin.apiKey || "API Key"}</Label>
            <Input
              id="api-key"
              type="password"
              placeholder={admin.enterJellyfinApiKey || "Enter Jellyfin API key"}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="bg-secondary/50 border-border/50"
            />
          </div>
          <Button 
            onClick={handleUpdateApiKey}
            disabled={updateApiKey.isPending}
            className="cinema-glow"
          >
            {updateApiKey.isPending ? (admin.updating || "Updating...") : (admin.updateApiKey || "Update API Key")}
          </Button>
        </CardContent>
      </Card>

      <Card className="border-border/50">
        <CardHeader>
          <CardTitle>{admin.githubUpdatesOptional || "GitHub Updates (Optional)"}</CardTitle>
          <CardDescription>
            {admin.githubDescription || "Configure GitHub repository for automatic updates."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="github-repo-url">{admin.githubRepoUrl || "GitHub Repository URL"}</Label>
            <Input
              id="github-repo-url"
              type="url"
              placeholder="https://github.com/username/repo"
              value={githubRepoUrl}
              onChange={(e) => setGithubRepoUrl(e.target.value)}
              className="bg-secondary/50 border-border/50"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="update-webhook-url">{admin.webhookUrlOptional || "Update Webhook URL"}</Label>
            <Input
              id="update-webhook-url"
              type="url"
              placeholder="https://your-domain.com/webhook/update"
              value={updateWebhookUrl}
              onChange={(e) => setUpdateWebhookUrl(e.target.value)}
              className="bg-secondary/50 border-border/50"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="update-webhook-secret">Webhook Secret</Label>
            <Input
              id="update-webhook-secret"
              type="password"
              placeholder="Generate using: openssl rand -hex 32"
              value={updateWebhookSecret}
              onChange={(e) => setUpdateWebhookSecret(e.target.value)}
              className="bg-secondary/50 border-border/50"
            />
          </div>
          <Button 
            onClick={() => updateGithubSettings.mutate({ repoUrl: githubRepoUrl, webhookUrl: updateWebhookUrl, webhookSecret: updateWebhookSecret })}
            disabled={updateGithubSettings.isPending || !githubRepoUrl}
            className="cinema-glow"
          >
            {updateGithubSettings.isPending ? (admin.saving || "Saving...") : (admin.saveGithubSettings || "Save GitHub Settings")}
          </Button>
        </CardContent>
      </Card>

      <Card className="border-border/50">
        <CardHeader>
          <CardTitle>{admin.jellyseerrServer || "Jellyseerr Server"}</CardTitle>
          <CardDescription>
            {admin.jellyseerrDescription || "Configure Jellyseerr to request content."}
            <span className="block mt-2 text-yellow-500/80">
              {admin.jellyseerrWarning || "⚠️ Note: Edge functions run in the cloud and cannot reach local IP addresses."}
            </span>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="jellyseerr-url">{admin.jellyseerrUrl || "Jellyseerr Server URL"}</Label>
            <div className="flex gap-2">
              <Input
                id="jellyseerr-url"
                type="url"
                placeholder="http://jellyseerr.yourdomain.com"
                value={jellyseerrUrl}
                onChange={(e) => setJellyseerrUrl(e.target.value)}
                className="bg-secondary/50 border-border/50 flex-1"
              />
              {jellyseerrUrl.startsWith('https://') && (
                <Button 
                  onClick={() => setJellyseerrUrl(jellyseerrUrl.replace('https://', 'http://'))}
                  variant="outline"
                  size="sm"
                >
                  → HTTP
                </Button>
              )}
            </div>
            {currentJellyseerrUrl && currentJellyseerrUrl !== jellyseerrUrl && (
              <p className="text-xs text-yellow-500/80">
                ⚠️ Saved URL: {currentJellyseerrUrl}
              </p>
            )}
          </div>
          <Button 
            onClick={handleUpdateJellyseerrUrl}
            disabled={updateJellyseerrUrl.isPending || !jellyseerrUrl || jellyseerrUrl === currentJellyseerrUrl}
            className="cinema-glow"
          >
            {updateJellyseerrUrl.isPending ? (admin.updating || "Updating...") : (admin.updateJellyseerrUrl || "Update Jellyseerr URL")}
          </Button>

          <div className="space-y-2">
            <Label htmlFor="jellyseerr-api-key">{admin.jellyseerrApiKey || "Jellyseerr API Key"}</Label>
            <Input
              id="jellyseerr-api-key"
              type="password"
              placeholder={admin.enterJellyseerrApiKey || "Enter Jellyseerr API key"}
              value={jellyseerrApiKey}
              onChange={(e) => setJellyseerrApiKey(e.target.value)}
              className="bg-secondary/50 border-border/50"
            />
          </div>
          <Button 
            onClick={handleUpdateJellyseerrApiKey}
            disabled={updateJellyseerrApiKey.isPending || !jellyseerrApiKey}
            className="cinema-glow"
          >
            {updateJellyseerrApiKey.isPending ? (admin.updating || "Updating...") : (admin.updateJellyseerrApiKey || "Update Jellyseerr API Key")}
          </Button>

          {testingJellyseerr && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 border border-border/50">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <span className="text-sm text-muted-foreground">Testing connection...</span>
            </div>
          )}
          
          {!testingJellyseerr && jellyseerrStatus && (
            <div className={`p-3 rounded-lg text-sm ${
              jellyseerrStatus.startsWith('✅') 
                ? 'bg-green-500/10 text-green-400 border border-green-500/20' 
                : 'bg-red-500/10 text-red-400 border border-red-500/20'
            }`}>
              {jellyseerrStatus}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Film className="h-5 w-5" />
            Radarr
          </CardTitle>
          <CardDescription>
            {language === 'no' ? 'Konfigurer Radarr for filmadministrasjon' : 'Configure Radarr for movie management'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="radarr-url">Radarr Server URL</Label>
            <Input
              id="radarr-url"
              type="url"
              placeholder="http://192.168.1.100:7878"
              value={radarrUrl}
              onChange={(e) => setRadarrUrl(e.target.value)}
              className="bg-secondary/50 border-border/50"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="radarr-api-key">Radarr API Key</Label>
            <Input
              id="radarr-api-key"
              type="password"
              placeholder={language === 'no' ? 'Finn i Radarr → Settings → General' : 'Find in Radarr → Settings → General'}
              value={radarrApiKey}
              onChange={(e) => setRadarrApiKey(e.target.value)}
              className="bg-secondary/50 border-border/50"
            />
          </div>
          <div className="flex gap-2">
            <Button 
              onClick={() => {
                if (radarrUrl.trim()) updateRadarrUrl.mutate(radarrUrl.trim());
                if (radarrApiKey.trim()) updateRadarrApiKey.mutate(radarrApiKey.trim());
              }}
              disabled={updateRadarrUrl.isPending || updateRadarrApiKey.isPending}
              className="cinema-glow flex-1"
            >
              {(updateRadarrUrl.isPending || updateRadarrApiKey.isPending) ? "Saving..." : "Save Settings"}
            </Button>
            <Button 
              onClick={handleTestRadarr}
              disabled={testingRadarr}
              variant="outline"
              className="flex-1"
            >
              {testingRadarr ? "Testing..." : "Test Connection"}
            </Button>
          </div>
          
          {radarrStatus && (
            <div className={`p-3 rounded-lg text-sm ${
              radarrStatus.startsWith('✅') 
                ? 'bg-green-500/10 text-green-400 border border-green-500/20' 
                : 'bg-red-500/10 text-red-400 border border-red-500/20'
            }`}>
              {radarrStatus}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Tv className="h-5 w-5" />
            Sonarr
          </CardTitle>
          <CardDescription>
            {language === 'no' ? 'Konfigurer Sonarr for serieadministrasjon' : 'Configure Sonarr for TV series management'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="sonarr-url">Sonarr Server URL</Label>
            <Input
              id="sonarr-url"
              type="url"
              placeholder="http://192.168.1.100:8989"
              value={sonarrUrl}
              onChange={(e) => setSonarrUrl(e.target.value)}
              className="bg-secondary/50 border-border/50"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sonarr-api-key">Sonarr API Key</Label>
            <Input
              id="sonarr-api-key"
              type="password"
              placeholder={language === 'no' ? 'Finn i Sonarr → Settings → General' : 'Find in Sonarr → Settings → General'}
              value={sonarrApiKey}
              onChange={(e) => setSonarrApiKey(e.target.value)}
              className="bg-secondary/50 border-border/50"
            />
          </div>
          <div className="flex gap-2">
            <Button 
              onClick={() => {
                if (sonarrUrl.trim()) updateSonarrUrl.mutate(sonarrUrl.trim());
                if (sonarrApiKey.trim()) updateSonarrApiKey.mutate(sonarrApiKey.trim());
              }}
              disabled={updateSonarrUrl.isPending || updateSonarrApiKey.isPending}
              className="cinema-glow flex-1"
            >
              {(updateSonarrUrl.isPending || updateSonarrApiKey.isPending) ? "Saving..." : "Save Settings"}
            </Button>
            <Button 
              onClick={handleTestSonarr}
              disabled={testingSonarr}
              variant="outline"
              className="flex-1"
            >
              {testingSonarr ? "Testing..." : "Test Connection"}
            </Button>
          </div>
          
          {sonarrStatus && (
            <div className={`p-3 rounded-lg text-sm ${
              sonarrStatus.startsWith('✅') 
                ? 'bg-green-500/10 text-green-400 border border-green-500/20' 
                : 'bg-red-500/10 text-red-400 border border-red-500/20'
            }`}>
              {sonarrStatus}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
