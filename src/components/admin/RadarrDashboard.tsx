import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRadarrApi, RadarrMovie, RadarrHistoryRecord, RadarrQueueItem } from "@/hooks/useRadarrApi";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { 
  RefreshCw, 
  Download, 
  CheckCircle, 
  Clock, 
  Eye, 
  EyeOff,
  Film,
  HardDrive,
  Search,
  AlertCircle
} from "lucide-react";

const formatBytes = (bytes: number) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleString('nb-NO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

export const RadarrDashboard = () => {
  const queryClient = useQueryClient();
  const { getHealth, getMovies, getHistory, getQueue, toggleMonitored } = useRadarrApi();
  const [selectedTab, setSelectedTab] = useState("downloads");
  const [searchQuery, setSearchQuery] = useState("");
  const [showOnlyMonitored, setShowOnlyMonitored] = useState(false);

  // Health check
  const { data: healthData, isLoading: healthLoading, error: healthError } = useQuery({
    queryKey: ['radarr-health'],
    queryFn: async () => {
      const result = await getHealth();
      if (result.error) throw result.error;
      return result.data;
    },
    retry: 1,
  });

  // Movies list
  const { data: moviesData, isLoading: moviesLoading } = useQuery({
    queryKey: ['radarr-movies'],
    queryFn: async () => {
      const result = await getMovies();
      if (result.error) throw result.error;
      return result.data;
    },
    enabled: !healthError,
  });

  // Download history (without event type filter since it causes errors)
  const { data: historyData, isLoading: historyLoading, refetch: refetchHistory } = useQuery({
    queryKey: ['radarr-history'],
    queryFn: async () => {
      const result = await getHistory(1, 100);
      if (result.error) throw result.error;
      return result.data;
    },
    enabled: !healthError,
  });

  // Current queue
  const { data: queueData, isLoading: queueLoading, refetch: refetchQueue } = useQuery({
    queryKey: ['radarr-queue'],
    queryFn: async () => {
      const result = await getQueue();
      if (result.error) throw result.error;
      return result.data;
    },
    enabled: !healthError,
    refetchInterval: 30000,
  });

  // Reviewed downloads from database
  const { data: reviewedDownloads } = useQuery({
    queryKey: ['reviewed-downloads'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('radarr_downloads')
        .select('*')
        .order('download_date', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Toggle monitoring mutation
  const toggleMonitoringMutation = useMutation({
    mutationFn: async ({ movieId, monitored }: { movieId: number; monitored: boolean }) => {
      const result = await toggleMonitored(movieId, monitored);
      if (result.error) throw result.error;
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['radarr-movies'] });
      toast.success('Overvåking oppdatert');
    },
    onError: (error) => {
      toast.error(`Kunne ikke oppdatere overvåking: ${error.message}`);
    },
  });

  // Mark as reviewed mutation
  const markReviewedMutation = useMutation({
    mutationFn: async ({ movieId, movieTitle, quality, downloadDate }: { 
      movieId: number; 
      movieTitle: string; 
      quality: string;
      downloadDate: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from('radarr_downloads')
        .upsert({
          radarr_movie_id: movieId,
          movie_title: movieTitle,
          quality,
          download_date: downloadDate,
          reviewed: true,
          reviewed_at: new Date().toISOString(),
          reviewed_by: user?.id,
        }, {
          onConflict: 'radarr_movie_id,download_date'
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reviewed-downloads'] });
      toast.success('Markert som sjekket');
    },
    onError: (error) => {
      toast.error(`Kunne ikke markere som sjekket: ${error.message}`);
    },
  });

  const isReviewed = (movieId: number, downloadDate: string) => {
    return reviewedDownloads?.some(
      d => d.radarr_movie_id === movieId && 
           new Date(d.download_date).toDateString() === new Date(downloadDate).toDateString()
    );
  };

  // Filter and apply search
  const filteredMovies = useMemo(() => {
    if (!moviesData) return [];

    let filtered = moviesData;

    if (showOnlyMonitored) {
      filtered = filtered.filter((m) => m.monitored);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (m) => m.title.toLowerCase().includes(query) || m.year?.toString().includes(query)
      );
    }

    return filtered.sort((a, b) => a.title.localeCompare(b.title));
  }, [moviesData, searchQuery, showOnlyMonitored]);

  const monitoredMovies = moviesData?.filter(m => m.monitored) || [];
  const totalSize = moviesData?.reduce((acc, m) => acc + (m.sizeOnDisk || 0), 0) || 0;
  const moviesWithFiles = moviesData?.filter(m => m.hasFile).length || 0;

  if (healthError) {
    return (
      <Card className="border-destructive">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-5 w-5" />
            Radarr ikke tilgjengelig
          </CardTitle>
          <CardDescription>
            Kunne ikke koble til Radarr. Sjekk at URL og API-nøkkel er korrekt konfigurert.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Film className="h-4 w-4" />
              Totalt filmer
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{moviesData?.length || 0}</div>
            <p className="text-xs text-muted-foreground">{moviesWithFiles} med filer</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Eye className="h-4 w-4" />
              Overvåket
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{monitoredMovies.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <HardDrive className="h-4 w-4" />
              Total størrelse
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatBytes(totalSize)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Download className="h-4 w-4" />
              I kø
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{queueData?.records?.length || 0}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
          <TabsList>
            <TabsTrigger value="downloads">Nedlastingshistorikk</TabsTrigger>
            <TabsTrigger value="queue">Nedlastingskø</TabsTrigger>
            <TabsTrigger value="monitoring">Kvalitetsovervåking ({moviesData?.length || 0})</TabsTrigger>
          </TabsList>

        <TabsContent value="downloads" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Nylig nedlastet</CardTitle>
                  <CardDescription>Filmer som har blitt importert til biblioteket</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={() => refetchHistory()}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Oppdater
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {historyLoading ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="h-6 w-6 animate-spin" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Film</TableHead>
                      <TableHead>Kvalitet</TableHead>
                      <TableHead>Dato</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Handling</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {historyData?.records?.slice(0, 50).map((record: RadarrHistoryRecord) => {
                      const reviewed = isReviewed(record.movieId, record.date);
                      return (
                        <TableRow key={record.id}>
                          <TableCell className="font-medium">
                            {record.movie?.title || record.sourceTitle}
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">
                              {record.quality?.quality?.name || 'Ukjent'}
                            </Badge>
                          </TableCell>
                          <TableCell>{formatDate(record.date)}</TableCell>
                          <TableCell>
                            {reviewed ? (
                              <Badge variant="default" className="bg-green-600">
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Sjekket
                              </Badge>
                            ) : (
                              <Badge variant="outline">
                                <Clock className="h-3 w-3 mr-1" />
                                Ikke sjekket
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {!reviewed && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => markReviewedMutation.mutate({
                                  movieId: record.movieId,
                                  movieTitle: record.movie?.title || record.sourceTitle,
                                  quality: record.quality?.quality?.name || 'Ukjent',
                                  downloadDate: record.date,
                                })}
                                disabled={markReviewedMutation.isPending}
                              >
                                <CheckCircle className="h-4 w-4 mr-1" />
                                Marker sjekket
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="queue" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Nedlastingskø</CardTitle>
                  <CardDescription>Filmer som lastes ned nå</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={() => refetchQueue()}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Oppdater
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {queueLoading ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="h-6 w-6 animate-spin" />
                </div>
              ) : queueData?.records?.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Download className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>Ingen aktive nedlastinger</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Film</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Progresjon</TableHead>
                      <TableHead>Gjenstående tid</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {queueData?.records?.map((item: RadarrQueueItem) => {
                      const progress = item.size > 0 
                        ? ((item.size - item.sizeleft) / item.size * 100).toFixed(1)
                        : 0;
                      return (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">
                            {item.movie?.title || item.title}
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">{item.status}</Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="w-24 h-2 bg-secondary rounded-full overflow-hidden">
                                <div 
                                  className="h-full bg-primary transition-all"
                                  style={{ width: `${progress}%` }}
                                />
                              </div>
                              <span className="text-sm">{progress}%</span>
                            </div>
                          </TableCell>
                          <TableCell>{item.timeleft || '-'}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="monitoring" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle>Kvalitetsovervåking</CardTitle>
                  <CardDescription>
                    Slå av overvåking for filmer du ikke ønsker å oppgradere til bedre kvalitet
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Søk etter film..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9 w-64"
                    />
                  </div>
                  <Button
                    variant={showOnlyMonitored ? "default" : "outline"}
                    size="sm"
                    onClick={() => setShowOnlyMonitored(!showOnlyMonitored)}
                  >
                    <Eye className="h-4 w-4 mr-1" />
                    {showOnlyMonitored ? 'Vis alle' : 'Kun overvåkede'}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {moviesLoading ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="h-6 w-6 animate-spin" />
                </div>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground mb-4">
                    Viser {filteredMovies.length} av {moviesData?.length || 0} filmer ({moviesWithFiles} med filer)
                  </p>
                  <div className="max-h-[600px] overflow-y-auto">
                    <Table>
                      <TableHeader className="sticky top-0 bg-background">
                        <TableRow>
                          <TableHead>Film</TableHead>
                          <TableHead>År</TableHead>
                          <TableHead>Kvalitet</TableHead>
                          <TableHead>Størrelse</TableHead>
                          <TableHead>Overvåket</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredMovies.map((movie: RadarrMovie) => (
                          <TableRow key={movie.id}>
                            <TableCell className="font-medium">{movie.title}</TableCell>
                            <TableCell>{movie.year}</TableCell>
                            <TableCell>
                              <Badge variant="secondary">
                                {movie.movieFile?.quality?.quality?.name || 'Ukjent'}
                              </Badge>
                            </TableCell>
                            <TableCell>{formatBytes(movie.sizeOnDisk)}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Switch
                                  checked={movie.monitored}
                                  onCheckedChange={(checked) => 
                                    toggleMonitoringMutation.mutate({ 
                                      movieId: movie.id, 
                                      monitored: checked 
                                    })
                                  }
                                  disabled={toggleMonitoringMutation.isPending}
                                />
                                {movie.monitored ? (
                                  <Eye className="h-4 w-4 text-green-500" />
                                ) : (
                                  <EyeOff className="h-4 w-4 text-muted-foreground" />
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
