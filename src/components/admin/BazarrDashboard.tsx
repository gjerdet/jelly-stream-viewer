import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { 
  Subtitles,
  Loader2,
  Check,
  X,
  RefreshCw,
  Zap,
  AlertCircle,
  Clock,
  Film,
  Tv,
  Search,
  Play,
  Download,
  History,
  Settings,
  CheckCircle2,
  XCircle
} from "lucide-react";
import { toast } from "sonner";
import { useBazarrApi } from "@/hooks/useBazarrApi";

interface BazarrStatus {
  bazarr_version?: string;
  sonarr_version?: string;
  radarr_version?: string;
  operating_system?: string;
  python_version?: string;
}

interface WantedItem {
  title?: string;
  seriesTitle?: string;
  episodeTitle?: string;
  season?: number;
  episode?: number;
  missing_subtitles?: Array<{ name: string; code2: string; code3: string }>;
  sonarrSeriesId?: number;
  sonarrEpisodeId?: number;
  radarrId?: number;
  sceneName?: string;
}

interface HistoryItem {
  action?: number;
  title?: string;
  seriesTitle?: string;
  episodeTitle?: string;
  season?: number;
  episode?: number;
  provider?: string;
  language?: { name: string };
  timestamp?: string;
  description?: string;
  score?: number;
  subs_id?: string;
  sonarrSeriesId?: number;
  sonarrEpisodeId?: number;
  radarrId?: number;
}

interface SearchResult {
  provider: string;
  description: string;
  language: string;
  hearing_impaired: boolean;
  forced: boolean;
  score: number;
  release_info?: string[];
  uploader?: string;
  url?: string;
  subtitle?: string;
}

