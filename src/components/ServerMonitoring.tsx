import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Loader2, Server, Cpu, HardDrive, Activity, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface ServerStats {
  systemInfo?: any;
  cpu?: any;
  ram?: any;
  disk?: any;
  network?: any;
}

interface ServerMonitoringProps {
  monitoringUrl?: string;
}

export const ServerMonitoring = ({ monitoringUrl }: ServerMonitoringProps) => {
  const [stats, setStats] = useState<ServerStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isConfigured, setIsConfigured] = useState(false);

  useEffect(() => {
    // Check if monitoring is configured
    if (monitoringUrl && monitoringUrl.trim() !== '') {
      setIsConfigured(true);
      fetchStats();
      const interval = setInterval(fetchStats, 5000);
      return () => clearInterval(interval);
    } else {
      setIsLoading(false);
      setIsConfigured(false);
    }
  }, [monitoringUrl]);

  const fetchStats = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("server-stats");

      if (error) {
        setError(error.message);
        return;
      }

      if (data?.error) {
        setError(data.error + (data.suggestion ? ` - ${data.suggestion}` : ''));
        return;
      }

      setStats(data);
      setError(null);
    } catch (err: any) {
      setError(err.message || "Kunne ikke hente server statistikk");
    } finally {
      setIsLoading(false);
    }
  };

  const getCpuUsage = () => {
    if (!stats?.cpu?.data) return 0;
    const latestData = stats.cpu.data[stats.cpu.data.length - 1];
    if (!latestData || !Array.isArray(latestData)) return 0;
    // Sum all CPU values (user, system, etc.)
    return latestData.slice(1).reduce((acc: number, val: number) => acc + (val || 0), 0);
  };

  const getRamUsage = () => {
    if (!stats?.ram?.data) return { used: 0, total: 0, percentage: 0 };
    const latestData = stats.ram.data[stats.ram.data.length - 1];
    if (!latestData || !Array.isArray(latestData)) return { used: 0, total: 0, percentage: 0 };
    
    const used = latestData[1] || 0;
    const cached = latestData[2] || 0;
    const free = latestData[3] || 0;
    const total = used + cached + free;
    const percentage = total > 0 ? (used / total) * 100 : 0;

    return {
      used: (used / 1024).toFixed(1), // Convert to GB
      total: (total / 1024).toFixed(1),
      percentage: percentage.toFixed(1),
    };
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="h-5 w-5" />
            Server Statistikk
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  if (!isConfigured || error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="h-5 w-5" />
            Server Statistikk
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {error || 'Server overvåkning er ikke konfigurert'}
            </AlertDescription>
          </Alert>
          <div className="mt-4 p-4 bg-muted rounded-lg">
            <p className="text-sm font-medium mb-2">Slik setter du opp server overvåking:</p>
            <ol className="text-sm text-muted-foreground list-decimal list-inside space-y-1">
              <li>Installer Netdata på serveren din: <code className="bg-background px-1 rounded">bash &lt;(curl -Ss https://my-netdata.io/kickstart.sh)</code></li>
              <li>Gå til Server Innstillinger under</li>
              <li>Sett Monitoring URL til: <code className="bg-background px-1 rounded">http://localhost:19999</code></li>
              <li>Oppfrisk denne siden</li>
            </ol>
          </div>
        </CardContent>
      </Card>
    );
  }

  const cpuUsage = getCpuUsage();
  const ramUsage = getRamUsage();

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="h-5 w-5" />
            Server Statistikk
          </CardTitle>
          <CardDescription>
            Live server ressurs overvåking
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* CPU Usage */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Cpu className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">CPU Bruk</span>
              </div>
              <span className="text-sm text-muted-foreground">
                {cpuUsage.toFixed(1)}%
              </span>
            </div>
            <Progress value={cpuUsage} className="h-2" />
          </div>

          {/* RAM Usage */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">RAM Bruk</span>
              </div>
              <span className="text-sm text-muted-foreground">
                {ramUsage.used} GB / {ramUsage.total} GB
              </span>
            </div>
            <Progress value={parseFloat(ramUsage.percentage.toString())} className="h-2" />
          </div>

          {/* System Info */}
          {stats?.systemInfo && (
            <div className="pt-4 border-t">
              <div className="flex items-center gap-2 mb-3">
                <HardDrive className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">System Info</span>
              </div>
              <dl className="grid grid-cols-2 gap-2 text-sm">
                {stats.systemInfo.os_name && (
                  <>
                    <dt className="text-muted-foreground">OS:</dt>
                    <dd>{stats.systemInfo.os_name}</dd>
                  </>
                )}
                {stats.systemInfo.os_version && (
                  <>
                    <dt className="text-muted-foreground">Versjon:</dt>
                    <dd>{stats.systemInfo.os_version}</dd>
                  </>
                )}
                {stats.systemInfo.cores_total && (
                  <>
                    <dt className="text-muted-foreground">CPU Kjerner:</dt>
                    <dd>{stats.systemInfo.cores_total}</dd>
                  </>
                )}
              </dl>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
