import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Loader2, Server, Cpu, HardDrive, Activity, AlertCircle, RefreshCw } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

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

  // Fetch git_pull_server_url from settings
  const { data: gitPullServerUrl } = useQuery({
    queryKey: ["server-settings", "git_pull_server_url"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("server_settings")
        .select("setting_value")
        .eq("setting_key", "git_pull_server_url")
        .maybeSingle();
      
      if (error) throw error;
      return data?.setting_value || null;
    },
  });

  useEffect(() => {
    // Check if monitoring is configured
    if (monitoringUrl && monitoringUrl.trim() !== '' && gitPullServerUrl) {
      setIsConfigured(true);
      fetchStats();
      const interval = setInterval(fetchStats, 5000);
      return () => clearInterval(interval);
    } else {
      setIsLoading(false);
      setIsConfigured(false);
    }
  }, [monitoringUrl, gitPullServerUrl]);

  const fetchStats = async () => {
    if (!gitPullServerUrl) {
      setError('Git pull server URL er ikke konfigurert');
      setIsLoading(false);
      return;
    }

    try {
      // Build the server-stats URL from git-pull server base URL
      const baseUrl = gitPullServerUrl.replace(/\/git-pull\/?$/, '');
      const statsUrl = `${baseUrl}/server-stats?monitoring_url=${encodeURIComponent(monitoringUrl || 'http://localhost:19999')}`;
      
      const response = await fetch(statsUrl);
      const data = await response.json();

      if (!response.ok) {
        setError(data.error + (data.suggestion ? ` - ${data.suggestion}` : ''));
        setIsLoading(false);
        return;
      }

      setStats(data);
      setError(null);
      setIsLoading(false);
    } catch (err: any) {
      console.error('Server stats exception:', err);
      setError(err.message || "Kunne ikke hente server statistikk");
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
    const missingGitPullServer = !gitPullServerUrl;
    
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
            <ol className="text-sm text-muted-foreground list-decimal list-inside space-y-2">
              <li>Installer Netdata på serveren din: <code className="bg-background px-1 rounded">bash &lt;(curl -Ss https://my-netdata.io/kickstart.sh)</code></li>
              <li>
                Sett opp Git Pull Server: <code className="bg-background px-1 rounded">sudo bash setup-git-pull-service.sh</code>
                {missingGitPullServer && <span className="text-yellow-500 ml-1">(mangler)</span>}
              </li>
              <li>Konfigurer Git Pull Server URL i Server Innstillinger (f.eks. <code className="bg-background px-1 rounded">http://192.168.x.x:3002/git-pull</code>)</li>
              <li>Sett Monitoring URL til: <code className="bg-background px-1 rounded">http://localhost:19999</code></li>
              <li>Restart git-pull-serveren: <code className="bg-background px-1 rounded">sudo systemctl restart jelly-git-pull</code></li>
            </ol>
          </div>
          {gitPullServerUrl && (
            <Button 
              variant="outline" 
              size="sm" 
              className="mt-4"
              onClick={() => {
                setIsLoading(true);
                fetchStats();
              }}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Prøv igjen
            </Button>
          )}
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

      {/* Netdata Dashboard iframe */}
      {monitoringUrl && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Netdata Dashboard
            </CardTitle>
            <CardDescription>
              Full server overvåking med sanntidsdata
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="w-full" style={{ height: '600px' }}>
              <iframe 
                src={monitoringUrl}
                className="w-full h-full border-0 rounded-b-lg"
                title="Netdata Dashboard"
                sandbox="allow-scripts allow-same-origin"
              />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
