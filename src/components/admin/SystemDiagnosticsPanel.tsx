import { useState, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Stethoscope,
  RefreshCw,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Copy,
  Terminal,
  Cpu,
  HardDrive,
  Activity,
  Server,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface DiagnosticsResult {
  node: {
    ok: boolean;
    version: string;
    required: string;
    message: string;
  };
  distPermissions: {
    ok: boolean;
    writable: boolean;
    exists: boolean;
    message: string;
  };
  netdata: {
    ok: boolean;
    running: boolean;
    message: string;
  };
  services: {
    preview: { ok: boolean; active: boolean; exists: boolean };
    gitPull: { ok: boolean; active: boolean; exists: boolean };
  };
}

interface FixCommands {
  nodeVersion: string;
  distPermissions: string;
  netdataInstall: string;
  netdataStart: string;
  previewService: string;
  gitPullService: string;
}

const DiagnosticItem = ({
  title,
  icon: Icon,
  ok,
  message,
  fixCommand,
  onCopy,
}: {
  title: string;
  icon: React.ElementType;
  ok: boolean;
  message: string;
  fixCommand?: string;
  onCopy: (cmd: string) => void;
}) => (
  <div className="p-4 rounded-lg border bg-card">
    <div className="flex items-start justify-between mb-2">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <span className="font-medium text-sm">{title}</span>
      </div>
      <Badge variant={ok ? "default" : "destructive"}>
        {ok ? (
          <span className="flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" /> OK
          </span>
        ) : (
          <span className="flex items-center gap-1">
            <XCircle className="h-3 w-3" /> Problem
          </span>
        )}
      </Badge>
    </div>
    <p className="text-sm text-muted-foreground mb-2">{message}</p>
    {!ok && fixCommand && (
      <div className="mt-2 p-2 bg-muted rounded text-xs font-mono flex items-center justify-between gap-2">
        <code className="break-all">{fixCommand}</code>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 flex-shrink-0"
          onClick={() => onCopy(fixCommand)}
        >
          <Copy className="h-3 w-3" />
        </Button>
      </div>
    )}
  </div>
);

export const SystemDiagnosticsPanel = () => {
  const [diagnostics, setDiagnostics] = useState<DiagnosticsResult | null>(null);
  const [fixCommands, setFixCommands] = useState<FixCommands | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runDiagnostics = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Get git_pull_server_url from database
      const { data: settings } = await supabase
        .from("server_settings")
        .select("setting_value")
        .eq("setting_key", "git_pull_server_url")
        .maybeSingle();

      const gitPullUrl = settings?.setting_value;
      
      if (!gitPullUrl) {
        setError("Git pull server URL ikke konfigurert");
        setIsLoading(false);
        return;
      }

      // Normalize URL
      let baseUrl = gitPullUrl.replace(/\/$/, '');
      if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
        baseUrl = `http://${baseUrl}`;
      }

      const response = await fetch(`${baseUrl}/diagnostics`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(15000),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      setDiagnostics(data.diagnostics);
      setFixCommands(data.fixCommands);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Ukjent feil";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Kommando kopiert til utklippstavle");
  };

  const allOk = diagnostics && 
    diagnostics.node.ok && 
    diagnostics.distPermissions.ok && 
    diagnostics.netdata.ok &&
    diagnostics.services.preview.ok &&
    diagnostics.services.gitPull.ok;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Stethoscope className="h-5 w-5" />
            <CardTitle>System Diagnostics</CardTitle>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={runDiagnostics} 
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            <span className="ml-2">Kjør sjekk</span>
          </Button>
        </div>
        <CardDescription>
          Tester Node-versjon, skriverettigheter til dist/, og Netdata-status
        </CardDescription>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-4 mb-4">
            <div className="flex gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-destructive font-medium">Kunne ikke kjøre diagnostikk</p>
                <p className="text-xs text-muted-foreground mt-1">{error}</p>
              </div>
            </div>
          </div>
        )}

        {!diagnostics && !error && !isLoading && (
          <div className="text-center py-8 text-muted-foreground">
            <Terminal className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>Klikk "Kjør sjekk" for å teste systemet</p>
          </div>
        )}

        {isLoading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {diagnostics && fixCommands && (
          <>
            {allOk && (
              <div className="rounded-lg border border-green-500/20 bg-green-500/10 p-4 mb-4">
                <div className="flex gap-2 items-center">
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                  <p className="text-sm font-medium text-green-700 dark:text-green-400">
                    Alle systemsjekker OK!
                  </p>
                </div>
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              <DiagnosticItem
                title="Node.js versjon"
                icon={Cpu}
                ok={diagnostics.node.ok}
                message={diagnostics.node.message}
                fixCommand={fixCommands.nodeVersion}
                onCopy={copyToClipboard}
              />

              <DiagnosticItem
                title="dist/ skrivetilgang"
                icon={HardDrive}
                ok={diagnostics.distPermissions.ok}
                message={diagnostics.distPermissions.message}
                fixCommand={fixCommands.distPermissions}
                onCopy={copyToClipboard}
              />

              <DiagnosticItem
                title="Netdata monitoring"
                icon={Activity}
                ok={diagnostics.netdata.ok}
                message={diagnostics.netdata.message}
                fixCommand={diagnostics.netdata.running ? undefined : fixCommands.netdataStart}
                onCopy={copyToClipboard}
              />

              <DiagnosticItem
                title="jelly-stream-preview"
                icon={Server}
                ok={diagnostics.services.preview.ok}
                message={
                  diagnostics.services.preview.exists
                    ? diagnostics.services.preview.active
                      ? "Service kjører ✓"
                      : "Service eksisterer men kjører ikke"
                    : "Service ikke opprettet"
                }
                fixCommand={fixCommands.previewService}
                onCopy={copyToClipboard}
              />

              <DiagnosticItem
                title="jelly-git-pull"
                icon={Server}
                ok={diagnostics.services.gitPull.ok}
                message={
                  diagnostics.services.gitPull.exists
                    ? diagnostics.services.gitPull.active
                      ? "Service kjører ✓"
                      : "Service eksisterer men kjører ikke"
                    : "Service ikke opprettet"
                }
                fixCommand={fixCommands.gitPullService}
                onCopy={copyToClipboard}
              />
            </div>

            {!diagnostics.netdata.running && (
              <div className="mt-4 p-4 border rounded-lg bg-muted/50">
                <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                  <Activity className="h-4 w-4" />
                  Installer Netdata
                </h4>
                <p className="text-xs text-muted-foreground mb-3">
                  Netdata gir deg sanntidsovervåking av CPU, RAM, disk og nettverk.
                </p>
                <div className="p-2 bg-background rounded text-xs font-mono flex items-center justify-between gap-2">
                  <code className="break-all">{fixCommands.netdataInstall}</code>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 flex-shrink-0"
                    onClick={() => copyToClipboard(fixCommands.netdataInstall)}
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};
