import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { useServerSettings } from "@/hooks/useServerSettings";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { useLanguage } from "@/contexts/LanguageContext";
import { Settings, Newspaper, Trash2, Pin, Loader2, Server, Download, Database, HardDrive, Activity, FileText, Library, Subtitles, AlertTriangle, MessageSquare, BookOpen, Film, Tv, Bold, Italic, List, Link, Type, Edit, Save, X, Copy, RefreshCw } from "lucide-react";

import { UpdateManager } from "@/components/UpdateManager";
import { UserManagement } from "@/components/UserManagement";
import { ServerMonitoring } from "@/components/ServerMonitoring";
import { QBittorrentStatus } from "@/components/QBittorrentStatus";
import { HealthCheckDashboard } from "@/components/HealthCheckDashboard";
import { SystemLogs } from "@/components/SystemLogs";
import { MediaLibraryOverview } from "@/components/MediaLibraryOverview";
import { BazarrDashboard } from "@/components/admin/BazarrDashboard";
import { MediaCompatibilityManager } from "@/components/admin/MediaCompatibilityManager";
import { TranscodeJobsDashboard } from "@/components/admin/TranscodeJobsDashboard";
import { MediaReportsManager } from "@/components/admin/MediaReportsManager";
import { DatabaseSetupGuide } from "@/components/admin/DatabaseSetupGuide";
import { RadarrDashboard } from "@/components/admin/RadarrDashboard";
import { SonarrDashboard } from "@/components/admin/SonarrDashboard";
import { UserAccessManagement } from "@/components/admin/UserAccessManagement";
import { DuplicateMediaManager } from "@/components/admin/DuplicateMediaManager";
import { DuplicateReportsManager } from "@/components/admin/DuplicateReportsManager";
import { BufferingDiagnostics } from "@/components/admin/BufferingDiagnostics";
import { DownloadsPendingManager } from "@/components/admin/DownloadsPendingManager";
import { NasAgentSettings } from "@/components/admin/NasAgentSettings";
import { SyncScheduleManager } from "@/components/admin/SyncScheduleManager";
import { ServerSettingsSection } from "@/components/admin/ServerSettingsSection";
import { NewsManagementSection } from "@/components/admin/NewsManagementSection";
import { SiteSettingsSection } from "@/components/admin/SiteSettingsSection";

