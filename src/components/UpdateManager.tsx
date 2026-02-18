import { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { RefreshCw, Download, AlertCircle, CheckCircle, GitBranch, FileText, Loader2, Settings, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { nb, enUS } from "date-fns/locale";
import { useLanguage } from "@/contexts/LanguageContext";

interface UpdateInfo {
  updateAvailable: boolean;
  installedVersion: { sha: string; shortSha: string };
  latestVersion: {
    sha: string;
    shortSha: string;
    message: string;
    author: string;
    date: string;
  };
}

interface LogEntry {
  timestamp: string;
  message: string;
  level: "info" | "success" | "error" | "warning";
}

const addLog = (logs: LogEntry[], message: string, level: LogEntry["level"] = "info"): LogEntry[] => [
  ...logs,
  { timestamp: new Date().toISOString(), message, level },
];

export const UpdateManager = () => {
  const { language } = useLanguage();
  const no = language === "no";
  const dateLocale = no ? nb : enUS;

  const [checking, setChecking] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [progress, setProgress] = useState(0);
  const [showLogs, setShowLogs] = useState(false);
  const [updateStep, setUpdateStep] = useState("");
  const [webhookConfigured, setWebhookConfigured] = useState<boolean | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Cleanup polling on unmount
  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  // Check if webhook URL is configured
  useEffect(() => {
    const checkWebhook = async () => {
      const { data } = await supabase
        .from("server_settings")
        .select("setting_value")
        .eq("setting_key", "update_webhook_url")
        .maybeSingle();
      
      const url = data?.setting_value || "";
      const isPrivate = !url || url.includes("192.168.") || url.includes("10.0.") || url.includes("172.16.") || url.startsWith("http://localhost");
      setWebhookConfigured(!isPrivate);
    };
    checkWebhook();
  }, []);

  const checkForUpdates = useCallback(async () => {
    setChecking(true);
    setError(null);
    setErrorDetails(null);
    try {
      const { data, error: invokeError } = await supabase.functions.invoke("check-updates");
      if (invokeError) throw new Error(invokeError.message);

      if (data?.needsSetup) {
        setError(no ? "GitHub repository er ikkje konfigurert. Gå til Servere-fanen." : "GitHub repository not configured. Go to Servers tab.");
        return;
      }
      setUpdateInfo(data);
      toast[data.updateAvailable ? "success" : "info"](
        data.updateAvailable
          ? (no ? "Ny oppdatering tilgjengeleg!" : "New update available!")
          : (no ? "Du har nyaste versjonen" : "You have the latest version")
      );
    } catch (err: any) {
      console.error("Check updates error:", err);
      setError(no ? "Kunne ikkje sjekke for oppdateringar" : "Could not check for updates");
    } finally {
      setChecking(false);
    }
  }, [no]);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const installUpdate = useCallback(async () => {
    if (!updateInfo?.updateAvailable) return;

    setUpdating(true);
    setShowLogs(true);
    setProgress(5);
    setLogs([]);
    setError(null);
    setErrorDetails(null);
    setUpdateStep(no ? "Startar oppdatering..." : "Starting update...");
    setLogs((l) => addLog(l, no ? "Startar oppdatering..." : "Starting update..."));

    const initialSha = updateInfo.installedVersion.sha;

    try {
      // Step 1: Trigger update
      setLogs((l) => addLog(l, no ? "Kontaktar oppdateringsserver..." : "Contacting update server..."));
      setProgress(10);

      const { data, error: invokeError } = await supabase.functions.invoke("trigger-update", {
        body: {},
      });

      if (invokeError) {
        throw new Error(invokeError.message || (no ? "Backend-funksjon feilet" : "Backend function failed"));
      }

      // Check for structured errors from the improved edge function
      if (data?.error) {
        const errMsg = data.error;
        const details = data.details || "";
        
        setUpdateStep(no ? "Feil" : "Error");
        setLogs((l) => addLog(l, `❌ ${errMsg}`, "error"));
        if (details) {
          setLogs((l) => addLog(l, `📋 ${details}`, "warning"));
        }
        
        setError(errMsg);
        setErrorDetails(details);
        setProgress(0);
        setUpdating(false);
        
        if (data.needsPublicUrl) {
          toast.error(no ? "Git pull server URL må konfigurerast" : "Git pull server URL needs configuration");
        } else if (data.connectionFailed) {
          toast.error(no ? "Kunne ikkje nå oppdateringsserveren" : "Could not reach update server");
        } else {
          toast.error(no ? "Oppdatering feilet" : "Update failed");
        }
        return;
      }

      setLogs((l) => addLog(l, no ? "✅ Git pull starta på serveren" : "✅ Git pull started on server", "success"));
      setProgress(20);
      setUpdateStep(no ? "Ventar på at serveren fullfører..." : "Waiting for server to finish...");

      // Step 2: Poll check-updates every 5s to detect version change
      let pollCount = 0;
      const maxPolls = 60; // 5 minutes max

      pollRef.current = setInterval(async () => {
        pollCount++;
        const estimatedProgress = Math.min(90, 20 + Math.round((pollCount / maxPolls) * 70));
        setProgress(estimatedProgress);
        
        if (pollCount % 6 === 0) {
          setLogs((l) =>
            addLog(l, `🔄 ${no ? "Sjekkar status" : "Checking status"} (${Math.round(pollCount * 5 / 60)}min)...`)
          );
        }

        try {
          const { data: checkData } = await supabase.functions.invoke("check-updates");

          if (checkData?.installedVersion?.sha && checkData.installedVersion.sha !== initialSha) {
            stopPolling();
            setProgress(100);
            setUpdateStep(no ? "Oppdatering fullført!" : "Update complete!");
            setLogs((l) => addLog(l, no ? "✅ Oppdatering fullført!" : "✅ Update complete!", "success"));
            setUpdateInfo(checkData);
            setUpdating(false);
            toast.success(no ? "Oppdatering fullført!" : "Update complete!");
            return;
          }

          if (!checkData?.updateAvailable && pollCount > 6) {
            stopPolling();
            setProgress(100);
            setUpdateStep(no ? "Du har nyaste versjonen" : "You have the latest version");
            setLogs((l) => addLog(l, no ? "✅ Allereie oppdatert" : "✅ Already up to date", "success"));
            setUpdateInfo(checkData);
            setUpdating(false);
            toast.success(no ? "Du har nyaste versjonen!" : "You have the latest version!");
            return;
          }
        } catch (e) {
          console.error("Poll error:", e);
        }

        if (pollCount >= maxPolls) {
          stopPolling();
          setUpdateStep(no ? "Tidsavbrot — sjekk manuelt" : "Timeout — check manually");
          setLogs((l) =>
            addLog(l, no ? "⚠️ Tidsavbrot — klikk 'Sjekk etter oppdatering'" : "⚠️ Timeout — click 'Check for updates'", "warning")
          );
          setUpdating(false);
          toast.warning(no ? "Tidsavbrot" : "Timeout");
        }
      }, 5000);
    } catch (err: any) {
      console.error("Install update error:", err);
      const msg = err?.message || (no ? "Ukjend feil" : "Unknown error");
      setUpdateStep(no ? "Feil" : "Error");
      setLogs((l) => addLog(l, `❌ ${msg}`, "error"));
      setError(msg);
      setProgress(0);
      setUpdating(false);
      toast.error(no ? "Oppdatering feilet" : "Update failed");
    }
  }, [updateInfo, no, stopPolling]);

  const cancelUpdate = useCallback(() => {
    stopPolling();
    setUpdating(false);
    setUpdateStep(no ? "Avbrote" : "Cancelled");
    setLogs((l) => addLog(l, no ? "🛑 Oppdatering avbrote av brukar" : "🛑 Update cancelled by user", "warning"));
    toast.info(no ? "Oppdatering avbrote" : "Update cancelled");
  }, [no, stopPolling]);

  const syncInstalledVersion = async () => {
    const commitSha = prompt(no ? "Lim inn commit SHA (køyr: git rev-parse HEAD)" : "Paste commit SHA (run: git rev-parse HEAD)");
    if (!commitSha) return;

    try {
      const { error: syncError } = await supabase.functions.invoke("sync-installed-version", {
        body: { commitSha: commitSha.trim() },
      });
      if (syncError) throw syncError;
      toast.success(no ? "Versjon synkronisert!" : "Version synced!");
      await checkForUpdates();
    } catch {
      toast.error(no ? "Kunne ikkje synkronisere versjon" : "Could not sync version");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <GitBranch className="h-5 w-5" />
          {no ? "Oppdateringar" : "Updates"}
        </CardTitle>
        <CardDescription>
          {no ? "Sjekk og installer oppdateringar frå GitHub" : "Check and install updates from GitHub"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Webhook URL warning */}
        {webhookConfigured === false && (
          <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
            <div className="flex items-start gap-2">
              <Settings className="h-4 w-4 text-yellow-400 mt-0.5 shrink-0" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-yellow-400">
                  {no ? "Git Pull Server URL manglar" : "Git Pull Server URL missing"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {no
                    ? "For å installere oppdateringar må du konfigurere ein offentleg URL for git-pull serveren din under Servere-fanen → Git Pull Server URL. Lokale IP-adresser (192.168.x.x) fungerer ikkje frå skyen."
                    : "To install updates, configure a public URL for your git-pull server under the Servers tab → Git Pull Server URL. Local IP addresses (192.168.x.x) won't work from the cloud."}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Info banner */}
        <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-blue-400 mt-0.5 shrink-0" />
            <p className="text-xs text-muted-foreground">
              {no
                ? "Denne funksjonen er berre for self-hosted installasjonar. Oppdateringar vert utført via git pull på serveren."
                : "This feature is only for self-hosted installations. Updates are performed via git pull on the server."}
            </p>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
              <div className="space-y-1">
                <p className="text-sm text-destructive font-medium">{error}</p>
                {errorDetails && (
                  <p className="text-xs text-muted-foreground">{errorDetails}</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Version info */}
        {updateInfo && (
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-secondary/20 rounded-lg">
              <div>
                <p className="text-sm font-medium">{no ? "Installert versjon" : "Installed version"}</p>
                <p className="text-xs text-muted-foreground font-mono">
                  {updateInfo.installedVersion.shortSha || (no ? "Ukjent" : "Unknown")}
                </p>
              </div>
              {updateInfo.updateAvailable ? (
                <Badge variant="secondary">{no ? "Utdatert" : "Outdated"}</Badge>
              ) : (
                <Badge variant="default" className="bg-green-500">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  {no ? "Oppdatert" : "Up to date"}
                </Badge>
              )}
            </div>

            {updateInfo.updateAvailable && (
              <div className="p-4 border border-primary/20 rounded-lg bg-primary/5">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-medium">{no ? "Ny versjon tilgjengeleg!" : "New version available!"}</p>
                    <p className="text-xs text-muted-foreground font-mono mt-1">
                      {updateInfo.latestVersion.shortSha}
                    </p>
                  </div>
                  <Badge variant="outline">{no ? "Ny" : "New"}</Badge>
                </div>
                <div className="mt-3 space-y-1 text-sm">
                  <p className="font-medium">{updateInfo.latestVersion.message}</p>
                  <p className="text-xs text-muted-foreground">
                    {no ? "av" : "by"} {updateInfo.latestVersion.author} •{" "}
                    {format(new Date(updateInfo.latestVersion.date), "d. MMM yyyy 'kl.' HH:mm", {
                      locale: dateLocale,
                    })}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Update progress */}
        {(updating || logs.length > 0) && (
          <div className="space-y-3 p-4 border border-primary/20 rounded-lg bg-primary/5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {updating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : progress === 100 ? (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-destructive" />
                )}
                <span className="text-sm font-medium">{updateStep}</span>
              </div>
              <div className="flex items-center gap-1">
                {updating && (
                  <Button variant="ghost" size="sm" onClick={cancelUpdate} className="text-destructive">
                    {no ? "Avbryt" : "Cancel"}
                  </Button>
                )}
                <Dialog open={showLogs} onOpenChange={setShowLogs}>
                  <DialogTrigger asChild>
                    <Button variant="ghost" size="sm">
                      <FileText className="h-4 w-4 mr-1" />
                      {no ? "Sjå loggar" : "View logs"}
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>{no ? "Oppdateringsloggar" : "Update logs"}</DialogTitle>
                      <DialogDescription>
                        {no ? "Detaljert logg frå oppdateringsprosessen" : "Detailed log of the update process"}
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-1 mb-4">
                      <p className="text-xs text-muted-foreground">
                        {no ? `Framgang: ${progress}%` : `Progress: ${progress}%`}
                      </p>
                      <Progress value={progress} className="h-1.5" />
                    </div>
                    <ScrollArea className="h-96 w-full rounded-md border p-4">
                      <div className="space-y-2">
                        {logs.map((log, idx) => (
                          <div key={idx} className="flex gap-2 text-sm">
                            <span className="text-muted-foreground font-mono text-xs shrink-0">
                              {format(new Date(log.timestamp), "HH:mm:ss")}
                            </span>
                            <span
                              className={
                                log.level === "error"
                                  ? "text-red-400"
                                  : log.level === "success"
                                  ? "text-green-400"
                                  : log.level === "warning"
                                  ? "text-yellow-400"
                                  : "text-muted-foreground"
                              }
                            >
                              {log.message}
                            </span>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          <Button onClick={checkForUpdates} disabled={checking || updating} variant="outline" className="flex-1">
            <RefreshCw className={`h-4 w-4 mr-2 ${checking ? "animate-spin" : ""}`} />
            {checking
              ? (no ? "Sjekkar..." : "Checking...")
              : (no ? "Sjekk etter oppdatering" : "Check for updates")}
          </Button>

          {updateInfo?.updateAvailable && !updating && (
            <>
              <Button onClick={syncInstalledVersion} variant="secondary" size="sm" className="shrink-0">
                <CheckCircle className="h-4 w-4 mr-2" />
                {no ? "Synk versjon" : "Sync version"}
              </Button>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button className="flex-1" disabled={webhookConfigured === false}>
                    <Download className="h-4 w-4 mr-2" />
                    {no ? "Installer oppdatering" : "Install update"}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      {no ? "Installer oppdatering?" : "Install update?"}
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      {no
                        ? "Dette vil laste ned nyaste versjon frå GitHub og bygge på nytt. Det tek vanlegvis 30-60 sekund."
                        : "This will download the latest version from GitHub and rebuild. Usually takes 30-60 seconds."}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{no ? "Avbryt" : "Cancel"}</AlertDialogCancel>
                    <AlertDialogAction onClick={installUpdate}>
                      {no ? "Installer no" : "Install now"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