export const BazarrDashboard = () => {
  const { bazarrRequest } = useBazarrApi();
  const [connected, setConnected] = useState<boolean | null>(null);
  const [status, setStatus] = useState<BazarrStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [wantedMovies, setWantedMovies] = useState<WantedItem[]>([]);
  const [wantedEpisodes, setWantedEpisodes] = useState<WantedItem[]>([]);
  const [movieHistory, setMovieHistory] = useState<HistoryItem[]>([]);
  const [episodeHistory, setEpisodeHistory] = useState<HistoryItem[]>([]);
  const [loadingWanted, setLoadingWanted] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [searchingItem, setSearchingItem] = useState<string | null>(null);
  const [manualSearchOpen, setManualSearchOpen] = useState(false);
  const [manualSearchResults, setManualSearchResults] = useState<SearchResult[]>([]);
  const [manualSearchLoading, setManualSearchLoading] = useState(false);
  const [selectedItem, setSelectedItem] = useState<WantedItem | null>(null);
  const [downloadingSubtitle, setDownloadingSubtitle] = useState<string | null>(null);

  // Check connection and get status
  const checkConnection = async () => {
    setLoading(true);
    try {
      const { data, error } = await bazarrRequest('status');
      
      if (error) {
        console.error('Bazarr connection error:', error);
        setConnected(false);
        return;
      }
      
      setConnected(true);
      setStatus((data as { data?: BazarrStatus })?.data || data as BazarrStatus);
    } catch (err) {
      console.error('Bazarr check failed:', err);
      setConnected(false);
    } finally {
      setLoading(false);
    }
  };

  // Load wanted items
  const loadWanted = async () => {
    setLoadingWanted(true);
    try {
      const [moviesRes, episodesRes] = await Promise.all([
        bazarrRequest('movies-wanted'),
        bazarrRequest('episodes-wanted')
      ]);
      
      if ((moviesRes.data as { data?: WantedItem[] })?.data) {
        setWantedMovies((moviesRes.data as { data: WantedItem[] }).data);
      }
      if ((episodesRes.data as { data?: WantedItem[] })?.data) {
        setWantedEpisodes((episodesRes.data as { data: WantedItem[] }).data);
      }
    } catch (err) {
      console.error('Failed to load wanted:', err);
      toast.error('Kunne ikke laste manglende undertekster');
    } finally {
      setLoadingWanted(false);
    }
  };

  // Load history
  const loadHistory = async () => {
    setLoadingHistory(true);
    try {
      const [moviesRes, episodesRes] = await Promise.all([
        bazarrRequest('movies-history'),
        bazarrRequest('episodes-history')
      ]);
      
      if ((moviesRes.data as { data?: HistoryItem[] })?.data) {
        setMovieHistory((moviesRes.data as { data: HistoryItem[] }).data);
      }
      if ((episodesRes.data as { data?: HistoryItem[] })?.data) {
        setEpisodeHistory((episodesRes.data as { data: HistoryItem[] }).data);
      }
    } catch (err) {
      console.error('Failed to load history:', err);
      toast.error('Kunne ikke laste historikk');
    } finally {
      setLoadingHistory(false);
    }
  };

  // Trigger search for a specific item
  const triggerSearch = async (item: WantedItem, type: 'movie' | 'episode') => {
    const key = type === 'movie' ? item.radarrId?.toString() : item.sonarrEpisodeId?.toString();
    setSearchingItem(key || null);
    
    try {
      const action = type === 'movie' ? 'search-movie' : 'search-episode';
      const params = type === 'movie' 
        ? { radarrId: item.radarrId }
        : { sonarrId: item.sonarrSeriesId, episodeId: item.sonarrEpisodeId };
      
      const { error } = await bazarrRequest(action, params);
      
      if (error) throw error;
      
      toast.success('Søk startet i Bazarr');
      // Refresh wanted list after a delay
      setTimeout(() => loadWanted(), 3000);
    } catch (err) {
      console.error('Search failed:', err);
      toast.error('Kunne ikke starte søk');
    } finally {
      setSearchingItem(null);
    }
  };

  // Manual search for subtitles
  const handleManualSearch = async (item: WantedItem, type: 'movie' | 'episode') => {
    setSelectedItem(item);
    setManualSearchOpen(true);
    setManualSearchLoading(true);
    setManualSearchResults([]);
    
    try {
      const action = type === 'movie' ? 'manual-search-movie' : 'manual-search-episode';
      const params = type === 'movie' 
        ? { radarrId: item.radarrId }
        : { episodeId: item.sonarrEpisodeId };
      
      const { data, error } = await bazarrRequest(action, params);
      
      if (error) throw error;
      
      setManualSearchResults((data as { data?: SearchResult[] })?.data || []);
    } catch (err) {
      console.error('Manual search failed:', err);
      toast.error('Kunne ikke søke etter undertekster');
    } finally {
      setManualSearchLoading(false);
    }
  };

  // Download subtitle from manual search
  const downloadSubtitle = async (subtitle: SearchResult, item: WantedItem, type: 'movie' | 'episode') => {
    setDownloadingSubtitle(subtitle.subtitle || subtitle.description);
    
    try {
      const action = type === 'movie' ? 'download-movie-subtitle' : 'download-episode-subtitle';
      const params = type === 'movie' 
        ? { 
            radarrId: item.radarrId,
            language: subtitle.language,
            hi: subtitle.hearing_impaired,
            forced: subtitle.forced,
            provider: subtitle.provider,
            subtitle: subtitle.subtitle
          }
        : { 
            sonarrId: item.sonarrSeriesId,
            episodeId: item.sonarrEpisodeId,
            language: subtitle.language,
            hi: subtitle.hearing_impaired,
            forced: subtitle.forced,
            provider: subtitle.provider,
            subtitle: subtitle.subtitle
          };
      
      const { error } = await bazarrRequest(action, params);
      
      if (error) throw error;
      
      toast.success('Undertekst lastet ned');
      setManualSearchOpen(false);
      loadWanted();
    } catch (err) {
      console.error('Download failed:', err);
      toast.error('Kunne ikke laste ned undertekst');
    } finally {
      setDownloadingSubtitle(null);
    }
  };

  useEffect(() => {
    checkConnection();
  }, []);

  useEffect(() => {
    if (connected) {
      loadWanted();
      loadHistory();
    }
  }, [connected]);

  const formatDate = (timestamp: string | undefined) => {
    if (!timestamp) return '-';
    return new Date(timestamp).toLocaleString('no-NO', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getActionIcon = (action: number | undefined) => {
    switch (action) {
      case 1: return <Download className="h-4 w-4 text-green-500" />;
      case 2: return <RefreshCw className="h-4 w-4 text-blue-500" />;
      case 3: return <X className="h-4 w-4 text-red-500" />;
      default: return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin" />
          <span className="ml-2">Kobler til Bazarr...</span>
        </CardContent>
      </Card>
    );
  }

  if (!connected) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Subtitles className="h-5 w-5" />
            Bazarr
          </CardTitle>
          <CardDescription>Automatisk undertekstbehandling</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <AlertCircle className="h-12 w-12 mb-4 text-yellow-500" />
            <p className="text-lg font-medium">Ikke konfigurert</p>
            <p className="text-sm mt-2 text-center max-w-md">
              Bazarr er ikke satt opp ennå. Gå til <strong>Admin → Servere</strong> for å konfigurere Bazarr URL og API-nøkkel.
            </p>
            <Button onClick={checkConnection} className="mt-4">
              <RefreshCw className="h-4 w-4 mr-2" />
              Sjekk på nytt
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Subtitles className="h-5 w-5" />
              Bazarr
              <Badge variant="default" className="bg-green-600">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Tilkoblet
              </Badge>
            </CardTitle>
            <CardDescription>
              {status?.bazarr_version && `v${status.bazarr_version}`}
              {status?.operating_system && ` • ${status.operating_system}`}
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={checkConnection}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="wanted" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="wanted" className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              Mangler ({wantedMovies.length + wantedEpisodes.length})
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center gap-2">
              <History className="h-4 w-4" />
              Historikk
            </TabsTrigger>
            <TabsTrigger value="status" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Status
            </TabsTrigger>
          </TabsList>

          {/* Wanted Tab */}
          <TabsContent value="wanted" className="mt-4">
            <div className="flex justify-end mb-4">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={loadWanted}
                disabled={loadingWanted}
              >
                {loadingWanted ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
              </Button>
            </div>

            {/* Movies Wanted */}
            {wantedMovies.length > 0 && (
              <div className="mb-6">
                <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                  <Film className="h-4 w-4" />
                  Filmer ({wantedMovies.length})
                </h4>
                <div className="h-[250px] overflow-y-auto border rounded-md">
                  <Table>
                    <TableHeader className="sticky top-0 bg-background z-10">
                      <TableRow>
                        <TableHead>Tittel</TableHead>
                        <TableHead>Mangler</TableHead>
                        <TableHead className="text-right">Handlinger</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {wantedMovies.map((item, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="font-medium">{item.title}</TableCell>
                          <TableCell>
                            <div className="flex gap-1 flex-wrap">
                              {item.missing_subtitles?.map((lang, i) => (
                                <Badge key={i} variant="outline" className="text-xs">
                                  {lang.name || lang.code2}
                                </Badge>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex gap-1 justify-end">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => triggerSearch(item, 'movie')}
                                disabled={searchingItem === item.radarrId?.toString()}
                                title="Automatisk søk"
                              >
                                {searchingItem === item.radarrId?.toString() ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Play className="h-4 w-4" />
                                )}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleManualSearch(item, 'movie')}
                                title="Manuelt søk"
                              >
                                <Search className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {/* Episodes Wanted */}
            {wantedEpisodes.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                  <Tv className="h-4 w-4" />
                  Episoder ({wantedEpisodes.length})
                </h4>
                <div className="h-[300px] overflow-y-auto border rounded-md">
                  <Table>
                    <TableHeader className="sticky top-0 bg-background z-10">
                      <TableRow>
                        <TableHead>Serie</TableHead>
                        <TableHead>Episode</TableHead>
                        <TableHead>Mangler</TableHead>
                        <TableHead className="text-right">Handlinger</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {wantedEpisodes.map((item, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="font-medium">{item.seriesTitle}</TableCell>
                          <TableCell>
                            S{String(item.season).padStart(2, '0')}E{String(item.episode).padStart(2, '0')}
                            <span className="text-muted-foreground ml-2">{item.episodeTitle}</span>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1 flex-wrap">
                              {item.missing_subtitles?.map((lang, i) => (
                                <Badge key={i} variant="outline" className="text-xs">
                                  {lang.name || lang.code2}
                                </Badge>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex gap-1 justify-end">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => triggerSearch(item, 'episode')}
                                disabled={searchingItem === item.sonarrEpisodeId?.toString()}
                                title="Automatisk søk"
                              >
                                {searchingItem === item.sonarrEpisodeId?.toString() ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Play className="h-4 w-4" />
                                )}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleManualSearch(item, 'episode')}
                                title="Manuelt søk"
                              >
                                <Search className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {wantedMovies.length === 0 && wantedEpisodes.length === 0 && !loadingWanted && (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <CheckCircle2 className="h-12 w-12 mb-4 text-green-500" />
                <p>Ingen manglende undertekster!</p>
              </div>
            )}
          </TabsContent>

          {/* History Tab */}
          <TabsContent value="history" className="mt-4">
            <div className="flex justify-end mb-4">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={loadHistory}
                disabled={loadingHistory}
              >
                {loadingHistory ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
              </Button>
            </div>

            <Tabs defaultValue="movies-history">
              <TabsList>
                <TabsTrigger value="movies-history" className="flex items-center gap-2">
                  <Film className="h-4 w-4" />
                  Filmer
                </TabsTrigger>
                <TabsTrigger value="episodes-history" className="flex items-center gap-2">
                  <Tv className="h-4 w-4" />
                  Serier
                </TabsTrigger>
              </TabsList>

              <TabsContent value="movies-history">
                <div className="h-[400px] overflow-y-auto border rounded-md">
                  <Table>
                    <TableHeader className="sticky top-0 bg-background z-10">
                      <TableRow>
                        <TableHead className="w-[40px]"></TableHead>
                        <TableHead>Tittel</TableHead>
                        <TableHead>Språk</TableHead>
                        <TableHead>Kilde</TableHead>
                        <TableHead>Dato</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {movieHistory.map((item, idx) => (
                        <TableRow key={idx}>
                          <TableCell>{getActionIcon(item.action)}</TableCell>
                          <TableCell className="font-medium">{item.title}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{item.language?.name || '-'}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">{item.provider || '-'}</Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {formatDate(item.timestamp)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>

              <TabsContent value="episodes-history">
                <div className="h-[400px] overflow-y-auto border rounded-md">
                  <Table>
                    <TableHeader className="sticky top-0 bg-background z-10">
                      <TableRow>
                        <TableHead className="w-[40px]"></TableHead>
                        <TableHead>Serie</TableHead>
                        <TableHead>Episode</TableHead>
                        <TableHead>Språk</TableHead>
                        <TableHead>Kilde</TableHead>
                        <TableHead>Dato</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {episodeHistory.map((item, idx) => (
                        <TableRow key={idx}>
                          <TableCell>{getActionIcon(item.action)}</TableCell>
                          <TableCell className="font-medium">{item.seriesTitle}</TableCell>
                          <TableCell>
                            S{String(item.season).padStart(2, '0')}E{String(item.episode).padStart(2, '0')}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{item.language?.name || '-'}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">{item.provider || '-'}</Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {formatDate(item.timestamp)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>
            </Tabs>
          </TabsContent>

          {/* Status Tab */}
          <TabsContent value="status" className="mt-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Bazarr</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">{status?.bazarr_version || '-'}</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">System</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{status?.operating_system || '-'}</p>
                  <p className="text-sm text-muted-foreground">Python {status?.python_version || '-'}</p>
                </CardContent>
              </Card>
            </div>

            <div className="mt-4 grid gap-2">
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <span className="text-sm">Sonarr</span>
                <Badge variant={status?.sonarr_version ? "default" : "secondary"}>
                  {status?.sonarr_version || 'Ikke tilkoblet'}
                </Badge>
              </div>
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <span className="text-sm">Radarr</span>
                <Badge variant={status?.radarr_version ? "default" : "secondary"}>
                  {status?.radarr_version || 'Ikke tilkoblet'}
                </Badge>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>

      {/* Manual Search Dialog */}
      <Dialog open={manualSearchOpen} onOpenChange={setManualSearchOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Manuelt søk</DialogTitle>
            <DialogDescription>
              {selectedItem?.title || selectedItem?.seriesTitle} 
              {selectedItem?.episodeTitle && ` - ${selectedItem.episodeTitle}`}
            </DialogDescription>
          </DialogHeader>

          {manualSearchLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin" />
              <span className="ml-2">Søker...</span>
            </div>
          ) : manualSearchResults.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <XCircle className="h-12 w-12 mb-4" />
              <p>Ingen undertekster funnet</p>
            </div>
          ) : (
            <ScrollArea className="flex-1 max-h-[500px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Beskrivelse</TableHead>
                    <TableHead>Språk</TableHead>
                    <TableHead>Kilde</TableHead>
                    <TableHead className="text-center">Score</TableHead>
                    <TableHead className="text-right">Last ned</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {manualSearchResults.map((sub, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="max-w-[250px]">
                        <div className="truncate" title={sub.description}>
                          {sub.description}
                        </div>
                        <div className="flex gap-1 mt-1">
                          {sub.hearing_impaired && (
                            <Badge variant="secondary" className="text-xs">HI</Badge>
                          )}
                          {sub.forced && (
                            <Badge variant="secondary" className="text-xs">Forced</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{sub.language}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{sub.provider}</Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge 
                          variant={sub.score > 80 ? "default" : "secondary"}
                          className={sub.score > 80 ? "bg-green-600" : ""}
                        >
                          {sub.score}%
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => downloadSubtitle(
                            sub, 
                            selectedItem!, 
                            selectedItem?.radarrId ? 'movie' : 'episode'
                          )}
                          disabled={downloadingSubtitle === (sub.subtitle || sub.description)}
                        >
                          {downloadingSubtitle === (sub.subtitle || sub.description) ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Download className="h-4 w-4" />
                          )}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
};