import { ProxyHealthCheck } from "@/components/admin/ProxyHealthCheck";
import { SystemDiagnosticsPanel } from "@/components/admin/SystemDiagnosticsPanel";
import { AppServicesHealth } from "@/components/admin/AppServicesHealth";
import { SystemStatusDashboard } from "@/components/admin/SystemStatusDashboard";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const Admin = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, loading: authLoading } = useAuth();
  const { data: userRole, isLoading: roleLoading } = useUserRole(user?.id);
  const { serverUrl, updateServerUrl } = useServerSettings();
  const { siteName, logoUrl, headerTitle, loginBackgroundUrl, loginTransparency, loginTitle, loginDescription, updateSetting } = useSiteSettings();
  const { t, language } = useLanguage();
  const admin = t.admin as any;
  const common = t.common as any;
  const [newServerUrl, setNewServerUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [jellyseerrUrl, setJellyseerrUrl] = useState("");
  const [jellyseerrApiKey, setJellyseerrApiKey] = useState("");
  const [monitoringUrl, setMonitoringUrl] = useState("");
  const [qbittorrentUrl, setQbittorrentUrl] = useState("");
  const [qbittorrentPort, setQbittorrentPort] = useState("8080");
  const [qbittorrentUsername, setQbittorrentUsername] = useState("");
  const [qbittorrentPassword, setQbittorrentPassword] = useState("");
  
  // Bazarr settings state
  const [bazarrUrl, setBazarrUrl] = useState("");
  const [bazarrApiKey, setBazarrApiKey] = useState("");
  const [testingBazarr, setTestingBazarr] = useState(false);
  const [bazarrStatus, setBazarrStatus] = useState<string | null>(null);
  
  // Radarr settings state
  const [radarrUrl, setRadarrUrl] = useState("");
  const [radarrApiKey, setRadarrApiKey] = useState("");
  const [testingRadarr, setTestingRadarr] = useState(false);
  const [radarrStatus, setRadarrStatus] = useState<string | null>(null);
  
  // Sonarr settings state
  const [sonarrUrl, setSonarrUrl] = useState("");
  const [sonarrApiKey, setSonarrApiKey] = useState("");
  const [testingSonarr, setTestingSonarr] = useState(false);
  const [sonarrStatus, setSonarrStatus] = useState<string | null>(null);
  
  // GitHub settings state
  const [githubRepoUrl, setGithubRepoUrl] = useState("");
  const [updateWebhookUrl, setUpdateWebhookUrl] = useState("");
  const [updateWebhookSecret, setUpdateWebhookSecret] = useState("");
  
  // Database settings state
  const [deploymentType, setDeploymentType] = useState("");
  const [dbHost, setDbHost] = useState("");
  const [dbPort, setDbPort] = useState("");
  const [dbName, setDbName] = useState("");
  const [dbUser, setDbUser] = useState("");
  const [supabaseUrl, setSupabaseUrl] = useState("");
  const [supabaseProjectId, setSupabaseProjectId] = useState("");
  
  // Site settings state
  const [newSiteName, setNewSiteName] = useState("");
  const [newLogoUrl, setNewLogoUrl] = useState("");
  const [newHeaderTitle, setNewHeaderTitle] = useState("");
  const [newLoginBackgroundUrl, setNewLoginBackgroundUrl] = useState("");
  const [newLoginTransparency, setNewLoginTransparency] = useState(95);
  const [newLoginTitle, setNewLoginTitle] = useState("");
  const [newLoginDescription, setNewLoginDescription] = useState("");
  
  // News post state
  const [newPostTitle, setNewPostTitle] = useState("");
  const [newPostContent, setNewPostContent] = useState("");
  const [editingPost, setEditingPost] = useState<string | null>(null);
  const [editPostTitle, setEditPostTitle] = useState("");
  const [editPostContent, setEditPostContent] = useState("");
  
  // Connection test state
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<string | null>(null);
  const [testingJellyseerr, setTestingJellyseerr] = useState(false);
  const [jellyseerrStatus, setJellyseerrStatus] = useState<string | null>(null);
  
  // Debounce timer for auto-validation
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
    enabled: !!user && userRole === "admin",
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
    enabled: !!user && userRole === "admin",
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
    enabled: !!user && userRole === "admin",
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

  useEffect(() => {
    if (serverUrl && !newServerUrl) {
      setNewServerUrl(serverUrl);
    }
  }, [serverUrl]);

  useEffect(() => {
    if (currentApiKey && !apiKey) {
      setApiKey(currentApiKey);
    }
  }, [currentApiKey]);

  useEffect(() => {
    if (currentJellyseerrUrl && !jellyseerrUrl) {
      setJellyseerrUrl(currentJellyseerrUrl);
    }
  }, [currentJellyseerrUrl]);

  useEffect(() => {
    if (currentJellyseerrApiKey && !jellyseerrApiKey) {
      setJellyseerrApiKey(currentJellyseerrApiKey);
    }
  }, [currentJellyseerrApiKey]);

  // Load monitoring, qBittorrent, GitHub and database settings
  useEffect(() => {
    const loadAdditionalSettings = async () => {
      if (!user || userRole !== "admin") return;
      
      const { data } = await supabase
        .from("server_settings")
        .select("setting_key, setting_value")
        .in("setting_key", [
          "monitoring_url", 
          "qbittorrent_url", 
          "qbittorrent_port",
          "qbittorrent_username", 
          "qbittorrent_password", 
          "github_repo_url", 
          "update_webhook_url",
          "update_webhook_secret",
          "deployment_type",
          "db_host",
          "db_port",
          "db_name",
          "db_user",
          "supabase_url",
          "supabase_project_id",
          "bazarr_url",
          "bazarr_api_key",
          "radarr_url",
          "radarr_api_key",
          "sonarr_url",
          "sonarr_api_key"
        ]);
      
      data?.forEach(setting => {
        if (setting.setting_key === "monitoring_url") setMonitoringUrl(setting.setting_value || "");
        if (setting.setting_key === "qbittorrent_url") setQbittorrentUrl(setting.setting_value || "");
        if (setting.setting_key === "qbittorrent_port") setQbittorrentPort(setting.setting_value || "8080");
        if (setting.setting_key === "qbittorrent_username") setQbittorrentUsername(setting.setting_value || "");
        if (setting.setting_key === "qbittorrent_password") setQbittorrentPassword(setting.setting_value || "");
        if (setting.setting_key === "github_repo_url") setGithubRepoUrl(setting.setting_value || "");
        if (setting.setting_key === "update_webhook_url") setUpdateWebhookUrl(setting.setting_value || "");
        if (setting.setting_key === "update_webhook_secret") setUpdateWebhookSecret(setting.setting_value || "");
        if (setting.setting_key === "deployment_type") setDeploymentType(setting.setting_value || "");
        if (setting.setting_key === "db_host") setDbHost(setting.setting_value || "");
        if (setting.setting_key === "db_port") setDbPort(setting.setting_value || "");
        if (setting.setting_key === "db_name") setDbName(setting.setting_value || "");
        if (setting.setting_key === "db_user") setDbUser(setting.setting_value || "");
        if (setting.setting_key === "supabase_url") setSupabaseUrl(setting.setting_value || "");
        if (setting.setting_key === "supabase_project_id") setSupabaseProjectId(setting.setting_value || "");
        if (setting.setting_key === "bazarr_url") setBazarrUrl(setting.setting_value || "");
        if (setting.setting_key === "bazarr_api_key") setBazarrApiKey(setting.setting_value || "");
        if (setting.setting_key === "radarr_url") setRadarrUrl(setting.setting_value || "");
        if (setting.setting_key === "radarr_api_key") setRadarrApiKey(setting.setting_value || "");
        if (setting.setting_key === "sonarr_url") setSonarrUrl(setting.setting_value || "");
        if (setting.setting_key === "sonarr_api_key") setSonarrApiKey(setting.setting_value || "");
      });
    };
    
    loadAdditionalSettings();
  }, [user, userRole]);

  useEffect(() => {
    if (siteName && !newSiteName) setNewSiteName(siteName);
    if (logoUrl !== undefined && !newLogoUrl) setNewLogoUrl(logoUrl);
    if (headerTitle && !newHeaderTitle) setNewHeaderTitle(headerTitle);
    if (loginBackgroundUrl !== undefined && !newLoginBackgroundUrl) setNewLoginBackgroundUrl(loginBackgroundUrl);
    if (loginTitle && !newLoginTitle) setNewLoginTitle(loginTitle);
    if (loginDescription && !newLoginDescription) setNewLoginDescription(loginDescription);
    setNewLoginTransparency(loginTransparency);
  }, [siteName, logoUrl, headerTitle, loginBackgroundUrl, loginTransparency, loginTitle, loginDescription]);

  useEffect(() => {
    // Wait for both auth and role to finish loading
    if (authLoading || roleLoading) return;
    
    if (!user) {
      navigate("/");
    } else if (userRole && userRole !== "admin") {
      navigate("/browse");
    }
  }, [user, userRole, authLoading, roleLoading, navigate]);

  // Auto-validate Jellyseerr connection when URL or API key changes
  useEffect(() => {
    // Clear existing timer
    if (jellyseerrDebounceTimer.current) {
      clearTimeout(jellyseerrDebounceTimer.current);
    }

    // Only auto-test if both fields have values
    if (jellyseerrUrl.trim() && jellyseerrApiKey.trim()) {
      // Set new timer
      jellyseerrDebounceTimer.current = setTimeout(() => {
        handleTestJellyseerr();
      }, 1500); // 1.5 second debounce
    } else {
      // Clear status if fields are empty
      setJellyseerrStatus(null);
    }

    // Cleanup function
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

  // Site settings handlers
  const handleUpdateSiteName = () => {
    if (newSiteName.trim()) {
      updateSetting({ key: "site_name", value: newSiteName.trim() });
    }
  };

  const handleUpdateLogoUrl = () => {
    updateSetting({ key: "site_logo_url", value: newLogoUrl.trim() });
  };

  const handleUpdateHeaderTitle = () => {
    if (newHeaderTitle.trim()) {
      updateSetting({ key: "site_header_title", value: newHeaderTitle.trim() });
    }
  };

  const handleUpdateLoginBackgroundUrl = () => {
    updateSetting({ key: "login_background_url", value: newLoginBackgroundUrl.trim() });
  };

  // Test Jellyfin connection
  const handleTestConnection = async () => {
    setTestingConnection(true);
    setConnectionStatus(null);
    
    try {
      // Get access token from localStorage
      const jellyfinSession = localStorage.getItem('jellyfin_session');
      const accessToken = jellyfinSession ? JSON.parse(jellyfinSession).AccessToken : null;

      if (!newServerUrl || !apiKey) {
        setConnectionStatus("❌ Server URL og API-nøkkel må være satt");
        setTestingConnection(false);
        return;
      }

      let normalizedUrl = newServerUrl;
      if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
        normalizedUrl = `http://${normalizedUrl}`;
      }

      // Test connection to Jellyfin
      const response = await fetch(`${normalizedUrl.replace(/\/$/, '')}/System/Info`, {
        headers: {
          "X-Emby-Token": apiKey || accessToken || "",
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        setConnectionStatus(`❌ Tilkobling feilet: ${response.status} ${response.statusText}`);
        setTestingConnection(false);
        return;
      }

      const systemInfo = await response.json();
      setConnectionStatus(`✅ Tilkobling vellykket! Server: ${systemInfo.ServerName} (${systemInfo.Version})`);
      toast.success("Jellyfin-tilkobling OK!");
      
    } catch (error) {
      console.error('Connection test error:', error);
      setConnectionStatus(`❌ Kunne ikke koble til serveren: ${error instanceof Error ? error.message : 'Ukjent feil'}`);
      toast.error("Tilkobling feilet");
    } finally {
      setTestingConnection(false);
    }
  };

  // Refresh configuration from Jellyfin
  const handleRefreshConfig = async () => {
    setTestingConnection(true);
    
    try {
      const jellyfinSession = localStorage.getItem('jellyfin_session');
      const accessToken = jellyfinSession ? JSON.parse(jellyfinSession).AccessToken : null;

      if (!newServerUrl || !apiKey) {
        toast.error("Server URL og API-nøkkel må være satt");
        setTestingConnection(false);
        return;
      }

      let normalizedUrl = newServerUrl;
      if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
        normalizedUrl = `http://${normalizedUrl}`;
      }

      // Fetch fresh system info
      const response = await fetch(`${normalizedUrl.replace(/\/$/, '')}/System/Info`, {
        headers: {
          "X-Emby-Token": apiKey || accessToken || "",
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const systemInfo = await response.json();
      
      // Update settings in database
      await updateServerUrl.mutateAsync(normalizedUrl);
      await updateApiKey.mutateAsync(apiKey);
      
      toast.success(`Konfigurasjon oppdatert fra ${systemInfo.ServerName}!`);
      setConnectionStatus(`✅ Konfigurasjon hentet fra: ${systemInfo.ServerName} (${systemInfo.Version})`);
      
      // Invalidate all queries to refresh data
      queryClient.invalidateQueries();
      
    } catch (error) {
      console.error('Refresh config error:', error);
      toast.error("Kunne ikke hente ny konfigurasjon");
      setConnectionStatus(`❌ Feil ved henting: ${error instanceof Error ? error.message : 'Ukjent feil'}`);
    } finally {
      setTestingConnection(false);
    }
  };

  // Test Jellyseerr connection
  const handleTestJellyseerr = async () => {
    if (!jellyseerrUrl.trim() || !jellyseerrApiKey.trim()) {
      setJellyseerrStatus("❌ Jellyseerr URL og API-nøkkel må være satt");
      return;
    }

    // Check for local/private IP addresses before calling edge function
    const localIpPattern = /^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2[0-9]|3[0-1])\.\d{1,3}\.\d{1,3})(:\d+)?/i;
    if (localIpPattern.test(jellyseerrUrl.trim())) {
      setJellyseerrStatus(`❌ Lokal IP-adresse oppdaget: Edge functions kan ikke nå lokale adresser (192.168.x.x, 10.x.x.x, 127.0.0.1, localhost).

Løsninger:
• Bruk en offentlig URL/domene
• Sett opp tunnel (ngrok/Cloudflare Tunnel)
• Kjør appen lokalt for utvikling

Tips: Hvis du har SSL-sertifikat-problemer med din offentlige URL, bruk http:// i stedet for https://`);
      return;
    }

    setTestingJellyseerr(true);
    setJellyseerrStatus(null);

    try {
      const { data, error } = await supabase.functions.invoke('jellyseerr-test', {
        body: { 
          url: jellyseerrUrl.trim(), 
          apiKey: jellyseerrApiKey.trim() 
        }
      });

      if (error) {
        console.error('Jellyseerr test error:', error);
        const errorString = error.message || JSON.stringify(error);
        
        // Check for network/timeout errors
        if (errorString.includes('Connection timed out') || 
            errorString.includes('tcp connect error') ||
            errorString.includes('serveren er utilgjengelig fra skyen')) {
          setJellyseerrStatus(`❌ Nettverksfeil: Edge functions kan ikke nå lokale IP-adresser (192.168.x.x). Bruk en offentlig URL, sett opp en tunnel (ngrok/Cloudflare), eller kjør appen lokalt.`);
        } else {
          setJellyseerrStatus(`❌ Feil: ${error.message}`);
        }
        return;
      }

      if (data?.success) {
        setJellyseerrStatus(`✅ ${data.message}`);
        toast.success("Jellyseerr-tilkobling OK!");
      } else {
        const errorMsg = data?.error || 'Tilkobling feilet';
        const errorDetails = data?.details || '';
        
        // Check for network/timeout errors in response
        if (errorDetails.includes('Connection timed out') || 
            errorDetails.includes('tcp connect error') ||
            errorMsg.includes('serveren er utilgjengelig fra skyen')) {
          setJellyseerrStatus(`❌ Nettverksfeil: Edge functions kan ikke nå lokale IP-adresser (192.168.x.x). Bruk en offentlig URL, sett opp en tunnel (ngrok/Cloudflare), eller kjør appen lokalt.`);
        } else {
          setJellyseerrStatus(`❌ ${errorMsg}`);
        }
      }
    } catch (error) {
      console.error('Jellyseerr test exception:', error);
      setJellyseerrStatus(`❌ Feil: ${error instanceof Error ? error.message : 'Ukjent feil'}`);
    } finally {
      setTestingJellyseerr(false);
    }
  };

  // Update Bazarr URL mutation
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

  // Update Bazarr API key mutation
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

  // Test Bazarr connection (direct call from browser)
  const handleTestBazarr = async () => {
    if (!bazarrUrl.trim() || !bazarrApiKey.trim()) {
      setBazarrStatus("❌ Bazarr URL og API-nøkkel må være satt");
      return;
    }

    setTestingBazarr(true);
    setBazarrStatus(null);

    try {
      // Save settings first
      await updateBazarrUrl.mutateAsync(bazarrUrl.trim());
      await updateBazarrApiKey.mutateAsync(bazarrApiKey.trim());
      
      // Test connection directly from browser (works with local IPs)
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
      const version = data?.bazarr_version || data?.data?.bazarr_version;
      setBazarrStatus(`✅ Tilkoblet! Bazarr v${version || 'ukjent'}`);
      toast.success("Bazarr-tilkobling OK!");
    } catch (error) {
      console.error('Bazarr test exception:', error);
      if (error instanceof Error && error.name === 'AbortError') {
        setBazarrStatus("❌ Timeout: Bazarr svarer ikke");
      } else {
        setBazarrStatus(`❌ Feil: ${error instanceof Error ? error.message : 'Ukjent feil'}`);
      }
    } finally {
      setTestingBazarr(false);
    }
  };

  // Radarr URL mutation
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

  // Radarr API key mutation
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

  // Test Radarr connection (direct call from browser)
  const handleTestRadarr = async () => {
    if (!radarrUrl.trim() || !radarrApiKey.trim()) {
      setRadarrStatus("❌ Radarr URL og API-nøkkel må være satt");
      return;
    }

    setTestingRadarr(true);
    setRadarrStatus(null);

    try {
      // Save settings first
      await updateRadarrUrl.mutateAsync(radarrUrl.trim());
      await updateRadarrApiKey.mutateAsync(radarrApiKey.trim());
      
      // Test connection directly from browser
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
      console.error('Radarr test exception:', error);
      if (error instanceof Error && error.name === 'AbortError') {
        setRadarrStatus("❌ Timeout: Radarr svarer ikke");
      } else {
        setRadarrStatus(`❌ Feil: ${error instanceof Error ? error.message : 'Ukjent feil'}`);
      }
    } finally {
      setTestingRadarr(false);
    }
  };

  // Sonarr URL mutation
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

  // Sonarr API key mutation
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

  // Test Sonarr connection (direct call from browser)
  const handleTestSonarr = async () => {
    if (!sonarrUrl.trim() || !sonarrApiKey.trim()) {
      setSonarrStatus("❌ Sonarr URL og API-nøkkel må være satt");
      return;
    }

    setTestingSonarr(true);
    setSonarrStatus(null);

    try {
      // Save settings first
      await updateSonarrUrl.mutateAsync(sonarrUrl.trim());
      await updateSonarrApiKey.mutateAsync(sonarrApiKey.trim());
      
      // Test connection directly from browser
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
      console.error('Sonarr test exception:', error);
      if (error instanceof Error && error.name === 'AbortError') {
        setSonarrStatus("❌ Timeout: Sonarr svarer ikke");
      } else {
        setSonarrStatus(`❌ Feil: ${error instanceof Error ? error.message : 'Ukjent feil'}`);
      }
    } finally {
      setTestingSonarr(false);
    }
  };

  const { data: newsPosts } = useQuery({
    queryKey: ["admin-news-posts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("news_posts")
        .select("*")
        .order("pinned", { ascending: false })
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!user && userRole === "admin",
  });

  // Create news post mutation
  const createNewsPost = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not authenticated");
      
      const { error } = await supabase
        .from("news_posts")
        .insert({
          title: newPostTitle.trim(),
          content: newPostContent.trim(),
          created_by: user.id,
          published: true,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-news-posts"] });
      queryClient.invalidateQueries({ queryKey: ["news-posts"] });
      setNewPostTitle("");
      setNewPostContent("");
      toast.success("Nyhet publisert!");
    },
    onError: () => {
      toast.error("Kunne ikke publisere nyhet");
    },
  });

  // Delete news post mutation
  const deleteNewsPost = useMutation({
    mutationFn: async (postId: string) => {
      const { error } = await supabase
        .from("news_posts")
        .delete()
        .eq("id", postId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-news-posts"] });
      queryClient.invalidateQueries({ queryKey: ["news-posts"] });
      toast.success("Nyhet slettet");
    },
    onError: () => {
      toast.error("Kunne ikke slette nyhet");
    },
  });

  // Toggle pin mutation
  const togglePin = useMutation({
    mutationFn: async ({ postId, currentPinned }: { postId: string; currentPinned: boolean }) => {
      const { error } = await supabase
        .from("news_posts")
        .update({ pinned: !currentPinned })
        .eq("id", postId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-news-posts"] });
      queryClient.invalidateQueries({ queryKey: ["news-posts"] });
      toast.success("Nyhet oppdatert");
    },
    onError: () => {
      toast.error("Kunne ikke oppdatere nyhet");
    },
  });

  // Update news post mutation
  const updateNewsPost = useMutation({
    mutationFn: async ({ postId, title, content }: { postId: string; title: string; content: string }) => {
      const { error } = await supabase
        .from("news_posts")
        .update({ title, content, updated_at: new Date().toISOString() })
        .eq("id", postId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-news-posts"] });
      queryClient.invalidateQueries({ queryKey: ["news-posts"] });
      setEditingPost(null);
      setEditPostTitle("");
      setEditPostContent("");
      toast.success("Nyhet oppdatert!");
    },
    onError: () => {
      toast.error("Kunne ikke oppdatere nyhet");
    },
  });

  // Start editing a post
  const startEditingPost = (post: { id: string; title: string; content: string }) => {
    setEditingPost(post.id);
    setEditPostTitle(post.title);
    setEditPostContent(post.content);
  };

  // Cancel editing
  const cancelEditing = () => {
    setEditingPost(null);
    setEditPostTitle("");
    setEditPostContent("");
  };

  // Save edited post
  const saveEditedPost = () => {
    if (editingPost && editPostTitle.trim() && editPostContent.trim()) {
      updateNewsPost.mutate({
        postId: editingPost,
        title: editPostTitle.trim(),
        content: editPostContent.trim(),
      });
    }
  };

  const handleCreatePost = () => {
    if (newPostTitle.trim() && newPostContent.trim()) {
      createNewsPost.mutate();
    }
  };

  if (authLoading || roleLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-12">
          <p className="text-center text-muted-foreground">{common.loading || "Loading..."}</p>
        </div>
      </div>
    );
  }

  const adminTabs = [
    { value: "health", label: "Health", icon: Activity },
    { value: "system-status", label: language === 'no' ? "System Status" : "System Status", icon: Server },
    { value: "media", label: "Media", icon: Library },
    { value: "radarr", label: "Radarr", icon: Film },
    { value: "sonarr", label: "Sonarr", icon: Tv },
    { value: "bazarr", label: "Bazarr", icon: Subtitles },
    { value: "compatibility", label: language === 'no' ? "Kompatibilitet" : "Compatibility", icon: AlertTriangle },
    { value: "duplicates", label: language === 'no' ? "Duplikater" : "Duplicates", icon: Copy },
    { value: "reports", label: language === 'no' ? "Rapporter" : "Reports", icon: MessageSquare },
    { value: "servers", label: admin.servers || "Servers", icon: Server },
    { value: "database", label: admin.database || "Database", icon: Database },
    { value: "site", label: language === 'no' ? 'Side' : 'Site', icon: Settings },
    { value: "monitoring", label: language === 'no' ? 'Status' : 'Status', icon: Activity },
    { value: "sync", label: language === 'no' ? 'Synkronisering' : 'Sync', icon: RefreshCw },
    { value: "qbittorrent", label: "qBittorrent", icon: Download },
    { value: "users", label: admin.users || "Users", icon: Settings },
    { value: "news", label: language === 'no' ? 'Nyheter' : 'News', icon: Newspaper },
    
    { value: "logs", label: admin.logs || "Logs", icon: FileText },
    { value: "updates", label: language === 'no' ? "Oppdateringer" : "Updates", icon: Download },
    { value: "db-setup", label: language === 'no' ? "DB Oppsett" : "DB Setup", icon: BookOpen },
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-primary/10">
              <Settings className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">{admin.title || "Admin Panel"}</h1>
              <p className="text-muted-foreground">{admin.serverSettings || "Manage server connections and content"}</p>
            </div>
          </div>
          <Button 
            onClick={() => navigate("/requests-admin")}
            variant="outline"
            className="gap-2"
          >
            <Newspaper className="h-4 w-4" />
            {admin.requests || "Requests"}
          </Button>
        </div>

        <Tabs defaultValue="health" className="w-full" orientation="vertical">
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Sidebar Navigation */}
            <div className="lg:w-56 flex-shrink-0">
              <TabsList className="flex lg:flex-col h-auto w-full overflow-x-auto lg:overflow-visible gap-1 bg-secondary/30 p-2 rounded-lg">
                {adminTabs.map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <TabsTrigger 
                      key={tab.value}
                      value={tab.value} 
                      className="w-full justify-start gap-2 px-3 py-2 text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                    >
                      <Icon className="h-4 w-4 flex-shrink-0" />
                      <span className="truncate">{tab.label}</span>
                    </TabsTrigger>
                  );
                })}
              </TabsList>
            </div>

            {/* Content Area */}
            <div className="flex-1 min-w-0">
              <TabsContent value="health" className="space-y-6 mt-0">
                <AppServicesHealth />
                <HealthCheckDashboard />
              </TabsContent>

              <TabsContent value="system-status" className="space-y-6 mt-0">
                <SystemStatusDashboard />
              </TabsContent>

              <TabsContent value="media" className="space-y-6 mt-0">
                <MediaLibraryOverview />
              </TabsContent>

              <TabsContent value="radarr" className="space-y-6 mt-0">
                <RadarrDashboard />
              </TabsContent>

              <TabsContent value="sonarr" className="space-y-6 mt-0">
                <SonarrDashboard />
              </TabsContent>

              <TabsContent value="bazarr" className="space-y-6 mt-0">
                <BazarrDashboard />
              </TabsContent>

              <TabsContent value="servers" className="space-y-6 mt-0">
                <ServerSettingsSection userRole={userRole} />
              </TabsContent>

              <TabsContent value="database" className="space-y-6 mt-0">
              <Card className="border-border/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Database className="h-5 w-5" />
                    {admin.databaseConfiguration || "Database Configuration"}
                  </CardTitle>
                  <CardDescription>
                    {admin.databaseDescription || "View and manage database settings. These are configured during installation."}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                    <p className="text-sm text-blue-400">
                      <strong>ℹ️ {common.note || "Note"}:</strong> {language === 'no' 
                        ? 'Database-innstillinger kan ikke endres direkte i Admin-panelet. For å endre deployment-type eller database-konfigurasjon, må du kjøre setup-wizarden på nytt.'
                        : 'Database settings cannot be changed directly in the Admin panel. To change deployment type or database configuration, you must run the setup wizard again.'}
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>{admin.deploymentType || "Deployment Type"}</Label>
                      <div className="p-3 rounded-lg bg-secondary/30 border border-border/50">
                        <p className="font-mono text-sm">
                          {deploymentType ? (
                            deploymentType === "cloud" ? (
                              <span className="text-primary">☁️ {admin.lovableCloud || "Lovable Cloud"}</span>
                            ) : (
                              <span className="text-green-400">🐳 {language === 'no' ? 'Lokal PostgreSQL (Docker)' : 'Local PostgreSQL (Docker)'}</span>
                            )
                          ) : (
                            <span className="text-muted-foreground">{language === 'no' ? 'Ikke konfigurert' : 'Not configured'}</span>
                          )}
                        </p>
                      </div>
                    </div>

                    {deploymentType === "cloud" && (
                      <>
                        <div className="space-y-2">
                          <Label>{admin.supabaseUrl || "Supabase Project URL"}</Label>
                          <div className="p-3 rounded-lg bg-secondary/30 border border-border/50">
                            <p className="font-mono text-sm break-all">
                              {supabaseUrl || <span className="text-muted-foreground">{admin.notSet || "Not set"}</span>}
                            </p>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label>{admin.supabaseProjectId || "Supabase Project ID"}</Label>
                          <div className="p-3 rounded-lg bg-secondary/30 border border-border/50">
                            <p className="font-mono text-sm">
                              {supabaseProjectId || <span className="text-muted-foreground">{admin.notSet || "Not set"}</span>}
                            </p>
                          </div>
                        </div>
                      </>
                    )}

                    {deploymentType === "local" && (
                      <>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>{admin.dbHost || "Database Host"}</Label>
                            <div className="p-3 rounded-lg bg-secondary/30 border border-border/50">
                              <p className="font-mono text-sm">
                                {dbHost || <span className="text-muted-foreground">{admin.notSet || "Not set"}</span>}
                              </p>
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label>{admin.dbPort || "Port"}</Label>
                            <div className="p-3 rounded-lg bg-secondary/30 border border-border/50">
                              <p className="font-mono text-sm">
                                {dbPort || <span className="text-muted-foreground">{admin.notSet || "Not set"}</span>}
                              </p>
                            </div>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label>{admin.dbName || "Database Name"}</Label>
                          <div className="p-3 rounded-lg bg-secondary/30 border border-border/50">
                            <p className="font-mono text-sm">
                              {dbName || <span className="text-muted-foreground">{admin.notSet || "Not set"}</span>}
                            </p>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label>{language === 'no' ? 'Brukernavn' : 'Username'}</Label>
                          <div className="p-3 rounded-lg bg-secondary/30 border border-border/50">
                            <p className="font-mono text-sm">
                              {dbUser || <span className="text-muted-foreground">{admin.notSet || "Not set"}</span>}
                            </p>
                          </div>
                        </div>
                        <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                          <p className="text-sm text-yellow-400">
                            <strong>{admin.securityWarning || "⚠️ Security: Database password is not displayed for security reasons."}</strong>
                          </p>
                        </div>
                      </>
                    )}

                    {!deploymentType && (
                      <div className="p-4 bg-orange-500/10 border border-orange-500/20 rounded-lg text-center">
                        <p className="text-sm text-orange-400 mb-3">
                          {admin.databaseNotConfigured || "Database is not configured via setup wizard."}
                        </p>
                        <Button 
                          onClick={() => navigate("/setup-wizard")}
                          variant="outline"
                          className="gap-2"
                        >
                          <HardDrive className="h-4 w-4" />
                          {admin.startSetupWizard || "Start setup wizard"}
                        </Button>
                      </div>
                    )}
                  </div>

                  <div className="p-4 bg-secondary/30 rounded-lg">
                    <h3 className="font-semibold mb-2 text-sm flex items-center gap-2">
                      <HardDrive className="h-4 w-4" />
                      {admin.troubleshooting || "Troubleshooting"}
                    </h3>
                    <ul className="text-xs text-muted-foreground space-y-2">
                      <li>• {language === 'no' 
                        ? 'For Supabase Cloud: Sjekk at URL og API-keys er riktige i .env filen' 
                        : 'For Supabase Cloud: Check that URL and API keys are correct in the .env file'}</li>
                      <li>• {language === 'no' 
                        ? 'For lokal PostgreSQL: Test forbindelse med:' 
                        : 'For local PostgreSQL: Test connection with:'} <code className="px-1 py-0.5 bg-secondary rounded">docker ps</code></li>
                      <li>• {language === 'no' 
                        ? 'Sjekk database-logs:' 
                        : 'Check database logs:'} <code className="px-1 py-0.5 bg-secondary rounded">docker logs jelly-stream-db</code></li>
                      <li>• {language === 'no' 
                        ? 'Se DEPLOYMENT_LOCAL.md for fullstendig feilsøkingsguide' 
                        : 'See DEPLOYMENT_LOCAL.md for complete troubleshooting guide'}</li>
                    </ul>
                  </div>
                </CardContent>
              </Card>
              </TabsContent>

              <TabsContent value="site" className="space-y-6 mt-0">
                <SiteSettingsSection />
              </TabsContent>

              <TabsContent value="monitoring" className="space-y-6 mt-0">
              <Card className="border-border/50">
                <CardHeader>
                  <CardTitle>{admin.serverMonitoring || "Server Monitoring"}</CardTitle>
                  <CardDescription>
                    {admin.monitoringDescription || "Configure monitoring URL to display server statistics (CPU, RAM, disk, network)"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="monitoring-url">{admin.monitoringUrlLabel || "Monitoring URL (Netdata API)"}</Label>
                    <Input
                      id="monitoring-url"
                      type="url"
                      placeholder="http://localhost:19999"
                      value={monitoringUrl}
                      onChange={(e) => setMonitoringUrl(e.target.value)}
                      className="bg-secondary/50 border-border/50"
                    />
                    <p className="text-xs text-muted-foreground">
                      {admin.monitoringInstructions || "Install Netdata on your server for live statistics. Default port is 19999."}
                    </p>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Button 
                      onClick={async () => {
                        const { error } = await supabase
                          .from("server_settings")
                          .upsert({ 
                            setting_key: "monitoring_url", 
                            setting_value: monitoringUrl 
                          }, { 
                            onConflict: 'setting_key' 
                          });
                        
                        if (error) {
                          console.error('Monitoring URL update error:', error);
                          toast.error(`${admin.couldNotUpdateMonitoring || "Could not update monitoring URL"}: ${error.message}`);
                        } else {
                          toast.success(admin.monitoringUpdated || "Monitoring URL updated!");
                        }
                      }}
                      className="cinema-glow"
                    >
                      {admin.saveMonitoringUrl || "Save Monitoring URL"}
                    </Button>
                    <Button 
                      variant="outline"
                      onClick={async () => {
                        toast.dismiss();
                        
                        // Check if we're on a local network - if not, show instructions
                        const isLocalNetwork = () => {
                          const hostname = window.location.hostname;
                          return (
                            hostname === 'localhost' ||
                            hostname === '127.0.0.1' ||
                            hostname.startsWith('192.168.') ||
                            hostname.startsWith('10.') ||
                            hostname.startsWith('172.') ||
                            hostname.endsWith('.local')
                          );
                        };

                        if (!isLocalNetwork()) {
                          toast.error(
                            "Setup Netdata kan kun kjøres fra lokal nettverkstilgang. Åpne appen fra din lokale server (f.eks. http://192.168.x.x:5173) og prøv igjen.",
                            { duration: 10000 }
                          );
                          return;
                        }

                        const toastId = toast.loading("Setter opp Netdata...");
                        try {
                          console.log("[SetupNetdata] Fetching server settings...");
                          const { data: settings, error: settingsError } = await supabase
                            .from("server_settings")
                            .select("setting_key, setting_value")
                            .in("setting_key", ["git_pull_server_url", "update_webhook_url"]);

                          console.log("[SetupNetdata] Settings result:", settings, settingsError);

                          if (settingsError) throw settingsError;

                          const settingsMap = new Map(
                            (settings || []).map((row: any) => [row.setting_key, row.setting_value])
                          );

                          const gitPullUrl =
                            settingsMap.get("git_pull_server_url") || settingsMap.get("update_webhook_url");

                          console.log("[SetupNetdata] Git Pull URL found:", gitPullUrl);

                          if (!gitPullUrl) {
                            throw new Error(
                              "Git Pull Server URL er ikke konfigurert. Gå til Oppdatering-fanen og sett 'Update webhook URL'."
                            );
                          }

                          let baseUrl = String(gitPullUrl).replace(/\/$/, "");
                          if (baseUrl.endsWith("/git-pull")) {
                            baseUrl = baseUrl.slice(0, -"/git-pull".length);
                          }

                          const setupUrl = `${baseUrl}/setup-netdata`;
                          console.log("[SetupNetdata] Calling:", setupUrl);

                          const response = await fetch(setupUrl, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            mode: "cors",
                          });

                          console.log("[SetupNetdata] Response status:", response.status);

                          if (!response.ok) {
                            throw new Error(`Kunne ikke starte Netdata installasjon (HTTP ${response.status})`);
                          }

                          const result = await response.json().catch(() => ({} as any));
                          console.log("[SetupNetdata] Result:", result);

                          toast.dismiss(toastId);
                          if (result?.success) {
                            toast.success(
                              result.alreadyInstalled
                                ? "Netdata er allerede installert."
                                : "Netdata installasjon startet. Vent noen minutter.",
                              { duration: 5000 }
                            );

                            // Auto-set the URL
                            setMonitoringUrl("http://localhost:19999");
                            await supabase
                              .from("server_settings")
                              .upsert(
                                {
                                  setting_key: "monitoring_url",
                                  setting_value: "http://localhost:19999",
                                },
                                {
                                  onConflict: "setting_key",
                                }
                              );
                          } else {
                            toast.error(result?.message || "Kunne ikke sette opp Netdata", { duration: 5000 });
                          }
                        } catch (err: any) {
                          console.error("[SetupNetdata] Error:", err);
                          toast.dismiss(toastId);
                          toast.error(err?.message || "Kunne ikke sette opp Netdata", { duration: 8000 });
                        }
                      }}
                      className="gap-2"
                    >
                      <Server className="h-4 w-4" />
                      Setup Netdata
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <ServerMonitoring monitoringUrl={monitoringUrl} />
              </TabsContent>

              <TabsContent value="sync" className="space-y-6 mt-0">
                <SyncScheduleManager />
              </TabsContent>

              <TabsContent value="qbittorrent" className="space-y-6 mt-0">
              <Card className="border-border/50">
                <CardHeader>
                  <CardTitle>{admin.qbittorrentIntegration || "qBittorrent Integration"}</CardTitle>
                  <CardDescription>
                    {admin.qbittorrentDescription || "Configure qBittorrent Web UI to display download status"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="qbittorrent-url">{admin.qbittorrentUrlLabel || "qBittorrent Host/IP"}</Label>
                    <Input
                      id="qbittorrent-url"
                      type="text"
                      placeholder="http://localhost eller http://192.168.1.100"
                      value={qbittorrentUrl}
                      onChange={(e) => setQbittorrentUrl(e.target.value)}
                      className="bg-secondary/50 border-border/50"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="qbittorrent-port">{admin.qbittorrentPortLabel || "Port"}</Label>
                    <Input
                      id="qbittorrent-port"
                      type="number"
                      placeholder="8080"
                      value={qbittorrentPort}
                      onChange={(e) => setQbittorrentPort(e.target.value)}
                      className="bg-secondary/50 border-border/50"
                    />
                    <p className="text-sm text-muted-foreground">
                      {admin.qbittorrentPortHint || "For Docker: ofte 30000-30100 range (f.eks. 30024)"}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="qbittorrent-username">{admin.qbittorrentUsername || "Username"}</Label>
                    <Input
                      id="qbittorrent-username"
                      type="text"
                      placeholder="admin"
                      value={qbittorrentUsername}
                      onChange={(e) => setQbittorrentUsername(e.target.value)}
                      className="bg-secondary/50 border-border/50"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="qbittorrent-password">{admin.qbittorrentPassword || "Password"}</Label>
                    <Input
                      id="qbittorrent-password"
                      type="password"
                      placeholder="••••••••"
                      value={qbittorrentPassword}
                      onChange={(e) => setQbittorrentPassword(e.target.value)}
                      className="bg-secondary/50 border-border/50"
                    />
                  </div>
                  <Button 
                    onClick={async () => {
                      const updates = [
                        { setting_key: "qbittorrent_url", setting_value: qbittorrentUrl },
                        { setting_key: "qbittorrent_port", setting_value: qbittorrentPort },
                        { setting_key: "qbittorrent_username", setting_value: qbittorrentUsername },
                        { setting_key: "qbittorrent_password", setting_value: qbittorrentPassword },
                      ];
                      
                      console.log('Updating qBittorrent settings:', updates);
                      
                      const { error } = await supabase
                        .from("server_settings")
                        .upsert(updates, { onConflict: 'setting_key' });
                      
                      if (error) {
                        console.error('qBittorrent settings update error:', error);
                        toast.error(`${admin.couldNotUpdateQbittorrent || "Could not update qBittorrent settings"}: ${error.message}`);
                      } else {
                        toast.success(admin.qbittorrentUpdated || "qBittorrent settings updated!");
                      }
                    }}
                    className="cinema-glow"
                  >
                    {admin.saveQbittorrentSettings || "Save qBittorrent Settings"}
                  </Button>
                </CardContent>
              </Card>

              <QBittorrentStatus qbUrl={qbittorrentUrl && qbittorrentPort ? `${qbittorrentUrl}:${qbittorrentPort}` : ""} />
              </TabsContent>

              <TabsContent value="news" className="space-y-6 mt-0">
                <NewsManagementSection userRole={userRole} />
              </TabsContent>

              <TabsContent value="users" className="space-y-6 mt-0">
                <UserAccessManagement userRole={userRole} />
                <UserManagement />
              </TabsContent>

              <TabsContent value="compatibility" className="space-y-6 mt-0">
                <MediaCompatibilityManager />
                <TranscodeJobsDashboard />
              </TabsContent>

              <TabsContent value="duplicates" className="space-y-6 mt-0">
                <DuplicateReportsManager />
                <DownloadsPendingManager />
                <BufferingDiagnostics />
                <DuplicateMediaManager />
              </TabsContent>

              <TabsContent value="reports" className="space-y-6 mt-0">
                <MediaReportsManager />
              </TabsContent>

              <TabsContent value="logs" className="space-y-6 mt-0">
                <SystemLogs />
              </TabsContent>

              <TabsContent value="updates" className="space-y-6 mt-0">
                <UpdateManager />
              </TabsContent>

              <TabsContent value="db-setup" className="space-y-6 mt-0">
                <DatabaseSetupGuide />
              </TabsContent>
            </div>
          </div>
        </Tabs>
      </div>
    </div>
  );
};

export default Admin;
