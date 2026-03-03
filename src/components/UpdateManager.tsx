import { useState, useEffect, useCallback, useRef } from "react";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  RefreshCw, Download, AlertCircle, CheckCircle, GitBranch,
  FileText, Loader2, Settings, XCircle, Wifi, WifiOff,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { nb, enUS } from "date-fns/locale";
import { useLanguage } from "@/contexts/LanguageContext";

// ─── Types ────────────────────────────────────────────────────────────────────
interface UpdateInfo {
  updateAvailable: boolean;
  installedVersion: { sha: string; shortSha: string };
  latestVersion: { sha: string; shortSha: string; message: string; author: string; date: string };
}

interface LogEntry {
  ts: string;
  msg: string;
  level: "info" | "success" | "error" | "warning";
}

type UpdateState = "idle" | "checking" | "updating" | "done" | "error";

// ─── Helpers ──────────────────────────────────────────────────────────────────
const mkLog = (msg: string, level: LogEntry["level"] = "info"): LogEntry => ({
  ts: new Date().toISOString(),
  msg,
  level,
});

const levelColor: Record<LogEntry["level"], string> = {
  info: "text-muted-foreground",
  success: "text-green-400",
  error: "text-red-400",
  warning: "text-yellow-400",
};

// ─── Component ────────────────────────────────────────────────────────────────
export const UpdateManager = () => {
  const { language } = useLanguage();
  const no = language === "no";
  const dateLocale = no ? nb : enUS;

  const [uiState, setUiState] = useState<UpdateState>("idle");
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [error, setError] = useState<{ msg: string; details?: string } | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [progress, setProgress] = useState(0);
  const [step, setStep] = useState("");
  const [logsOpen, setLogsOpen] = useState(false);
  const [webhookOk, setWebhookOk] = useState<boolean | null>(null);
  const [connTest, setConnTest] = useState<{ ok: boolean; message: string; details?: string } | null>(null);
  const [testingConn, setTestingConn] = useState(false);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const appendLog = useCallback((msg: string, level: LogEntry["level"] = "info") => {
    setLogs((prev) => [...prev, mkLog(msg, level)]);
  }, []);

  const stopPoll = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  }, []);

  // Cleanup on unmount
  useEffect(() => () => stopPoll(), [stopPoll]);

  // Auto-sjekk tilkobling ved montering
  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase.functions.invoke("test-git-pull-connection");
        if (data) {
          setConnTest({ ok: data.ok, message: data.message, details: data.details });
          setWebhookOk(data.ok);
        }
      } catch { /* still show manual test button */ }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Check for updates ────────────────────────────────────────────────────
  const checkForUpdates = useCallback(async () => {
    setUiState("checking");
    setError(null);
    try {
      const { data, error: err } = await supabase.functions.invoke("check-updates");

      if (err) throw new Error(err.message);

      if (data?.error || data?.needsSetup) {
        throw new Error(
          data?.error ??
          (no ? "GitHub repository er ikkje konfigurert" : "GitHub repository not configured"),
        );
      }

      setUpdateInfo(data as UpdateInfo);
      toast[data.updateAvailable ? "success" : "info"](
        data.updateAvailable
          ? (no ? "Ny oppdatering tilgjengeleg!" : "New update available!")
          : (no ? "Du har nyaste versjonen" : "You have the latest version"),
      );
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError({ msg: no ? "Kunne ikkje sjekke for oppdateringar" : "Could not check for updates", details: msg });
      toast.error(no ? "Sjekk feilet" : "Check failed");
    } finally {
      setUiState("idle");
    }
  }, [no]);

  // ── Install update ───────────────────────────────────────────────────────
  const installUpdate = useCallback(async () => {
    if (!updateInfo?.updateAvailable) return;

    stopPoll();
    setUiState("updating");
    setLogsOpen(true);
    setProgress(5);
    setLogs([mkLog(no ? "Startar oppdatering..." : "Starting update...")]);
    setStep(no ? "Startar..." : "Starting...");
    setError(null);

    const initialSha = updateInfo.installedVersion.sha;

    try {
      appendLog(no ? "📡 Kontaktar oppdateringsserver..." : "📡 Contacting update server...");
      setProgress(10);

      const { data, error: invokeErr } = await supabase.functions.invoke("trigger-update", {
        body: {},
      });

      // Edge function always returns 200; if supabase still throws, handle it
      if (invokeErr) {
        throw new Error(invokeErr.message ?? "invoke failed");
      }

      // The edge function itself returns {success:false, error:...} for known failures
      if (!data?.success) {
        const errMsg: string = data?.error ?? (no ? "Ukjend feil frå serveren" : "Unknown error from server");
        const details: string = data?.details ?? "";
        const needsUrl: boolean = data?.needsPublicUrl ?? false;
        const connFail: boolean = data?.connectionFailed ?? false;

        appendLog(`❌ ${errMsg}`, "error");
        if (details) appendLog(`📋 ${details}`, "warning");

        setError({ msg: errMsg, details });
        setStep(no ? "Feil" : "Error");
        setProgress(0);
        setUiState("error");

        if (needsUrl) {
          toast.error(no ? "Offentleg URL for git-pull server manglar" : "Public git-pull server URL required");
        } else if (connFail) {
          toast.error(no ? "Kunne ikkje nå git pull serveren" : "Could not reach git pull server");
        } else {
          toast.error(no ? "Oppdatering feilet" : "Update failed");
        }
        return;
      }

      appendLog(no ? "✅ Kommando sendt til serveren — ventar på fullføring..." : "✅ Command sent — waiting for completion...", "success");
      setProgress(20);
      setStep(no ? "Ventar på serveren..." : "Waiting for server...");

      // Poll check-updates every 5 s (max 5 min) until SHA changes
      let polls = 0;
      const maxPolls = 60;

      pollRef.current = setInterval(async () => {
        polls++;
        setProgress(Math.min(90, 20 + Math.round((polls / maxPolls) * 70)));

        if (polls % 6 === 0) {
          appendLog(`🔄 ${no ? "Sjekkar status" : "Checking status"} (${Math.round(polls * 5 / 60)} min)...`);
        }

        try {
          const { data: cd } = await supabase.functions.invoke("check-updates");

          if (cd?.installedVersion?.sha && cd.installedVersion.sha !== initialSha) {
            stopPoll();
            setProgress(100);
            setStep(no ? "Oppdatering fullført!" : "Update complete!");
            appendLog(no ? "✅ Oppdatering fullført!" : "✅ Update complete!", "success");
            setUpdateInfo(cd as UpdateInfo);
            setUiState("done");
            toast.success(no ? "Oppdatering fullført!" : "Update complete!");
            return;
          }

          // If check-updates says not updateAvailable after a while, we're done
          if (!cd?.updateAvailable && polls > 6) {
            stopPoll();
            setProgress(100);
            setStep(no ? "Du har nyaste versjonen" : "You have the latest version");
            appendLog(no ? "✅ Allereie oppdatert" : "✅ Already up to date", "success");
            setUpdateInfo(cd as UpdateInfo);
            setUiState("done");
            toast.success(no ? "Oppdatert!" : "Updated!");
            return;
          }
        } catch { /* ignore poll errors, keep polling */ }

        if (polls >= maxPolls) {
          stopPoll();
          setStep(no ? "Tidsavbrot — sjekk manuelt" : "Timeout — check manually");
          appendLog(no ? "⚠️ Tidsavbrot. Klikk «Sjekk etter oppdatering» for å sjå status." : "⚠️ Timeout. Click 'Check for updates' to see status.", "warning");
          setUiState("idle");
          toast.warning(no ? "Tidsavbrot" : "Timeout");
        }
      }, 5000);
    } catch (e: unknown) {
      stopPoll();
      const msg = e instanceof Error ? e.message : String(e);
      appendLog(`❌ ${msg}`, "error");
      setError({ msg });
      setStep(no ? "Feil" : "Error");
      setProgress(0);
      setUiState("error");
      toast.error(no ? "Oppdatering feilet" : "Update failed");
    }
  }, [updateInfo, no, appendLog, stopPoll]);

  // ── Cancel ────────────────────────────────────────────────────────────────
  const cancelUpdate = useCallback(() => {
    stopPoll();
    setUiState("idle");
    setStep(no ? "Avbrote" : "Cancelled");
    appendLog(no ? "🛑 Avbrote av brukar" : "🛑 Cancelled by user", "warning");
    toast.info(no ? "Avbrote" : "Cancelled");
  }, [no, appendLog, stopPoll]);

  // ── Sync installed version manually ──────────────────────────────────────
  // ── Test connection ──────────────────────────────────────────────────────
  const testConnection = useCallback(async () => {
    setTestingConn(true);
    setConnTest(null);
    try {
      const { data, error: err } = await supabase.functions.invoke("test-git-pull-connection");
      if (err) throw new Error(err.message);
      setConnTest({ ok: data?.ok, message: data?.message, details: data?.details });
      if (data?.ok) toast.success(data.message);
      else toast.error(data?.message ?? (no ? "Tilkobling feila" : "Connection failed"));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setConnTest({ ok: false, message: no ? "Feil ved tilkoblingstest" : "Connection test error", details: msg });
      toast.error(no ? "Tilkoblingstest feila" : "Connection test failed");
    } finally {
      setTestingConn(false);
    }
  }, [no]);

  const syncVersion = async () => {
    const sha = prompt(
      no ? "Lim inn commit SHA (køyr: git rev-parse HEAD)" : "Paste commit SHA (run: git rev-parse HEAD)",
    );
    if (!sha) return;
    try {
      const { error: e } = await supabase.functions.invoke("sync-installed-version", {
        body: { commitSha: sha.trim() },
      });
      if (e) throw e;
      toast.success(no ? "Versjon synkronisert!" : "Version synced!");
      await checkForUpdates();
    } catch {
      toast.error(no ? "Kunne ikkje synkronisere versjon" : "Could not sync version");
    }
  };

  const isUpdating = uiState === "updating";
  const isChecking = uiState === "checking";

  // ─── Render ───────────────────────────────────────────────────────────────
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

        {/* ── Webhook warning ── */}
        {webhookOk === false && (
          <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg flex items-start gap-2">
            <Settings className="h-4 w-4 text-yellow-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-yellow-400">
                {no ? "Git Pull Server URL manglar" : "Git Pull Server URL missing"}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {no
                  ? "Konfigurer ein offentleg URL under Servere → Git Pull Server URL. Lokale IP-ar (192.168.x.x) fungerer ikkje frå skyen."
                  : "Configure a public URL under Servers → Git Pull Server URL. Local IPs (192.168.x.x) won't work from the cloud."}
              </p>
            </div>
          </div>
        )}

        {/* ── Self-hosted notice ── */}
        <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg flex items-start gap-2">
          <AlertCircle className="h-4 w-4 text-blue-400 mt-0.5 shrink-0" />
          <p className="text-xs text-muted-foreground">
            {no
              ? "Berre for self-hosted installasjonar. Oppdateringar skjer via git pull på serveren."
              : "For self-hosted installations only. Updates are performed via git pull on the server."}
          </p>
        </div>

        {/* ── Error banner ── */}
        {error && (
          <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-lg flex items-start gap-2">
            <XCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-destructive">{error.msg}</p>
              {error.details && (
                <p className="text-xs text-muted-foreground mt-0.5">{error.details}</p>
              )}
            </div>
          </div>
        )}

        {/* ── Version info ── */}
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
                <Badge className="bg-green-500">
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
                    <p className="text-xs text-muted-foreground font-mono mt-1">{updateInfo.latestVersion.shortSha}</p>
                  </div>
                  <Badge variant="outline">{no ? "Ny" : "New"}</Badge>
                </div>
                <p className="text-sm font-medium mt-2">{updateInfo.latestVersion.message}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {no ? "av" : "by"} {updateInfo.latestVersion.author} •{" "}
                  {format(new Date(updateInfo.latestVersion.date), "d. MMM yyyy 'kl.' HH:mm", { locale: dateLocale })}
                </p>
              </div>
            )}
          </div>
        )}

        {/* ── Progress / status ── */}
        {(isUpdating || uiState === "done" || uiState === "error") && logs.length > 0 && (
          <div className="space-y-2 p-4 border border-primary/20 rounded-lg bg-primary/5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {isUpdating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : uiState === "done" ? (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                ) : (
                  <XCircle className="h-4 w-4 text-destructive" />
                )}
                <span className="text-sm font-medium">{step}</span>
              </div>
              <div className="flex items-center gap-1">
                {isUpdating && (
                  <Button variant="ghost" size="sm" onClick={cancelUpdate} className="text-destructive h-7 px-2">
                    {no ? "Avbryt" : "Cancel"}
                  </Button>
                )}
                <Dialog open={logsOpen} onOpenChange={setLogsOpen}>
                  <DialogTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-7 px-2">
                      <FileText className="h-3 w-3 mr-1" />
                      {no ? "Loggar" : "Logs"}
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>{no ? "Oppdateringsloggar" : "Update logs"}</DialogTitle>
                      <DialogDescription>
                        {no ? "Detaljert logg frå oppdateringsprosessen" : "Detailed update log"}
                      </DialogDescription>
                    </DialogHeader>
                    <div className="mb-3">
                      <p className="text-xs text-muted-foreground mb-1">{progress}%</p>
                      <Progress value={progress} className="h-1.5" />
                    </div>
                    <ScrollArea className="h-80 rounded-md border p-3">
                      <div className="space-y-1">
                        {logs.map((l, i) => (
                          <div key={i} className="flex gap-2 text-sm">
                            <span className="text-muted-foreground font-mono text-xs shrink-0">
                              {format(new Date(l.ts), "HH:mm:ss")}
                            </span>
                            <span className={levelColor[l.level]}>{l.msg}</span>
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

        {/* ── Connection test result ── */}
        {connTest && (
          <div className={`p-3 rounded-lg border flex items-start gap-2 ${connTest.ok ? "bg-green-500/10 border-green-500/30" : "bg-destructive/10 border-destructive/30"}`}>
            {connTest.ok
              ? <Wifi className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
              : <WifiOff className="h-4 w-4 text-destructive mt-0.5 shrink-0" />}
            <div>
              <p className={`text-sm font-medium ${connTest.ok ? "text-green-500" : "text-destructive"}`}>
                {connTest.message}
              </p>
              {connTest.details && (
                <p className="text-xs text-muted-foreground mt-0.5">{connTest.details}</p>
              )}
            </div>
          </div>
        )}

        {/* ── Actions ── */}
        <div className="flex gap-2 flex-wrap">
          <Button
            onClick={checkForUpdates}
            disabled={isChecking || isUpdating}
            variant="outline"
            className="flex-1 min-w-[140px]"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isChecking ? "animate-spin" : ""}`} />
            {isChecking
              ? (no ? "Sjekkar..." : "Checking...")
              : (no ? "Sjekk etter oppdatering" : "Check for updates")}
          </Button>

          <Button
            onClick={testConnection}
            disabled={testingConn || isUpdating}
            variant="outline"
            size="sm"
            className="shrink-0"
          >
            {testingConn
              ? <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              : <Wifi className="h-4 w-4 mr-1" />}
            {testingConn
              ? (no ? "Testar..." : "Testing...")
              : (no ? "Test tilkobling" : "Test connection")}
          </Button>

          {updateInfo?.updateAvailable && !isUpdating && (
            <>
              <Button onClick={syncVersion} variant="secondary" size="sm" className="shrink-0">
                <CheckCircle className="h-4 w-4 mr-1" />
                {no ? "Synk versjon" : "Sync version"}
              </Button>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button className="flex-1 min-w-[140px]" disabled={webhookOk === false}>
                    <Download className="h-4 w-4 mr-2" />
                    {no ? "Installer oppdatering" : "Install update"}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{no ? "Installer oppdatering?" : "Install update?"}</AlertDialogTitle>
                    <AlertDialogDescription>
                      {no
                        ? "Dette lastar ned nyaste versjon frå GitHub og bygger på nytt. Tek vanlegvis 30–60 sekund."
                        : "This downloads the latest version from GitHub and rebuilds. Usually 30–60 seconds."}
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
