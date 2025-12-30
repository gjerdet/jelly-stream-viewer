import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerSettings } from "@/hooks/useServerSettings";
import { supabase } from "@/integrations/supabase/client";
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
  Film, 
  Tv, 
  Search, 
  ChevronDown, 
  ChevronRight, 
  HardDrive, 
  Languages, 
  Subtitles,
  RefreshCw,
  Loader2,
  Eye
} from "lucide-react";
import { SubtitleManager } from "@/components/admin/SubtitleManager";

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
        <Button
          variant="outline"
          size="sm"
          className="h-7 gap-1.5 text-xs"
          onClick={(e) => {
            e.stopPropagation();
            onViewSubtitles(item);
          }}
          title="Administrer undertekster"
        >
          <Subtitles className="h-3.5 w-3.5" />
          {subtitleLangs.length > 0 ? (
            <span className="flex items-center gap-1">
              {subtitleLangs.slice(0, 2).map((lang, i) => (
                <span key={i} className="text-green-400">{lang}</span>
              ))}
              {subtitleLangs.length > 2 && (
                <span className="text-muted-foreground">+{subtitleLangs.length - 2}</span>
              )}
            </span>
          ) : (
            <span className="text-yellow-400">Ingen</span>
          )}
          <Eye className="h-3 w-3 ml-1" />
        </Button>
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
  const { serverUrl } = useServerSettings();
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("movies");
  
  // Subtitle manager state
  const [subtitleDialogOpen, setSubtitleDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<MediaItem | null>(null);

  const handleViewSubtitles = (item: MediaItem) => {
    setSelectedItem(item);
    setSubtitleDialogOpen(true);
  };

  // Fetch all movies with detailed media info using proxy for Chrome compatibility
  const { data: movies, isLoading: moviesLoading, refetch: refetchMovies } = useQuery({
    queryKey: ["admin-media-movies", serverUrl],
    queryFn: async () => {
      if (!serverUrl) throw new Error("Mangler server");
      
      // Use jellyfin-proxy for Chrome compatibility
      const { data, error } = await supabase.functions.invoke('jellyfin-proxy', {
        body: {
          endpoint: '/Items?IncludeItemTypes=Movie&Recursive=true&Fields=MediaSources,Path,Container,MediaStreams&SortBy=SortName&SortOrder=Ascending',
          method: 'GET'
        }
      });

      if (error) {
        console.error('Jellyfin proxy error:', error);
        throw new Error("Kunne ikke hente filmer");
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      return (data?.Items || []) as MediaItem[];
    },
    enabled: !!serverUrl,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Fetch all series with episodes using proxy for Chrome compatibility
  const { data: series, isLoading: seriesLoading, refetch: refetchSeries } = useQuery({
    queryKey: ["admin-media-series", serverUrl],
    queryFn: async () => {
      if (!serverUrl) throw new Error("Mangler server");

      // First, get all series
      const { data: seriesData, error: seriesError } = await supabase.functions.invoke('jellyfin-proxy', {
        body: {
          endpoint: '/Items?IncludeItemTypes=Series&Recursive=true&Fields=ProductionYear&SortBy=SortName&SortOrder=Ascending',
          method: 'GET'
        }
      });

      if (seriesError) {
        console.error('Jellyfin proxy error:', seriesError);
        throw new Error("Kunne ikke hente serier");
      }

      if (seriesData?.error) {
        throw new Error(seriesData.error);
      }

      const allSeries = (seriesData?.Items || []) as MediaItem[];

      // For each series, get seasons and episodes
      const seriesWithDetails: SeriesInfo[] = await Promise.all(
        allSeries.map(async (s) => {
          // Get seasons
          const { data: seasonsData } = await supabase.functions.invoke('jellyfin-proxy', {
            body: {
              endpoint: `/Shows/${s.Id}/Seasons?Fields=ItemCounts`,
              method: 'GET'
            }
          });
          
          const seasons = seasonsData?.Items || [];

          // Get episodes for each season
          const seasonsWithEpisodes: SeasonInfo[] = await Promise.all(
            seasons.map(async (season: any) => {
              const { data: episodesData } = await supabase.functions.invoke('jellyfin-proxy', {
                body: {
                  endpoint: `/Shows/${s.Id}/Episodes?SeasonId=${season.Id}&Fields=MediaSources,Path,Container,MediaStreams`,
                  method: 'GET'
                }
              });
              
              return {
                Id: season.Id,
                Name: season.Name,
                IndexNumber: season.IndexNumber,
                episodes: episodesData?.Items || []
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

  const handleSubtitleChanged = () => {
    refetchMovies();
    refetchSeries();
  };

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
      
      <SubtitleManager
        open={subtitleDialogOpen}
        onOpenChange={setSubtitleDialogOpen}
        item={selectedItem}
        serverUrl={serverUrl}
        onSubtitleChanged={handleSubtitleChanged}
      />
    </Card>
  );
};
