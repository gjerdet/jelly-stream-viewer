import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Loader2, Download, Upload, HardDrive, AlertCircle, ArrowDown, ArrowUp } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Torrent {
  name: string;
  size: number;
  progress: number;
  dlspeed: number;
  upspeed: number;
  state: string;
  eta: number;
}

interface TransferInfo {
  dl_info_speed: number;
  up_info_speed: number;
  dl_info_data: number;
  up_info_data: number;
}

interface QBData {
  torrents: Torrent[];
  transferInfo: TransferInfo;
}

interface QBittorrentStatusProps {
  qbUrl?: string;
}

export const QBittorrentStatus = ({ qbUrl }: QBittorrentStatusProps) => {
  const [data, setData] = useState<QBData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isConfigured, setIsConfigured] = useState(false);

  useEffect(() => {
    // Check if qBittorrent is configured
    if (qbUrl && qbUrl.trim() !== '') {
      setIsConfigured(true);
      fetchStatus();
      const interval = setInterval(fetchStatus, 3000);
      return () => clearInterval(interval);
    } else {
      setIsLoading(false);
      setIsConfigured(false);
    }
  }, [qbUrl]);

  const fetchStatus = async () => {
    try {
      const { data: result, error } = await supabase.functions.invoke("qbittorrent-status");

      if (error) {
        setError(error.message);
        return;
      }

      if (result?.error) {
        setError(result.error + (result.details ? ` - ${result.details}` : ''));
        return;
      }

      setData(result);
      setError(null);
    } catch (err: any) {
      setError(err.message || "Kunne ikke hente qBittorrent status");
    } finally {
      setIsLoading(false);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  const formatSpeed = (bytesPerSec: number) => {
    return formatBytes(bytesPerSec) + '/s';
  };

  const formatEta = (seconds: number) => {
    if (seconds === 8640000) return '∞'; // qBittorrent uses this for unknown
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}t ${minutes}m`;
  };

  const getStateColor = (state: string) => {
    const stateColors: Record<string, string> = {
      downloading: "bg-blue-500",
      uploading: "bg-green-500",
      pausedDL: "bg-yellow-500",
      pausedUP: "bg-yellow-500",
      stalledDL: "bg-orange-500",
      stalledUP: "bg-orange-500",
      queuedDL: "bg-gray-500",
      queuedUP: "bg-gray-500",
      checkingDL: "bg-purple-500",
      checkingUP: "bg-purple-500",
      error: "bg-red-500",
    };
    return stateColors[state] || "bg-gray-500";
  };

  const getStateText = (state: string) => {
    const stateTexts: Record<string, string> = {
      downloading: "Laster ned",
      uploading: "Deler",
      pausedDL: "Pauset",
      pausedUP: "Pauset",
      stalledDL: "Står fast",
      stalledUP: "Står fast",
      queuedDL: "I kø",
      queuedUP: "I kø",
      checkingDL: "Sjekker",
      checkingUP: "Sjekker",
      error: "Feil",
    };
    return stateTexts[state] || state;
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            qBittorrent Status
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
            <Download className="h-5 w-5" />
            qBittorrent Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {error || 'qBittorrent er ikke konfigurert'}
            </AlertDescription>
          </Alert>
          <div className="mt-4 p-4 bg-muted rounded-lg">
            <p className="text-sm font-medium mb-2">Slik kobler du til qBittorrent:</p>
            <ol className="text-sm text-muted-foreground list-decimal list-inside space-y-1">
              <li>Gå til qBittorrent innstillinger → Web UI</li>
              <li>Aktiver Web UI (vanligvis på port 8080)</li>
              <li>Gå til Server Innstillinger under og konfigurer qBittorrent URL, brukernavn og passord</li>
            </ol>
          </div>
        </CardContent>
      </Card>
    );
  }

  const activeTorrents = data?.torrents.filter(t => t.state === 'downloading' || t.state === 'uploading') || [];
  const totalSpeed = data?.transferInfo?.dl_info_speed || 0;
  const totalUpSpeed = data?.transferInfo?.up_info_speed || 0;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            qBittorrent Status
          </CardTitle>
          <CardDescription>
            Nedlastninger og torrent status
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Global stats */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-3 p-3 bg-secondary/20 rounded-lg">
              <ArrowDown className="h-5 w-5 text-blue-500" />
              <div>
                <p className="text-xs text-muted-foreground">Nedlasting</p>
                <p className="text-lg font-semibold">{formatSpeed(totalSpeed)}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-secondary/20 rounded-lg">
              <ArrowUp className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-xs text-muted-foreground">Opplasting</p>
                <p className="text-lg font-semibold">{formatSpeed(totalUpSpeed)}</p>
              </div>
            </div>
          </div>

          {/* Active torrents */}
          {activeTorrents.length > 0 && (
            <div>
              <h4 className="text-sm font-medium mb-3">
                Aktive nedlastninger ({activeTorrents.length})
              </h4>
              <ScrollArea className="h-[300px] pr-4">
                <div className="space-y-3">
                  {activeTorrents.map((torrent, index) => (
                    <div key={index} className="p-3 border rounded-lg space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{torrent.name}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className={getStateColor(torrent.state)}>
                              {getStateText(torrent.state)}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {formatBytes(torrent.size)}
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      <Progress value={torrent.progress * 100} className="h-2" />
                      
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{(torrent.progress * 100).toFixed(1)}%</span>
                        <div className="flex items-center gap-3">
                          <span className="flex items-center gap-1">
                            <ArrowDown className="h-3 w-3" />
                            {formatSpeed(torrent.dlspeed)}
                          </span>
                          <span className="flex items-center gap-1">
                            <ArrowUp className="h-3 w-3" />
                            {formatSpeed(torrent.upspeed)}
                          </span>
                          {torrent.eta > 0 && torrent.eta < 8640000 && (
                            <span>ETA: {formatEta(torrent.eta)}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* All torrents summary */}
          {data && data.torrents.length > 0 && (
            <div className="pt-4 border-t">
              <p className="text-sm text-muted-foreground">
                Totalt {data.torrents.length} torrent{data.torrents.length !== 1 ? 'er' : ''}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
