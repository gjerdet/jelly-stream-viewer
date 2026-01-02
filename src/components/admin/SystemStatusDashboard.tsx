import { useState, useCallback, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Activity,
  RefreshCw,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Server,
  Cpu,
  HardDrive,
  MemoryStick,
  Network,
  Play,
  Square,
  RotateCcw,
  Terminal,
  Clock,
  Wifi,
  Copy,
  ChevronDown,
  ChevronUp,
  Info,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ServiceStatus {
  name: string;
  displayName: string;
  description: string;
  active: boolean;
  state: string;
  loadState: string;
  activeState: string;
  subState: string;
  pid: string | null;
  startedAt: string | null;
  port?: number;
  portOpen?: boolean;
}

interface SystemInfo {
  nodeVersion: string;
  nodeOk: boolean;
  distWritable: boolean;
  netdataRunning: boolean;
}

interface PortStatus {
  port: number;
  name: string;
  open: boolean;
  responseTime?: number;
}

export const SystemStatusDashboard = () => {
  const [services, setServices] = useState<ServiceStatus[]>([]);
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [ports, setPorts] = useState<PortStatus[]>([]);
  const [logs, setLogs] = useState<{ service: string; content: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [gitPullBaseUrl, setGitPullBaseUrl] = useState<string | null>(null);
  const [logsOpen, setLogsOpen] = useState(false);
  const [infoDialogOpen, setInfoDialogOpen] = useState<string | null>(null);

  // Fetch git-pull server URL from settings
  useEffect(() => {
    const fetchBaseUrl = async () => {
      const { data } = await supabase
        .from("server_settings")
        .select("setting_key, setting_value")
        .in("setting_key", ["git_pull_server_url", "update_webhook_url"]);

      const gitPullUrl =
        data?.find((s) => s.setting_key === "git_pull_server_url")?.setting_value ||
        data?.find((s) => s.setting_key === "update_webhook_url")?.setting_value;

      if (gitPullUrl) {
        let baseUrl = gitPullUrl.replace(/\/$/, "");
        if (!baseUrl.startsWith("http://") && !baseUrl.startsWith("https://")) {
          baseUrl = `http://${baseUrl}`;
        }
        setGitPullBaseUrl(baseUrl);
      }
    };
    fetchBaseUrl();
  }, []);

  const checkServiceStatus = useCallback(async () => {
    if (!gitPullBaseUrl) {
      toast.error("Git Pull Server URL ikke konfigurert");
      return;
    }

    setIsLoading(true);
    try {
      // Fetch service status
      const statusRes = await fetch(`${gitPullBaseUrl}/service-status`, {
        signal: AbortSignal.timeout(10000),
      });

      if (statusRes.ok) {
        const statusData = await statusRes.json();
        const servicesList: ServiceStatus[] = [];

        const displayNames: Record<string, { name: string; description: string; port: number }> = {
          "jelly-stream-preview": { name: "Preview (Web UI)", description: "Port 4173", port: 4173 },
          "jelly-git-pull": { name: "Git Pull Server", description: "Port 3002", port: 3002 },
          "jelly-transcode": { name: "Transcode Server", description: "Port 3001", port: 3001 },
        };
        
        for (const [name, info] of Object.entries(statusData.services) as [string, any][]) {
          const display = displayNames[name] || { name, description: "", port: 0 };
          servicesList.push({
            name,
            displayName: display.name,
            description: display.description,
            active: info.active,
            state: info.state,
            loadState: info.loadState,
            activeState: info.activeState,
            subState: info.subState,
            pid: info.pid,
            startedAt: info.startedAt,
            port: display.port,
          });
        }

        setServices(servicesList);
      }

      // Fetch diagnostics
      const diagRes = await fetch(`${gitPullBaseUrl}/diagnostics`, {
        signal: AbortSignal.timeout(10000),
      });

      if (diagRes.ok) {
        const diagData = await diagRes.json();
        setSystemInfo({
          nodeVersion: diagData.diagnostics.node.version,
          nodeOk: diagData.diagnostics.node.ok,
          distWritable: diagData.diagnostics.distPermissions.ok,
          netdataRunning: diagData.diagnostics.netdata.running,
        });
      }

      // Check ports
      const portChecks: PortStatus[] = [
        { port: 4173, name: "Preview", open: false },
        { port: 3002, name: "Git Pull", open: false },
        { port: 3001, name: "Transcode", open: false },
        { port: 19999, name: "Netdata", open: false },
      ];

      // Try to check each port
      for (const portCheck of portChecks) {
        try {
          const start = performance.now();
          const healthUrl = portCheck.port === 4173 
            ? `${gitPullBaseUrl.replace(':3002', `:${portCheck.port}`)}/`
            : portCheck.port === 19999
            ? `${gitPullBaseUrl.replace(':3002', `:${portCheck.port}`)}/api/v1/info`
            : `${gitPullBaseUrl.replace(':3002', `:${portCheck.port}`)}/health`;
          
          const res = await fetch(healthUrl, { 
            signal: AbortSignal.timeout(5000),
            mode: 'no-cors' // Allow checking without CORS issues
          });
          portCheck.open = true;
          portCheck.responseTime = Math.round(performance.now() - start);
        } catch {
          portCheck.open = false;
        }
      }

      setPorts(portChecks);
      setLastChecked(new Date());
    } catch (error) {
      console.error("Failed to fetch system status:", error);
      toast.error("Kunne ikke koble til Git Pull Server");
    } finally {
      setIsLoading(false);
    }
  }, [gitPullBaseUrl]);

  const fetchServiceLogs = async (serviceName: string) => {
    if (!gitPullBaseUrl) {
      toast.error("Git Pull Server URL ikke konfigurert");
      return;
    }

    setIsLoadingLogs(true);
    try {
      // Map display name to actual systemd service name
      const serviceMap: Record<string, string> = {
        "jelly-stream-preview": "jelly-stream-preview",
        "jelly-git-pull": "jelly-git-pull",
        "jelly-transcode": "jelly-transcode",
      };
      const actualServiceName = serviceMap[serviceName] || serviceName;
      
      console.log(`Fetching logs for service: ${actualServiceName}`);
      
      const res = await fetch(
        `${gitPullBaseUrl}/service-logs?service=${actualServiceName}&lines=100`,
        { signal: AbortSignal.timeout(10000) }
      );

      if (res.ok) {
        const data = await res.json();
        if (data.logs) {
          setLogs({ service: actualServiceName, content: data.logs });
          setLogsOpen(true);
        } else if (data.error) {
          toast.error(`Feil: ${data.error}`);
        }
      } else {
        const text = await res.text();
        console.error("Failed to fetch logs:", res.status, text);
        toast.error(`Kunne ikke hente logger (${res.status})`);
      }
    } catch (error) {
      console.error("Error fetching logs:", error);
      toast.error("Kunne ikke hente logger");
    } finally {
      setIsLoadingLogs(false);
    }
  };

  const restartService = async () => {
    if (!gitPullBaseUrl) return;

    try {
      const res = await fetch(`${gitPullBaseUrl}/restart-preview`, {
        method: "POST",
        signal: AbortSignal.timeout(30000),
      });

      if (res.ok) {
        toast.success("Preview-tjenesten restartes...");
        // Wait a bit then refresh status
        setTimeout(() => checkServiceStatus(), 5000);
      } else {
        toast.error("Kunne ikke restarte tjenesten");
      }
    } catch (error) {
      toast.error("Restart feilet");
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Kopiert til utklippstavle");
  };

  const getStatusIcon = (active: boolean) => {
    return active ? (
      <CheckCircle2 className="h-5 w-5 text-green-500" />
    ) : (
      <XCircle className="h-5 w-5 text-destructive" />
    );
  };

  const getStatusBadge = (active: boolean, state: string) => {
    if (active) {
      return (
        <Badge className="bg-green-500/10 text-green-500 border-green-500/20">
          Kjører
        </Badge>
      );
    }
    return <Badge variant="destructive">{state || "Stoppet"}</Badge>;
  };

  // Run initial check when URL is available
  useEffect(() => {
    if (gitPullBaseUrl) {
      checkServiceStatus();
    }
  }, [gitPullBaseUrl, checkServiceStatus]);

  const allServicesOk = services.length > 0 && services.every((s) => s.active);
  const hasErrors = services.some((s) => !s.active);

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Server className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="flex items-center gap-2">
                  System Status
                  {lastChecked && (
                    <>
                      {allServicesOk && (
                        <Badge className="bg-green-500/10 text-green-500 border-green-500/20">
                          Alt OK
                        </Badge>
                      )}
                      {hasErrors && <Badge variant="destructive">Problemer oppdaget</Badge>}
                    </>
                  )}
                </CardTitle>
                <CardDescription>
                  Oversikt over alle systemtjenester og porter
                </CardDescription>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={checkServiceStatus}
              disabled={isLoading || !gitPullBaseUrl}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              <span className="ml-2">Oppdater</span>
            </Button>
          </div>
        </CardHeader>
      </Card>

      {!gitPullBaseUrl && (
        <Card className="border-yellow-500/20 bg-yellow-500/5">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 text-yellow-600">
              <AlertTriangle className="h-5 w-5" />
              <div>
                <p className="font-medium">Git Pull Server ikke konfigurert</p>
                <p className="text-sm text-muted-foreground">
                  Gå til Servere-fanen og konfigurer Git Pull Server URL for å aktivere
                  systemovervåking.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Services Grid */}
      {services.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          {services.map((service) => (
            <Card key={service.name} className="relative overflow-hidden">
              <div
                className={`absolute top-0 left-0 w-1 h-full ${
                  service.active ? "bg-green-500" : "bg-destructive"
                }`}
              />
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(service.active)}
                    <CardTitle className="text-base">{service.displayName}</CardTitle>
                  </div>
                  {getStatusBadge(service.active, service.state)}
                </div>
                <CardDescription>{service.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Activity className="h-3 w-3" />
                    <span>State:</span>
                  </div>
                  <span className="font-mono text-xs">{service.subState}</span>

                  {service.pid && service.pid !== "0" && (
                    <>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Cpu className="h-3 w-3" />
                        <span>PID:</span>
                      </div>
                      <span className="font-mono text-xs">{service.pid}</span>
                    </>
                  )}

                  {service.startedAt && (
                    <>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        <span>Startet:</span>
                      </div>
                      <span className="font-mono text-xs truncate">
                        {service.startedAt.split(" ").slice(1, 4).join(" ")}
                      </span>
                    </>
                  )}
                </div>

                <Separator />

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => fetchServiceLogs(service.name)}
                    disabled={isLoadingLogs}
                  >
                    <Terminal className="h-3 w-3 mr-1" />
                    Logger
                  </Button>
                  {service.name === "jelly-stream-preview" && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={restartService}
                    >
                      <RotateCcw className="h-3 w-3 mr-1" />
                      Restart
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* System Info */}
      {systemInfo && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Cpu className="h-4 w-4" />
              Systemkrav
            </CardTitle>
            <CardDescription>Klikk på et kort for mer informasjon</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-3">
              <button
                onClick={() => setInfoDialogOpen('nodejs')}
                className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-secondary/30 transition-colors cursor-pointer text-left w-full"
              >
                <div className="flex items-center gap-2">
                  <Server className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Node.js</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs">{systemInfo.nodeVersion}</span>
                  {systemInfo.nodeOk ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  ) : (
                    <XCircle className="h-4 w-4 text-destructive" />
                  )}
                </div>
              </button>

              <button
                onClick={() => setInfoDialogOpen('dist')}
                className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-secondary/30 transition-colors cursor-pointer text-left w-full"
              >
                <div className="flex items-center gap-2">
                  <HardDrive className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">dist/ Tilgang</span>
                </div>
                <div className="flex items-center gap-2">
                  {systemInfo.distWritable ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  ) : (
                    <XCircle className="h-4 w-4 text-destructive" />
                  )}
                </div>
              </button>

              <button
                onClick={() => setInfoDialogOpen('netdata')}
                className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-secondary/30 transition-colors cursor-pointer text-left w-full"
              >
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Netdata</span>
                </div>
                <div className="flex items-center gap-2">
                  {systemInfo.netdataRunning ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  ) : (
                    <XCircle className="h-4 w-4 text-destructive" />
                  )}
                </div>
              </button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* System Info Dialogs */}
      <Dialog open={infoDialogOpen === 'nodejs'} onOpenChange={() => setInfoDialogOpen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Server className="h-5 w-5" />
              Node.js
            </DialogTitle>
            <DialogDescription>
              Runtime-miljøet for backend-tjenestene
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/30">
              <span className="text-sm text-muted-foreground">Versjon:</span>
              <span className="font-mono text-sm">{systemInfo?.nodeVersion || 'Ukjent'}</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/30">
              <span className="text-sm text-muted-foreground">Status:</span>
              {systemInfo?.nodeOk ? (
                <Badge className="bg-green-500/10 text-green-500 border-green-500/20">OK</Badge>
              ) : (
                <Badge variant="destructive">Krever oppdatering</Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              Node.js v18+ er påkrevd for å kjøre Git Pull Server og andre backend-tjenester. 
              Hvis versjonen er rød, oppdater Node.js på serveren.
            </p>
            <div className="p-3 rounded-lg bg-secondary/30">
              <p className="text-xs text-muted-foreground mb-1">Sjekk/oppdater Node.js:</p>
              <code className="text-xs font-mono">nvm install --lts && nvm use --lts</code>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={infoDialogOpen === 'dist'} onOpenChange={() => setInfoDialogOpen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <HardDrive className="h-5 w-5" />
              dist/ Tilgang
            </DialogTitle>
            <DialogDescription>
              Skrivetilgang til build-mappen
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/30">
              <span className="text-sm text-muted-foreground">Status:</span>
              {systemInfo?.distWritable ? (
                <Badge className="bg-green-500/10 text-green-500 border-green-500/20">Skrivbar</Badge>
              ) : (
                <Badge variant="destructive">Ikke skrivbar</Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              dist/-mappen må være skrivbar for at Git Pull Server skal kunne oppdatere frontend-bygget 
              etter en git pull. Hvis status er rød, sjekk filrettigheter.
            </p>
            <div className="p-3 rounded-lg bg-secondary/30 space-y-2">
              <p className="text-xs text-muted-foreground">Fiks rettigheter:</p>
              <code className="text-xs font-mono block">sudo chown -R $USER:$USER /path/to/project/dist</code>
              <code className="text-xs font-mono block">chmod -R 755 /path/to/project/dist</code>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={infoDialogOpen === 'netdata'} onOpenChange={() => setInfoDialogOpen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Netdata
            </DialogTitle>
            <DialogDescription>
              Systemovervåking og statistikk
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/30">
              <span className="text-sm text-muted-foreground">Status:</span>
              {systemInfo?.netdataRunning ? (
                <Badge className="bg-green-500/10 text-green-500 border-green-500/20">Kjører</Badge>
              ) : (
                <Badge variant="destructive">Stoppet</Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              Netdata gir sanntidsstatistikk for CPU, minne, nettverk og disk. Den kjører normalt på port 19999. 
              Hvis status er rød, start Netdata-tjenesten.
            </p>
            <div className="p-3 rounded-lg bg-secondary/30 space-y-2">
              <p className="text-xs text-muted-foreground">Start Netdata:</p>
              <code className="text-xs font-mono block">sudo systemctl start netdata</code>
              <code className="text-xs font-mono block">sudo systemctl enable netdata</code>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Ports Status */}
      {ports.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Network className="h-4 w-4" />
              Porter
            </CardTitle>
            <CardDescription>Status for nettverksporter</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-4">
              {ports.map((port) => (
                <div
                  key={port.port}
                  className={`flex items-center justify-between p-3 rounded-lg border ${
                    port.open
                      ? "border-green-500/20 bg-green-500/5"
                      : "border-border bg-card"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {port.open ? (
                      <Wifi className="h-4 w-4 text-green-500" />
                    ) : (
                      <Square className="h-4 w-4 text-muted-foreground" />
                    )}
                    <div>
                      <p className="text-sm font-medium">{port.name}</p>
                      <p className="text-xs text-muted-foreground">:{port.port}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    {port.open ? (
                      <Badge
                        variant="outline"
                        className="bg-green-500/10 text-green-500 border-green-500/20"
                      >
                        Åpen
                      </Badge>
                    ) : (
                      <Badge variant="outline">Stengt</Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* CLI Commands Reference */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Terminal className="h-4 w-4" />
            CLI Kommandoer
          </CardTitle>
          <CardDescription>Hurtigkommandoer for terminal</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {[
            {
              label: "Sjekk alle tjenester",
              cmd: 'echo "Preview: $(systemctl is-active jelly-stream-preview) | Git-Pull: $(systemctl is-active jelly-git-pull) | Transcode: $(systemctl is-active jelly-transcode)"',
            },
            {
              label: "Detaljert status",
              cmd: "sudo systemctl status jelly-stream-preview jelly-git-pull jelly-transcode --no-pager",
            },
            {
              label: "Sjekk porter",
              cmd: "sudo ss -tlnp | grep -E ':(4173|3002|3001)'",
            },
            {
              label: "Preview logger (live)",
              cmd: "sudo journalctl -u jelly-stream-preview -f",
            },
            {
              label: "Restart preview",
              cmd: "sudo systemctl restart jelly-stream-preview",
            },
          ].map((item) => (
            <div
              key={item.label}
              className="flex items-center justify-between p-2 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground mb-1">{item.label}</p>
                <code className="text-xs font-mono text-foreground break-all">
                  {item.cmd}
                </code>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 flex-shrink-0 ml-2"
                onClick={() => copyToClipboard(item.cmd)}
              >
                <Copy className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Logs Viewer */}
      {logs && (
        <Collapsible open={logsOpen} onOpenChange={setLogsOpen}>
          <Card>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-secondary/20 transition-colors">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Terminal className="h-4 w-4" />
                    Logger: {logs.service}
                  </CardTitle>
                  {logsOpen ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent>
                <ScrollArea className="h-[300px] rounded-lg border bg-secondary/20 p-4">
                  <pre className="text-xs font-mono whitespace-pre-wrap text-muted-foreground">
                    {logs.content}
                  </pre>
                </ScrollArea>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      )}

      {/* Last Checked */}
      {lastChecked && (
        <p className="text-xs text-muted-foreground text-right">
          Sist oppdatert: {lastChecked.toLocaleTimeString("no-NO")}
        </p>
      )}
    </div>
  );
};
