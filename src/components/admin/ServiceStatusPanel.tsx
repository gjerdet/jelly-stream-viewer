import { useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Server, 
  RefreshCw, 
  Play, 
  Loader2, 
  CheckCircle2, 
  XCircle,
  Clock,
  Hash
} from "lucide-react";
import { useServiceStatus, ServiceInfo } from "@/hooks/useServiceStatus";
import { toast } from "sonner";

const ServiceCard = ({ service }: { service: ServiceInfo }) => {
  const isActive = service.active;
  
  const formatStartTime = (timestamp: string | null) => {
    if (!timestamp) return null;
    try {
      // Parse systemd timestamp format
      const date = new Date(timestamp);
      if (isNaN(date.getTime())) return timestamp;
      return date.toLocaleString('no-NO');
    } catch {
      return timestamp;
    }
  };

  return (
    <div className="p-4 rounded-lg border bg-card">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <Server className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium text-sm">{service.name}</span>
        </div>
        <Badge variant={isActive ? "default" : "destructive"}>
          {isActive ? (
            <span className="flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" /> Active
            </span>
          ) : (
            <span className="flex items-center gap-1">
              <XCircle className="h-3 w-3" /> {service.state}
            </span>
          )}
        </Badge>
      </div>
      
      <div className="space-y-2 text-xs text-muted-foreground">
        <div className="flex justify-between">
          <span>State:</span>
          <span className="font-mono">{service.activeState}/{service.subState}</span>
        </div>
        
        {service.pid && service.pid !== '0' && (
          <div className="flex justify-between">
            <span className="flex items-center gap-1">
              <Hash className="h-3 w-3" /> PID:
            </span>
            <span className="font-mono">{service.pid}</span>
          </div>
        )}
        
        {service.startedAt && (
          <div className="flex justify-between">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" /> Started:
            </span>
            <span className="font-mono text-right">
              {formatStartTime(service.startedAt)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export const ServiceStatusPanel = () => {
  const { status, isLoading, error, fetchStatus, restartPreview } = useServiceStatus();

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const handleRestart = async () => {
    const success = await restartPreview();
    if (success) {
      toast.success("jelly-stream-preview restartet");
    } else {
      toast.error("Kunne ikke restarte tjenesten");
    }
  };

  const previewService = status?.services?.['jelly-stream-preview'];
  const gitPullService = status?.services?.['jelly-git-pull'];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Server className="h-5 w-5" />
            <CardTitle>Systemd Services</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={fetchStatus}
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleRestart}
              disabled={isLoading}
            >
              <Play className="h-4 w-4 mr-1" />
              Restart Web UI
            </Button>
          </div>
        </div>
        <CardDescription>
          Status for lokale systemd-tjenester (port 4173 og 3002)
        </CardDescription>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-4 mb-4">
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Sjekk at git-pull serveren kjører og er tilgjengelig
            </p>
          </div>
        )}

        {!status && !error && isLoading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {status && (
          <div className="grid gap-4 md:grid-cols-2">
            {previewService && <ServiceCard service={previewService} />}
            {gitPullService && <ServiceCard service={gitPullService} />}
          </div>
        )}

        {status && (
          <p className="text-xs text-muted-foreground text-right mt-4">
            Sist oppdatert: {new Date(status.timestamp).toLocaleTimeString('no-NO')}
          </p>
        )}
      </CardContent>
    </Card>
  );
};
