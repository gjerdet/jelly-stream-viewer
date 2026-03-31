import { useState, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Activity,
  RefreshCw,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Server,
  Database,
  Globe,
  Film,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface ServiceCheck {
  name: string;
  description: string;
  status: "checking" | "ok" | "error" | "warning" | "idle";
  message?: string;
  responseTime?: number;
}

export const AppServicesHealth = () => {
  const [services, setServices] = useState<ServiceCheck[]>([
    { name: "Supabase", description: "Database og autentisering", status: "idle" },
    { name: "Jellyfin", description: "Mediaserver", status: "idle" },
    { name: "Jellyseerr", description: "Forespørsler", status: "idle" },
    { name: "Git Pull Server", description: "Oppdateringer (lokal)", status: "idle" },
  ]);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [isChecking, setIsChecking] = useState(false);

  const updateService = (name: string, updates: Partial<ServiceCheck>) => {
    setServices((prev) =>
      prev.map((s) => (s.name === name ? { ...s, ...updates } : s))
    );
  };

  const checkSupabase = async (): Promise<void> => {
    updateService("Supabase", { status: "checking" });
    const start = performance.now();
    try {
      const { data, error } = await supabase
        .from("server_settings")
        .select("setting_key")
        .limit(1);

      const responseTime = Math.round(performance.now() - start);
      if (error) throw error;

      updateService("Supabase", {
        status: "ok",
        message: "Tilkoblet",
        responseTime,
      });
    } catch (err) {
      updateService("Supabase", {
        status: "error",
        message: err instanceof Error ? err.message : "Feil",
        responseTime: Math.round(performance.now() - start),
      });
    }
  };

  const checkJellyfin = async (): Promise<void> => {
    updateService("Jellyfin", { status: "checking" });
    const start = performance.now();
    try {
      const { data: settings } = await supabase
        .from("server_settings")
        .select("setting_key, setting_value")
        .in("setting_key", ["jellyfin_server_url", "jellyfin_api_key"]);

      const serverUrl = settings?.find((s) => s.setting_key === "jellyfin_server_url")?.setting_value;

      if (!serverUrl) {
        updateService("Jellyfin", {
          status: "warning",
          message: "Ikke konfigurert",
          responseTime: Math.round(performance.now() - start),
        });
        return;
      }

      // Route through edge function proxy to avoid Mixed Content / PNA blocks
      const { data: proxyData, error: proxyError } = await supabase.functions.invoke('jellyfin-proxy', {
        body: { endpoint: '/System/Info', method: 'GET' },
      });

      const responseTime = Math.round(performance.now() - start);

      if (proxyError || !proxyData?.ServerName) {
        updateService("Jellyfin", {
          status: "error",
          message: proxyError?.message || "Kunne ikke koble til",
          responseTime,
        });
      } else {
        updateService("Jellyfin", {
          status: "ok",
          message: `v${proxyData.Version}`,
          responseTime,
        });
      }
    } catch (err) {
      updateService("Jellyfin", {
        status: "error",
        message: err instanceof Error ? err.message : "Feil",
        responseTime: Math.round(performance.now() - start),
      });
    }
  };

  const checkJellyseerr = async (): Promise<void> => {
    updateService("Jellyseerr", { status: "checking" });
    const start = performance.now();
    try {
      const { data: settings } = await supabase
        .from("server_settings")
        .select("setting_key, setting_value")
        .in("setting_key", ["jellyseerr_url", "jellyseerr_api_key"]);

      const url = settings?.find((s) => s.setting_key === "jellyseerr_url")?.setting_value;
      const apiKey = settings?.find((s) => s.setting_key === "jellyseerr_api_key")?.setting_value;

      if (!url) {
        updateService("Jellyseerr", {
          status: "warning",
          message: "Ikke konfigurert",
          responseTime: Math.round(performance.now() - start),
        });
        return;
      }

      const { data, error } = await supabase.functions.invoke("jellyseerr-test", {
        body: { url, apiKey },
      });

      const responseTime = Math.round(performance.now() - start);

      if (error) throw error;

      if (data?.success) {
        updateService("Jellyseerr", {
          status: "ok",
          message: `v${data.data?.version || "OK"}`,
          responseTime,
        });
      } else {
        updateService("Jellyseerr", {
          status: "error",
          message: data?.message || "Feil",
          responseTime,
        });
      }
    } catch (err) {
      updateService("Jellyseerr", {
        status: "error",
        message: err instanceof Error ? err.message : "Feil",
        responseTime: Math.round(performance.now() - start),
      });
    }
  };

  const checkGitPullServer = async (): Promise<void> => {
    updateService("Git Pull Server", { status: "checking" });
    const start = performance.now();
    try {
      // Check via database: the git-pull server polls the DB every 30s.
      // We look at the most recent update_status row to see if the server is active.
      const { data: settings } = await supabase
        .from("server_settings")
        .select("setting_key, setting_value")
        .eq("setting_key", "git_pull_server_url");

      const gitPullUrl = settings?.[0]?.setting_value;

      if (!gitPullUrl) {
        updateService("Git Pull Server", {
          status: "warning",
          message: "Ikke konfigurert",
          responseTime: Math.round(performance.now() - start),
        });
        return;
      }

      // Check the edge function to test git pull connection (goes through proxy)
      const { data, error } = await supabase.functions.invoke("test-git-pull-connection");
      const responseTime = Math.round(performance.now() - start);

      if (error) throw error;

      if (data?.ok) {
        updateService("Git Pull Server", {
          status: "ok",
          message: "Kjører (polling aktiv)",
          responseTime,
        });
      } else {
        // If it's a timeout/connection issue from edge function trying to reach local server,
        // fall back to checking if DB polling is working by looking at update_status
        const { data: statusRows } = await supabase
          .from("update_status")
          .select("updated_at, status")
          .order("updated_at", { ascending: false })
          .limit(1);

        const lastActivity = statusRows?.[0]?.updated_at;
        if (lastActivity) {
          const minutesAgo = Math.round((Date.now() - new Date(lastActivity).getTime()) / 60000);
          updateService("Git Pull Server", {
            status: minutesAgo < 5 ? "ok" : "warning",
            message: minutesAgo < 5 ? `Aktiv (${minutesAgo}m siden)` : `Sist aktiv ${minutesAgo}m siden`,
            responseTime,
          });
        } else {
          updateService("Git Pull Server", {
            status: "warning",
            message: data?.message || "Lokal server ikke nåbar fra sky",
            responseTime,
          });
        }
      }
    } catch (err) {
      updateService("Git Pull Server", {
        status: "warning",
        message: "Lokal server – kan ikke sjekkes fra sky",
        responseTime: Math.round(performance.now() - start),
      });
    }
  };

  const runAllChecks = useCallback(async () => {
    setIsChecking(true);
    
    // Run all checks in parallel
    await Promise.all([
      checkSupabase(),
      checkJellyfin(),
      checkJellyseerr(),
      checkGitPullServer(),
    ]);

    setLastChecked(new Date());
    setIsChecking(false);
  }, []);

  const getStatusIcon = (status: ServiceCheck["status"]) => {
    switch (status) {
      case "checking":
        return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />;
      case "ok":
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case "error":
        return <XCircle className="h-4 w-4 text-destructive" />;
      case "warning":
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      default:
        return <div className="h-4 w-4 rounded-full bg-muted" />;
    }
  };

  const getServiceIcon = (name: string) => {
    switch (name) {
      case "Supabase":
        return <Database className="h-4 w-4 text-muted-foreground" />;
      case "Jellyfin":
        return <Film className="h-4 w-4 text-muted-foreground" />;
      case "Jellyseerr":
        return <Globe className="h-4 w-4 text-muted-foreground" />;
      case "Git Pull Server":
        return <Server className="h-4 w-4 text-muted-foreground" />;
      default:
        return <Server className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: ServiceCheck["status"]) => {
    switch (status) {
      case "ok":
        return <Badge variant="default" className="bg-green-500/10 text-green-500 border-green-500/20">OK</Badge>;
      case "error":
        return <Badge variant="destructive">Feil</Badge>;
      case "warning":
        return <Badge variant="secondary" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20">Advarsel</Badge>;
      case "checking":
        return <Badge variant="secondary">Sjekker...</Badge>;
      default:
        return <Badge variant="outline">Ikke sjekket</Badge>;
    }
  };

  const allOk = services.every((s) => s.status === "ok");
  const hasErrors = services.some((s) => s.status === "error");

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            <CardTitle>App Services</CardTitle>
            {lastChecked && (
              <>
                {allOk && <Badge variant="default" className="bg-green-500/10 text-green-500 border-green-500/20">Alt OK</Badge>}
                {hasErrors && <Badge variant="destructive">Feil oppdaget</Badge>}
              </>
            )}
          </div>
          <Button variant="outline" size="sm" onClick={runAllChecks} disabled={isChecking}>
            {isChecking ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            <span className="ml-2">Sjekk alle</span>
          </Button>
        </div>
        <CardDescription>
          Status for alle tjenester appen er avhengig av
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {services.map((service) => (
            <div
              key={service.name}
              className="flex items-center justify-between p-3 rounded-lg border bg-card"
            >
              <div className="flex items-center gap-3">
                {getServiceIcon(service.name)}
                <div>
                  <p className="font-medium text-sm">{service.name}</p>
                  <p className="text-xs text-muted-foreground">{service.description}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {service.message && service.status !== "idle" && (
                  <span className="text-xs text-muted-foreground max-w-[150px] truncate">
                    {service.message}
                  </span>
                )}
                {service.responseTime && (
                  <span className="text-xs text-muted-foreground">{service.responseTime}ms</span>
                )}
                <div className="flex items-center gap-2">
                  {getStatusIcon(service.status)}
                  {getStatusBadge(service.status)}
                </div>
              </div>
            </div>
          ))}
        </div>

        {lastChecked && (
          <p className="text-xs text-muted-foreground text-right mt-4">
            Sist sjekket: {lastChecked.toLocaleTimeString("no-NO")}
          </p>
        )}
      </CardContent>
    </Card>
  );
};
