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
import { Settings, Newspaper, Trash2, Pin, Loader2 } from "lucide-react";
import { VersionManager } from "@/components/VersionManager";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const Admin = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, loading: authLoading } = useAuth();
  const { data: userRole, isLoading: roleLoading } = useUserRole(user?.id);
  const { serverUrl, updateServerUrl } = useServerSettings();
  const { siteName, logoUrl, headerTitle, updateSetting } = useSiteSettings();
  const [newServerUrl, setNewServerUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [jellyseerrUrl, setJellyseerrUrl] = useState("");
  const [jellyseerrApiKey, setJellyseerrApiKey] = useState("");
  
  // Site settings state
  const [newSiteName, setNewSiteName] = useState("");
  const [newLogoUrl, setNewLogoUrl] = useState("");
  const [newHeaderTitle, setNewHeaderTitle] = useState("");
  
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

  useEffect(() => {
    if (siteName && !newSiteName) setNewSiteName(siteName);
    if (logoUrl !== undefined && !newLogoUrl) setNewLogoUrl(logoUrl);
    if (headerTitle && !newHeaderTitle) setNewHeaderTitle(headerTitle);
  }, [siteName, logoUrl, headerTitle]);

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
          <p className="text-center text-muted-foreground">Laster...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="flex items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-primary/10">
                <Settings className="h-8 w-8 text-primary" />
              </div>
              <div>
                <h1 className="text-3xl font-bold">Admin-innstillinger</h1>
                <p className="text-muted-foreground">Administrer server-tilkoblinger og innhold</p>
              </div>
            </div>
            <Button 
              onClick={() => navigate("/requests-admin")}
              variant="outline"
              className="gap-2"
            >
              <Newspaper className="h-4 w-4" />
              Forespørsler
            </Button>
          </div>

          <Tabs defaultValue="servers" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="servers">Servere</TabsTrigger>
              <TabsTrigger value="site">Side-innstillinger</TabsTrigger>
              <TabsTrigger value="news">Nyheter</TabsTrigger>
              <TabsTrigger value="versions">Versjoner</TabsTrigger>
            </TabsList>

            <TabsContent value="servers" className="space-y-6">
              <Card className="border-border/50">
                <CardHeader>
                  <CardTitle>Server konfigurering</CardTitle>
                  <CardDescription>
                    Oppdater Jellyfin server URL for alle brukere
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="server-url">Jellyfin Server URL</Label>
                    <Input
                      id="server-url"
                      type="url"
                      placeholder="http://jellyfin.gjerdet.casa/"
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
                      {updateServerUrl.isPending ? "Oppdaterer..." : "Oppdater URL"}
                    </Button>
                    <Button 
                      onClick={handleTestConnection}
                      disabled={testingConnection}
                      variant="outline"
                      className="flex-1"
                    >
                      {testingConnection ? "Tester..." : "Test tilkobling"}
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
                    {testingConnection ? "Henter..." : "🔄 Hent ny konfigurasjon fra Jellyfin"}
                  </Button>
                </CardContent>
              </Card>

              <Card className="border-border/50">
                <CardHeader>
                  <CardTitle>Jellyfin API-nøkkel</CardTitle>
                  <CardDescription>
                    Konfigurer API-nøkkelen for å autentisere mot Jellyfin-serveren
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="api-key">API-nøkkel</Label>
                    <Input
                      id="api-key"
                      type="password"
                      placeholder="Skriv inn Jellyfin API-nøkkel"
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
                    {updateApiKey.isPending ? "Oppdaterer..." : "Oppdater API-nøkkel"}
                  </Button>
                </CardContent>
              </Card>

              <Card className="border-border/50">
                <CardHeader>
                  <CardTitle>Jellyseerr Server</CardTitle>
                  <CardDescription>
                    Konfigurer Jellyseerr for å be om innhold. 
                    <span className="block mt-2 text-yellow-500/80">
                      ⚠️ Merk: Edge functions kjører i skyen og kan ikke nå lokale IP-adresser (192.168.x.x). 
                      Bruk en offentlig URL eller sett opp en tunnel (ngrok/Cloudflare).
                    </span>
                    <span className="block mt-2 text-blue-500/80">
                      💡 Tips: Hvis du får SSL-sertifikatfeil, bruk http:// i stedet for https:// 
                      (f.eks. http://jellyseerr.dittdomene.com)
                    </span>
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="jellyseerr-url">Jellyseerr Server URL</Label>
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
                          title="Bytt til HTTP for å unngå SSL-problemer"
                        >
                          → HTTP
                        </Button>
                      )}
                    </div>
                    {currentJellyseerrUrl && currentJellyseerrUrl !== jellyseerrUrl && (
                      <p className="text-xs text-yellow-500/80">
                        ⚠️ Lagret URL: {currentJellyseerrUrl} (forskjellig fra det du har skrevet)
                      </p>
                    )}
                  </div>
                  <Button 
                    onClick={handleUpdateJellyseerrUrl}
                    disabled={updateJellyseerrUrl.isPending || !jellyseerrUrl || jellyseerrUrl === currentJellyseerrUrl}
                    className="cinema-glow"
                  >
                    {updateJellyseerrUrl.isPending ? "Oppdaterer..." : "Oppdater URL"}
                  </Button>
                </CardContent>
              </Card>

              <Card className="border-border/50">
                <CardHeader>
                  <CardTitle>Jellyseerr API-nøkkel</CardTitle>
                  <CardDescription>
                    Konfigurer API-nøkkelen for Jellyseerr (finn den i Settings → General)
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="jellyseerr-api-key">API-nøkkel</Label>
                    <Input
                      id="jellyseerr-api-key"
                      type="password"
                      placeholder="Skriv inn Jellyseerr API-nøkkel"
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
                      {updateJellyseerrApiKey.isPending ? "Oppdaterer..." : "Oppdater API-nøkkel"}
                    </Button>
                    <Button 
                      onClick={handleTestJellyseerr}
                      disabled={testingJellyseerr}
                      variant="outline"
                      className="flex-1"
                    >
                      {testingJellyseerr ? "Tester..." : "Test tilkobling"}
                    </Button>
                  </div>
                  
                  {testingJellyseerr && (
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 border border-border/50">
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                      <span className="text-sm text-muted-foreground">Tester tilkobling...</span>
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
            </TabsContent>

            <TabsContent value="site" className="space-y-6">
              <Card className="border-border/50">
                <CardHeader>
                  <CardTitle>Side-namn</CardTitle>
                  <CardDescription>
                    Endre namnet på nettstaden
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="site-name">Side-namn</Label>
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
                    Oppdater side-namn
                  </Button>
                </CardContent>
              </Card>

              <Card className="border-border/50">
                <CardHeader>
                  <CardTitle>Logo URL</CardTitle>
                  <CardDescription>
                    Legg til ein logo som erstattar standard ikonen (la stå tomt for standard)
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="logo-url">Logo URL</Label>
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
                      <p className="text-sm text-muted-foreground mb-2">Forhåndsvisning:</p>
                      <img src={newLogoUrl} alt="Logo preview" className="h-10 w-auto object-contain" />
                    </div>
                  )}
                  <Button 
                    onClick={handleUpdateLogoUrl}
                    className="cinema-glow"
                  >
                    Oppdater logo
                  </Button>
                </CardContent>
              </Card>

              <Card className="border-border/50">
                <CardHeader>
                  <CardTitle>Header-tittel</CardTitle>
                  <CardDescription>
                    Endre teksten som vises i headeren
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="header-title">Header-tittel</Label>
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
                    Oppdater tittel
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="news" className="space-y-6">
              <Card className="border-border/50">
                <CardHeader>
                  <CardTitle>Opprett ny nyhet</CardTitle>
                  <CardDescription>
                    Legg til ei ny nyhet som blir synleg for alle brukarar
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="post-title">Tittel</Label>
                    <Input
                      id="post-title"
                      type="text"
                      placeholder="Nyheitstittel..."
                      value={newPostTitle}
                      onChange={(e) => setNewPostTitle(e.target.value)}
                      className="bg-secondary/50 border-border/50"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="post-content">Innhald</Label>
                    <Textarea
                      id="post-content"
                      placeholder="Skriv inn innhaldet..."
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
                    {createNewsPost.isPending ? "Publiserer..." : "Publiser nyhet"}
                  </Button>
                </CardContent>
              </Card>

              <Card className="border-border/50">
                <CardHeader>
                  <CardTitle>Eksisterande nyheter</CardTitle>
                  <CardDescription>
                    Administrer og slett publiserte nyheter
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {!newsPosts || newsPosts.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">Ingen nyheter ennå</p>
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
                                    Festa
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
                                title={post.pinned ? "Løs frå toppen" : "Fest til toppen"}
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

            <TabsContent value="versions">
              <VersionManager />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default Admin;
