import { useState, useEffect } from "react";
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
import { Settings, Newspaper, Trash2, Pin } from "lucide-react";
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
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-primary/10">
              <Settings className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Admin-innstillinger</h1>
              <p className="text-muted-foreground">Administrer server-tilkoblinger og innhold</p>
            </div>
          </div>

          <Tabs defaultValue="servers" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="servers">Servere</TabsTrigger>
              <TabsTrigger value="site">Side-innstillinger</TabsTrigger>
              <TabsTrigger value="news">Nyheter</TabsTrigger>
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
                  <Button 
                    onClick={handleUpdateUrl}
                    disabled={updateServerUrl.isPending || newServerUrl === serverUrl}
                    className="cinema-glow"
                  >
                    {updateServerUrl.isPending ? "Oppdaterer..." : "Oppdater URL"}
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
                    Konfigurer Jellyseerr for å be om innhold
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="jellyseerr-url">Jellyseerr Server URL</Label>
                    <Input
                      id="jellyseerr-url"
                      type="url"
                      placeholder="https://jellyseerr.dittdomene.com"
                      value={jellyseerrUrl}
                      onChange={(e) => setJellyseerrUrl(e.target.value)}
                      className="bg-secondary/50 border-border/50"
                    />
                  </div>
                  <Button 
                    onClick={handleUpdateJellyseerrUrl}
                    disabled={updateJellyseerrUrl.isPending}
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
                  <Button 
                    onClick={handleUpdateJellyseerrApiKey}
                    disabled={updateJellyseerrApiKey.isPending}
                    className="cinema-glow"
                  >
                    {updateJellyseerrApiKey.isPending ? "Oppdaterer..." : "Oppdater API-nøkkel"}
                  </Button>
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
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default Admin;
