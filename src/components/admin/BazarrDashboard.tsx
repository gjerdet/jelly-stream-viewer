import React, { useState, useEffect, useMemo } from "react";
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
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
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
  XCircle,
  CheckSquare,
  Square,
  Trash2,
  FolderOpen,
  ChevronDown
} from "lucide-react";
import { toast } from "sonner";
import { useBazarrApi } from "@/hooks/useBazarrApi";
import { supabase } from "@/integrations/supabase/client";

interface BazarrStatus {
  bazarr_version?: string;
  sonarr_version?: string;
  radarr_version?: string;
  operating_system?: string;
  python_version?: string;
}

interface SubtitleInfo {
  code2: string;
  code3: string;
  name: string;
  forced: boolean;
  hi: boolean;
  path: string;
}

interface WantedItem {
  title?: string;
  seriesTitle?: string;
  episodeTitle?: string;
  season?: number;
  episode?: number;
  episode_number?: string; // Bazarr format: "3x2"
  missing_subtitles?: Array<{ name: string; code2: string; code3: string }>;
  sonarrSeriesId?: number;
  sonarrEpisodeId?: number;
  radarrId?: number;
  sceneName?: string;
  subtitles?: SubtitleInfo[];
}

interface MovieItem {
  title?: string;
  radarrId?: number;
  subtitles?: SubtitleInfo[];
  missing_subtitles?: Array<{ name: string; code2: string; code3: string }>;
  path?: string;
  audio_language?: Array<{ name: string }>;
}

interface EpisodeItem {
  title?: string;
  seriesTitle?: string;
  season?: number;
  episode?: number;
  episode_number?: string;
  sonarrSeriesId?: number;
  sonarrEpisodeId?: number;
  subtitles?: SubtitleInfo[];
  missing_subtitles?: Array<{ name: string; code2: string; code3: string }>;
}

interface SeriesItem {
  title?: string;
  sonarrSeriesId?: number;
  episodeFileCount?: number;
  episodeMissingCount?: number;
  profileId?: number;
  seriesType?: string;
}

interface HistoryItem {
  action?: number;
  title?: string;
  seriesTitle?: string;
  episodeTitle?: string;
  season?: number;
  episode?: number;
  episode_number?: string; // Bazarr format: "3x2"
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

type SearchSource = 'bazarr' | 'jellyfin';

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
  const [selectedItem, setSelectedItem] = useState<WantedItem | MovieItem | null>(null);
  const [downloadingSubtitle, setDownloadingSubtitle] = useState<string | null>(null);
  const [searchSource, setSearchSource] = useState<SearchSource>('bazarr');
  
  // Subtitle management state
  const [allMovies, setAllMovies] = useState<MovieItem[]>([]);
  const [allSeries, setAllSeries] = useState<SeriesItem[]>([]);
  const [seriesEpisodes, setSeriesEpisodes] = useState<{ [key: number]: EpisodeItem[] }>({});
  const [loadingMovies, setLoadingMovies] = useState(false);
  const [loadingSeries, setLoadingSeries] = useState(false);
  const [movieSearchQuery, setMovieSearchQuery] = useState("");
  const [seriesSearchQuery, setSeriesSearchQuery] = useState("");
  const [expandedSeries, setExpandedSeries] = useState<number | null>(null);
  const [deletingSubtitle, setDeletingSubtitle] = useState<string | null>(null);
  const [manageDialogOpen, setManageDialogOpen] = useState(false);
  const [selectedMovieForManage, setSelectedMovieForManage] = useState<MovieItem | null>(null);
  
