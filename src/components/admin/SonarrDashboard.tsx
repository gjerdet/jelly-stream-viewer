import { useQuery } from "@tanstack/react-query";
import { useSonarrApi, SonarrSeries, SonarrHistoryRecord, SonarrQueueItem } from "@/hooks/useSonarrApi";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { AlertCircle, Download, Tv, HardDrive, Calendar } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

const formatBytes = (bytes: number) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('nb-NO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

export const SonarrDashboard = () => {
  const { getHealth, getSeries, getHistory, getQueue, toggleMonitored } = useSonarrApi();
  const [selectedTab, setSelectedTab] = useState("downloads");
  const queryClient = useQueryClient();

  const { data: healthData, error: healthError, isLoading: healthLoading } = useQuery({
    queryKey: ['sonarr-health'],
    queryFn: async () => {
      const result = await getHealth();
      if (result.error) throw result.error;
      return result.data;
    },
    retry: 1,
    refetchInterval: 30000,
  });

  const { data: seriesData, isLoading: seriesLoading } = useQuery({
    queryKey: ['sonarr-series'],
    queryFn: async () => {
      const result = await getSeries();
      if (result.error) throw result.error;
      return result.data as SonarrSeries[];
    },
    enabled: !healthError,
  });

  const { data: historyData, isLoading: historyLoading } = useQuery({
    queryKey: ['sonarr-history'],
    queryFn: async () => {
      const result = await getHistory(1, 100, 'downloadFolderImported');
      if (result.error) throw result.error;
      return result.data;
    },
    enabled: !healthError,
  });

  const { data: queueData, isLoading: queueLoading } = useQuery({
    queryKey: ['sonarr-queue'],
    queryFn: async () => {
      const result = await getQueue();
      if (result.error) throw result.error;
      return result.data;
    },
    enabled: !healthError,
    refetchInterval: 10000,
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ seriesId, monitored }: { seriesId: number; monitored: boolean }) => {
      const result = await toggleMonitored(seriesId, monitored);
      if (result.error) throw result.error;
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sonarr-series'] });
      toast.success('Overvåkingsstatus oppdatert');
    },
    onError: () => {
      toast.error('Kunne ikke oppdatere overvåkingsstatus');
    },
  });

  if (healthError) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Sonarr ikke tilgjengelig</AlertTitle>
        <AlertDescription>
          Kunne ikke koble til Sonarr. Sjekk at URL og API-nøkkel er korrekt konfigurert.
        </AlertDescription>
      </Alert>
    );
  }

  const totalSeries = seriesData?.length || 0;
  const monitoredSeries = seriesData?.filter(s => s.monitored).length || 0;
  const totalSize = seriesData?.reduce((acc, s) => acc + (s.sizeOnDisk || 0), 0) || 0;
  const totalEpisodes = seriesData?.reduce((acc, s) => acc + (s.episodeFileCount || 0), 0) || 0;
  const queueCount = queueData?.records?.length || 0;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Totalt serier</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Tv className="h-4 w-4 text-primary" />
              <span className="text-2xl font-bold">{totalSeries}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Overvåket</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-green-500" />
              <span className="text-2xl font-bold">{monitoredSeries}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Episoder</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Tv className="h-4 w-4 text-blue-500" />
              <span className="text-2xl font-bold">{totalEpisodes}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total størrelse</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <HardDrive className="h-4 w-4 text-orange-500" />
              <span className="text-2xl font-bold">{formatBytes(totalSize)}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">I kø</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Download className="h-4 w-4 text-purple-500" />
              <span className="text-2xl font-bold">{queueCount}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList>
          <TabsTrigger value="downloads">Nedlastinger</TabsTrigger>
          <TabsTrigger value="queue">Kø</TabsTrigger>
          <TabsTrigger value="monitoring">Overvåking</TabsTrigger>
        </TabsList>

        <TabsContent value="downloads" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Siste nedlastinger</CardTitle>
              <CardDescription>Nylig importerte episoder fra Sonarr</CardDescription>
            </CardHeader>
            <CardContent>
              {historyLoading ? (
                <p className="text-muted-foreground">Laster...</p>
              ) : historyData?.records?.length ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Serie / Episode</TableHead>
                      <TableHead>Kvalitet</TableHead>
                      <TableHead>Dato</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {historyData.records.slice(0, 20).map((record: SonarrHistoryRecord) => (
                      <TableRow key={record.id}>
                        <TableCell>
                          <div className="font-medium">{record.series?.title || record.sourceTitle}</div>
                          {record.episode && (
                            <div className="text-sm text-muted-foreground">
                              S{String(record.episode.seasonNumber).padStart(2, '0')}E{String(record.episode.episodeNumber).padStart(2, '0')} - {record.episode.title}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {record.quality?.quality?.name || 'Ukjent'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatDate(record.date)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-muted-foreground">Ingen nedlastinger funnet</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="queue" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Nedlastingskø</CardTitle>
              <CardDescription>Episoder som lastes ned nå</CardDescription>
            </CardHeader>
            <CardContent>
              {queueLoading ? (
                <p className="text-muted-foreground">Laster...</p>
              ) : queueData?.records?.length ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Serie / Episode</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Fremgang</TableHead>
                      <TableHead>Tid igjen</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {queueData.records.map((item: SonarrQueueItem) => {
                      const progress = item.size > 0 
                        ? ((item.size - item.sizeleft) / item.size) * 100 
                        : 0;
                      return (
                        <TableRow key={item.id}>
                          <TableCell>
                            <div className="font-medium">{item.series?.title || item.title}</div>
                            {item.episode && (
                              <div className="text-sm text-muted-foreground">
                                S{String(item.episode.seasonNumber).padStart(2, '0')}E{String(item.episode.episodeNumber).padStart(2, '0')} - {item.episode.title}
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant={item.status === 'downloading' ? 'default' : 'secondary'}>
                              {item.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="w-32">
                              <Progress value={progress} className="h-2" />
                              <span className="text-xs text-muted-foreground">
                                {progress.toFixed(1)}%
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {item.timeleft || '-'}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-muted-foreground">Ingen elementer i køen</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="monitoring" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Serieovervåking</CardTitle>
              <CardDescription>Administrer hvilke serier som overvåkes</CardDescription>
            </CardHeader>
            <CardContent>
              {seriesLoading ? (
                <p className="text-muted-foreground">Laster...</p>
              ) : seriesData?.length ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Serie</TableHead>
                      <TableHead>År</TableHead>
                      <TableHead>Episoder</TableHead>
                      <TableHead>Størrelse</TableHead>
                      <TableHead>Overvåket</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {seriesData
                      .sort((a, b) => a.title.localeCompare(b.title))
                      .map((series: SonarrSeries) => (
                        <TableRow key={series.id}>
                          <TableCell className="font-medium">{series.title}</TableCell>
                          <TableCell>{series.year}</TableCell>
                          <TableCell>
                            {series.episodeFileCount} / {series.episodeCount}
                          </TableCell>
                          <TableCell>{formatBytes(series.sizeOnDisk)}</TableCell>
                          <TableCell>
                            <Switch
                              checked={series.monitored}
                              onCheckedChange={(checked) => 
                                toggleMutation.mutate({ seriesId: series.id, monitored: checked })
                              }
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-muted-foreground">Ingen serier funnet</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
