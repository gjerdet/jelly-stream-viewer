import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Server, CheckCircle2, AlertCircle, Loader2, Cloud, Tv, SkipForward, Info, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";

type SetupStep = "welcome" | "cloud-info" | "jellyfin-config" | "complete";

const SetupWizard = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { data: userRole, isLoading: roleLoading } = useUserRole(user?.id);
  const [currentStep, setCurrentStep] = useState<SetupStep>("welcome");
  const [loading, setLoading] = useState(false);
  const [checkingSetup, setCheckingSetup] = useState(true);

  // Jellyfin settings
  const [jellyfinUrl, setJellyfinUrl] = useState("");
  const [jellyfinApiKey, setJellyfinApiKey] = useState("");
  const [testingJellyfin, setTestingJellyfin] = useState(false);
  const [jellyfinStatus, setJellyfinStatus] = useState<"idle" | "success" | "error">("idle");

  // Check auth and redirect non-admins
  useEffect(() => {
    if (authLoading || roleLoading) return;
    if (!user) { navigate("/"); return; }
    if (userRole && userRole !== "admin") {
      toast.error("Du har ikke tilgang til denne siden");
      navigate("/browse");
    }
  }, [user, userRole, authLoading, roleLoading, navigate]);

  // Check if setup is already completed
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const forceShow = searchParams.get("force") === "true";
    if (forceShow) { setCheckingSetup(false); return; }

    const checkExistingSetup = async () => {
      try {
        const { data } = await supabase
          .from("server_settings")
          .select("setting_key")
          .eq("setting_key", "setup_completed")
          .maybeSingle();
        if (data) navigate("/");
      } catch {
        // No existing setup, continue
      } finally {
        setCheckingSetup(false);
      }
    };
    checkExistingSetup();
  }, [navigate]);

  if (authLoading || roleLoading || checkingSetup) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user || userRole !== "admin") return null;

  const steps: SetupStep[] = ["welcome", "cloud-info", "jellyfin-config", "complete"];
  const stepIndex = steps.indexOf(currentStep);
  const progress = ((stepIndex + 1) / steps.length) * 100;

  const stepLabels: Record<SetupStep, string> = {
    "welcome": "Velkommen",
    "cloud-info": "Skyoppsett",
    "jellyfin-config": "Jellyfin",
    "complete": "Ferdig",
  };

  const testJellyfinConnection = async () => {
    setTestingJellyfin(true);
    setJellyfinStatus("idle");
    try {
      let normalizedUrl = jellyfinUrl.trim();
      if (!normalizedUrl.startsWith("http://") && !normalizedUrl.startsWith("https://")) {
        normalizedUrl = `http://${normalizedUrl}`;
      }
      const { data, error } = await supabase.functions.invoke("jellyfin-proxy", {
        body: { path: "/System/Info", apiKey: jellyfinApiKey, serverUrl: normalizedUrl },
      });
      if (error || !data) throw new Error("Feil");
      setJellyfinStatus("success");
      toast.success("Jellyfin tilkobling OK!");
    } catch {
      setJellyfinStatus("error");
      toast.error("Kunne ikke koble til Jellyfin. Sjekk URL og API-nøkkel.");
    } finally {
      setTestingJellyfin(false);
    }
  };

  const saveAndFinish = async (skipJellyfin = false) => {
    setLoading(true);
    try {
      if (!skipJellyfin && jellyfinUrl.trim()) {
        let normalizedUrl = jellyfinUrl.trim();
        if (!normalizedUrl.startsWith("http://") && !normalizedUrl.startsWith("https://")) {
          normalizedUrl = `http://${normalizedUrl}`;
        }
        await supabase.rpc("setup_server_settings", {
          p_server_url: normalizedUrl,
          p_api_key: jellyfinApiKey.trim(),
        });
      }

      await supabase.from("server_settings").upsert({
        setting_key: "setup_completed",
        setting_value: "true",
      }, { onConflict: "setting_key" });

      setCurrentStep("complete");
      toast.success("Oppsett fullført!");
    } catch (error) {
      console.error("Setup error:", error);
      toast.error("Noe gikk galt. Prøv igjen.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 relative overflow-hidden">
      <div className="absolute inset-0 gradient-hero opacity-50" />

      <Card className="w-full max-w-2xl relative z-10 border-border/50 bg-card/95 backdrop-blur-xl">
        <CardHeader className="space-y-4 pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-2xl font-bold">Installasjonsveileder</CardTitle>
            <span className="text-sm text-muted-foreground font-medium">
              {stepLabels[currentStep]} · Steg {stepIndex + 1} av {steps.length}
            </span>
          </div>
          <div className="space-y-1">
            <Progress value={progress} className="h-1.5" />
            <div className="flex justify-between">
              {steps.map((s, i) => (
                <span
                  key={s}
                  className={`text-xs ${i <= stepIndex ? "text-primary" : "text-muted-foreground"}`}
                >
                  {stepLabels[s]}
                </span>
              ))}
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">

          {/* ── Welcome ── */}
          {currentStep === "welcome" && (
            <div className="space-y-6 text-center">
              <div className="flex justify-center">
                <div className="p-6 rounded-2xl bg-primary/10 cinema-glow">
                  <Server className="h-16 w-16 text-primary" />
                </div>
              </div>
              <div>
                <h2 className="text-2xl font-bold mb-2">Velkommen til Jelly Stream Viewer!</h2>
                <p className="text-muted-foreground">
                  Denne veilederen setter opp applikasjonen på noen minutter.
                  Det er bare <strong>to steg</strong> – du kan alltid konfigurere mer i Admin-panelet etterpå.
                </p>
              </div>

              <div className="space-y-3 text-left">
                <StepCard
                  icon={<Cloud className="h-5 w-5 text-primary" />}
                  title="1. Skyoppsett (Lovable Cloud)"
                  desc="Allerede ferdig konfigurert! Vi forklarer hva det betyr."
                  done
                />
                <StepCard
                  icon={<Tv className="h-5 w-5 text-primary" />}
                  title="2. Jellyfin media server"
                  desc="Koble til Jellyfin. Kan hoppes over og gjøres i Admin-panelet."
                  optional
                />
              </div>

              <Button
                onClick={() => setCurrentStep("cloud-info")}
                className="w-full cinema-glow smooth-transition hover:scale-[1.02]"
                size="lg"
              >
                Start oppsett <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          )}

          {/* ── Cloud Info ── */}
          {currentStep === "cloud-info" && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold mb-1">Skyoppsett – Lovable Cloud</h2>
                <p className="text-muted-foreground text-sm">
                  Applikasjonen bruker <strong>Lovable Cloud</strong> som backend. Det er allerede konfigurert for deg – du trenger ikke gjøre noe her.
                </p>
              </div>

              <div className="space-y-3">
                <InfoCard
                  icon="✅"
                  title="Database"
                  desc="Alle innstillinger, brukere og historikk lagres sikkert i skyen. Ingenting lagres lokalt på din maskin."
                />
                <InfoCard
                  icon="✅"
                  title="Autentisering"
                  desc="Innlogging og brukeradministrasjon håndteres automatisk. Første bruker som registrerer seg blir administrator."
                />
                <InfoCard
                  icon="✅"
                  title="Edge Functions (proxyer)"
                  desc="Alle API-kall til Jellyfin, Jellyseerr, Radarr, Sonarr og Bazarr kjøres via sikre sky-funksjoner for å unngå CORS-problemer."
                />
                <InfoCard
                  icon="✅"
                  title="Internett-tilkobling kreves"
                  desc="Siden backend er i skyen trenger appen internett-tilkobling. Jellyfin kan likevel ligge lokalt på hjemmenettverket ditt."
                />
              </div>

              <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                <div className="flex gap-2 items-start">
                  <Info className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                  <p className="text-sm text-muted-foreground">
                    Jellyfin, Jellyseerr, Radarr, Sonarr og Bazarr konfigureres manuelt i <strong>Admin → Serverinnstillinger</strong> etter at du har logget inn.
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <Button onClick={() => setCurrentStep("welcome")} variant="outline" className="flex-1">
                  Tilbake
                </Button>
                <Button onClick={() => setCurrentStep("jellyfin-config")} className="flex-1 cinema-glow">
                  Neste <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* ── Jellyfin Config ── */}
          {currentStep === "jellyfin-config" && (
            <div className="space-y-6">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="text-2xl font-bold">Jellyfin media server</h2>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">Valgfritt</span>
                </div>
                <p className="text-muted-foreground text-sm">
                  Koble til Jellyfin nå, eller hopp over og gjør det i Admin-panelet.
                </p>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="jellyfinUrl">Jellyfin Server URL</Label>
                  <Input
                    id="jellyfinUrl"
                    placeholder="http://192.168.1.100:8096"
                    value={jellyfinUrl}
                    onChange={(e) => { setJellyfinUrl(e.target.value); setJellyfinStatus("idle"); }}
                    className="bg-secondary/50"
                  />
                  <p className="text-xs text-muted-foreground">
                    Eks: <code>http://localhost:8096</code> eller <code>http://192.168.1.100:8096</code>
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="jellyfinApiKey">API-nøkkel</Label>
                  <Input
                    id="jellyfinApiKey"
                    placeholder="Din API-nøkkel fra Jellyfin"
                    value={jellyfinApiKey}
                    onChange={(e) => { setJellyfinApiKey(e.target.value); setJellyfinStatus("idle"); }}
                    className="bg-secondary/50"
                  />
                  <p className="text-xs text-muted-foreground">
                    Finn den i Jellyfin Dashboard → <strong>Avansert → API-nøkler</strong>
                  </p>
                </div>
              </div>

              <div className="p-4 bg-secondary/30 rounded-lg">
                <h3 className="font-semibold mb-2 text-sm">Slik genererer du en API-nøkkel i Jellyfin:</h3>
                <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
                  <li>Logg inn på Jellyfin</li>
                  <li>Gå til <strong>Dashboard → Avansert → API-nøkler</strong></li>
                  <li>Klikk <strong>+</strong> og gi nøkkelen et navn (f.eks. «JellyStream»)</li>
                  <li>Kopier nøkkelen og lim inn her</li>
                </ol>
              </div>

              {jellyfinUrl && (
                <Button
                  onClick={testJellyfinConnection}
                  disabled={testingJellyfin || !jellyfinUrl || !jellyfinApiKey}
                  variant={jellyfinStatus === "success" ? "default" : "outline"}
                  className="w-full"
                >
                  {testingJellyfin && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {jellyfinStatus === "success" && <CheckCircle2 className="mr-2 h-4 w-4" />}
                {jellyfinStatus === "error" && <AlertCircle className="mr-2 h-4 w-4" />}
                  {testingJellyfin ? "Tester..." : "Test tilkobling"}
                </Button>
              )}

              <div className="flex gap-3">
                <Button onClick={() => setCurrentStep("cloud-info")} variant="outline" className="flex-1">
                  Tilbake
                </Button>
                <Button
                  onClick={() => saveAndFinish(true)}
                  variant="ghost"
                  className="flex-1 text-muted-foreground"
                  disabled={loading}
                >
                  <SkipForward className="mr-2 h-4 w-4" />
                  Hopp over
                </Button>
                <Button
                  onClick={() => saveAndFinish(false)}
                  className="flex-1 cinema-glow"
                  disabled={loading || !jellyfinUrl || !jellyfinApiKey}
                >
                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  {loading ? "Lagrer..." : "Fullfør"}
                </Button>
              </div>
            </div>
          )}

          {/* ── Complete ── */}
          {currentStep === "complete" && (
            <div className="space-y-6 text-center">
              <div className="flex justify-center">
                <div className="p-6 rounded-2xl bg-primary/10 cinema-glow">
                  <CheckCircle2 className="h-16 w-16 text-primary" />
                </div>
...
                {!jellyfinUrl && (
                  <div className="p-3 rounded-lg bg-secondary border border-border text-sm text-muted-foreground">
                    💡 Du hoppet over Jellyfin-oppsett. Konfigurer det i <strong>Admin → Serverinnstillinger</strong> etter innlogging.
                  </div>
                )}
              </div>

              <Button
                onClick={() => navigate("/")}
                className="w-full cinema-glow smooth-transition hover:scale-[1.02]"
                size="lg"
              >
                Gå til innlogging
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

// Helper components
const StepCard = ({
  icon, title, desc, done, optional,
}: {
  icon: React.ReactNode; title: string; desc: string; done?: boolean; optional?: boolean;
}) => (
  <div className="flex items-start gap-3 p-3 rounded-lg bg-secondary/30">
    {icon}
    <div>
      <div className="flex items-center gap-2">
        <p className="font-medium text-sm">{title}</p>
        {done && <span className="text-xs px-2 py-0.5 rounded-full bg-primary/20 text-primary">Ferdig</span>}
        {optional && <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">Valgfritt</span>}
      </div>
      <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
    </div>
  </div>
);

const InfoCard = ({ icon, title, desc }: { icon: string; title: string; desc: string }) => (
  <div className="flex items-start gap-3 p-3 rounded-lg bg-secondary/30">
    <span className="text-lg leading-none mt-0.5">{icon}</span>
    <div>
      <p className="font-medium text-sm">{title}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
    </div>
  </div>
);

export default SetupWizard;
