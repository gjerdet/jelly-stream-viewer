import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw, CheckCircle2, AlertTriangle, XCircle, Loader2, Activity } from "lucide-react";
import { useHealthCheck } from "@/hooks/useHealthCheck";
import { Badge } from "@/components/ui/badge";

export const HealthCheckDashboard = () => {
  const { healthStatus, isChecking, performHealthCheck } = useHealthCheck(true, 60000);

  const getStatusIcon = (status: "healthy" | "degraded" | "down" | "checking") => {
    switch (status) {
      case "healthy":
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case "degraded":
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case "down":
        return <XCircle className="h-5 w-5 text-red-500" />;
      case "checking":
        return <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />;
    }
  };

  const getStatusColor = (status: "healthy" | "degraded" | "down" | "checking") => {
    switch (status) {
      case "healthy":
        return "bg-green-500/10 text-green-500 hover:bg-green-500/20";
      case "degraded":
        return "bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20";
      case "down":
        return "bg-red-500/10 text-red-500 hover:bg-red-500/20";
      case "checking":
        return "bg-muted text-muted-foreground";
    }
  };

  const getOverallBadgeVariant = (status: "healthy" | "degraded" | "down") => {
    switch (status) {
      case "healthy":
        return "default";
      case "degraded":
        return "secondary";
      case "down":
        return "destructive";
    }
  };

  const getStatusText = (status: "healthy" | "degraded" | "down" | "checking") => {
    switch (status) {
      case "healthy":
        return "Tilkoblet";
      case "degraded":
        return "Degradert";
      case "down":
        return "Nede";
      case "checking":
        return "Sjekker...";
    }
  };

  const formatResponseTime = (ms?: number) => {
    if (!ms) return "";
    return `${ms}ms`;
  };

  const services = [
    healthStatus.jellyfin,
    healthStatus.jellyseerr,
    healthStatus.database,
    healthStatus.netdata,
  ];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            <CardTitle>System Health</CardTitle>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant={getOverallBadgeVariant(healthStatus.overallStatus)}>
              {healthStatus.overallStatus === "healthy" && "Alle tjenester OK"}
              {healthStatus.overallStatus === "degraded" && "Noen tjenester har problemer"}
              {healthStatus.overallStatus === "down" && "Kritisk feil"}
            </Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={performHealthCheck}
              disabled={isChecking}
            >
              {isChecking ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
        <CardDescription>
          Sanntidsovervåking av alle systemtjenester
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {services.map((service) => (
            <Card key={service.name} className="overflow-hidden">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium">
                    {service.name}
                  </CardTitle>
                  {getStatusIcon(service.status)}
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className={`inline-flex items-center rounded-md px-2.5 py-0.5 text-xs font-semibold transition-colors ${getStatusColor(service.status)}`}>
                  {getStatusText(service.status)}
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2">
                  {service.message}
                </p>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{service.lastChecked.toLocaleTimeString('no-NO')}</span>
                  {service.responseTime && (
                    <span className="font-mono">{formatResponseTime(service.responseTime)}</span>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {healthStatus.overallStatus !== "healthy" && (
          <div className="mt-4 rounded-lg border border-yellow-500/20 bg-yellow-500/10 p-4">
            <div className="flex gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500 flex-shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-yellow-600 dark:text-yellow-400">
                  Noen tjenester er ikke tilgjengelige
                </p>
                <p className="text-xs text-muted-foreground">
                  Sjekk konfigurasjonen i innstillingene eller se i loggen for mer informasjon.
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