  // Search and bulk selection state
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedMovies, setSelectedMovies] = useState<Set<number>>(new Set());
  const [selectedEpisodes, setSelectedEpisodes] = useState<Set<number>>(new Set());
  const [bulkSearching, setBulkSearching] = useState(false);

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

  // Load all movies for subtitle management
  const loadAllMovies = async () => {
    setLoadingMovies(true);
    try {
      const { data, error } = await bazarrRequest('movies');
      
      if (error) throw error;
      
      if ((data as { data?: MovieItem[] })?.data) {
        setAllMovies((data as { data: MovieItem[] }).data);
      } else if (Array.isArray(data)) {
        setAllMovies(data as MovieItem[]);
      }
    } catch (err) {
      console.error('Failed to load movies:', err);
      toast.error('Kunne ikke laste filmer');
    } finally {
      setLoadingMovies(false);
    }
  };

  // Load all series for subtitle management
  const loadAllSeries = async () => {
    setLoadingSeries(true);
    try {
      const { data, error } = await bazarrRequest('series');
      
      if (error) throw error;
      
      if ((data as { data?: SeriesItem[] })?.data) {
        setAllSeries((data as { data: SeriesItem[] }).data);
      } else if (Array.isArray(data)) {
        setAllSeries(data as SeriesItem[]);
      }
    } catch (err) {
      console.error('Failed to load series:', err);
      toast.error('Kunne ikke laste serier');
    } finally {
      setLoadingSeries(false);
    }
  };

  // Load episodes for a specific series
  const loadSeriesEpisodes = async (sonarrId: number) => {
    try {
      const { data, error } = await bazarrRequest('episodes', { sonarrId });
      
      if (error) throw error;
      
      const episodes = (data as { data?: EpisodeItem[] })?.data || (Array.isArray(data) ? data as EpisodeItem[] : []);
      setSeriesEpisodes(prev => ({ ...prev, [sonarrId]: episodes }));
    } catch (err) {
      console.error('Failed to load episodes:', err);
      toast.error('Kunne ikke laste episoder');
    }
  };

  // Toggle series expansion and load episodes
  const toggleSeriesExpansion = async (sonarrId: number) => {
    if (expandedSeries === sonarrId) {
      setExpandedSeries(null);
    } else {
      setExpandedSeries(sonarrId);
      if (!seriesEpisodes[sonarrId]) {
        await loadSeriesEpisodes(sonarrId);
      }
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
      // Get first missing subtitle language or default to Norwegian
      const language = item.missing_subtitles?.[0]?.code2 || 'no';
      const params = type === 'movie' 
        ? { radarrId: item.radarrId, language }
        : { sonarrId: item.sonarrSeriesId, episodeId: item.sonarrEpisodeId, language };
      
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

  // Manual search for subtitles via Bazarr
  const handleBazarrSearch = async (item: WantedItem | MovieItem, type: 'movie' | 'episode') => {
    setSelectedItem(item);
    setManualSearchOpen(true);
    setManualSearchLoading(true);
    setManualSearchResults([]);
    setSearchSource('bazarr');
    
    try {
      const action = type === 'movie' ? 'manual-search-movie' : 'manual-search-episode';
      const params = type === 'movie' 
        ? { radarrId: (item as MovieItem).radarrId }
        : { episodeId: (item as WantedItem).sonarrEpisodeId };
      
      const { data, error } = await bazarrRequest(action, params);
      
      if (error) throw error;
      
      setManualSearchResults((data as { data?: SearchResult[] })?.data || []);
    } catch (err) {
      console.error('Bazarr manual search failed:', err);
      toast.error('Kunne ikke søke etter undertekster via Bazarr');
    } finally {
      setManualSearchLoading(false);
    }
  };

  // Find Jellyfin item by searching by title
  const findJellyfinItem = async (title: string, type: 'Movie' | 'Episode'): Promise<string | null> => {
    try {
      const { data, error } = await supabase.functions.invoke('jellyfin-proxy', {
        body: { 
          endpoint: `/Search/Hints?searchTerm=${encodeURIComponent(title)}&limit=10&includeItemTypes=${type}`,
          method: 'GET'
        }
      });
      
      if (error) throw error;
      
      // Find best match
      const hints = data?.SearchHints || [];
      if (hints.length > 0) {
        // Try to find exact match first
        const exactMatch = hints.find((h: any) => 
          h.Name?.toLowerCase() === title.toLowerCase()
        );
        return exactMatch?.Id || hints[0]?.Id || null;
      }
      return null;
    } catch (err) {
      console.error('Failed to search Jellyfin:', err);
      return null;
    }
  };

  // Manual search for subtitles via Jellyfin
  const handleJellyfinSearch = async (item: WantedItem | MovieItem, type: 'movie' | 'episode') => {
    setSelectedItem(item);
    setManualSearchOpen(true);
    setManualSearchLoading(true);
    setManualSearchResults([]);
    setSearchSource('jellyfin');
    
    try {
      // Get title to search for
      const title = type === 'movie' 
        ? (item as MovieItem).title 
        : (item as WantedItem).episodeTitle || (item as WantedItem).seriesTitle;
      
      toast.info(`Søker etter "${title}" i Jellyfin...`);
      
      // First find the Jellyfin item ID by searching
      const jellyfinItemId = await findJellyfinItem(
        title, 
        type === 'movie' ? 'Movie' : 'Episode'
      );
      
      if (!jellyfinItemId) {
        toast.error(`Kunne ikke finne "${title}" i Jellyfin`);
        setManualSearchLoading(false);
        return;
      }
      
      console.log(`Found Jellyfin item ID: ${jellyfinItemId} for "${title}"`);
      
      const { data, error } = await supabase.functions.invoke('jellyfin-search-subtitles', {
        body: { itemId: jellyfinItemId, language: 'nor' }
      });
      
      if (error) throw error;
      
      // Map Jellyfin results to SearchResult format
      const results: SearchResult[] = (data?.subtitles || []).map((sub: any) => ({
        provider: sub.ProviderName || 'Unknown',
        description: sub.Name || sub.Format || 'Ukjent',
        language: sub.Language || 'nor',
        hearing_impaired: sub.IsHashMatch || false,
        forced: sub.IsForced || false,
        score: sub.Score || 0,
        subtitle: sub.Id,
        release_info: [sub.Format, sub.Comment].filter(Boolean)
      }));
      
      setManualSearchResults(results);
      
      if (results.length === 0) {
        toast.info('Ingen undertekster funnet via Jellyfin');
      }
    } catch (err) {
      console.error('Jellyfin search failed:', err);
      toast.error('Kunne ikke søke etter undertekster via Jellyfin');
    } finally {
      setManualSearchLoading(false);
    }
  };

  // Download subtitle from manual search
  const downloadSubtitle = async (subtitle: SearchResult, item: WantedItem | MovieItem, type: 'movie' | 'episode') => {
    setDownloadingSubtitle(subtitle.subtitle || subtitle.description);
    
    try {
      const action = type === 'movie' ? 'download-movie-subtitle' : 'download-episode-subtitle';
      const params = type === 'movie' 
        ? { 
            radarrId: (item as MovieItem).radarrId,
            language: subtitle.language,
            hi: subtitle.hearing_impaired,
            forced: subtitle.forced,
            provider: subtitle.provider,
            subtitle: subtitle.subtitle
          }
        : { 
            sonarrId: (item as WantedItem).sonarrSeriesId,
            episodeId: (item as WantedItem).sonarrEpisodeId,
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
      loadAllMovies();
    } catch (err) {
      console.error('Download failed:', err);
      toast.error('Kunne ikke laste ned undertekst');
    } finally {
      setDownloadingSubtitle(null);
    }
  };

  // Delete subtitle
  const deleteSubtitle = async (movie: MovieItem, subtitle: SubtitleInfo) => {
    setDeletingSubtitle(subtitle.path);
    
    try {
      const { error } = await bazarrRequest('delete-movie-subtitle', {
        radarrId: movie.radarrId,
        language: subtitle.code2,
        forced: subtitle.forced,
        hi: subtitle.hi,
        path: subtitle.path
      });
      
      if (error) throw error;
      
      toast.success('Undertekst slettet');
      // Refresh the movie data
      loadAllMovies();
      
      // Update the selected movie for manage dialog
      if (selectedMovieForManage?.radarrId === movie.radarrId) {
        const { data } = await bazarrRequest('movie', { radarrId: movie.radarrId });
        if ((data as { data?: MovieItem[] })?.data?.[0]) {
          setSelectedMovieForManage((data as { data: MovieItem[] }).data[0]);
        }
      }
    } catch (err) {
      console.error('Delete failed:', err);
      toast.error('Kunne ikke slette undertekst');
    } finally {
      setDeletingSubtitle(null);
    }
  };

  // Open manage dialog for a movie
  const openManageDialog = async (movie: MovieItem) => {
    setSelectedMovieForManage(movie);
    setManageDialogOpen(true);
    
    // Fetch fresh data for the movie
    try {
      const { data } = await bazarrRequest('movie', { radarrId: movie.radarrId });
      if ((data as { data?: MovieItem[] })?.data?.[0]) {
        setSelectedMovieForManage((data as { data: MovieItem[] }).data[0]);
      }
    } catch (err) {
      console.error('Failed to fetch movie details:', err);
    }
  };

  // Filtered items based on search query - use allMovies for Mangler tab
  const filteredMovies = useMemo(() => {
    const moviesToFilter = allMovies as unknown as WantedItem[];
    if (!searchQuery.trim()) return moviesToFilter;
    const query = searchQuery.toLowerCase();
    return moviesToFilter.filter(item => 
      item.title?.toLowerCase().includes(query)
    );
  }, [allMovies, searchQuery]);

  const filteredEpisodes = useMemo(() => {
    if (!searchQuery.trim()) return wantedEpisodes;
    const query = searchQuery.toLowerCase();
    return wantedEpisodes.filter(item => 
      item.seriesTitle?.toLowerCase().includes(query) ||
      item.episodeTitle?.toLowerCase().includes(query)
    );
  }, [wantedEpisodes, searchQuery]);

  // Filtered all movies for management
  const filteredAllMovies = useMemo(() => {
    if (!movieSearchQuery.trim()) return allMovies;
    const query = movieSearchQuery.toLowerCase();
    return allMovies.filter(item => 
      item.title?.toLowerCase().includes(query)
    );
  }, [allMovies, movieSearchQuery]);

  // Movies with subtitles
  const moviesWithSubtitles = useMemo(() => {
    return filteredAllMovies.filter(m => m.subtitles && m.subtitles.length > 0);
  }, [filteredAllMovies]);

  // Filtered all series for management
  const filteredAllSeries = useMemo(() => {
    if (!seriesSearchQuery.trim()) return allSeries;
    const query = seriesSearchQuery.toLowerCase();
    return allSeries.filter(item => 
      item.title?.toLowerCase().includes(query)
    );
  }, [allSeries, seriesSearchQuery]);

  // Bulk selection helpers
  const toggleMovieSelection = (radarrId: number) => {
    setSelectedMovies(prev => {
      const newSet = new Set(prev);
      if (newSet.has(radarrId)) {
        newSet.delete(radarrId);
      } else {
        newSet.add(radarrId);
      }
      return newSet;
    });
  };

  const toggleEpisodeSelection = (episodeId: number) => {
    setSelectedEpisodes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(episodeId)) {
        newSet.delete(episodeId);
      } else {
        newSet.add(episodeId);
      }
      return newSet;
    });
  };

  const selectAllMovies = () => {
    if (selectedMovies.size === filteredMovies.length) {
      setSelectedMovies(new Set());
    } else {
      setSelectedMovies(new Set(filteredMovies.map(m => m.radarrId!).filter(Boolean)));
    }
  };

  const selectAllEpisodes = () => {
    if (selectedEpisodes.size === filteredEpisodes.length) {
      setSelectedEpisodes(new Set());
    } else {
      setSelectedEpisodes(new Set(filteredEpisodes.map(e => e.sonarrEpisodeId!).filter(Boolean)));
    }
  };

  // Bulk search for selected movies
  const bulkSearchMovies = async () => {
    if (selectedMovies.size === 0) {
      toast.info('Velg minst én film');
      return;
    }

    setBulkSearching(true);
    let successCount = 0;
    let failCount = 0;

    for (const radarrId of selectedMovies) {
      const movie = wantedMovies.find(m => m.radarrId === radarrId);
      const language = movie?.missing_subtitles?.[0]?.code2 || 'no';
      
      try {
        const { error } = await bazarrRequest('search-movie', { radarrId, language });
        if (error) throw error;
        successCount++;
      } catch (err) {
        console.error('Bulk search failed for movie:', radarrId, err);
        failCount++;
      }
    }

    setBulkSearching(false);
    setSelectedMovies(new Set());
    
    if (successCount > 0) {
      toast.success(`Startet søk for ${successCount} film(er)`);
    }
    if (failCount > 0) {
      toast.error(`${failCount} søk feilet`);
    }
    
    setTimeout(() => loadWanted(), 3000);
  };

  // Bulk search for selected episodes
  const bulkSearchEpisodes = async () => {
    if (selectedEpisodes.size === 0) {
      toast.info('Velg minst én episode');
      return;
    }

    setBulkSearching(true);
    let successCount = 0;
    let failCount = 0;

    for (const episodeId of selectedEpisodes) {
      const episode = wantedEpisodes.find(e => e.sonarrEpisodeId === episodeId);
      if (!episode) continue;
      
      const language = episode.missing_subtitles?.[0]?.code2 || 'no';
      
      try {
        const { error } = await bazarrRequest('search-episode', { 
          sonarrId: episode.sonarrSeriesId, 
          episodeId: episode.sonarrEpisodeId,
          language
        });
        if (error) throw error;
        successCount++;
      } catch (err) {
        console.error('Bulk search failed for episode:', episodeId, err);
        failCount++;
      }
    }

    setBulkSearching(false);
    setSelectedEpisodes(new Set());
    
    if (successCount > 0) {
      toast.success(`Startet søk for ${successCount} episode(r)`);
    }
    if (failCount > 0) {
      toast.error(`${failCount} søk feilet`);
    }
    
    setTimeout(() => loadWanted(), 3000);
  };

  useEffect(() => {
    checkConnection();
  }, []);

  useEffect(() => {
    if (connected) {
      loadWanted();
      loadHistory();
      loadAllMovies();
      loadAllSeries();
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
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="wanted" className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              Mangler ({wantedMovies.length + wantedEpisodes.length})
            </TabsTrigger>
            <TabsTrigger value="manage" className="flex items-center gap-2">
              <FolderOpen className="h-4 w-4" />
              Administrer
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
            {/* Search and controls */}
            <div className="flex flex-col sm:flex-row gap-3 mb-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Søk etter tittel..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => { loadWanted(); loadAllMovies(); }}
                disabled={loadingWanted || loadingMovies}
              >
                {(loadingWanted || loadingMovies) ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
              </Button>
            </div>

            {/* Movies Wanted */}
            {filteredMovies.length > 0 && (
              <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-medium flex items-center gap-2">
                    <Film className="h-4 w-4" />
                    Filmer ({filteredMovies.length})
                  </h4>
                  <div className="flex gap-2">
                    {selectedMovies.size > 0 && (
                      <Button
                        variant="default"
                        size="sm"
                        onClick={bulkSearchMovies}
                        disabled={bulkSearching}
                        className="text-xs"
                      >
                        {bulkSearching ? (
                          <Loader2 className="h-3 w-3 animate-spin mr-1" />
                        ) : (
                          <Zap className="h-3 w-3 mr-1" />
                        )}
                        Søk valgte ({selectedMovies.size})
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={selectAllMovies}
                      className="text-xs"
                    >
                      {selectedMovies.size === filteredMovies.length && filteredMovies.length > 0 ? (
                        <>
                          <CheckSquare className="h-3 w-3 mr-1" />
                          Fjern alle
                        </>
                      ) : (
                        <>
                          <Square className="h-3 w-3 mr-1" />
                          Velg alle
                        </>
                      )}
                    </Button>
                  </div>
                </div>
                <div className="h-[250px] overflow-y-auto border rounded-md">
                  <Table>
                    <TableHeader className="sticky top-0 bg-background z-10">
                      <TableRow>
                        <TableHead className="w-[40px]"></TableHead>
                        <TableHead>Tittel</TableHead>
                        <TableHead>Mangler</TableHead>
                        <TableHead className="text-right">Handlinger</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredMovies.map((item, idx) => (
                        <TableRow 
                          key={idx}
                          className={selectedMovies.has(item.radarrId!) ? "bg-primary/10" : ""}
                        >
                          <TableCell>
                            <Checkbox
                              checked={selectedMovies.has(item.radarrId!)}
                              onCheckedChange={() => toggleMovieSelection(item.radarrId!)}
                            />
                          </TableCell>
                          <TableCell className="font-medium">{item.title}</TableCell>
                          <TableCell>
                            <div className="flex gap-1 flex-wrap">
                              {(item as unknown as MovieItem).subtitles && (item as unknown as MovieItem).subtitles!.length > 0 ? (
                                (item as unknown as MovieItem).subtitles!.map((sub, i) => (
                                  <Badge key={i} variant="secondary" className="text-xs">
                                    {sub.name || sub.code2}
                                    {sub.hi && ' (HI)'}
                                  </Badge>
                                ))
                              ) : item.missing_subtitles && item.missing_subtitles.length > 0 ? (
                                item.missing_subtitles.map((lang, i) => (
                                  <Badge key={i} variant="outline" className="text-xs text-yellow-600 border-yellow-600">
                                    Mangler {lang.name || lang.code2}
                                  </Badge>
                                ))
                              ) : (
                                <span className="text-muted-foreground text-xs">Ingen undertekster</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex gap-1 justify-end">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => triggerSearch(item, 'movie')}
                                disabled={searchingItem === item.radarrId?.toString()}
                                title="Automatisk søk (Bazarr)"
                              >
                                {searchingItem === item.radarrId?.toString() ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Play className="h-4 w-4" />
                                )}
                              </Button>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="sm" title="Manuelt søk">
                                    <Search className="h-4 w-4" />
                                    <ChevronDown className="h-3 w-3 ml-1" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent>
                                  <DropdownMenuItem onClick={() => handleBazarrSearch(item, 'movie')}>
                                    <Subtitles className="h-4 w-4 mr-2" />
                                    Søk via Bazarr
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleJellyfinSearch(item, 'movie')}>
                                    <Play className="h-4 w-4 mr-2" />
                                    Søk via Jellyfin
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
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
            {filteredEpisodes.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-medium flex items-center gap-2">
                    <Tv className="h-4 w-4" />
                    Episoder ({filteredEpisodes.length})
                  </h4>
                  <div className="flex gap-2">
                    {selectedEpisodes.size > 0 && (
                      <Button
                        variant="default"
                        size="sm"
                        onClick={bulkSearchEpisodes}
                        disabled={bulkSearching}
                        className="text-xs"
                      >
                        {bulkSearching ? (
                          <Loader2 className="h-3 w-3 animate-spin mr-1" />
                        ) : (
                          <Zap className="h-3 w-3 mr-1" />
                        )}
                        Søk valgte ({selectedEpisodes.size})
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={selectAllEpisodes}
                      className="text-xs"
                    >
                      {selectedEpisodes.size === filteredEpisodes.length && filteredEpisodes.length > 0 ? (
                        <>
                          <CheckSquare className="h-3 w-3 mr-1" />
                          Fjern alle
                        </>
                      ) : (
                        <>
                          <Square className="h-3 w-3 mr-1" />
                          Velg alle
                        </>
                      )}
                    </Button>
                  </div>
                </div>
                <div className="h-[300px] overflow-y-auto border rounded-md">
                  <Table>
                    <TableHeader className="sticky top-0 bg-background z-10">
                      <TableRow>
                        <TableHead className="w-[40px]"></TableHead>
                        <TableHead>Serie</TableHead>
                        <TableHead>Episode</TableHead>
                        <TableHead>Mangler</TableHead>
                        <TableHead className="text-right">Handlinger</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredEpisodes.map((item, idx) => (
                        <TableRow 
                          key={idx}
                          className={selectedEpisodes.has(item.sonarrEpisodeId!) ? "bg-primary/10" : ""}
                        >
                          <TableCell>
                            <Checkbox
                              checked={selectedEpisodes.has(item.sonarrEpisodeId!)}
                              onCheckedChange={() => toggleEpisodeSelection(item.sonarrEpisodeId!)}
                            />
                          </TableCell>
                          <TableCell className="font-medium">{item.seriesTitle}</TableCell>
                          <TableCell>
                            <span className="font-mono">{item.episode_number || `S${String(item.season || 0).padStart(2, '0')}E${String(item.episode || 0).padStart(2, '0')}`}</span>
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
                                title="Automatisk søk (Bazarr)"
                              >
                                {searchingItem === item.sonarrEpisodeId?.toString() ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Play className="h-4 w-4" />
                                )}
                              </Button>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="sm" title="Manuelt søk">
                                    <Search className="h-4 w-4" />
                                    <ChevronDown className="h-3 w-3 ml-1" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent>
                                  <DropdownMenuItem onClick={() => handleBazarrSearch(item, 'episode')}>
                                    <Subtitles className="h-4 w-4 mr-2" />
                                    Søk via Bazarr
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleJellyfinSearch(item, 'episode')}>
                                    <Play className="h-4 w-4 mr-2" />
                                    Søk via Jellyfin
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {filteredMovies.length === 0 && filteredEpisodes.length === 0 && !loadingWanted && !loadingMovies && (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                {searchQuery ? (
                  <>
                    <Search className="h-12 w-12 mb-4 text-muted-foreground" />
                    <p>Ingen treff for "{searchQuery}"</p>
                  </>
                ) : (
                  <>
                    <Film className="h-12 w-12 mb-4 text-muted-foreground" />
                    <p>Ingen filmer funnet</p>
                  </>
                )}
              </div>
            )}
            
            {(loadingMovies || loadingWanted) && filteredMovies.length === 0 && (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin mr-2" />
                <span>Laster...</span>
              </div>
            )}
          </TabsContent>

          {/* Manage Subtitles Tab */}
          <TabsContent value="manage" className="mt-4">
            <Tabs defaultValue="manage-movies">
              <TabsList className="mb-4">
                <TabsTrigger value="manage-movies" className="flex items-center gap-2">
                  <Film className="h-4 w-4" />
                  Filmer ({allMovies.length})
                </TabsTrigger>
                <TabsTrigger value="manage-series" className="flex items-center gap-2">
                  <Tv className="h-4 w-4" />
                  Serier ({allSeries.length})
                </TabsTrigger>
              </TabsList>

              {/* Manage Movies */}
              <TabsContent value="manage-movies">
                <div className="flex flex-col sm:flex-row gap-3 mb-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Søk etter film..."
                      value={movieSearchQuery}
                      onChange={(e) => setMovieSearchQuery(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={loadAllMovies}
                    disabled={loadingMovies}
                  >
                    {loadingMovies ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                  </Button>
                </div>

                <div className="text-sm text-muted-foreground mb-3">
                  Viser {filteredAllMovies.length} filmer
                </div>

                <div className="h-[400px] overflow-y-auto border rounded-md">
                  <Table>
                    <TableHeader className="sticky top-0 bg-background z-10">
                      <TableRow>
                        <TableHead>Film</TableHead>
                        <TableHead>Undertekster</TableHead>
                        <TableHead className="text-right">Handlinger</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loadingMovies ? (
                        <TableRow>
                          <TableCell colSpan={3} className="text-center py-8">
                            <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                          </TableCell>
                        </TableRow>
                      ) : filteredAllMovies.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                            {movieSearchQuery ? `Ingen treff for "${movieSearchQuery}"` : 'Ingen filmer funnet'}
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredAllMovies.map((movie, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="font-medium">{movie.title}</TableCell>
                            <TableCell>
                              <div className="flex gap-1 flex-wrap">
                                {movie.subtitles && movie.subtitles.length > 0 ? (
                                  movie.subtitles.map((sub, i) => (
                                    <Badge key={i} variant="secondary" className="text-xs">
                                      {sub.name || sub.code2}
                                      {sub.forced && ' (Forced)'}
                                      {sub.hi && ' (HI)'}
                                    </Badge>
                                  ))
                                ) : movie.missing_subtitles && movie.missing_subtitles.length > 0 ? (
                                  movie.missing_subtitles.map((lang, i) => (
                                    <Badge key={i} variant="outline" className="text-xs text-yellow-600 border-yellow-600">
                                      Mangler {lang.name || lang.code2}
                                    </Badge>
                                  ))
                                ) : (
                                  <span className="text-muted-foreground text-xs">Ingen undertekster</span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex gap-1 justify-end">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleBazarrSearch(movie, 'movie')}
                                  title="Søk undertekster (Bazarr)"
                                >
                                  <Search className="h-4 w-4" />
                                </Button>
                                {movie.subtitles && movie.subtitles.length > 0 && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => openManageDialog(movie)}
                                    title="Administrer undertekster"
                                  >
                                    <Settings className="h-4 w-4" />
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>

              {/* Manage Series */}
              <TabsContent value="manage-series">
                <div className="flex flex-col sm:flex-row gap-3 mb-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Søk etter serie..."
                      value={seriesSearchQuery}
                      onChange={(e) => setSeriesSearchQuery(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={loadAllSeries}
                    disabled={loadingSeries}
                  >
                    {loadingSeries ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                  </Button>
                </div>

                <div className="text-sm text-muted-foreground mb-3">
                  Viser {filteredAllSeries.length} serier
                </div>

                <div className="h-[400px] overflow-y-auto border rounded-md">
                  <Table>
                    <TableHeader className="sticky top-0 bg-background z-10">
                      <TableRow>
                        <TableHead>Serie</TableHead>
                        <TableHead>Episoder</TableHead>
                        <TableHead className="text-right">Handlinger</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loadingSeries ? (
                        <TableRow>
                          <TableCell colSpan={3} className="text-center py-8">
                            <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                          </TableCell>
                        </TableRow>
                      ) : filteredAllSeries.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                            {seriesSearchQuery ? `Ingen treff for "${seriesSearchQuery}"` : 'Ingen serier funnet'}
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredAllSeries.map((series, idx) => (
                          <React.Fragment key={idx}>
                            <TableRow className="cursor-pointer hover:bg-muted/50" onClick={() => toggleSeriesExpansion(series.sonarrSeriesId!)}>
                              <TableCell className="font-medium">
                                <div className="flex items-center gap-2">
                                  <ChevronDown className={`h-4 w-4 transition-transform ${expandedSeries === series.sonarrSeriesId ? 'rotate-180' : ''}`} />
                                  {series.title}
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline">
                                  {series.episodeFileCount || 0} episoder
                                </Badge>
                                {series.episodeMissingCount && series.episodeMissingCount > 0 && (
                                  <Badge variant="destructive" className="ml-2">
                                    {series.episodeMissingCount} mangler
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell className="text-right">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleSeriesExpansion(series.sonarrSeriesId!);
                                  }}
                                >
                                  <FolderOpen className="h-4 w-4 mr-1" />
                                  Se episoder
                                </Button>
                              </TableCell>
                            </TableRow>
                            {/* Expanded episodes */}
                            {expandedSeries === series.sonarrSeriesId && (
                              <TableRow>
                                <TableCell colSpan={3} className="bg-muted/30 p-0">
                                  <div className="p-4">
                                    {!seriesEpisodes[series.sonarrSeriesId!] ? (
                                      <div className="flex items-center justify-center py-4">
                                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                        Laster episoder...
                                      </div>
                                    ) : seriesEpisodes[series.sonarrSeriesId!].length === 0 ? (
                                      <div className="text-center py-4 text-muted-foreground">
                                        Ingen episoder funnet
                                      </div>
                                    ) : (
                                      <div className="space-y-2 max-h-[300px] overflow-y-auto">
                                        {seriesEpisodes[series.sonarrSeriesId!].map((ep, epIdx) => (
                                          <div key={epIdx} className="flex items-center justify-between p-2 rounded bg-background border">
                                            <div className="flex-1">
                                              <span className="font-mono text-sm mr-2">
                                                {ep.episode_number || `S${String(ep.season || 0).padStart(2, '0')}E${String(ep.episode || 0).padStart(2, '0')}`}
                                              </span>
                                              <span className="text-sm">{ep.title}</span>
                                            </div>
                                            <div className="flex gap-1 items-center">
                                              {ep.subtitles && ep.subtitles.length > 0 ? (
                                                ep.subtitles.map((sub, subIdx) => (
                                                  <Badge key={subIdx} variant="secondary" className="text-xs">
                                                    {sub.name || sub.code2}
                                                    {sub.hi && ' (HI)'}
                                                  </Badge>
                                                ))
                                              ) : ep.missing_subtitles && ep.missing_subtitles.length > 0 ? (
                                                ep.missing_subtitles.map((lang, langIdx) => (
                                                  <Badge key={langIdx} variant="outline" className="text-xs text-yellow-600 border-yellow-600">
                                                    Mangler {lang.name || lang.code2}
                                                  </Badge>
                                                ))
                                              ) : (
                                                <Badge variant="outline" className="text-xs">Ingen undertekster</Badge>
                                              )}
                                              <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => handleBazarrSearch(ep as unknown as WantedItem, 'episode')}
                                                title="Søk undertekster"
                                              >
                                                <Search className="h-3 w-3" />
                                              </Button>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </TableCell>
                              </TableRow>
                            )}
                          </React.Fragment>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>
            </Tabs>
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
                            <span className="font-mono">{item.episode_number || `S${String(item.season || 0).padStart(2, '0')}E${String(item.episode || 0).padStart(2, '0')}`}</span>
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
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 border rounded-lg">
                <div className="text-sm text-muted-foreground">Bazarr</div>
                <div className="text-lg font-semibold">v{status?.bazarr_version || '-'}</div>
              </div>
              <div className="p-4 border rounded-lg">
                <div className="text-sm text-muted-foreground">Sonarr</div>
                <div className="text-lg font-semibold">v{status?.sonarr_version || '-'}</div>
              </div>
              <div className="p-4 border rounded-lg">
                <div className="text-sm text-muted-foreground">Radarr</div>
                <div className="text-lg font-semibold">v{status?.radarr_version || '-'}</div>
              </div>
              <div className="p-4 border rounded-lg">
                <div className="text-sm text-muted-foreground">Python</div>
                <div className="text-lg font-semibold">{status?.python_version || '-'}</div>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* Manual Search Dialog */}
        <Dialog open={manualSearchOpen} onOpenChange={setManualSearchOpen}>
          <DialogContent className="max-w-3xl max-h-[80vh]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Search className="h-5 w-5" />
                Søk undertekster {searchSource === 'bazarr' ? '(Bazarr)' : '(Jellyfin)'}
              </DialogTitle>
              <DialogDescription>
                {(selectedItem as MovieItem)?.title || (selectedItem as WantedItem)?.seriesTitle}
              </DialogDescription>
            </DialogHeader>
            
            <ScrollArea className="max-h-[60vh]">
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
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Kilde</TableHead>
                      <TableHead>Beskrivelse</TableHead>
                      <TableHead>Score</TableHead>
                      <TableHead className="text-right">Last ned</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {manualSearchResults.map((result, idx) => (
                      <TableRow key={idx}>
                        <TableCell>
                          <Badge variant="secondary">{result.provider}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="max-w-md">
                            <p className="truncate">{result.description}</p>
                            <div className="flex gap-1 mt-1">
                              {result.hearing_impaired && (
                                <Badge variant="outline" className="text-xs">HI</Badge>
                              )}
                              {result.forced && (
                                <Badge variant="outline" className="text-xs">Forced</Badge>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant={result.score > 80 ? "default" : result.score > 50 ? "secondary" : "outline"}
                          >
                            {result.score}%
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            onClick={() => downloadSubtitle(result, selectedItem!, 'movie')}
                            disabled={downloadingSubtitle === (result.subtitle || result.description)}
                          >
                            {downloadingSubtitle === (result.subtitle || result.description) ? (
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
              )}
            </ScrollArea>
          </DialogContent>
        </Dialog>

        {/* Manage Subtitles Dialog */}
        <Dialog open={manageDialogOpen} onOpenChange={setManageDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[85vh]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Subtitles className="h-5 w-5" />
                Administrer undertekster
              </DialogTitle>
              <DialogDescription>
                {selectedMovieForManage?.title}
                {selectedMovieForManage?.path && (
                  <span className="block text-xs mt-1 font-mono truncate opacity-70">
                    {selectedMovieForManage.path}
                  </span>
                )}
              </DialogDescription>
            </DialogHeader>
            
            <ScrollArea className="max-h-[55vh]">
              {selectedMovieForManage?.subtitles && selectedMovieForManage.subtitles.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Språk</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="min-w-[300px]">Filsti</TableHead>
                      <TableHead className="text-right">Handlinger</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedMovieForManage.subtitles.map((sub, idx) => (
                      <TableRow key={idx}>
                        <TableCell>
                          <Badge variant="secondary">{sub.name || sub.code2}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {sub.forced && <Badge variant="outline" className="text-xs">Forced</Badge>}
                            {sub.hi && <Badge variant="outline" className="text-xs">HI</Badge>}
                            {!sub.forced && !sub.hi && <span className="text-muted-foreground text-sm">Normal</span>}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="font-mono text-xs text-muted-foreground break-all max-w-[350px]">
                            {sub.path}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-1 justify-end">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                navigator.clipboard.writeText(sub.path);
                                toast.success('Filsti kopiert');
                              }}
                              title="Kopier filsti"
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => deleteSubtitle(selectedMovieForManage, sub)}
                              disabled={deletingSubtitle === sub.path}
                              title="Slett undertekst"
                            >
                              {deletingSubtitle === sub.path ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Subtitles className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Ingen undertekster funnet for denne filmen</p>
                </div>
              )}
            </ScrollArea>

            <div className="flex gap-2 pt-4 border-t">
              <Button 
                variant="outline" 
                onClick={() => selectedMovieForManage && handleBazarrSearch(selectedMovieForManage, 'movie')}
                className="flex-1"
              >
                <Search className="h-4 w-4 mr-2" />
                Søk via Bazarr
              </Button>
              <Button 
                variant="outline" 
                onClick={() => selectedMovieForManage && handleJellyfinSearch(selectedMovieForManage, 'movie')}
                className="flex-1"
              >
                <Play className="h-4 w-4 mr-2" />
                Søk via Jellyfin
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};
