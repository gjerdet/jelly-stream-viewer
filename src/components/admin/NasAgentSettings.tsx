import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { HardDrive, Loader2, Shield, FolderOpen } from "lucide-react";
import { Separator } from "@/components/ui/separator";

export const NasAgentSettings = () => {
  const { language } = useLanguage();
  const queryClient = useQueryClient();
  
  const [nasAgentUrl, setNasAgentUrl] = useState("");
  const [nasDeleteSecret, setNasDeleteSecret] = useState("");
  const [nasMoviesPath, setNasMoviesPath] = useState("");
  const [nasShowsPath, setNasShowsPath] = useState("");
  const [nasDownloadsPath, setNasDownloadsPath] = useState("");
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<string | null>(null);

  // Fetch current settings
  const { data: settings } = useQuery({
    queryKey: ["server-settings", "nas-agent"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("server_settings")
        .select("setting_key, setting_value")
        .in("setting_key", [
          "nas_delete_agent_url", 
          "nas_delete_secret",
          "nas_movies_path",
          "nas_shows_path",
          "nas_downloads_path"
        ]);

      if (error) throw error;
      
      const result: Record<string, string> = {};
      data?.forEach(s => {
        result[s.setting_key] = s.setting_value || "";
      });
      return result;
    },
  });

  useEffect(() => {
    if (settings) {
      if (settings.nas_delete_agent_url && !nasAgentUrl) {
        setNasAgentUrl(settings.nas_delete_agent_url);
      }
      if (settings.nas_delete_secret && !nasDeleteSecret) {
        setNasDeleteSecret(settings.nas_delete_secret);
      }
      if (settings.nas_movies_path && !nasMoviesPath) {
        setNasMoviesPath(settings.nas_movies_path);
      }
      if (settings.nas_shows_path && !nasShowsPath) {
        setNasShowsPath(settings.nas_shows_path);
      }
      if (settings.nas_downloads_path && !nasDownloadsPath) {
        setNasDownloadsPath(settings.nas_downloads_path);
      }
    }
  }, [settings]);

  const updateSettings = useMutation({
    mutationFn: async ({ 
      url, secret, moviesPath, showsPath, downloadsPath 
    }: { 
      url: string; secret: string; moviesPath: string; showsPath: string; downloadsPath: string;
    }) => {
      const updates = [
        { setting_key: "nas_delete_agent_url", setting_value: url, updated_at: new Date().toISOString() },
        { setting_key: "nas_delete_secret", setting_value: secret, updated_at: new Date().toISOString() },
        { setting_key: "nas_movies_path", setting_value: moviesPath, updated_at: new Date().toISOString() },
        { setting_key: "nas_shows_path", setting_value: showsPath, updated_at: new Date().toISOString() },
        { setting_key: "nas_downloads_path", setting_value: downloadsPath, updated_at: new Date().toISOString() },
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
      toast.success(language === 'no' ? "NAS Agent-innstillinger lagret!" : "NAS Agent settings saved!");
    },
    onError: () => {
      toast.error(language === 'no' ? "Kunne ikke lagre innstillinger" : "Failed to save settings");
    },
  });

  const handleSave = () => {
    updateSettings.mutate({ 
      url: nasAgentUrl.trim(), 
      secret: nasDeleteSecret.trim(),
      moviesPath: nasMoviesPath.trim(),
      showsPath: nasShowsPath.trim(),
      downloadsPath: nasDownloadsPath.trim(),
    });
  };

  const handleTestConnection = async () => {
    if (!nasAgentUrl.trim()) {
      toast.error(language === 'no' ? "Fyll inn NAS Agent URL først" : "Fill in NAS Agent URL first");
      return;
    }

    setTestingConnection(true);
    setConnectionStatus(null);

    try {
      // Try to reach the NAS agent health endpoint
      const healthUrl = nasAgentUrl.replace(/\/$/, '') + '/health';
      const response = await fetch(healthUrl, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (response.ok) {
        const data = await response.json();
        setConnectionStatus(`✅ ${language === 'no' ? 'Tilkobling OK' : 'Connection OK'} - ${data.message || 'NAS Agent kjører'}`);
      } else {
        setConnectionStatus(`❌ ${language === 'no' ? 'Feil' : 'Error'}: HTTP ${response.status}`);
      }
    } catch (error: any) {
      // Check for mixed content / network errors
      if (error.message?.includes('Mixed Content') || error.message?.includes('blocked')) {
        setConnectionStatus(`❌ ${language === 'no' 
          ? 'Blokkert: Nettleseren blokkerer HTTP fra HTTPS. Bruk HTTPS for NAS Agent eller test fra lokal tilgang.' 
          : 'Blocked: Browser blocks HTTP from HTTPS. Use HTTPS for NAS Agent or test from local access.'}`);
      } else {
        setConnectionStatus(`❌ ${language === 'no' ? 'Kunne ikke koble til' : 'Could not connect'}: ${error.message || 'Network error'}`);
      }
    } finally {
      setTestingConnection(false);
    }
  };

  const generateSecret = () => {
    // Generate a random 32-character hex secret
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    const secret = Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
    setNasDeleteSecret(secret);
    toast.info(language === 'no' ? "Ny hemmelighet generert - husk å lagre!" : "New secret generated - remember to save!");
  };

  return (
    <Card className="border-border/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <HardDrive className="h-5 w-5" />
          {language === 'no' ? 'NAS Delete Agent' : 'NAS Delete Agent'}
        </CardTitle>
        <CardDescription>
          {language === 'no' 
            ? 'Konfigurer lokal NAS-agent for filsletting når Radarr/Sonarr ikke har tilgang. Agenten kjører på TrueNAS/NAS-serveren.' 
            : 'Configure local NAS agent for file deletion when Radarr/Sonarr lack access. The agent runs on the TrueNAS/NAS server.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="nas-agent-url">
            {language === 'no' ? 'NAS Agent URL' : 'NAS Agent URL'}
          </Label>
          <Input
            id="nas-agent-url"
            type="url"
            placeholder="http://192.168.1.100:3003"
            value={nasAgentUrl}
            onChange={(e) => setNasAgentUrl(e.target.value)}
            className="bg-secondary/50 border-border/50"
          />
          <p className="text-xs text-muted-foreground">
            {language === 'no' 
              ? 'URL til NAS delete agent (vanligvis port 3003)' 
              : 'URL to NAS delete agent (usually port 3003)'}
          </p>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="nas-delete-secret">
              <div className="flex items-center gap-1">
                <Shield className="h-3 w-3" />
                {language === 'no' ? 'Delete Secret (HMAC)' : 'Delete Secret (HMAC)'}
              </div>
            </Label>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={generateSecret}
              className="text-xs h-7"
            >
              {language === 'no' ? 'Generer ny' : 'Generate new'}
            </Button>
          </div>
          <Input
            id="nas-delete-secret"
            type="password"
            placeholder={language === 'no' ? 'Delt hemmelighet for HMAC-signering' : 'Shared secret for HMAC signing'}
            value={nasDeleteSecret}
            onChange={(e) => setNasDeleteSecret(e.target.value)}
            className="bg-secondary/50 border-border/50 font-mono"
          />
          <p className="text-xs text-muted-foreground">
            {language === 'no' 
              ? 'Denne hemmeligheten må være identisk på både web-appen og NAS-agenten' 
              : 'This secret must be identical on both the web app and the NAS agent'}
          </p>
        </div>

        <Separator className="my-4" />

        {/* Media Paths Section */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <FolderOpen className="h-4 w-4 text-muted-foreground" />
            <Label className="text-sm font-medium">
              {language === 'no' ? 'Tillatte stier (referanse)' : 'Allowed paths (reference)'}
            </Label>
          </div>
          <p className="text-xs text-muted-foreground">
            {language === 'no' 
              ? 'Disse stiene brukes av NAS-agenten for å validere slette-forespørsler. Oppdater dem her for referanse og på NAS-agenten for faktisk kontroll.' 
              : 'These paths are used by the NAS agent to validate delete requests. Update them here for reference and on the NAS agent for actual control.'}
          </p>
          
          <div className="grid gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="nas-movies-path" className="text-xs">
                {language === 'no' ? 'Filmer' : 'Movies'}
              </Label>
              <Input
                id="nas-movies-path"
                type="text"
                placeholder="/mnt/data/movies"
                value={nasMoviesPath}
                onChange={(e) => setNasMoviesPath(e.target.value)}
                className="bg-secondary/50 border-border/50 font-mono text-sm h-9"
              />
            </div>
            
            <div className="space-y-1.5">
              <Label htmlFor="nas-shows-path" className="text-xs">
                {language === 'no' ? 'TV-serier' : 'TV Shows'}
              </Label>
              <Input
                id="nas-shows-path"
                type="text"
                placeholder="/mnt/data/shows"
                value={nasShowsPath}
                onChange={(e) => setNasShowsPath(e.target.value)}
                className="bg-secondary/50 border-border/50 font-mono text-sm h-9"
              />
            </div>
            
            <div className="space-y-1.5">
              <Label htmlFor="nas-downloads-path" className="text-xs">
                {language === 'no' ? 'Nedlastinger' : 'Downloads'}
              </Label>
              <Input
                id="nas-downloads-path"
                type="text"
                placeholder="/mnt/data/downloads"
                value={nasDownloadsPath}
                onChange={(e) => setNasDownloadsPath(e.target.value)}
                className="bg-secondary/50 border-border/50 font-mono text-sm h-9"
              />
            </div>
          </div>
        </div>

        <Separator className="my-4" />

        <div className="flex gap-2">
          <Button 
            onClick={handleSave}
            disabled={updateSettings.isPending}
            className="cinema-glow flex-1"
          >
            {updateSettings.isPending 
              ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />{language === 'no' ? 'Lagrer...' : 'Saving...'}</>
              : (language === 'no' ? 'Lagre innstillinger' : 'Save Settings')}
          </Button>
          <Button 
            onClick={handleTestConnection}
            disabled={testingConnection}
            variant="outline"
            className="flex-1"
          >
            {testingConnection 
              ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />{language === 'no' ? 'Tester...' : 'Testing...'}</>
              : (language === 'no' ? 'Test tilkobling' : 'Test Connection')}
          </Button>
        </div>

        {connectionStatus && (
          <div className={`p-3 rounded-lg text-sm ${
            connectionStatus.startsWith('✅') 
              ? 'bg-green-500/10 text-green-400 border border-green-500/20' 
              : 'bg-red-500/10 text-red-400 border border-red-500/20'
          }`}>
            <div className="whitespace-pre-wrap">{connectionStatus}</div>
          </div>
        )}

        <div className="pt-4 border-t border-border/50">
          <p className="text-sm font-medium mb-2">
            {language === 'no' ? 'Oppsettinstruksjoner:' : 'Setup instructions:'}
          </p>
          <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
            <li>{language === 'no' ? 'Kjør setup-scriptet på NAS-serveren: bash setup-nas-delete-agent.sh' : 'Run the setup script on the NAS server: bash setup-nas-delete-agent.sh'}</li>
            <li>{language === 'no' ? 'Kopier den genererte hemmeligheten hit (eller generer ny og oppdater agenten)' : 'Copy the generated secret here (or generate new and update the agent)'}</li>
            <li>{language === 'no' ? 'Fyll inn NAS Agent URL og lagre' : 'Fill in NAS Agent URL and save'}</li>
            <li>{language === 'no' ? 'Test tilkoblingen' : 'Test the connection'}</li>
          </ol>
        </div>
      </CardContent>
    </Card>
  );
};
