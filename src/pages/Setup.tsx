import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Server, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";

const Setup = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { data: userRole, isLoading: roleLoading } = useUserRole(user?.id);
  const [serverUrl, setServerUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingSetup, setCheckingSetup] = useState(true);
  const [setupCompleted, setSetupCompleted] = useState(false);

  // Check if setup is already completed
  useEffect(() => {
    const checkSetup = async () => {
      try {
        const { data, error } = await supabase
          .from("server_settings")
          .select("setting_key")
          .eq("setting_key", "setup_completed")
          .maybeSingle();

        if (data && !error) {
          setSetupCompleted(true);
        }
      } catch (error) {
        console.log("No existing setup found");
      } finally {
        setCheckingSetup(false);
      }
    };
    
    checkSetup();
  }, []);

  // Check auth and redirect non-admins if setup is already completed
  useEffect(() => {
    if (authLoading || roleLoading || checkingSetup) return;
    
    // If setup is completed, require admin role
    if (setupCompleted) {
      if (!user) {
        navigate("/");
        return;
      }
      
      if (userRole && userRole !== "admin") {
        toast.error("Du har ikke tilgang til denne siden");
        navigate("/browse");
        return;
      }
    }
  }, [user, userRole, authLoading, roleLoading, setupCompleted, checkingSetup, navigate]);

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Normaliser server URL - legg til http:// hvis det mangler
      let normalizedUrl = serverUrl.trim();
      if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
        normalizedUrl = `http://${normalizedUrl}`;
      }
      
      // Use security definer function to bypass RLS for initial setup
      const { error } = await supabase.rpc('setup_server_settings', {
        p_server_url: normalizedUrl,
        p_api_key: apiKey.trim(),
      });

      if (error) throw error;

      toast.success("Innstillinger lagret! Du kan nå logge inn.");
      navigate("/");
    } catch (error) {
      console.error('Setup error:', error);
      const msg =
        typeof error === "object" && error && "message" in error
          ? String((error as { message?: unknown }).message)
          : "";

      if (msg.includes("Only administrators") || msg.includes("You must be logged in")) {
        toast.error("Oppsettet er allerede gjort. Logg inn som administrator for å endre.");
      } else {
        toast.error("Kunne ikke lagre innstillingene");
      }
    } finally {
      setLoading(false);
    }
  };

  // Show loading while checking
  if (checkingSetup || (setupCompleted && (authLoading || roleLoading))) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // If setup is complete, explain that only admins can change it
  if (setupCompleted && (!user || userRole !== "admin")) {
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
            <CardTitle className="text-2xl font-bold">Oppsett er allerede fullført</CardTitle>
            <CardDescription className="text-base">
              Du må logge inn som administrator for å endre serverinnstillinger.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button className="w-full cinema-glow" onClick={() => navigate("/")}>Gå til innlogging</Button>
            <p className="text-xs text-muted-foreground text-center">
              {user ? "Du mangler admin-tilgang." : "Du er ikke innlogget."}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

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
