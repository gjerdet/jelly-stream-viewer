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
import { Settings, Newspaper, Trash2, Pin, Loader2, Server, Download, Database, HardDrive, Activity, FileText, Library, Subtitles } from "lucide-react";
import { VersionManager } from "@/components/VersionManager";
import { UpdateManager } from "@/components/UpdateManager";
import { UserManagement } from "@/components/UserManagement";
import { ServerMonitoring } from "@/components/ServerMonitoring";
import { QBittorrentStatus } from "@/components/QBittorrentStatus";
import { HealthCheckDashboard } from "@/components/HealthCheckDashboard";
import { SystemLogs } from "@/components/SystemLogs";
import { MediaLibraryOverview } from "@/components/MediaLibraryOverview";
import { BazarrDashboard } from "@/components/admin/BazarrDashboard";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const Admin = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, loading: authLoading } = useAuth();
  const { data: userRole, isLoading: roleLoading } = useUserRole(user?.id);
  const { serverUrl, updateServerUrl } = useServerSettings();
  const { siteName, logoUrl, headerTitle, loginBackgroundUrl, updateSetting } = useSiteSettings();
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
  
  // News post state
  const [newPostTitle, setNewPostTitle] = useState("");
  const [newPostContent, setNewPostContent] = useState("");
  const [editingPost, setEditingPost] = useState<string | null>(null);
  
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
          "bazarr_api_key"
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
      });
    };
    
    loadAdditionalSettings();
  }, [user, userRole]);

  useEffect(() => {
    if (siteName && !newSiteName) setNewSiteName(siteName);
    if (logoUrl !== undefined && !newLogoUrl) setNewLogoUrl(logoUrl);
    if (headerTitle && !newHeaderTitle) setNewHeaderTitle(headerTitle);
    if (loginBackgroundUrl !== undefined && !newLoginBackgroundUrl) setNewLoginBackgroundUrl(loginBackgroundUrl);
  }, [siteName, logoUrl, headerTitle, loginBackgroundUrl]);

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

  // Test Bazarr connection
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
      
      // Test connection via edge function
      const { data, error } = await supabase.functions.invoke('bazarr-proxy', {
        body: { action: 'status', params: {} }
      });

      if (error) {
        setBazarrStatus(`❌ Feil: ${error.message}`);
        return;
      }

      if (data?.error) {
        setBazarrStatus(`❌ ${data.error}`);
        return;
      }

      const version = data?.bazarr_version || data?.data?.bazarr_version;
      setBazarrStatus(`✅ Tilkoblet! Bazarr v${version || 'ukjent'}`);
      toast.success("Bazarr-tilkobling OK!");
    } catch (error) {
      console.error('Bazarr test exception:', error);
      setBazarrStatus(`❌ Feil: ${error instanceof Error ? error.message : 'Ukjent feil'}`);
    } finally {
      setTestingBazarr(false);
    }
  };

  // News posts query
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

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-full md:max-w-4xl lg:max-w-6xl mx-auto space-y-6 px-2 sm:px-4">
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

          <Tabs defaultValue="health" className="w-full">
            <TabsList className="w-full overflow-x-auto flex md:grid md:grid-cols-12 justify-start">
              <TabsTrigger value="health" className="flex-shrink-0">
                <Activity className="h-4 w-4 md:mr-2" />
                <span className="hidden md:inline">Health</span>
              </TabsTrigger>
              <TabsTrigger value="media" className="flex-shrink-0">
                <Library className="h-4 w-4 md:mr-2" />
                <span className="hidden md:inline">Media</span>
              </TabsTrigger>
              <TabsTrigger value="bazarr" className="flex-shrink-0">
                <Subtitles className="h-4 w-4 md:mr-2" />
                <span className="hidden md:inline">Bazarr</span>
              </TabsTrigger>
              <TabsTrigger value="servers" className="flex-shrink-0">{admin.servers || "Servers"}</TabsTrigger>
              <TabsTrigger value="database" className="flex-shrink-0">{admin.database || "Database"}</TabsTrigger>
              <TabsTrigger value="site" className="flex-shrink-0">{language === 'no' ? 'Side' : 'Site'}</TabsTrigger>
              <TabsTrigger value="monitoring" className="flex-shrink-0">
                <Server className="h-4 w-4 md:mr-2" />
                <span className="hidden md:inline">{language === 'no' ? 'Status' : 'Status'}</span>
              </TabsTrigger>
              <TabsTrigger value="qbittorrent" className="flex-shrink-0">
                <Download className="h-4 w-4 md:mr-2" />
                <span className="hidden md:inline">qBittorrent</span>
              </TabsTrigger>
              <TabsTrigger value="users" className="flex-shrink-0">{admin.users || "Users"}</TabsTrigger>
              <TabsTrigger value="news" className="flex-shrink-0">{language === 'no' ? 'Nyheter' : 'News'}</TabsTrigger>
              <TabsTrigger value="versions" className="flex-shrink-0">{admin.versions || "Versions"}</TabsTrigger>
              <TabsTrigger value="logs" className="flex-shrink-0">
                <FileText className="h-4 w-4 md:mr-2" />
                <span className="hidden md:inline">{admin.logs || "Logs"}</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="health" className="space-y-6">
              <HealthCheckDashboard />
            </TabsContent>

            <TabsContent value="media" className="space-y-6">
              <MediaLibraryOverview />
            </TabsContent>

            <TabsContent value="bazarr" className="space-y-6">
              <BazarrDashboard />
            </TabsContent>

            <TabsContent value="servers" className="space-y-6">
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
                    {admin.githubDescription || "Configure GitHub repository for automatic updates. If you are not using GitHub, you can skip this."}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="github-repo-url">{admin.githubRepoUrl || "GitHub Repository URL"}</Label>
                    <Input
                      id="github-repo-url"
                      type="url"
                      placeholder="https://github.com/brukernavn/repo-navn"
                      value={githubRepoUrl}
                      onChange={(e) => setGithubRepoUrl(e.target.value)}
                      className="bg-secondary/50 border-border/50"
                    />
                    <p className="text-xs text-muted-foreground">
                      {admin.githubRepoDescription || "Used to check for updates from GitHub"}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="update-webhook-url">{admin.webhookUrlOptional || "Update Webhook URL (Optional)"}</Label>
                    <Input
                      id="update-webhook-url"
                      type="url"
                      placeholder="https://jellyfin.gjerdet.casa/webhook/update"
                      value={updateWebhookUrl}
                      onChange={(e) => setUpdateWebhookUrl(e.target.value)}
                      className="bg-secondary/50 border-border/50"
                    />
                    <p className="text-xs text-muted-foreground">
                      {admin.webhookDescription || "Webhook URL to your server to install updates"}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="update-webhook-secret">{admin.webhookSecretOptional || "Webhook Secret (Optional)"}</Label>
                    <Input
                      id="update-webhook-secret"
                      type="password"
                      placeholder="Generate using: openssl rand -hex 32"
                      value={updateWebhookSecret}
                      onChange={(e) => setUpdateWebhookSecret(e.target.value)}
                      className="bg-secondary/50 border-border/50"
                    />
                    <p className="text-xs text-muted-foreground">
                      {admin.webhookSecretDescription || "Secret key for authenticating webhook requests"}
                    </p>
                  </div>
                  <Button 
                    onClick={() => updateGithubSettings.mutate({ repoUrl: githubRepoUrl, webhookUrl: updateWebhookUrl, webhookSecret: updateWebhookSecret })}
                    disabled={updateGithubSettings.isPending || !githubRepoUrl}
                    className="cinema-glow"
                  >
                    {updateGithubSettings.isPending ? (admin.saving || "Saving...") : (admin.saveGithubSettings || "Save GitHub Settings")}
                  </Button>
                  <div className="mt-4 p-4 bg-muted/30 rounded-lg text-sm space-y-2">
                    <p className="font-medium">📖 {admin.webhookSetupGuide || "Setup Guide"}:</p>
                    <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                      <li>Start webhook server på serveren: <code className="bg-background px-1 rounded">node server/update-webhook.js</code></li>
                      <li>Sett webhook URL til server endpoint (f.eks. https://dittdomene.com/webhook/update)</li>
                      <li>Generer secret: <code className="bg-background px-1 rounded">openssl rand -hex 32</code></li>
                      <li>Se <code className="bg-background px-1 rounded">docs/UPDATE_SETUP.md</code> for detaljert oppsett</li>
                    </ol>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border/50">
                <CardHeader>
                  <CardTitle>{admin.jellyseerrServer || "Jellyseerr Server"}</CardTitle>
                  <CardDescription>
                    {admin.jellyseerrDescription || "Configure Jellyseerr to request content."}
                    <span className="block mt-2 text-yellow-500/80">
                      {admin.jellyseerrWarning || "⚠️ Note: Edge functions run in the cloud and cannot reach local IP addresses (192.168.x.x). Use a public URL or set up a tunnel (ngrok/Cloudflare)."}
                    </span>
                    <span className="block mt-2 text-blue-500/80">
                      {admin.jellyseerrTip || "💡 Tip: If you get SSL certificate errors, use http:// instead of https:// (e.g. http://jellyseerr.yourdomain.com)"}
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
                        placeholder="http://jellyseerr.dittdomene.com"
                        value={jellyseerrUrl}
                        onChange={(e) => setJellyseerrUrl(e.target.value)}
                        className="bg-secondary/50 border-border/50 flex-1"
                      />
                      {jellyseerrUrl.startsWith('https://') && (
                        <Button 
                          onClick={() => setJellyseerrUrl(jellyseerrUrl.replace('https://', 'http://'))}
                          variant="outline"
                          size="sm"
                          className="shrink-0"
                          title={admin.switchToHttpTitle || "Switch to HTTP to avoid SSL issues"}
                        >
                          {admin.switchToHttp || "→ HTTP"}
                        </Button>
                      )}
                    </div>
                    {currentJellyseerrUrl && currentJellyseerrUrl !== jellyseerrUrl && (
                      <p className="text-xs text-yellow-500/80">
                        {admin.savedUrl || "⚠️ Saved URL:"} {currentJellyseerrUrl} {admin.differentFromTyped || "(different from what you typed)"}
                      </p>
                    )}
                  </div>
                  <Button 
                    onClick={handleUpdateJellyseerrUrl}
                    disabled={updateJellyseerrUrl.isPending || !jellyseerrUrl || jellyseerrUrl === currentJellyseerrUrl}
                    className="cinema-glow"
                  >
                    {updateJellyseerrUrl.isPending ? (admin.updating || "Updating...") : (admin.updateUrl || "Update URL")}
                  </Button>
                </CardContent>
              </Card>

              <Card className="border-border/50">
                <CardHeader>
                  <CardTitle>{admin.jellyseerrApiKey || "Jellyseerr API Key"}</CardTitle>
                  <CardDescription>
                    {admin.jellyseerrApiDescription || "Configure the API key for Jellyseerr (find it in Settings → General)"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="jellyseerr-api-key">{admin.apiKey || "API Key"}</Label>
                    <Input
                      id="jellyseerr-api-key"
                      type="password"
                      placeholder={admin.enterJellyseerrApiKey || "Enter Jellyseerr API key"}
                      value={jellyseerrApiKey}
                      onChange={(e) => setJellyseerrApiKey(e.target.value)}
                      className="bg-secondary/50 border-border/50"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      onClick={handleUpdateJellyseerrApiKey}
                      disabled={updateJellyseerrApiKey.isPending}
                      className="cinema-glow flex-1"
                    >
                      {updateJellyseerrApiKey.isPending ? (admin.updating || "Updating...") : (admin.updateJellyseerrApiKey || "Update API Key")}
                    </Button>
                    <Button 
                      onClick={handleTestJellyseerr}
                      disabled={testingJellyseerr}
                      variant="outline"
                      className="flex-1"
                    >
                      {testingJellyseerr ? (admin.testing || "Testing...") : (admin.testConnection || "Test Connection")}
                    </Button>
                  </div>
                  
                  {testingJellyseerr && (
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 border border-border/50">
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                      <span className="text-sm text-muted-foreground">{language === 'no' ? 'Tester tilkobling...' : 'Testing connection...'}</span>
                    </div>
                  )}
                  
                  {!testingJellyseerr && jellyseerrStatus && (
                    <div className={`p-3 rounded-lg text-sm ${
                      jellyseerrStatus.startsWith('✅') 
                        ? 'bg-green-500/10 text-green-400 border border-green-500/20' 
                        : 'bg-red-500/10 text-red-400 border border-red-500/20'
                    }`}>
                      <div className="whitespace-pre-wrap">{jellyseerrStatus}</div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="border-border/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Subtitles className="h-5 w-5" />
                    Bazarr
                  </CardTitle>
                  <CardDescription>
                    {language === 'no' 
                      ? 'Konfigurer Bazarr for automatisk undertekstbehandling' 
                      : 'Configure Bazarr for automatic subtitle management'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="bazarr-url">{language === 'no' ? 'Bazarr Server URL' : 'Bazarr Server URL'}</Label>
                    <Input
                      id="bazarr-url"
                      type="url"
                      placeholder="http://192.168.1.100:6767"
                      value={bazarrUrl}
                      onChange={(e) => setBazarrUrl(e.target.value)}
                      className="bg-secondary/50 border-border/50"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="bazarr-api-key">{language === 'no' ? 'Bazarr API-nøkkel' : 'Bazarr API Key'}</Label>
                    <Input
                      id="bazarr-api-key"
                      type="password"
                      placeholder={language === 'no' ? 'Finn i Bazarr → Settings → General' : 'Find in Bazarr → Settings → General'}
                      value={bazarrApiKey}
                      onChange={(e) => setBazarrApiKey(e.target.value)}
                      className="bg-secondary/50 border-border/50"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      onClick={() => {
                        if (bazarrUrl.trim()) updateBazarrUrl.mutate(bazarrUrl.trim());
                        if (bazarrApiKey.trim()) updateBazarrApiKey.mutate(bazarrApiKey.trim());
                      }}
                      disabled={updateBazarrUrl.isPending || updateBazarrApiKey.isPending}
                      className="cinema-glow flex-1"
                    >
                      {(updateBazarrUrl.isPending || updateBazarrApiKey.isPending) 
                        ? (admin.updating || "Updating...") 
                        : (language === 'no' ? 'Lagre innstillinger' : 'Save Settings')}
                    </Button>
                    <Button 
                      onClick={handleTestBazarr}
                      disabled={testingBazarr}
                      variant="outline"
                      className="flex-1"
                    >
                      {testingBazarr ? (admin.testing || "Testing...") : (admin.testConnection || "Test Connection")}
                    </Button>
                  </div>
                  
                  {testingBazarr && (
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 border border-border/50">
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                      <span className="text-sm text-muted-foreground">{language === 'no' ? 'Tester tilkobling...' : 'Testing connection...'}</span>
                    </div>
                  )}
                  
                  {!testingBazarr && bazarrStatus && (
                    <div className={`p-3 rounded-lg text-sm ${
                      bazarrStatus.startsWith('✅') 
                        ? 'bg-green-500/10 text-green-400 border border-green-500/20' 
                        : 'bg-red-500/10 text-red-400 border border-red-500/20'
                    }`}>
                      <div className="whitespace-pre-wrap">{bazarrStatus}</div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="database" className="space-y-6">
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

            <TabsContent value="site" className="space-y-6">
              <Card className="border-border/50">
                <CardHeader>
                  <CardTitle>{admin.siteNameTitle || "Site Name"}</CardTitle>
                  <CardDescription>
                    {admin.siteNameDescription || "Change the name of the website"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="site-name">{admin.siteName || "Site Name"}</Label>
                    <Input
                      id="site-name"
                      type="text"
                      placeholder="Jelly Stream Viewer"
                      value={newSiteName}
                      onChange={(e) => setNewSiteName(e.target.value)}
                      className="bg-secondary/50 border-border/50"
                    />
                  </div>
                  <Button 
                    onClick={handleUpdateSiteName}
                    className="cinema-glow"
                  >
                    {admin.updateSiteName || "Update Site Name"}
                  </Button>
                </CardContent>
              </Card>

              <Card className="border-border/50">
                <CardHeader>
                  <CardTitle>{admin.logoUrl || "Logo URL"}</CardTitle>
                  <CardDescription>
                    {admin.logoUrlDescription || "Add a logo that replaces the standard icon (leave blank for default)"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="logo-url">{admin.logoUrl || "Logo URL"}</Label>
                    <Input
                      id="logo-url"
                      type="url"
                      placeholder="https://example.com/logo.png"
                      value={newLogoUrl}
                      onChange={(e) => setNewLogoUrl(e.target.value)}
                      className="bg-secondary/50 border-border/50"
                    />
                  </div>
                  {newLogoUrl && (
                    <div className="p-4 bg-secondary/20 rounded-lg">
                      <p className="text-sm text-muted-foreground mb-2">{admin.preview || "Preview:"}</p>
                      <img src={newLogoUrl} alt="Logo preview" className="h-10 w-auto object-contain" />
                    </div>
                  )}
                  <Button 
                    onClick={handleUpdateLogoUrl}
                    className="cinema-glow"
                  >
                    {admin.updateLogo || "Update Logo"}
                  </Button>
                </CardContent>
              </Card>

              <Card className="border-border/50">
                <CardHeader>
                  <CardTitle>{admin.headerTitleLabel || "Header Title"}</CardTitle>
                  <CardDescription>
                    {admin.headerTitleDescription || "Change the text displayed in the header"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="header-title">{admin.headerTitle || "Header Title"}</Label>
                    <Input
                      id="header-title"
                      type="text"
                      placeholder="Jelly Stream Viewer"
                      value={newHeaderTitle}
                      onChange={(e) => setNewHeaderTitle(e.target.value)}
                      className="bg-secondary/50 border-border/50"
                    />
                  </div>
                  <Button 
                    onClick={handleUpdateHeaderTitle}
                    className="cinema-glow"
                  >
                    {admin.updateTitle || "Update Title"}
                  </Button>
                </CardContent>
              </Card>

              <Card className="border-border/50">
                <CardHeader>
                  <CardTitle>{admin.loginBackgroundTitle || "Innloggingsbakgrunn"}</CardTitle>
                  <CardDescription>
                    {admin.loginBackgroundDescription || "Sett et bakgrunnsbilde for innloggingssiden (la stå tom for standard gradient)"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-bg-url">{admin.loginBackgroundUrl || "Bakgrunns-URL"}</Label>
                    <Input
                      id="login-bg-url"
                      type="url"
                      placeholder="https://example.com/background.jpg"
                      value={newLoginBackgroundUrl}
                      onChange={(e) => setNewLoginBackgroundUrl(e.target.value)}
                      className="bg-secondary/50 border-border/50"
                    />
                  </div>
                  {newLoginBackgroundUrl && (
                    <div className="p-4 bg-secondary/20 rounded-lg">
                      <p className="text-sm text-muted-foreground mb-2">{admin.preview || "Forhåndsvisning:"}</p>
                      <div 
                        className="h-32 w-full rounded-lg bg-cover bg-center bg-no-repeat relative overflow-hidden"
                        style={{ backgroundImage: `url(${newLoginBackgroundUrl})` }}
                      >
                        <div className="absolute inset-0 bg-black/60" />
                      </div>
                    </div>
                  )}
                  <Button 
                    onClick={handleUpdateLoginBackgroundUrl}
                    className="cinema-glow"
                  >
                    {admin.updateLoginBackground || "Oppdater bakgrunn"}
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="monitoring" className="space-y-6">
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
                        toast.loading("Setter opp Netdata...");
                        try {
                          const { data, error } = await supabase.functions.invoke("setup-netdata");
                          
                          if (error) throw error;
                          
                          if (data.success) {
                            toast.success("Netdata er satt opp! Vennligst vent noen minutter før du bruker det.");
                            // Auto-set the URL
                            setMonitoringUrl("http://localhost:19999");
                            await supabase
                              .from("server_settings")
                              .upsert({ 
                                setting_key: "monitoring_url", 
                                setting_value: "http://localhost:19999" 
                              }, { 
                                onConflict: 'setting_key' 
                              });
                          } else {
                            toast.error(data.message || "Kunne ikke sette opp Netdata");
                          }
                        } catch (err: any) {
                          toast.error(err.message || "Kunne ikke sette opp Netdata");
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

            <TabsContent value="qbittorrent" className="space-y-6">
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

            <TabsContent value="news" className="space-y-6">
              <Card className="border-border/50">
                <CardHeader>
                  <CardTitle>{admin.createNewPost || "Create New Post"}</CardTitle>
                  <CardDescription>
                    {admin.newPostDescription || "Add a new post that is visible to all users"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="post-title">{admin.postTitleLabel || "Title"}</Label>
                    <Input
                      id="post-title"
                      type="text"
                      placeholder={admin.titlePlaceholder || "Post title..."}
                      value={newPostTitle}
                      onChange={(e) => setNewPostTitle(e.target.value)}
                      className="bg-secondary/50 border-border/50"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="post-content">{admin.postContentLabel || "Content"}</Label>
                    <Textarea
                      id="post-content"
                      placeholder={admin.contentPlaceholder || "Write the content..."}
                      value={newPostContent}
                      onChange={(e) => setNewPostContent(e.target.value)}
                      className="bg-secondary/50 border-border/50 min-h-[200px]"
                    />
                  </div>
                  <Button 
                    onClick={handleCreatePost}
                    disabled={createNewsPost.isPending || !newPostTitle.trim() || !newPostContent.trim()}
                    className="cinema-glow"
                  >
                    {createNewsPost.isPending ? (admin.publishing || "Publishing...") : (admin.publishPost || "Publish Post")}
                  </Button>
                </CardContent>
              </Card>

              <Card className="border-border/50">
                <CardHeader>
                  <CardTitle>{admin.existingPosts || "Existing Posts"}</CardTitle>
                  <CardDescription>
                    {admin.existingPostsDescription || "Manage and delete published posts"}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {!newsPosts || newsPosts.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">{admin.noPosts || "No posts yet"}</p>
                  ) : (
                     <div className="space-y-4">
                      {newsPosts.map((post) => (
                        <div key={post.id} className="p-4 border border-border rounded-lg space-y-2">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <h3 className="font-semibold">{post.title}</h3>
                                {post.pinned && (
                                  <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded">
                                    {admin.pinned || "Pinned"}
                                  </span>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground line-clamp-2">{post.content}</p>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => togglePin.mutate({ postId: post.id, currentPinned: post.pinned })}
                                disabled={togglePin.isPending}
                                title={post.pinned ? (admin.unpinFromTop || "Unpin from top") : (admin.pinToTop || "Pin to top")}
                              >
                                <Pin className={`h-4 w-4 ${post.pinned ? 'fill-current text-primary' : ''}`} />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => deleteNewsPost.mutate(post.id)}
                                disabled={deleteNewsPost.isPending}
                                className="text-destructive hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="users">
              <UserManagement />
            </TabsContent>

            <TabsContent value="versions" className="space-y-6">
              <UpdateManager />
              <VersionManager />
            </TabsContent>

            <TabsContent value="logs" className="space-y-6">
              <SystemLogs />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default Admin;
