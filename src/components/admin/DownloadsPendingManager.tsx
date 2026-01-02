import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, RefreshCw, Download, Film, Tv, CheckCircle2, AlertCircle, FolderOpen, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
interface JellyfinLibrary {
  ItemId: string;
  Name: string;
  CollectionType?: string;
  Locations?: string[];
}

interface JellyfinItem {
  Id: string;
  Name: string;
  Type: string;
  SeriesName?: string;
  SeasonName?: string;
  IndexNumber?: number;
  ParentIndexNumber?: number;
  Path?: string;
  ProductionYear?: number;
  MediaSources?: Array<{
    Path?: string;
    Size?: number;
  }>;
}

interface PendingItem extends JellyfinItem {
  existsElsewhere: boolean;
  matchedLibrary?: string;
}

export const DownloadsPendingManager = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<"pending" | "all">("pending");
  const [movingItem, setMovingItem] = useState<string | null>(null);
  const queryClient = useQueryClient();

  // Fetch all libraries using VirtualFolders endpoint
  const { data: libraries, isLoading: loadingLibraries } = useQuery({
    queryKey: ["jellyfin-virtual-folders"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("jellyfin-proxy", {
        body: { endpoint: "/Library/VirtualFolders" },
      });
      if (error) throw error;
      return (data || []) as JellyfinLibrary[];
    },
  });

  // Find Downloads library
  const downloadsLibrary = libraries?.find(
    (lib) => lib.Name.toLowerCase() === "downloads" || lib.Name.toLowerCase() === "nedlastinger"
  );

  // Get user ID for Jellyfin items query
  const { data: jellyfinUserId } = useQuery({
    queryKey: ["jellyfin-user-id"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("jellyfin-proxy", {
        body: { endpoint: "/Users" },
      });
      if (error) throw error;
      // Return first user (admin user typically)
      return data?.[0]?.Id || null;
    },
  });

  // Fetch items from Downloads library
  const { 
    data: downloadsItems, 
    isLoading: loadingDownloads,
    refetch: refetchDownloads 
  } = useQuery({
    queryKey: ["downloads-library-items", downloadsLibrary?.ItemId, jellyfinUserId],
    queryFn: async () => {
      if (!downloadsLibrary?.ItemId || !jellyfinUserId) return [];
      
      const { data, error } = await supabase.functions.invoke("jellyfin-proxy", {
        body: { 
          endpoint: `/Users/${jellyfinUserId}/Items?ParentId=${downloadsLibrary.ItemId}&IncludeItemTypes=Movie,Episode,Series&Recursive=true&Fields=Path,MediaSources,ProductionYear`,
        },
      });
      if (error) throw error;
      return (data?.Items || []) as JellyfinItem[];
    },
    enabled: !!downloadsLibrary?.ItemId && !!jellyfinUserId,
  });

  // Fetch items from other libraries to check for duplicates
  const { data: otherLibraryItems, isLoading: loadingOthers } = useQuery({
    queryKey: ["other-library-items", downloadsLibrary?.ItemId, jellyfinUserId],
    queryFn: async () => {
      if (!libraries || !downloadsLibrary?.ItemId || !jellyfinUserId) return [];
      
      const otherLibs = libraries.filter(
        (lib) => lib.ItemId !== downloadsLibrary.ItemId && 
                 (lib.CollectionType === "movies" || lib.CollectionType === "tvshows")
      );
      
      const allItems: JellyfinItem[] = [];
      
      for (const lib of otherLibs) {
        if (!lib.ItemId) continue;
        const { data } = await supabase.functions.invoke("jellyfin-proxy", {
          body: { 
            endpoint: `/Users/${jellyfinUserId}/Items?ParentId=${lib.ItemId}&IncludeItemTypes=Movie,Episode,Series&Recursive=true&Fields=Path,ProductionYear`,
          },
        });
        if (data?.Items) {
          // Add library name to each item for reference
          allItems.push(...data.Items.map((item: JellyfinItem) => ({ 
            ...item, 
            _libraryName: lib.Name 
          })));
        }
      }
      
      return allItems;
    },
    enabled: !!downloadsLibrary?.ItemId && !!libraries && !!jellyfinUserId,
  });

  // Process items to find pending ones
  const processedItems: PendingItem[] = (downloadsItems || []).map((item) => {
    // Check if this item exists in other libraries by name match
    const matchedItem = otherLibraryItems?.find((other: JellyfinItem & { _libraryName?: string }) => {
      if (item.Type === "Movie") {
        return other.Type === "Movie" && 
               other.Name.toLowerCase() === item.Name.toLowerCase() &&
               (!item.ProductionYear || !other.ProductionYear || other.ProductionYear === item.ProductionYear);
      }
      if (item.Type === "Episode") {
        return other.Type === "Episode" && 
               other.SeriesName?.toLowerCase() === item.SeriesName?.toLowerCase() &&
               other.ParentIndexNumber === item.ParentIndexNumber &&
               other.IndexNumber === item.IndexNumber;
      }
      if (item.Type === "Series") {
        return other.Type === "Series" && 
               other.Name.toLowerCase() === item.Name.toLowerCase();
      }
      return false;
    });

    return {
      ...item,
      existsElsewhere: !!matchedItem,
      matchedLibrary: matchedItem ? (matchedItem as JellyfinItem & { _libraryName?: string })._libraryName : undefined,
    };
  });

  // Filter by pending (not existing elsewhere) or show all
  const filteredItems = processedItems.filter((item) => {
    const matchesSearch = 
      item.Name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.SeriesName?.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (activeTab === "pending") {
      return matchesSearch && !item.existsElsewhere;
    }
    return matchesSearch;
  });

  const pendingCount = processedItems.filter((i) => !i.existsElsewhere).length;
  const processedCount = processedItems.filter((i) => i.existsElsewhere).length;

  const handleRefresh = async () => {
    toast.info("Oppdaterer nedlastinger...");
    await refetchDownloads();
    toast.success("Liste oppdatert");
  };

  // Handle move file via Radarr/Sonarr
  const handleMoveFile = async (item: PendingItem) => {
    setMovingItem(item.Id);
    try {
      if (item.Type === "Movie") {
        // Find the movie in Radarr and trigger a rename/move command
        const { data: movies, error: moviesError } = await supabase.functions.invoke('radarr-proxy', {
          body: { action: 'movies' }
        });
        
        if (moviesError) throw moviesError;
        
        // Normalize title for matching
        const normalizedTitle = item.Name.toLowerCase().replace(/[^a-z0-9]/g, '');
        const normalizedYear = item.ProductionYear;
        
        const movie = movies?.find((m: any) => {
          const mTitle = m.title?.toLowerCase().replace(/[^a-z0-9]/g, '') || '';
          const mYear = m.year;
          // Match by title and optionally by year
          return mTitle === normalizedTitle && (!normalizedYear || !mYear || mYear === normalizedYear);
        });
        
        if (!movie) {
          // Movie not in Radarr yet - tell user to import it first
          toast.error(`"${item.Name}" finnes ikke i Radarr. Importer den først via Radarr.`);
          return;
        }
        
        // Trigger a rename command in Radarr which moves files to correct location
        const { error: commandError } = await supabase.functions.invoke('radarr-proxy', {
          body: { 
            action: 'command', 
            params: { 
              name: 'RenameMovie',
              movieIds: [movie.id]
            } 
          }
        });
        
        if (commandError) throw commandError;
        
        toast.success(`Flyttekommando sendt for "${item.Name}". Radarr vil flytte filen.`);
        
        // Refresh list after a short delay
        setTimeout(() => refetchDownloads(), 3000);
        
      } else if (item.Type === "Episode" || item.Type === "Series") {
        // For episodes/series, use Sonarr
        const { data: series, error: seriesError } = await supabase.functions.invoke('sonarr-proxy', {
          body: { action: 'series' }
        });
        
        if (seriesError) throw seriesError;
        
        const seriesName = item.SeriesName || item.Name;
        const normalizedSeriesName = seriesName.toLowerCase().replace(/[^a-z0-9]/g, '');
        
        const matchedSeries = series?.find((s: any) => 
          s.title?.toLowerCase().replace(/[^a-z0-9]/g, '') === normalizedSeriesName
        );
        
        if (!matchedSeries) {
          toast.error(`"${seriesName}" finnes ikke i Sonarr. Importer den først via Sonarr.`);
          return;
        }
        
        // Trigger a rename command in Sonarr
        const { error: commandError } = await supabase.functions.invoke('sonarr-proxy', {
          body: { 
            action: 'command', 
            params: { 
              name: 'RenameSeries',
              seriesIds: [matchedSeries.id]
            } 
          }
        });
        
        if (commandError) throw commandError;
        
        toast.success(`Flyttekommando sendt for "${seriesName}". Sonarr vil flytte filen.`);
        
        // Refresh list after a short delay
        setTimeout(() => refetchDownloads(), 3000);
      }
    } catch (error) {
      console.error('Move error:', error);
      toast.error(error instanceof Error ? error.message : 'Kunne ikke flytte filen');
    } finally {
      setMovingItem(null);
    }
  };

  const isLoading = loadingLibraries || loadingDownloads || loadingOthers;

  if (!downloadsLibrary && !loadingLibraries) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Nedlastinger-oversikt
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 p-4 border rounded-lg bg-yellow-500/10 border-yellow-500/20">
            <AlertCircle className="h-5 w-5 text-yellow-500" />
            <div>
              <p className="font-medium">Downloads-bibliotek ikke funnet</p>
              <p className="text-sm text-muted-foreground">
                Opprett et bibliotek kalt "Downloads" eller "Nedlastinger" i Jellyfin for å bruke denne funksjonen.
              </p>
            </div>
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
              <Download className="h-5 w-5" />
              Nedlastinger-oversikt
            </CardTitle>
            <CardDescription>
              Filer i Downloads-biblioteket som venter på flytting
            </CardDescription>
          </div>
          <Button
            onClick={handleRefresh}
            disabled={isLoading}
            variant="outline"
            size="sm"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
            Oppdater
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Stats */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                <AlertCircle className="h-4 w-4 text-yellow-500" />
                <span className="font-medium">{pendingCount}</span>
                <span className="text-sm text-muted-foreground">venter</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-500/10 border border-green-500/20">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span className="font-medium">{processedCount}</span>
                <span className="text-sm text-muted-foreground">finnes andre steder</span>
              </div>
            </div>

            {/* Search and tabs */}
            <div className="flex flex-col sm:flex-row gap-3">
              <Input
                placeholder="Søk etter tittel..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="sm:max-w-xs"
              />
              <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "pending" | "all")}>
                <TabsList>
                  <TabsTrigger value="pending">
                    Venter ({pendingCount})
                  </TabsTrigger>
                  <TabsTrigger value="all">
                    Alle ({processedItems.length})
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            {/* Items list */}
            <div className="space-y-2 max-h-[500px] overflow-y-auto">
              {filteredItems.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FolderOpen className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>
                    {activeTab === "pending"
                      ? "Ingen ventende elementer!"
                      : "Ingen elementer funnet"}
                  </p>
                </div>
              ) : (
                filteredItems.map((item) => (
                  <div
                    key={item.Id}
                    className={`p-3 border rounded-lg flex items-center justify-between gap-3 ${
                      item.existsElsewhere
                        ? "bg-green-500/5 border-green-500/20"
                        : "bg-yellow-500/5 border-yellow-500/20"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {item.Type === "Movie" ? (
                        <Film className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                      ) : (
                        <Tv className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                      )}
                      <div className="min-w-0">
                        <p className="font-medium truncate">
                          {item.Type === "Episode" && item.SeriesName
                            ? `${item.SeriesName} - S${String(item.ParentIndexNumber || 0).padStart(2, "0")}E${String(item.IndexNumber || 0).padStart(2, "0")}`
                            : item.Name}
                          {item.ProductionYear && item.Type === "Movie" && (
                            <span className="text-muted-foreground ml-1">({item.ProductionYear})</span>
                          )}
                        </p>
                        {item.Type === "Episode" && (
                          <p className="text-xs text-muted-foreground truncate">{item.Name}</p>
                        )}
                        {item.MediaSources?.[0]?.Path && (
                          <p className="text-xs text-muted-foreground truncate">
                            {item.MediaSources[0].Path.split("/").pop() || item.MediaSources[0].Path.split("\\").pop()}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Badge variant={item.Type === "Movie" ? "default" : "secondary"}>
                        {item.Type === "Movie" ? "Film" : item.Type === "Episode" ? "Episode" : "Serie"}
                      </Badge>
                      {item.existsElsewhere ? (
                        <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/30">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          {item.matchedLibrary || "Finnes"}
                        </Badge>
                      ) : (
                        <>
                          <Badge variant="outline" className="bg-yellow-500/10 text-yellow-500 border-yellow-500/30">
                            <AlertCircle className="h-3 w-3 mr-1" />
                            Venter
                          </Badge>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleMoveFile(item)}
                            disabled={movingItem === item.Id}
                            className="h-7 px-2"
                          >
                            {movingItem === item.Id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <>
                                <ArrowRight className="h-3 w-3 mr-1" />
                                Flytt
                              </>
                            )}
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
