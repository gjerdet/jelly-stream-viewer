import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Server } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const Setup = () => {
  const navigate = useNavigate();
  const [serverUrl, setServerUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Use security definer function to bypass RLS for initial setup
      const { error } = await supabase.rpc('setup_server_settings', {
        p_server_url: serverUrl.trim(),
        p_api_key: apiKey.trim(),
      });

      if (error) throw error;

      toast.success("Innstillinger lagret! Du kan nå logge inn.");
      navigate("/");
    } catch (error) {
      console.error('Setup error:', error);
      toast.error("Kunne ikke lagre innstillingene");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 relative overflow-hidden">
      <div className="absolute inset-0 gradient-hero opacity-50" />
      
      <Card className="w-full max-w-md relative z-10 border-border/50 bg-card/95 backdrop-blur-xl">
        <CardHeader className="space-y-4 text-center">
          <div className="flex justify-center">
            <div className="p-4 rounded-2xl bg-primary/10 cinema-glow">
              <Server className="h-12 w-12 text-primary" />
            </div>
          </div>
          <CardTitle className="text-3xl font-bold">Første gangs oppsett</CardTitle>
          <CardDescription className="text-base">
            Konfigurer Jellyfin-serveren din før første innlogging
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSetup} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="serverUrl">Jellyfin Server URL</Label>
              <Input
                id="serverUrl"
                type="text"
                placeholder="http://localhost:8096"
                value={serverUrl}
                onChange={(e) => setServerUrl(e.target.value)}
                className="bg-secondary/50 border-border/50"
                required
              />
              <p className="text-xs text-muted-foreground">
                Eks: http://localhost:8096 eller http://192.168.1.100:8096
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="apiKey">Jellyfin API-nøkkel</Label>
              <Input
                id="apiKey"
                type="text"
                placeholder="Din API-nøkkel fra Jellyfin"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="bg-secondary/50 border-border/50"
                required
              />
              <p className="text-xs text-muted-foreground">
                Finnes i Jellyfin Dashboard → API Keys
              </p>
            </div>
            <Button 
              type="submit" 
              className="w-full cinema-glow smooth-transition hover:scale-[1.02]"
              disabled={loading}
            >
              {loading ? "Lagrer..." : "Lagre og fortsett"}
            </Button>
          </form>
          
          <div className="mt-6 p-4 bg-secondary/30 rounded-lg">
            <h3 className="font-semibold mb-2 text-sm">Hvordan generere API-nøkkel:</h3>
            <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
              <li>Logg inn på Jellyfin web-grensesnittet</li>
              <li>Gå til Dashboard → API Keys</li>
              <li>Klikk + for å lage ny nøkkel</li>
              <li>Gi den et navn og kopier nøkkelen</li>
            </ol>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Setup;
