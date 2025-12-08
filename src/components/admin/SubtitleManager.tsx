import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { 
  Subtitles,
  Loader2,
  Check,
  X,
  Trash2,
  Search,
  Download,
  RefreshCw,
  Zap,
  AlertCircle
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useBazarrApi } from "@/hooks/useBazarrApi";

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

interface SubtitleInfo {
  Language: string;
  DisplayTitle: string;
  Codec: string;
  IsExternal: boolean;
  IsDefault: boolean;
  IsForced: boolean;
  Path?: string;
  Index?: number;
}

interface RemoteSubtitle {
  Id: string;
  Name: string;
  ProviderName: string;
  Language?: string;
  Format?: string;
  IsHashMatch?: boolean;
  Author?: string;
  DownloadCount?: number;
}

interface BazarrSubtitle {
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

interface BazarrStatus {
  data?: {
    bazarr_version?: string;
  };
}

interface SubtitleManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: MediaItem | null;
  serverUrl: string | null;
  onSubtitleChanged?: () => void;
}

const LANGUAGE_OPTIONS = [
  { value: "nor", label: "Norsk" },
  { value: "eng", label: "Engelsk" },
  { value: "swe", label: "Svensk" },
  { value: "dan", label: "Dansk" },
  { value: "fin", label: "Finsk" },
  { value: "ger", label: "Tysk" },
  { value: "fre", label: "Fransk" },
  { value: "spa", label: "Spansk" },
];

