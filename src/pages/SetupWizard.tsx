import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Server, Database, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

type DeploymentType = "cloud" | "local" | null;
type SetupStep = "welcome" | "deployment-type" | "database-config" | "jellyfin-config" | "monitoring-config" | "complete";

const SetupWizard = () => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState<SetupStep>("welcome");
  const [deploymentType, setDeploymentType] = useState<DeploymentType>(null);
  const [loading, setLoading] = useState(false);

  // Database settings
  const [dbHost, setDbHost] = useState("localhost");
  const [dbPort, setDbPort] = useState("5432");
  const [dbName, setDbName] = useState("jellystream");
  const [dbUser, setDbUser] = useState("jellystream");
  const [dbPassword, setDbPassword] = useState("");
  
  // Supabase Cloud settings
  const [supabaseUrl, setSupabaseUrl] = useState("");
  const [supabaseKey, setSupabaseKey] = useState("");
  const [supabaseProjectId, setSupabaseProjectId] = useState("");

  // Jellyfin settings
  const [jellyfinUrl, setJellyfinUrl] = useState("");
  const [jellyfinApiKey, setJellyfinApiKey] = useState("");

  // Monitoring settings
  const [monitoringUrl, setMonitoringUrl] = useState("http://localhost:19999");

  // Testing states
  const [testingDb, setTestingDb] = useState(false);
  const [dbStatus, setDbStatus] = useState<"idle" | "success" | "error">("idle");
  const [testingJellyfin, setTestingJellyfin] = useState(false);
  const [jellyfinStatus, setJellyfinStatus] = useState<"idle" | "success" | "error">("idle");
  const [testingMonitoring, setTestingMonitoring] = useState(false);
  const [monitoringStatus, setMonitoringStatus] = useState<"idle" | "success" | "error">("idle");

  // Check if setup is already completed
  useEffect(() => {
    checkExistingSetup();
  }, []);

  const checkExistingSetup = async () => {
    try {
      const { data, error } = await supabase
        .from("server_settings")
        .select("setting_key")
        .eq("setting_key", "setup_completed")
        .maybeSingle();

      if (data && !error) {
        // Setup already completed, redirect to login
        navigate("/");
      }
    } catch (error) {
      console.log("No existing setup found, continuing with wizard");
    }
  };

  const getProgress = () => {
    const steps = ["welcome", "deployment-type", "database-config", "jellyfin-config", "monitoring-config", "complete"];
    const currentIndex = steps.indexOf(currentStep);
    return ((currentIndex + 1) / steps.length) * 100;
  };

  const testDatabaseConnection = async () => {
    if (deploymentType === "cloud") {
      // Test Supabase connection
      setTestingDb(true);
      setDbStatus("idle");
      
      try {
        const response = await fetch(`${supabaseUrl}/rest/v1/`, {
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`
          }
        });
        
        if (response.ok) {
          setDbStatus("success");
          toast.success("Supabase forbindelse OK!");
        } else {
          setDbStatus("error");
          toast.error("Kunne ikke koble til Supabase");
        }
      } catch (error) {
        setDbStatus("error");
        toast.error("Feil ved tilkobling til Supabase");
      } finally {
        setTestingDb(false);
      }
    } else {
      // Test local PostgreSQL connection
      setTestingDb(true);
      setDbStatus("idle");
      
      // Note: This would need a backend endpoint to actually test
      // For now we'll just validate the inputs
      if (dbHost && dbPort && dbName && dbUser && dbPassword) {
        setDbStatus("success");
        toast.success("Database-konfigurasjon validert");
      } else {
        setDbStatus("error");
        toast.error("Vennligst fyll ut alle felt");
      }
      setTestingDb(false);
    }
  };

  const testJellyfinConnection = async () => {
    setTestingJellyfin(true);
    setJellyfinStatus("idle");
    
    try {
      let normalizedUrl = jellyfinUrl.trim();
      if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
        normalizedUrl = `http://${normalizedUrl}`;
      }

      const response = await fetch(`${normalizedUrl}/System/Info`, {
        headers: {
          'X-Emby-Token': jellyfinApiKey
        }
      });

      if (response.ok) {
        setJellyfinStatus("success");
        toast.success("Jellyfin forbindelse OK!");
      } else {
        setJellyfinStatus("error");
        toast.error("Kunne ikke koble til Jellyfin");
      }
    } catch (error) {
      setJellyfinStatus("error");
      toast.error("Feil ved tilkobling til Jellyfin");
    } finally {
      setTestingJellyfin(false);
    }
  };

  const testMonitoringConnection = async () => {
    setTestingMonitoring(true);
    setMonitoringStatus("idle");
    
    try {
      let normalizedUrl = monitoringUrl.trim();
      if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
        normalizedUrl = `http://${normalizedUrl}`;
      }

      const response = await fetch(`${normalizedUrl}/api/v1/info`);

      if (response.ok) {
        setMonitoringStatus("success");
        toast.success("Netdata forbindelse OK!");
      } else {
        setMonitoringStatus("error");
        toast.error("Kunne ikke koble til Netdata");
      }
    } catch (error) {
      setMonitoringStatus("error");
      toast.error("Feil ved tilkobling til Netdata");
    } finally {
      setTestingMonitoring(false);
    }
  };

  const saveConfiguration = async () => {
    setLoading(true);
    
    try {
      // Save deployment type
      await supabase.from("server_settings").upsert({
        setting_key: "deployment_type",
        setting_value: deploymentType || "cloud",
      }, { onConflict: "setting_key" });

      if (deploymentType === "cloud") {
        // Save Supabase settings
        await supabase.from("server_settings").upsert([
          { setting_key: "supabase_url", setting_value: supabaseUrl },
          { setting_key: "supabase_key", setting_value: supabaseKey },
          { setting_key: "supabase_project_id", setting_value: supabaseProjectId },
        ], { onConflict: "setting_key" });
      } else {
        // Save local database settings
        const connectionString = `postgresql://${dbUser}:${dbPassword}@${dbHost}:${dbPort}/${dbName}`;
        await supabase.from("server_settings").upsert([
          { setting_key: "database_url", setting_value: connectionString },
          { setting_key: "db_host", setting_value: dbHost },
          { setting_key: "db_port", setting_value: dbPort },
          { setting_key: "db_name", setting_value: dbName },
          { setting_key: "db_user", setting_value: dbUser },
        ], { onConflict: "setting_key" });
      }

      // Save Jellyfin settings
      let normalizedJellyfinUrl = jellyfinUrl.trim();
      if (!normalizedJellyfinUrl.startsWith('http://') && !normalizedJellyfinUrl.startsWith('https://')) {
        normalizedJellyfinUrl = `http://${normalizedJellyfinUrl}`;
      }

      await supabase.rpc('setup_server_settings', {
        p_server_url: normalizedJellyfinUrl,
        p_api_key: jellyfinApiKey.trim(),
      });

      // Save monitoring URL
      let normalizedMonitoringUrl = monitoringUrl.trim();
      if (!normalizedMonitoringUrl.startsWith('http://') && !normalizedMonitoringUrl.startsWith('https://')) {
        normalizedMonitoringUrl = `http://${normalizedMonitoringUrl}`;
      }

      await supabase.from("server_settings").upsert({
        setting_key: "monitoring_url",
        setting_value: normalizedMonitoringUrl,
      }, { onConflict: "setting_key" });

      // Mark setup as completed
      await supabase.from("server_settings").upsert({
        setting_key: "setup_completed",
        setting_value: "true",
      }, { onConflict: "setting_key" });

      setCurrentStep("complete");
      toast.success("Oppsett fullført!");
    } catch (error) {
      console.error('Setup error:', error);
      toast.error("Kunne ikke lagre innstillingene");
    } finally {
      setLoading(false);
    }
  };

  const handleNext = () => {
    if (currentStep === "welcome") {
      setCurrentStep("deployment-type");
    } else if (currentStep === "deployment-type") {
      if (!deploymentType) {
        toast.error("Vennligst velg en deployment-type");
        return;
      }
      setCurrentStep("database-config");
    } else if (currentStep === "database-config") {
      if (dbStatus !== "success") {
        toast.error("Vennligst test database-forbindelsen først");
        return;
      }
      setCurrentStep("jellyfin-config");
    } else if (currentStep === "jellyfin-config") {
      if (jellyfinStatus !== "success") {
        toast.error("Vennligst test Jellyfin-forbindelsen først");
        return;
      }
      setCurrentStep("monitoring-config");
    } else if (currentStep === "monitoring-config") {
      // Monitoring is optional, allow skipping
      saveConfiguration();
    }
  };

  const handleBack = () => {
    if (currentStep === "deployment-type") {
      setCurrentStep("welcome");
    } else if (currentStep === "database-config") {
      setCurrentStep("deployment-type");
    } else if (currentStep === "jellyfin-config") {
      setCurrentStep("database-config");
    } else if (currentStep === "monitoring-config") {
      setCurrentStep("jellyfin-config");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 relative overflow-hidden">
      <div className="absolute inset-0 gradient-hero opacity-50" />
      
      <Card className="w-full max-w-2xl relative z-10 border-border/50 bg-card/95 backdrop-blur-xl">
        <CardHeader className="space-y-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-3xl font-bold">Installasjonsveileder</CardTitle>
            <span className="text-sm text-muted-foreground">
              {currentStep === "welcome" && "Steg 1 av 6"}
              {currentStep === "deployment-type" && "Steg 2 av 6"}
              {currentStep === "database-config" && "Steg 3 av 6"}
              {currentStep === "jellyfin-config" && "Steg 4 av 6"}
              {currentStep === "monitoring-config" && "Steg 5 av 6"}
              {currentStep === "complete" && "Steg 6 av 6"}
            </span>
          </div>
          <Progress value={getProgress()} className="h-2" />
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Welcome Step */}
          {currentStep === "welcome" && (
            <div className="space-y-6 text-center">
              <div className="flex justify-center">
                <div className="p-6 rounded-2xl bg-primary/10 cinema-glow">
                  <Server className="h-16 w-16 text-primary" />
                </div>
              </div>
              <div className="space-y-3">
                <h2 className="text-2xl font-bold">Velkommen til Jelly Stream Viewer!</h2>
                <p className="text-muted-foreground">
                  Denne veilederen vil hjelpe deg med å sette opp applikasjonen.
                  Du vil bli guidet gjennom følgende steg:
                </p>
              </div>
              <div className="space-y-3 text-left">
                <div className="flex items-start gap-3 p-3 rounded-lg bg-secondary/30">
                  <Database className="h-5 w-5 text-primary mt-0.5" />
                  <div>
                    <p className="font-medium">1. Velg deployment-type</p>
                    <p className="text-sm text-muted-foreground">Supabase Cloud eller lokal database</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-lg bg-secondary/30">
                  <Database className="h-5 w-5 text-primary mt-0.5" />
                  <div>
                    <p className="font-medium">2. Konfigurer database</p>
                    <p className="text-sm text-muted-foreground">Sett opp tilkobling til database</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-lg bg-secondary/30">
                  <Server className="h-5 w-5 text-primary mt-0.5" />
                  <div>
                    <p className="font-medium">3. Konfigurer Jellyfin</p>
                    <p className="text-sm text-muted-foreground">Koble til din Jellyfin media server</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-lg bg-secondary/30">
                  <Server className="h-5 w-5 text-primary mt-0.5" />
                  <div>
                    <p className="font-medium">4. Konfigurer Server Monitoring</p>
                    <p className="text-sm text-muted-foreground">Netdata for sanntids server-statistikk (valgfritt)</p>
                  </div>
                </div>
              </div>
              <Button 
                onClick={handleNext}
                className="w-full cinema-glow smooth-transition hover:scale-[1.02]"
                size="lg"
              >
                Start oppsett
              </Button>
            </div>
          )}

          {/* Deployment Type Step */}
          {currentStep === "deployment-type" && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold mb-2">Velg deployment-type</h2>
                <p className="text-muted-foreground">
                  Hvordan vil du kjøre Jelly Stream Viewer?
                </p>
              </div>

              <RadioGroup value={deploymentType || ""} onValueChange={(value) => setDeploymentType(value as DeploymentType)}>
                <div className="space-y-3">
                  <Label
                    htmlFor="cloud"
                    className="flex items-start gap-4 p-4 rounded-lg border-2 border-border cursor-pointer hover:border-primary/50 transition-colors has-[:checked]:border-primary has-[:checked]:bg-primary/5"
                  >
                    <RadioGroupItem value="cloud" id="cloud" className="mt-1" />
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">Supabase Cloud</span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-primary/20 text-primary">Anbefalt</span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Enklest å sette opp. Automatisk autentisering, edge functions og realtime.
                        Gratis tier tilgjengelig. Krever internett-tilkobling.
                      </p>
                      <ul className="text-xs text-muted-foreground mt-2 space-y-1">
                        <li>✓ Full funksjonalitet</li>
                        <li>✓ Gratis å starte</li>
                        <li>✓ Automatiske backups</li>
                      </ul>
                    </div>
                  </Label>

                  <Label
                    htmlFor="local"
                    className="flex items-start gap-4 p-4 rounded-lg border-2 border-border cursor-pointer hover:border-primary/50 transition-colors has-[:checked]:border-primary has-[:checked]:bg-primary/5"
                  >
                    <RadioGroupItem value="local" id="local" className="mt-1" />
                    <div className="flex-1 space-y-1">
                      <span className="font-semibold">Lokal PostgreSQL (Docker)</span>
                      <p className="text-sm text-muted-foreground">
                        Kjører 100% lokalt på din maskin. Full kontroll over data.
                        Krever Docker og manuell oppsett av autentisering.
                      </p>
                      <ul className="text-xs text-muted-foreground mt-2 space-y-1">
                        <li>✓ Full datakontroll</li>
                        <li>✓ Offline capable</li>
                        <li>⚠ Begrenset funksjonalitet</li>
                      </ul>
                    </div>
                  </Label>
                </div>
              </RadioGroup>

              <div className="flex gap-3">
                <Button onClick={handleBack} variant="outline" className="flex-1">
                  Tilbake
                </Button>
                <Button onClick={handleNext} className="flex-1 cinema-glow">
                  Neste
                </Button>
              </div>
            </div>
          )}

          {/* Database Config Step */}
          {currentStep === "database-config" && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold mb-2">Konfigurer database</h2>
                <p className="text-muted-foreground">
                  {deploymentType === "cloud" 
                    ? "Legg inn dine Supabase credentials" 
                    : "Konfigurer lokal PostgreSQL-tilkobling"}
                </p>
              </div>

              {deploymentType === "cloud" ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="supabaseUrl">Supabase Project URL</Label>
                    <Input
                      id="supabaseUrl"
                      placeholder="https://xxxxx.supabase.co"
                      value={supabaseUrl}
                      onChange={(e) => setSupabaseUrl(e.target.value)}
                      className="bg-secondary/50"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="supabaseKey">Supabase Anon/Public Key</Label>
                    <Input
                      id="supabaseKey"
                      placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                      value={supabaseKey}
                      onChange={(e) => setSupabaseKey(e.target.value)}
                      className="bg-secondary/50"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="supabaseProjectId">Supabase Project ID</Label>
                    <Input
                      id="supabaseProjectId"
                      placeholder="xxxxx"
                      value={supabaseProjectId}
                      onChange={(e) => setSupabaseProjectId(e.target.value)}
                      className="bg-secondary/50"
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="dbHost">Host</Label>
                      <Input
                        id="dbHost"
                        placeholder="localhost"
                        value={dbHost}
                        onChange={(e) => setDbHost(e.target.value)}
                        className="bg-secondary/50"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="dbPort">Port</Label>
                      <Input
                        id="dbPort"
                        placeholder="5432"
                        value={dbPort}
                        onChange={(e) => setDbPort(e.target.value)}
                        className="bg-secondary/50"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dbName">Database Navn</Label>
                    <Input
                      id="dbName"
                      placeholder="jellystream"
                      value={dbName}
                      onChange={(e) => setDbName(e.target.value)}
                      className="bg-secondary/50"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dbUser">Brukernavn</Label>
                    <Input
                      id="dbUser"
                      placeholder="jellystream"
                      value={dbUser}
                      onChange={(e) => setDbUser(e.target.value)}
                      className="bg-secondary/50"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dbPassword">Passord</Label>
                    <Input
                      id="dbPassword"
                      type="password"
                      placeholder="••••••••"
                      value={dbPassword}
                      onChange={(e) => setDbPassword(e.target.value)}
                      className="bg-secondary/50"
                    />
                  </div>
                </div>
              )}

              <Button
                onClick={testDatabaseConnection}
                disabled={testingDb}
                variant={dbStatus === "success" ? "default" : "outline"}
                className="w-full"
              >
                {testingDb && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {dbStatus === "success" && <CheckCircle2 className="mr-2 h-4 w-4" />}
                {dbStatus === "error" && <AlertCircle className="mr-2 h-4 w-4" />}
                {testingDb ? "Tester forbindelse..." : "Test forbindelse"}
              </Button>

              <div className="flex gap-3">
                <Button onClick={handleBack} variant="outline" className="flex-1">
                  Tilbake
                </Button>
                <Button 
                  onClick={handleNext} 
                  className="flex-1 cinema-glow"
                  disabled={dbStatus !== "success"}
                >
                  Neste
                </Button>
              </div>
            </div>
          )}

          {/* Jellyfin Config Step */}
          {currentStep === "jellyfin-config" && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold mb-2">Konfigurer Jellyfin</h2>
                <p className="text-muted-foreground">
                  Koble til din Jellyfin media server
                </p>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="jellyfinUrl">Jellyfin Server URL</Label>
                  <Input
                    id="jellyfinUrl"
                    placeholder="http://192.168.1.100:8096"
                    value={jellyfinUrl}
                    onChange={(e) => setJellyfinUrl(e.target.value)}
                    className="bg-secondary/50"
                  />
                  <p className="text-xs text-muted-foreground">
                    Eks: http://localhost:8096 eller http://192.168.1.100:8096
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="jellyfinApiKey">Jellyfin API-nøkkel</Label>
                  <Input
                    id="jellyfinApiKey"
                    placeholder="Din API-nøkkel fra Jellyfin"
                    value={jellyfinApiKey}
                    onChange={(e) => setJellyfinApiKey(e.target.value)}
                    className="bg-secondary/50"
                  />
                  <p className="text-xs text-muted-foreground">
                    Finnes i Jellyfin Dashboard → API Keys
                  </p>
                </div>
              </div>

              <Button
                onClick={testJellyfinConnection}
                disabled={testingJellyfin}
                variant={jellyfinStatus === "success" ? "default" : "outline"}
                className="w-full"
              >
                {testingJellyfin && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {jellyfinStatus === "success" && <CheckCircle2 className="mr-2 h-4 w-4" />}
                {jellyfinStatus === "error" && <AlertCircle className="mr-2 h-4 w-4" />}
                {testingJellyfin ? "Tester forbindelse..." : "Test forbindelse"}
              </Button>

              <div className="p-4 bg-secondary/30 rounded-lg">
                <h3 className="font-semibold mb-2 text-sm">Hvordan generere API-nøkkel:</h3>
                <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
                  <li>Logg inn på Jellyfin web-grensesnittet</li>
                  <li>Gå til Dashboard → API Keys</li>
                  <li>Klikk + for å lage ny nøkkel</li>
                  <li>Gi den et navn og kopier nøkkelen</li>
                </ol>
              </div>

              <div className="flex gap-3">
                <Button onClick={handleBack} variant="outline" className="flex-1">
                  Tilbake
                </Button>
                <Button 
                  onClick={handleNext} 
                  className="flex-1 cinema-glow"
                  disabled={jellyfinStatus !== "success"}
                >
                  Neste
                </Button>
              </div>
            </div>
          )}

          {/* Monitoring Config Step */}
          {currentStep === "monitoring-config" && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold mb-2">Konfigurer Server Monitoring</h2>
                <p className="text-muted-foreground">
                  Netdata gir deg sanntids-statistikk for server-ytelse (valgfritt)
                </p>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="monitoringUrl">Netdata URL</Label>
                  <Input
                    id="monitoringUrl"
                    placeholder="http://localhost:19999"
                    value={monitoringUrl}
                    onChange={(e) => setMonitoringUrl(e.target.value)}
                    className="bg-secondary/50"
                  />
                  <p className="text-xs text-muted-foreground">
                    Standard Netdata-adresse er http://localhost:19999
                  </p>
                </div>
              </div>

              <Button
                onClick={testMonitoringConnection}
                disabled={testingMonitoring}
                variant={monitoringStatus === "success" ? "default" : "outline"}
                className="w-full"
              >
                {testingMonitoring && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {monitoringStatus === "success" && <CheckCircle2 className="mr-2 h-4 w-4" />}
                {monitoringStatus === "error" && <AlertCircle className="mr-2 h-4 w-4" />}
                {testingMonitoring ? "Tester forbindelse..." : "Test forbindelse"}
              </Button>

              <div className="p-4 bg-secondary/30 rounded-lg">
                <h3 className="font-semibold mb-2 text-sm">Om Netdata:</h3>
                <p className="text-xs text-muted-foreground mb-2">
                  Netdata ble installert automatisk under oppsett. Du kan nå:
                </p>
                <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                  <li>Se sanntids CPU, RAM, disk og nettverksstatistikk</li>
                  <li>Overvåke systemhelse direkte i Admin-panelet</li>
                  <li>Åpne Netdata direkte på http://localhost:19999</li>
                </ul>
              </div>

              <div className="flex gap-3">
                <Button onClick={handleBack} variant="outline" className="flex-1">
                  Tilbake
                </Button>
                <Button 
                  onClick={handleNext} 
                  className="flex-1 cinema-glow"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Lagrer...
                    </>
                  ) : (
                    monitoringStatus === "success" ? "Fullfør oppsett" : "Hopp over"
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* Complete Step */}
          {currentStep === "complete" && (
            <div className="space-y-6 text-center">
              <div className="flex justify-center">
                <div className="p-6 rounded-2xl bg-green-500/10 cinema-glow">
                  <CheckCircle2 className="h-16 w-16 text-green-500" />
                </div>
              </div>
              <div className="space-y-3">
                <h2 className="text-2xl font-bold">Oppsett fullført! 🎉</h2>
                <p className="text-muted-foreground">
                  Jelly Stream Viewer er nå konfigurert og klar til bruk.
                </p>
              </div>
              <div className="space-y-3 text-left">
                <div className="p-4 bg-secondary/30 rounded-lg">
                  <h3 className="font-semibold mb-2">Neste steg:</h3>
                  <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
                    <li>Klikk "Gå til innlogging" under</li>
                    <li>Registrer din første bruker (blir automatisk admin)</li>
                    <li>Start streaming fra Jellyfin!</li>
                  </ol>
                </div>
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

export default SetupWizard;
