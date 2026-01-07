import { useQuery } from "@tanstack/react-query";
import { useSonarrApi, SonarrSeries, SonarrHistoryRecord, SonarrQueueItem, SonarrSeason } from "@/hooks/useSonarrApi";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { AlertCircle, Download, Tv, HardDrive, Calendar, ChevronDown, ChevronRight, Search, ToggleLeft, ToggleRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";

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
  const { getHealth, getSeries, getHistory, getQueue, toggleMonitored, toggleSeasonMonitored, toggleAllSeasonsMonitored } = useSonarrApi();
  const [selectedTab, setSelectedTab] = useState("downloads");
  const [expandedSeries, setExpandedSeries] = useState<Set<number>>(new Set());
  const [seriesSearch, setSeriesSearch] = useState("");
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
      // Sonarr v3 API uses numeric eventType: 1=grabbed, 3=downloadFolderImported
      const result = await getHistory(1, 100);
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

  const toggleSeasonMutation = useMutation({
    mutationFn: async ({ seriesId, seasonNumber, monitored }: { seriesId: number; seasonNumber: number; monitored: boolean }) => {
      const result = await toggleSeasonMonitored(seriesId, seasonNumber, monitored);
      if (result.error) throw result.error;
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sonarr-series'] });
      toast.success('Sesong-overvåking oppdatert');
    },
    onError: (error) => {
      console.error('Toggle season error:', error);
      toast.error('Kunne ikke oppdatere sesong-overvåking');
    },
  });

  const toggleAllSeasonsMutation = useMutation({
    mutationFn: async ({ seriesId, monitored }: { seriesId: number; monitored: boolean }) => {
      const result = await toggleAllSeasonsMonitored(seriesId, monitored);
      if (result.error) throw result.error;
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sonarr-series'] });
      toast.success('Alle sesongar oppdatert');
    },
    onError: (error) => {
      console.error('Toggle all seasons error:', error);
      toast.error('Kunne ikke oppdatere alle sesongar');
    },
  });

  const toggleExpandSeries = (seriesId: number) => {
    setExpandedSeries(prev => {
      const next = new Set(prev);
      if (next.has(seriesId)) {
        next.delete(seriesId);
      } else {
        next.add(seriesId);
      }
      return next;
    });
  };

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
              <CardDescription>Administrer hvilke serier og sesongar som overvåkes. Klikk på ei serie for å vise sesongar.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Search field */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Søk etter serie..."
                  value={seriesSearch}
                  onChange={(e) => setSeriesSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              
              {seriesLoading ? (
                <p className="text-muted-foreground">Laster...</p>
              ) : seriesData?.length ? (
                <div className="space-y-2">
                  {seriesData
                    .filter((s) => s.title.toLowerCase().includes(seriesSearch.toLowerCase()))
                    .sort((a, b) => a.title.localeCompare(b.title))
                    .map((series: SonarrSeries) => {
                      const isExpanded = expandedSeries.has(series.id);
                      const seasons = series.seasons?.filter(s => s.seasonNumber > 0).sort((a, b) => a.seasonNumber - b.seasonNumber) || [];
                      const totalEps = series.episodeCount ?? seasons.reduce((acc, s) => acc + (s.statistics?.totalEpisodeCount || 0), 0);
                      const fileEps = series.episodeFileCount ?? seasons.reduce((acc, s) => acc + (s.statistics?.episodeFileCount || 0), 0);
                      
                      return (
                        <Collapsible key={series.id} open={isExpanded} onOpenChange={() => toggleExpandSeries(series.id)}>
                          <div className="border rounded-lg">
                            <div className="flex items-center justify-between p-3 hover:bg-muted/50">
                              <CollapsibleTrigger className="flex items-center gap-2 flex-1 text-left">
                                {isExpanded ? (
                                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                ) : (
                                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                )}
                                <span className="font-medium">{series.title}</span>
                                <span className="text-sm text-muted-foreground">({series.year})</span>
                                <Badge variant="outline" className="ml-2">
                                  {fileEps} / {totalEps} ep
                                </Badge>
                              </CollapsibleTrigger>
                              <div className="flex items-center gap-4">
                                <span className="text-sm text-muted-foreground">{formatBytes(series.sizeOnDisk || 0)}</span>
                                <Switch
                                  checked={series.monitored}
                                  onCheckedChange={(checked) => 
                                    toggleMutation.mutate({ seriesId: series.id, monitored: checked })
                                  }
                                />
                              </div>
                            </div>
                            
                            <CollapsibleContent>
                              {seasons.length > 0 && (
                                <div className="border-t bg-muted/30 p-3">
                                  <div className="flex items-center justify-between mb-2">
                                    <p className="text-sm font-medium text-muted-foreground">Sesongar</p>
                                    <div className="flex gap-2">
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => toggleAllSeasonsMutation.mutate({ seriesId: series.id, monitored: false })}
                                        disabled={toggleAllSeasonsMutation.isPending}
                                        className="h-7 text-xs"
                                      >
                                        <ToggleLeft className="h-3 w-3 mr-1" />
                                        Slå av alle
                                      </Button>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => toggleAllSeasonsMutation.mutate({ seriesId: series.id, monitored: true })}
                                        disabled={toggleAllSeasonsMutation.isPending}
                                        className="h-7 text-xs"
                                      >
                                        <ToggleRight className="h-3 w-3 mr-1" />
                                        Slå på alle
                                      </Button>
                                    </div>
                                  </div>
                                  <div className="space-y-2">
                                    {seasons.map((season: SonarrSeason) => (
                                      <div key={season.seasonNumber} className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-muted/50">
                                        <div className="flex items-center gap-2">
                                          <span className="text-sm">Sesong {season.seasonNumber}</span>
                                          {season.statistics && (
                                            <Badge variant="secondary" className="text-xs">
                                              {season.statistics.episodeFileCount} / {season.statistics.totalEpisodeCount} ep
                                            </Badge>
                                          )}
                                          {season.statistics?.sizeOnDisk ? (
                                            <span className="text-xs text-muted-foreground">
                                              {formatBytes(season.statistics.sizeOnDisk)}
                                            </span>
                                          ) : null}
                                        </div>
                                        <Switch
                                          checked={season.monitored}
                                          onCheckedChange={(checked) => 
                                            toggleSeasonMutation.mutate({ 
                                              seriesId: series.id, 
                                              seasonNumber: season.seasonNumber, 
                                              monitored: checked 
                                            })
                                          }
                                        />
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </CollapsibleContent>
                          </div>
                        </Collapsible>
                      );
                    })}
                </div>
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