export const SubtitleManager = ({ 
  open, 
  onOpenChange, 
  item, 
  serverUrl,
  onSubtitleChanged 
}: SubtitleManagerProps) => {
  const [subtitles, setSubtitles] = useState<SubtitleInfo[]>([]);
  const [remoteSubtitles, setRemoteSubtitles] = useState<RemoteSubtitle[]>([]);
  const [bazarrSubtitles, setBazarrSubtitles] = useState<BazarrSubtitle[]>([]);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [bazarrSearching, setBazarrSearching] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [searchLanguage, setSearchLanguage] = useState("nor");
  const [showSearch, setShowSearch] = useState(false);
  const [bazarrConnected, setBazarrConnected] = useState<boolean | null>(null);
  const [activeTab, setActiveTab] = useState("jellyfin");
  const { bazarrRequest } = useBazarrApi();

  // Check Bazarr connection
  const checkBazarrConnection = async () => {
    try {
      const { data, error } = await bazarrRequest('status');
      
      if (error) {
        console.log('Bazarr not connected:', error);
        setBazarrConnected(false);
        return;
      }
      
      setBazarrConnected(true);
      console.log('Bazarr connected:', data);
    } catch (err) {
      console.log('Bazarr connection check failed:', err);
      setBazarrConnected(false);
    }
  };

  useEffect(() => {
    if (open) {
      checkBazarrConnection();
    }
  }, [open]);

  const getAuthToken = () => {
    const jellyfinSession = localStorage.getItem('jellyfin_session');
    return jellyfinSession ? JSON.parse(jellyfinSession).AccessToken : null;
  };

  const normalizeUrl = (url: string) => {
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      return `http://${url}`;
    }
    return url.replace(/\/$/, '');
  };

  // Load current subtitles when dialog opens
  const loadSubtitles = async () => {
    if (!item) return;
    
    setLoading(true);
    try {
      const allSubtitles: SubtitleInfo[] = [];
      
      item.MediaSources?.forEach(source => {
        source.MediaStreams?.filter(stream => stream.Type === "Subtitle").forEach((stream, index) => {
          allSubtitles.push({
            Language: stream.Language || "Ukjent",
            DisplayTitle: stream.DisplayTitle || stream.Title || "Ukjent",
            Codec: stream.Codec || "Ukjent",
            IsExternal: stream.IsExternal || false,
            IsDefault: stream.IsDefault || false,
            IsForced: false,
            Index: stream.Index ?? index,
          });
        });
      });

      setSubtitles(allSubtitles);
    } catch (error) {
      console.error("Error loading subtitles:", error);
      toast.error("Kunne ikke laste undertekster");
    } finally {
      setLoading(false);
    }
  };

  // Search for remote subtitles via Jellyfin
  const handleSearchSubtitles = async () => {
    if (!item || !serverUrl) return;
    
    setSearching(true);
    setRemoteSubtitles([]);
    
    try {
      const accessToken = getAuthToken();
      if (!accessToken) {
        toast.error("Ikke autentisert");
        return;
      }

      const normalizedUrl = normalizeUrl(serverUrl);
      
      const response = await fetch(
        `${normalizedUrl}/Items/${item.Id}/RemoteSearch/Subtitles/${searchLanguage}`,
        {
          headers: {
            "X-Emby-Token": accessToken,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const results = await response.json();
      setRemoteSubtitles(results || []);
      
      if (results.length === 0) {
        toast.info("Ingen undertekster funnet for dette språket");
      } else {
        toast.success(`Fant ${results.length} undertekster`);
      }
    } catch (error) {
      console.error("Error searching subtitles:", error);
      toast.error("Kunne ikke søke etter undertekster");
    } finally {
      setSearching(false);
    }
  };

  // Search via Bazarr
  const handleBazarrSearch = async () => {
    if (!item) return;
    
    setBazarrSearching(true);
    setBazarrSubtitles([]);
    
    try {
      const isMovie = item.Type === "Movie";
      const action = isMovie ? 'manual-search-movie' : 'manual-search-episode';
      
      const params = isMovie 
        ? { radarrId: item.Id } 
        : { episodeId: item.Id };

      const { data, error } = await bazarrRequest(action, params);
      
      if (error) {
        throw error;
      }
      
      const results = (data as { data?: BazarrSubtitle[] })?.data || [];
      setBazarrSubtitles(results);
      
      if (results.length === 0) {
        toast.info("Ingen undertekster funnet i Bazarr");
      } else {
        toast.success(`Fant ${results.length} undertekster via Bazarr`);
      }
    } catch (error) {
      console.error("Error searching Bazarr:", error);
      toast.error("Kunne ikke søke via Bazarr. Sjekk at ID-ene matcher Radarr/Sonarr.");
    } finally {
      setBazarrSearching(false);
    }
  };

  // Download a remote subtitle via Jellyfin
  const handleDownloadSubtitle = async (subtitle: RemoteSubtitle) => {
    if (!item || !serverUrl) return;
    
    setDownloading(subtitle.Id);
    
    try {
      const accessToken = getAuthToken();
      if (!accessToken) {
        toast.error("Ikke autentisert");
        return;
      }

      const normalizedUrl = normalizeUrl(serverUrl);
      
      const response = await fetch(
        `${normalizedUrl}/Items/${item.Id}/RemoteSearch/Subtitles/${subtitle.Id}`,
        {
          method: 'POST',
          headers: {
            "X-Emby-Token": accessToken,
          },
        }
      );

      if (response.ok) {
        toast.success("Undertekst lastet ned");
        onSubtitleChanged?.();
        setRemoteSubtitles(prev => prev.filter(s => s.Id !== subtitle.Id));
        await refreshItemAndSubtitles();
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error) {
      console.error("Error downloading subtitle:", error);
      toast.error("Kunne ikke laste ned undertekst");
    } finally {
      setDownloading(null);
    }
  };

  // Download subtitle via Bazarr
  const handleBazarrDownload = async (subtitle: BazarrSubtitle) => {
    if (!item) return;
    
    setDownloading(subtitle.subtitle || subtitle.description);
    
    try {
      const isMovie = item.Type === "Movie";
      const action = isMovie ? 'download-movie-subtitle' : 'download-episode-subtitle';
      
      const params = isMovie 
        ? { 
            radarrId: item.Id,
            language: subtitle.language,
            hi: subtitle.hearing_impaired,
            forced: subtitle.forced,
            provider: subtitle.provider,
            subtitle: subtitle.subtitle
          } 
        : { 
            sonarrId: item.Id,
            episodeId: item.Id,
            language: subtitle.language,
            hi: subtitle.hearing_impaired,
            forced: subtitle.forced,
            provider: subtitle.provider,
            subtitle: subtitle.subtitle
          };

      const { error } = await bazarrRequest(action, params);
      
      if (error) {
        throw error;
      }
      
      toast.success("Undertekst lastet ned via Bazarr");
      onSubtitleChanged?.();
      setBazarrSubtitles(prev => prev.filter(s => s.subtitle !== subtitle.subtitle));
      await refreshItemAndSubtitles();
    } catch (error) {
      console.error("Error downloading via Bazarr:", error);
      toast.error("Kunne ikke laste ned undertekst via Bazarr");
    } finally {
      setDownloading(null);
    }
  };

  // Delete a subtitle via Jellyfin
  const handleDeleteSubtitle = async (subtitleIndex: number) => {
    if (!item || !serverUrl) return;
    
    setDeleting(subtitleIndex);
    
    try {
      const accessToken = getAuthToken();
      if (!accessToken) {
        toast.error("Ikke autentisert");
        return;
      }

      const normalizedUrl = normalizeUrl(serverUrl);
      
      const response = await fetch(
        `${normalizedUrl}/Videos/${item.Id}/Subtitles/${subtitleIndex}`,
        {
          method: 'DELETE',
          headers: {
            "X-Emby-Token": accessToken,
          },
        }
      );

      if (response.ok) {
        toast.success("Undertekst slettet");
        setSubtitles(prev => prev.filter(s => s.Index !== subtitleIndex));
        onSubtitleChanged?.();
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error) {
      console.error("Error deleting subtitle:", error);
      toast.error("Kunne ikke slette undertekst");
    } finally {
      setDeleting(null);
    }
  };

  // Refresh item data from server
  const refreshItemAndSubtitles = async () => {
    if (!item || !serverUrl) return;
    
    setLoading(true);
    try {
      const accessToken = getAuthToken();
      if (!accessToken) return;

      const normalizedUrl = normalizeUrl(serverUrl);
      
      const response = await fetch(
        `${normalizedUrl}/Items/${item.Id}?Fields=MediaSources,MediaStreams`,
        {
          headers: {
            "X-Emby-Token": accessToken,
          },
        }
      );

      if (response.ok) {
        const updatedItem = await response.json();
        const allSubtitles: SubtitleInfo[] = [];
        
        updatedItem.MediaSources?.forEach((source: MediaSource) => {
          source.MediaStreams?.filter((stream: MediaStream) => stream.Type === "Subtitle").forEach((stream: MediaStream, index: number) => {
            allSubtitles.push({
              Language: stream.Language || "Ukjent",
              DisplayTitle: stream.DisplayTitle || stream.Title || "Ukjent",
              Codec: stream.Codec || "Ukjent",
              IsExternal: stream.IsExternal || false,
              IsDefault: stream.IsDefault || false,
              IsForced: false,
              Index: stream.Index ?? index,
            });
          });
        });

        setSubtitles(allSubtitles);
      }
    } catch (error) {
      console.error("Error refreshing subtitles:", error);
    } finally {
      setLoading(false);
    }
  };

  // Load subtitles when dialog opens
  const handleOpenChange = (newOpen: boolean) => {
    onOpenChange(newOpen);
    if (newOpen && item) {
      loadSubtitles();
      setShowSearch(false);
      setRemoteSubtitles([]);
      setBazarrSubtitles([]);
      setActiveTab("jellyfin");
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Subtitles className="h-5 w-5" />
            Undertekster for {item?.Name}
          </DialogTitle>
          <DialogDescription>
            Administrer undertekster - vis, slett eller søk etter og last ned nye
          </DialogDescription>
        </DialogHeader>
        
        {/* Action bar */}
        <div className="flex flex-wrap gap-2 pb-3 border-b">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowSearch(!showSearch)}
            className={showSearch ? "bg-primary/10" : ""}
          >
            <Search className="h-4 w-4 mr-2" />
            {showSearch ? "Skjul søk" : "Søk nye undertekster"}
          </Button>
          {bazarrConnected && (
            <Badge variant="secondary" className="flex items-center gap-1">
              <Zap className="h-3 w-3 text-green-500" />
              Bazarr tilkoblet
            </Badge>
          )}
          {bazarrConnected === false && (
            <Badge variant="outline" className="flex items-center gap-1 text-muted-foreground">
              <AlertCircle className="h-3 w-3" />
              Bazarr ikke tilkoblet
            </Badge>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={refreshItemAndSubtitles}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </Button>
        </div>

        {/* Search section */}
        {showSearch && (
          <div className="py-3 border-b space-y-3">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="jellyfin">Jellyfin</TabsTrigger>
                <TabsTrigger value="bazarr" disabled={!bazarrConnected}>
                  Bazarr {!bazarrConnected && "(ikke tilkoblet)"}
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="jellyfin" className="space-y-3 mt-3">
                <div className="flex gap-2 items-end">
                  <div className="flex-1">
                    <label className="text-sm text-muted-foreground mb-1 block">Språk</label>
                    <Select value={searchLanguage} onValueChange={setSearchLanguage}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {LANGUAGE_OPTIONS.map(lang => (
                          <SelectItem key={lang.value} value={lang.value}>
                            {lang.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    onClick={handleSearchSubtitles}
                    disabled={searching}
                  >
                    {searching ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Search className="h-4 w-4 mr-2" />
                    )}
                    Søk
                  </Button>
                </div>

                {/* Jellyfin search results */}
                {remoteSubtitles.length > 0 && (
                  <ScrollArea className="max-h-[200px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Navn</TableHead>
                          <TableHead className="text-center">Kilde</TableHead>
                          <TableHead className="text-center">Format</TableHead>
                          <TableHead className="text-center w-[100px]">Last ned</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {remoteSubtitles.map((sub) => (
                          <TableRow key={sub.Id}>
                            <TableCell className="max-w-[300px]">
                              <div className="truncate" title={sub.Name}>
                                {sub.Name}
                              </div>
                              {sub.IsHashMatch && (
                                <Badge variant="default" className="mt-1 text-xs bg-green-600">
                                  Hash match
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge variant="outline" className="text-xs">
                                {sub.ProviderName}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge variant="secondary" className="text-xs">
                                {sub.Format || "SRT"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 text-green-600 hover:text-green-700 hover:bg-green-100"
                                onClick={() => handleDownloadSubtitle(sub)}
                                disabled={downloading === sub.Id}
                                title="Last ned"
                              >
                                {downloading === sub.Id ? (
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
              </TabsContent>
              
              <TabsContent value="bazarr" className="space-y-3 mt-3">
                <div className="flex gap-2 items-center">
                  <p className="text-sm text-muted-foreground flex-1">
                    Søk via Bazarr basert på filens fingeravtrykk
                  </p>
                  <Button
                    onClick={handleBazarrSearch}
                    disabled={bazarrSearching}
                  >
                    {bazarrSearching ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Zap className="h-4 w-4 mr-2" />
                    )}
                    Søk i Bazarr
                  </Button>
                </div>

                {/* Bazarr search results */}
                {bazarrSubtitles.length > 0 && (
                  <ScrollArea className="max-h-[200px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Beskrivelse</TableHead>
                          <TableHead className="text-center">Kilde</TableHead>
                          <TableHead className="text-center">Score</TableHead>
                          <TableHead className="text-center w-[100px]">Last ned</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {bazarrSubtitles.map((sub, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="max-w-[300px]">
                              <div className="truncate" title={sub.description}>
                                {sub.description}
                              </div>
                              <div className="flex gap-1 mt-1">
                                <Badge variant="outline" className="text-xs">
                                  {sub.language}
                                </Badge>
                                {sub.hearing_impaired && (
                                  <Badge variant="secondary" className="text-xs">HI</Badge>
                                )}
                                {sub.forced && (
                                  <Badge variant="secondary" className="text-xs">Forced</Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge variant="outline" className="text-xs">
                                {sub.provider}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge 
                                variant={sub.score > 80 ? "default" : "secondary"} 
                                className={`text-xs ${sub.score > 80 ? "bg-green-600" : ""}`}
                              >
                                {sub.score}%
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 text-green-600 hover:text-green-700 hover:bg-green-100"
                                onClick={() => handleBazarrDownload(sub)}
                                disabled={downloading === (sub.subtitle || sub.description)}
                                title="Last ned"
                              >
                                {downloading === (sub.subtitle || sub.description) ? (
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
              </TabsContent>
            </Tabs>
          </div>
        )}

        {/* Current subtitles */}
        <div className="flex-1 overflow-hidden">
          <h4 className="text-sm font-medium mb-2 mt-2">Installerte undertekster</h4>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span className="ml-2">Henter undertekster...</span>
            </div>
          ) : subtitles.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <X className="h-12 w-12 mb-2 text-yellow-500" />
              <p>Ingen undertekster funnet</p>
              <p className="text-sm mt-2">Bruk "Søk nye undertekster" for å finne og laste ned</p>
            </div>
          ) : (
            <ScrollArea className="h-[250px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Språk</TableHead>
                    <TableHead>Tittel</TableHead>
                    <TableHead className="text-center">Format</TableHead>
                    <TableHead className="text-center">Type</TableHead>
                    <TableHead className="text-center">Standard</TableHead>
                    <TableHead className="text-center w-[80px]">Slett</TableHead>
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
                      <TableCell className="text-center">
                        {sub.IsExternal && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => handleDeleteSubtitle(sub.Index ?? index)}
                            disabled={deleting === (sub.Index ?? index)}
                            title="Slett undertekst"
                          >
                            {deleting === (sub.Index ?? index) ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
