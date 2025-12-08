import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerSettings } from "@/hooks/useServerSettings";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { 
  Film, 
  Tv, 
  Search, 
  ChevronDown, 
  ChevronRight, 
  HardDrive, 
  Languages, 
  Subtitles,
  FileVideo,
  RefreshCw,
  Loader2,
  Eye,
  Check,
  X
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface MediaStream {
  Type: string;
  Codec?: string;
  Language?: string;
  DisplayTitle?: string;
  Title?: string;
  IsDefault?: boolean;
  IsExternal?: boolean;
  Index?: number;
}

interface MediaSource {
  Size?: number;
  Container?: string;
  Path?: string;
  Bitrate?: number;
  MediaStreams?: MediaStream[];
}

interface MediaItem {
  Id: string;
  Name: string;
  Type: string;
  SeriesName?: string;
  SeasonName?: string;
  IndexNumber?: number;
  ParentIndexNumber?: number;
  ProductionYear?: number;
  RunTimeTicks?: number;
  MediaSources?: MediaSource[];
  Container?: string;
  Path?: string;
}

interface SeriesInfo {
  Id: string;
  Name: string;
  ProductionYear?: number;
  seasons: SeasonInfo[];
}

interface SeasonInfo {
  Id: string;
  Name: string;
  IndexNumber?: number;
  episodes: MediaItem[];
}

const formatFileSize = (bytes?: number): string => {
  if (!bytes) return "Ukjent";
  const gb = bytes / (1024 * 1024 * 1024);
  if (gb >= 1) return `${gb.toFixed(2)} GB`;
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(0)} MB`;
};

const formatDuration = (ticks?: number): string => {
  if (!ticks) return "Ukjent";
  const minutes = Math.floor(ticks / 600000000);
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours > 0) return `${hours}t ${mins}m`;
  return `${mins}m`;
};

const getAudioLanguages = (mediaSources?: MediaSource[]): string[] => {
  if (!mediaSources?.length) return [];
  const languages = new Set<string>();
  mediaSources.forEach(source => {
    source.MediaStreams?.filter(s => s.Type === "Audio").forEach(stream => {
      if (stream.Language) {
        languages.add(stream.Language.toUpperCase());
      } else if (stream.DisplayTitle) {
        languages.add(stream.DisplayTitle);
      }
    });
  });
  return Array.from(languages);
};

const getSubtitleLanguages = (mediaSources?: MediaSource[]): string[] => {
  if (!mediaSources?.length) return [];
  const languages = new Set<string>();
  mediaSources.forEach(source => {
    source.MediaStreams?.filter(s => s.Type === "Subtitle").forEach(stream => {
      if (stream.Language) {
        languages.add(stream.Language.toUpperCase());
      } else if (stream.DisplayTitle) {
        languages.add(stream.DisplayTitle);
      }
    });
  });
  return Array.from(languages);
};

const getVideoInfo = (mediaSources?: MediaSource[]): { codec: string; resolution: string; container: string } => {
  if (!mediaSources?.length) return { codec: "Ukjent", resolution: "Ukjent", container: "Ukjent" };
  const source = mediaSources[0];
  const videoStream = source.MediaStreams?.find(s => s.Type === "Video");
  return {
    codec: videoStream?.Codec?.toUpperCase() || "Ukjent",
    resolution: videoStream?.DisplayTitle?.match(/\d+p|\d+x\d+/)?.[0] || "Ukjent",
    container: source.Container?.toUpperCase() || "Ukjent"
  };
};

interface SubtitleInfo {
  Language: string;
  DisplayTitle: string;
  Codec: string;
  IsExternal: boolean;
  IsDefault: boolean;
  IsForced: boolean;
  Path?: string;
}

interface SubtitleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: MediaItem | null;
  subtitles: SubtitleInfo[];
  loading: boolean;
}

const SubtitleDialog = ({ open, onOpenChange, item, subtitles, loading }: SubtitleDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Subtitles className="h-5 w-5" />
            Undertekster for {item?.Name}
          </DialogTitle>
          <DialogDescription>
            Viser alle innebygde og eksterne undertekster for denne filen
          </DialogDescription>
        </DialogHeader>
        
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="ml-2">Henter undertekster...</span>
          </div>
        ) : subtitles.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <X className="h-12 w-12 mb-2 text-yellow-500" />
            <p>Ingen undertekster funnet</p>
          </div>
        ) : (
          <ScrollArea className="max-h-[50vh]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Språk</TableHead>
                  <TableHead>Tittel</TableHead>
                  <TableHead className="text-center">Format</TableHead>
                  <TableHead className="text-center">Type</TableHead>
                  <TableHead className="text-center">Standard</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {subtitles.map((sub, index) => (
                  <TableRow key={index}>
                    <TableCell>
                      <Badge variant="outline" className="bg-green-500/10 border-green-500/20">
                        {sub.Language?.toUpperCase() || "Ukjent"}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate" title={sub.DisplayTitle}>
                      {sub.DisplayTitle || "-"}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary" className="text-xs">
                        {sub.Codec?.toUpperCase() || "Ukjent"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge 
                        variant="outline" 
                        className={sub.IsExternal 
                          ? "bg-blue-500/10 border-blue-500/20" 
                          : "bg-purple-500/10 border-purple-500/20"
                        }
                      >
                        {sub.IsExternal ? "Ekstern" : "Innebygd"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      {sub.IsDefault ? (
                        <Check className="h-4 w-4 text-green-500 mx-auto" />
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
};

interface MediaItemRowProps {
  item: MediaItem;
  onViewSubtitles: (item: MediaItem) => void;
}

const MediaItemRow = ({ item, onViewSubtitles }: MediaItemRowProps) => {
  const audioLangs = getAudioLanguages(item.MediaSources);
  const subtitleLangs = getSubtitleLanguages(item.MediaSources);
  const videoInfo = getVideoInfo(item.MediaSources);
  const size = item.MediaSources?.[0]?.Size;

  return (
    <TableRow className="hover:bg-muted/50">
      <TableCell className="font-medium max-w-[200px] truncate" title={item.Name}>
        {item.Type === "Episode" && item.IndexNumber && (
          <span className="text-muted-foreground mr-1">E{item.IndexNumber}</span>
        )}
        {item.Name}
      </TableCell>
      <TableCell className="text-center">
        <Badge variant="outline" className="font-mono text-xs">
          {formatFileSize(size)}
        </Badge>
      </TableCell>
      <TableCell className="text-center">
        <div className="flex flex-col items-center gap-1">
          <Badge variant="secondary" className="text-xs">{videoInfo.container}</Badge>
          <span className="text-xs text-muted-foreground">{videoInfo.codec}</span>
        </div>
      </TableCell>
      <TableCell className="text-center">
        <span className="text-sm">{formatDuration(item.RunTimeTicks)}</span>
      </TableCell>
      <TableCell>
        <div className="flex flex-wrap gap-1 justify-center">
          {audioLangs.length > 0 ? (
            audioLangs.slice(0, 3).map((lang, i) => (
              <Badge key={i} variant="outline" className="text-xs bg-blue-500/10 border-blue-500/20">
                {lang}
              </Badge>
            ))
          ) : (
            <span className="text-muted-foreground text-xs">-</span>
          )}
          {audioLangs.length > 3 && (
            <Badge variant="outline" className="text-xs">+{audioLangs.length - 3}</Badge>
          )}
        </div>
      </TableCell>
      <TableCell>
        <div className="flex items-center justify-center gap-2">
          <div className="flex flex-wrap gap-1">
            {subtitleLangs.length > 0 ? (
              <>
                {subtitleLangs.slice(0, 2).map((lang, i) => (
                  <Badge key={i} variant="outline" className="text-xs bg-green-500/10 border-green-500/20">
                    {lang}
                  </Badge>
                ))}
                {subtitleLangs.length > 2 && (
                  <Badge variant="outline" className="text-xs">+{subtitleLangs.length - 2}</Badge>
                )}
              </>
            ) : (
              <Badge variant="outline" className="text-xs bg-yellow-500/10 border-yellow-500/20">
                Ingen
              </Badge>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={() => onViewSubtitles(item)}
            title="Vis undertekster"
          >
            <Eye className="h-3.5 w-3.5" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
};

interface SeriesAccordionProps {
  series: SeriesInfo;
  onViewSubtitles: (item: MediaItem) => void;
}

const SeriesAccordion = ({ series, onViewSubtitles }: SeriesAccordionProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const totalEpisodes = series.seasons.reduce((acc, s) => acc + s.episodes.length, 0);
  const totalSize = series.seasons.reduce((acc, season) => 
    acc + season.episodes.reduce((eAcc, ep) => 
      eAcc + (ep.MediaSources?.[0]?.Size || 0), 0
    ), 0
  );

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="border rounded-lg mb-2">
      <CollapsibleTrigger className="flex items-center justify-between w-full p-4 hover:bg-muted/50 transition-colors">
        <div className="flex items-center gap-3">
          {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          <Tv className="h-5 w-5 text-primary" />
          <span className="font-semibold">{series.Name}</span>
          {series.ProductionYear && (
            <span className="text-muted-foreground text-sm">({series.ProductionYear})</span>
          )}
        </div>
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span>{series.seasons.length} sesonger</span>
          <span>{totalEpisodes} episoder</span>
          <Badge variant="outline" className="font-mono">{formatFileSize(totalSize)}</Badge>
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="px-4 pb-4 space-y-4">
          {series.seasons.sort((a, b) => (a.IndexNumber || 0) - (b.IndexNumber || 0)).map(season => (
            <div key={season.Id} className="border-l-2 border-primary/30 pl-4">
              <h4 className="font-medium text-sm mb-2 text-muted-foreground">{season.Name}</h4>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[200px]">Episode</TableHead>
                    <TableHead className="text-center w-[100px]">Størrelse</TableHead>
                    <TableHead className="text-center w-[100px]">Format</TableHead>
                    <TableHead className="text-center w-[80px]">Varighet</TableHead>
                    <TableHead className="text-center w-[150px]">Lyd</TableHead>
                    <TableHead className="text-center w-[150px]">Undertekst</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {season.episodes.sort((a, b) => (a.IndexNumber || 0) - (b.IndexNumber || 0)).map(episode => (
                    <MediaItemRow key={episode.Id} item={episode} onViewSubtitles={onViewSubtitles} />
                  ))}
                </TableBody>
              </Table>
            </div>
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};

export const MediaLibraryOverview = () => {
  const { serverUrl, apiKey } = useServerSettings();
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("movies");
  
  // Subtitle dialog state
  const [subtitleDialogOpen, setSubtitleDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<MediaItem | null>(null);
  const [subtitles, setSubtitles] = useState<SubtitleInfo[]>([]);
  const [subtitlesLoading, setSubtitlesLoading] = useState(false);

  const handleViewSubtitles = async (item: MediaItem) => {
    setSelectedItem(item);
    setSubtitleDialogOpen(true);
    setSubtitlesLoading(true);
    setSubtitles([]);

    try {
      // Get subtitles from the MediaSources
      const allSubtitles: SubtitleInfo[] = [];
      
      item.MediaSources?.forEach(source => {
        source.MediaStreams?.filter(stream => stream.Type === "Subtitle").forEach(stream => {
          allSubtitles.push({
            Language: stream.Language || "Ukjent",
            DisplayTitle: stream.DisplayTitle || stream.Title || "Ukjent",
            Codec: stream.Codec || "Ukjent",
            IsExternal: stream.IsExternal || false,
            IsDefault: stream.IsDefault || false,
            IsForced: false,
          });
        });
      });

      setSubtitles(allSubtitles);
    } catch (error) {
      console.error("Error loading subtitles:", error);
      toast.error("Kunne ikke laste undertekster");
    } finally {
      setSubtitlesLoading(false);
    }
  };

  // Fetch all movies with detailed media info
  const { data: movies, isLoading: moviesLoading, refetch: refetchMovies } = useQuery({
    queryKey: ["admin-media-movies", serverUrl],
    queryFn: async () => {
      const jellyfinSession = localStorage.getItem('jellyfin_session');
      const accessToken = jellyfinSession ? JSON.parse(jellyfinSession).AccessToken : null;
      
      if (!serverUrl || !accessToken) throw new Error("Mangler server eller token");
      
      let normalizedUrl = serverUrl;
      if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
        normalizedUrl = `http://${normalizedUrl}`;
      }

      const response = await fetch(
        `${normalizedUrl.replace(/\/$/, '')}/Items?IncludeItemTypes=Movie&Recursive=true&Fields=MediaSources,Path,Container,MediaStreams&SortBy=SortName&SortOrder=Ascending`,
        {
          headers: {
            "X-Emby-Token": accessToken,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) throw new Error("Kunne ikke hente filmer");
      const data = await response.json();
      return data.Items as MediaItem[];
    },
    enabled: !!serverUrl,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Fetch all series with episodes
  const { data: series, isLoading: seriesLoading, refetch: refetchSeries } = useQuery({
    queryKey: ["admin-media-series", serverUrl],
    queryFn: async () => {
      const jellyfinSession = localStorage.getItem('jellyfin_session');
      const accessToken = jellyfinSession ? JSON.parse(jellyfinSession).AccessToken : null;
      
      if (!serverUrl || !accessToken) throw new Error("Mangler server eller token");
      
      let normalizedUrl = serverUrl;
      if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
        normalizedUrl = `http://${normalizedUrl}`;
      }

      // First, get all series
      const seriesResponse = await fetch(
        `${normalizedUrl.replace(/\/$/, '')}/Items?IncludeItemTypes=Series&Recursive=true&Fields=ProductionYear&SortBy=SortName&SortOrder=Ascending`,
        {
          headers: {
            "X-Emby-Token": accessToken,
            "Content-Type": "application/json",
          },
        }
      );

      if (!seriesResponse.ok) throw new Error("Kunne ikke hente serier");
      const seriesData = await seriesResponse.json();
      const allSeries = seriesData.Items as MediaItem[];

      // For each series, get seasons and episodes
      const seriesWithDetails: SeriesInfo[] = await Promise.all(
        allSeries.map(async (s) => {
          // Get seasons
          const seasonsResponse = await fetch(
            `${normalizedUrl.replace(/\/$/, '')}/Shows/${s.Id}/Seasons?Fields=ItemCounts`,
            {
              headers: {
                "X-Emby-Token": accessToken,
                "Content-Type": "application/json",
              },
            }
          );
          
          const seasonsData = seasonsResponse.ok ? await seasonsResponse.json() : { Items: [] };
          const seasons = seasonsData.Items || [];

          // Get episodes for each season
          const seasonsWithEpisodes: SeasonInfo[] = await Promise.all(
            seasons.map(async (season: any) => {
              const episodesResponse = await fetch(
                `${normalizedUrl.replace(/\/$/, '')}/Shows/${s.Id}/Episodes?SeasonId=${season.Id}&Fields=MediaSources,Path,Container,MediaStreams`,
                {
                  headers: {
                    "X-Emby-Token": accessToken,
                    "Content-Type": "application/json",
                  },
                }
              );
              
              const episodesData = episodesResponse.ok ? await episodesResponse.json() : { Items: [] };
              
              return {
                Id: season.Id,
                Name: season.Name,
                IndexNumber: season.IndexNumber,
                episodes: episodesData.Items || []
              };
            })
          );

          return {
            Id: s.Id,
            Name: s.Name,
            ProductionYear: s.ProductionYear,
            seasons: seasonsWithEpisodes
          };
        })
      );

      return seriesWithDetails;
    },
    enabled: !!serverUrl,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const filteredMovies = movies?.filter(m => 
    m.Name.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const filteredSeries = series?.filter(s =>
    s.Name.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const totalMovieSize = movies?.reduce((acc, m) => acc + (m.MediaSources?.[0]?.Size || 0), 0) || 0;
  const totalSeriesSize = series?.reduce((acc, s) => 
    acc + s.seasons.reduce((sAcc, season) => 
      sAcc + season.episodes.reduce((eAcc, ep) => 
        eAcc + (ep.MediaSources?.[0]?.Size || 0), 0
      ), 0
    ), 0
  ) || 0;

  const isLoading = moviesLoading || seriesLoading;

  return (
    <Card className="border-border/50">
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <HardDrive className="h-5 w-5" />
              Mediebibliotek Oversikt
            </CardTitle>
            <CardDescription>
              Detaljert oversikt over alle filmer og serier med størrelse, format, språk og undertekster
            </CardDescription>
          </div>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => {
              refetchMovies();
              refetchSeries();
            }}
            disabled={isLoading}
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            <span className="ml-2">Oppdater</span>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Stats summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="p-4 bg-muted/30 rounded-lg text-center">
            <Film className="h-6 w-6 mx-auto mb-2 text-primary" />
            <div className="text-2xl font-bold">{movies?.length || 0}</div>
            <div className="text-xs text-muted-foreground">Filmer</div>
          </div>
          <div className="p-4 bg-muted/30 rounded-lg text-center">
            <Tv className="h-6 w-6 mx-auto mb-2 text-primary" />
            <div className="text-2xl font-bold">{series?.length || 0}</div>
            <div className="text-xs text-muted-foreground">Serier</div>
          </div>
          <div className="p-4 bg-muted/30 rounded-lg text-center">
            <HardDrive className="h-6 w-6 mx-auto mb-2 text-blue-500" />
            <div className="text-2xl font-bold">{formatFileSize(totalMovieSize)}</div>
            <div className="text-xs text-muted-foreground">Filmer totalt</div>
          </div>
          <div className="p-4 bg-muted/30 rounded-lg text-center">
            <HardDrive className="h-6 w-6 mx-auto mb-2 text-green-500" />
            <div className="text-2xl font-bold">{formatFileSize(totalSeriesSize)}</div>
            <div className="text-xs text-muted-foreground">Serier totalt</div>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Søk etter tittel..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-secondary/50"
          />
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="movies" className="flex items-center gap-2">
              <Film className="h-4 w-4" />
              Filmer ({filteredMovies.length})
            </TabsTrigger>
            <TabsTrigger value="series" className="flex items-center gap-2">
              <Tv className="h-4 w-4" />
              Serier ({filteredSeries.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="movies">
            {moviesLoading ? (
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : filteredMovies.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {searchTerm ? "Ingen filmer funnet" : "Ingen filmer i biblioteket"}
              </div>
            ) : (
              <ScrollArea className="h-[500px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[250px]">Tittel</TableHead>
                      <TableHead className="text-center w-[100px]">Størrelse</TableHead>
                      <TableHead className="text-center w-[100px]">Format</TableHead>
                      <TableHead className="text-center w-[80px]">Varighet</TableHead>
                      <TableHead className="text-center w-[150px]">
                        <div className="flex items-center justify-center gap-1">
                          <Languages className="h-4 w-4" />
                          Lyd
                        </div>
                      </TableHead>
                      <TableHead className="text-center w-[150px]">
                        <div className="flex items-center justify-center gap-1">
                          <Subtitles className="h-4 w-4" />
                          Undertekst
                        </div>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredMovies.map(movie => (
                      <MediaItemRow key={movie.Id} item={movie} onViewSubtitles={handleViewSubtitles} />
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            )}
          </TabsContent>

          <TabsContent value="series">
            {seriesLoading ? (
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : filteredSeries.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {searchTerm ? "Ingen serier funnet" : "Ingen serier i biblioteket"}
              </div>
            ) : (
              <ScrollArea className="h-[500px]">
                <div className="space-y-2">
                  {filteredSeries.map(s => (
                    <SeriesAccordion key={s.Id} series={s} onViewSubtitles={handleViewSubtitles} />
                  ))}
                </div>
              </ScrollArea>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
      
      <SubtitleDialog
        open={subtitleDialogOpen}
        onOpenChange={setSubtitleDialogOpen}
        item={selectedItem}
        subtitles={subtitles}
        loading={subtitlesLoading}
      />
    </Card>
  );
};
