import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, AlertCircle, Film, Tv, Star, Search, ChevronLeft, ChevronRight, Check, Home, Grid3X3 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useJellyseerrRequest } from "@/hooks/useJellyseerr";
import { SeasonSelectDialog } from "@/components/SeasonSelectDialog";
import { MediaDetailDialog } from "@/components/MediaDetailDialog";
import { cn } from "@/lib/utils";

interface DiscoverResult {
  id: number;
  mediaType: 'movie' | 'tv';
  title?: string;
  name?: string;
  overview: string;
  posterPath?: string;
  backdropPath?: string;
  voteAverage: number;
  releaseDate?: string;
  firstAirDate?: string;
  mediaInfo?: {
    status: number;
    requests?: any[];
  };
}

// TMDB Genre IDs with translation keys
const MOVIE_GENRES = [
  { id: 28, key: 'action' },
  { id: 12, key: 'adventure' },
  { id: 16, key: 'animation' },
  { id: 35, key: 'comedy' },
  { id: 80, key: 'crime' },
  { id: 99, key: 'documentary' },
  { id: 18, key: 'drama' },
  { id: 10751, key: 'family' },
  { id: 14, key: 'fantasy' },
  { id: 36, key: 'history' },
  { id: 27, key: 'horror' },
  { id: 10402, key: 'music' },
  { id: 9648, key: 'mystery' },
  { id: 10749, key: 'romance' },
  { id: 878, key: 'scifi' },
  { id: 53, key: 'thriller' },
  { id: 10752, key: 'war' },
  { id: 37, key: 'western' },
];

const TV_GENRES = [
  { id: 10759, key: 'actionAdventure' },
  { id: 16, key: 'animation' },
  { id: 35, key: 'comedy' },
  { id: 80, key: 'crime' },
  { id: 99, key: 'documentary' },
  { id: 18, key: 'drama' },
  { id: 10751, key: 'family' },
  { id: 10762, key: 'kids' },
  { id: 9648, key: 'mystery' },
  { id: 10763, key: 'news' },
  { id: 10764, key: 'reality' },
  { id: 10765, key: 'scifiFantasy' },
  { id: 10766, key: 'soap' },
  { id: 10767, key: 'talk' },
  { id: 10768, key: 'warPolitics' },
  { id: 37, key: 'western' },
];

const Wishes = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { t } = useLanguage();
  const wishes = t.wishes as any;
  const [jellyseerrUrl, setJellyseerrUrl] = useState<string>("");
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);
  const [activeTab, setActiveTab] = useState("home");
  
  // Home tab state
  const [trendingMovies, setTrendingMovies] = useState<DiscoverResult[]>([]);
  const [trendingSeries, setTrendingSeries] = useState<DiscoverResult[]>([]);
  const [discoverMovies, setDiscoverMovies] = useState<DiscoverResult[]>([]);
  const [discoverSeries, setDiscoverSeries] = useState<DiscoverResult[]>([]);
  const [isLoadingTrendingMovies, setIsLoadingTrendingMovies] = useState(false);
  const [isLoadingTrendingSeries, setIsLoadingTrendingSeries] = useState(false);
  const [isLoadingDiscoverMovies, setIsLoadingDiscoverMovies] = useState(false);
  const [isLoadingDiscoverSeries, setIsLoadingDiscoverSeries] = useState(false);
  
  // Browse Movies state
  const [browseMovies, setBrowseMovies] = useState<DiscoverResult[]>([]);
  const [moviePage, setMoviePage] = useState(1);
  const [movieGenre, setMovieGenre] = useState<string>("all");
  const [isLoadingBrowseMovies, setIsLoadingBrowseMovies] = useState(false);
  const [totalMoviePages, setTotalMoviePages] = useState(1);
  
  // Browse Series state
  const [browseSeries, setBrowseSeries] = useState<DiscoverResult[]>([]);
  const [seriesPage, setSeriesPage] = useState(1);
  const [seriesGenre, setSeriesGenre] = useState<string>("all");
  const [isLoadingBrowseSeries, setIsLoadingBrowseSeries] = useState(false);
  const [totalSeriesPages, setTotalSeriesPages] = useState(1);
  
  // Search state
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<DiscoverResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchType, setSearchType] = useState<'all' | 'movie' | 'tv'>('all');
  
  // Dialog state
  const [seasonDialogOpen, setSeasonDialogOpen] = useState(false);
  const [selectedTvShow, setSelectedTvShow] = useState<{ id: number; title: string } | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<{ id: number; mediaType: 'movie' | 'tv' } | null>(null);
  const jellyseerrRequest = useJellyseerrRequest();

  // Get genre name from translation
  const getGenreName = (key: string) => {
    return wishes.genres?.[key] || key;
  };

  useEffect(() => {
    if (!loading && !user) {
      navigate("/");
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    const fetchJellyseerrUrl = async () => {
      const { data } = await supabase
        .from('server_settings')
        .select('setting_value')
        .eq('setting_key', 'jellyseerr_url')
        .maybeSingle();
      
      if (data?.setting_value) {
        setJellyseerrUrl(data.setting_value);
      }
      setIsLoadingSettings(false);
    };

    if (user) {
      fetchJellyseerrUrl();
    }
  }, [user]);

  useEffect(() => {
    if (user && jellyseerrUrl && activeTab === 'home') {
      loadTrendingMovies();
      loadTrendingSeries();
      loadDiscoverMovies();
      loadDiscoverSeries();
    }
  }, [user, jellyseerrUrl, activeTab]);

  useEffect(() => {
    if (user && jellyseerrUrl && activeTab === 'movies') {
      loadBrowseMovies();
    }
  }, [user, jellyseerrUrl, activeTab, moviePage, movieGenre]);

  useEffect(() => {
    if (user && jellyseerrUrl && activeTab === 'series') {
      loadBrowseSeries();
    }
  }, [user, jellyseerrUrl, activeTab, seriesPage, seriesGenre]);

  const loadTrendingMovies = async () => {
    setIsLoadingTrendingMovies(true);
    try {
      const { data, error } = await supabase.functions.invoke("jellyseerr-popular", {
        body: { type: 'movie', page: 1 },
      });
      if (!error && data?.results) {
        setTrendingMovies(data.results.slice(0, 20));
      }
    } catch (error) {
      console.error('Trending movies error:', error);
    } finally {
      setIsLoadingTrendingMovies(false);
    }
  };

  const loadTrendingSeries = async () => {
    setIsLoadingTrendingSeries(true);
    try {
      const { data, error } = await supabase.functions.invoke("jellyseerr-popular", {
        body: { type: 'tv', page: 1 },
      });
      if (!error && data?.results) {
        setTrendingSeries(data.results.slice(0, 20));
      }
    } catch (error) {
      console.error('Trending series error:', error);
    } finally {
      setIsLoadingTrendingSeries(false);
    }
  };

  const loadDiscoverMovies = async () => {
    setIsLoadingDiscoverMovies(true);
    setConnectionError(null);
    try {
      const { data, error } = await supabase.functions.invoke("jellyseerr-discover", {
        body: { type: 'movie', page: 1 },
      });

      if (error) {
        const errorString = JSON.stringify(error);
        if (errorString.includes('Connection timed out') || errorString.includes('tcp connect error')) {
          setConnectionError('network');
        } else if (errorString.includes('SSL') || errorString.includes('invalid peer certificate')) {
          setConnectionError('ssl');
        }
        throw error;
      }

      if (data?.results) {
        setDiscoverMovies(data.results.slice(0, 20));
      }
    } catch (error) {
      console.error('Discover movies error:', error);
    } finally {
      setIsLoadingDiscoverMovies(false);
    }
  };

  const loadDiscoverSeries = async () => {
    setIsLoadingDiscoverSeries(true);
    try {
      const { data, error } = await supabase.functions.invoke("jellyseerr-discover", {
        body: { type: 'tv', page: 1 },
      });
      if (!error && data?.results) {
        setDiscoverSeries(data.results.slice(0, 20));
      }
    } catch (error) {
      console.error('Discover series error:', error);
    } finally {
      setIsLoadingDiscoverSeries(false);
    }
  };

  const loadBrowseMovies = async () => {
    setIsLoadingBrowseMovies(true);
    try {
      const { data, error } = await supabase.functions.invoke("jellyseerr-discover", {
        body: { 
          type: 'movie', 
          page: moviePage,
          genre: movieGenre !== 'all' ? movieGenre : undefined,
        },
      });
      if (!error && data) {
        setBrowseMovies(data.results || []);
        setTotalMoviePages(data.totalPages || 1);
      }
    } catch (error) {
      console.error('Browse movies error:', error);
    } finally {
      setIsLoadingBrowseMovies(false);
    }
  };

  const loadBrowseSeries = async () => {
    setIsLoadingBrowseSeries(true);
    try {
      const { data, error } = await supabase.functions.invoke("jellyseerr-discover", {
        body: { 
          type: 'tv', 
          page: seriesPage,
          genre: seriesGenre !== 'all' ? seriesGenre : undefined,
        },
      });
      if (!error && data) {
        setBrowseSeries(data.results || []);
        setTotalSeriesPages(data.totalPages || 1);
      }
    } catch (error) {
      console.error('Browse series error:', error);
    } finally {
      setIsLoadingBrowseSeries(false);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setConnectionError(null);
    try {
      // Fetch first page to get total pages
      const { data: firstPageData, error } = await supabase.functions.invoke("jellyseerr-search", {
        body: { query: searchQuery, page: 1 },
      });

      if (error) {
        const errorString = JSON.stringify(error);
        if (errorString.includes('Connection timed out') || errorString.includes('tcp connect error')) {
          setConnectionError('network');
        } else if (errorString.includes('SSL') || errorString.includes('invalid peer certificate')) {
          setConnectionError('ssl');
        }
        throw error;
      }

      let allResults = firstPageData?.results || [];
      const totalPages = firstPageData?.totalPages || 1;
      
      // Fetch remaining pages if there are more (limit to 5 pages to avoid too many requests)
      const maxPages = Math.min(totalPages, 5);
      if (maxPages > 1) {
        const pagePromises = [];
        for (let page = 2; page <= maxPages; page++) {
          pagePromises.push(
            supabase.functions.invoke("jellyseerr-search", {
              body: { query: searchQuery, page },
            })
          );
        }
        
        const pageResults = await Promise.all(pagePromises);
        for (const result of pageResults) {
          if (!result.error && result.data?.results) {
            allResults = [...allResults, ...result.data.results];
          }
        }
      }
      
      // Filter by search type
      if (searchType === 'movie') {
        allResults = allResults.filter((r: DiscoverResult) => r.mediaType === 'movie');
      } else if (searchType === 'tv') {
        allResults = allResults.filter((r: DiscoverResult) => r.mediaType === 'tv');
      }
      
      setSearchResults(allResults);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setIsSearching(false);
    }
  };

  const clearSearch = () => {
    setSearchQuery("");
    setSearchResults([]);
  };

  const handleMediaClick = (result: DiscoverResult) => {
    setSelectedMedia({
      id: result.id,
      mediaType: result.mediaType,
    });
    setDetailDialogOpen(true);
  };

  const handleRequestFromDetail = () => {
    if (!selectedMedia) return;

    const allMedia = [...trendingMovies, ...trendingSeries, ...discoverMovies, ...discoverSeries, ...searchResults, ...browseMovies, ...browseSeries];
    const result = allMedia.find(r => r.id === selectedMedia.id);

    if (!result) return;

    setDetailDialogOpen(false);

    if (selectedMedia.mediaType === 'tv') {
      setSelectedTvShow({
        id: result.id,
        title: result.name || 'Unknown',
      });
      setSeasonDialogOpen(true);
    } else {
      const title = result.title;
      const posterUrl = result.posterPath
        ? `https://image.tmdb.org/t/p/w500${result.posterPath}`
        : undefined;

      jellyseerrRequest.mutate({
        mediaType: selectedMedia.mediaType,
        mediaId: result.id,
        mediaTitle: title || 'Unknown',
        mediaPoster: posterUrl,
        mediaOverview: result.overview,
      });
    }
  };

  const handleSeasonConfirm = (selection: { seasons: number[]; episodes: { [seasonNumber: number]: number[] } }) => {
    if (!selectedTvShow) return;

    const allSeries = [...trendingSeries, ...discoverSeries, ...searchResults, ...browseSeries];
    const result = allSeries.find(r => r.id === selectedTvShow.id);

    if (!result) return;

    const posterUrl = result.posterPath
      ? `https://image.tmdb.org/t/p/w500${result.posterPath}`
      : undefined;

    let seasonsData: any;
    if (selection.seasons.length > 0 && Object.keys(selection.episodes).length === 0) {
      seasonsData = selection.seasons;
    } else if (selection.seasons.length === 0 && Object.keys(selection.episodes).length > 0) {
      seasonsData = selection.episodes;
    } else {
      seasonsData = {
        fullSeasons: selection.seasons,
        episodes: selection.episodes,
      };
    }

    jellyseerrRequest.mutate({
      mediaType: 'tv',
      mediaId: selectedTvShow.id,
      seasons: seasonsData,
      mediaTitle: selectedTvShow.title,
      mediaPoster: posterUrl,
      mediaOverview: result.overview,
    });
  };

  const getYear = (date?: string) => date ? new Date(date).getFullYear() : null;

  const isAvailable = (result: DiscoverResult) => result.mediaInfo?.status === 5;
  const isRequested = (result: DiscoverResult) => {
    const status = result.mediaInfo?.status;
    return status === 3 || status === 4;
  };

  // Horizontal scroll row component
  const MediaRow = ({ title, items, isLoading }: { title: string; items: DiscoverResult[]; isLoading: boolean }) => {
    const scrollRef = useRef<HTMLDivElement>(null);

    const scroll = (direction: 'left' | 'right') => {
      if (scrollRef.current) {
        const scrollAmount = 300;
        scrollRef.current.scrollBy({
          left: direction === 'left' ? -scrollAmount : scrollAmount,
          behavior: 'smooth'
        });
      }
    };

    if (isLoading) {
      return (
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4 text-foreground">{title}</h2>
          <div className="flex gap-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="flex-shrink-0 w-36 aspect-[2/3] bg-muted rounded-lg animate-pulse" />
            ))}
          </div>
        </div>
      );
    }

    if (items.length === 0) return null;

    return (
      <div className="mb-8 group/row">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-foreground">{title}</h2>
          <div className="flex gap-1 opacity-0 group-hover/row:opacity-100 transition-opacity">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => scroll('left')}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => scroll('right')}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
        
        <div 
          ref={scrollRef}
          className="flex gap-3 overflow-x-auto scrollbar-hide pb-2"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {items.map((result) => (
            <MediaCard key={result.id} result={result} onClick={() => handleMediaClick(result)} />
          ))}
        </div>
      </div>
    );
  };

  // Media card component
  const MediaCard = ({ result, onClick }: { result: DiscoverResult; onClick: () => void }) => {
    const mediaTitle = result.mediaType === 'movie' ? result.title : result.name;
    const date = result.mediaType === 'movie' ? result.releaseDate : result.firstAirDate;
    const year = getYear(date);
    const posterUrl = result.posterPath
      ? `https://image.tmdb.org/t/p/w300${result.posterPath}`
      : null;

    return (
      <div
        className="flex-shrink-0 w-36 cursor-pointer group"
        onClick={onClick}
      >
        <div className="relative aspect-[2/3] rounded-lg overflow-hidden bg-muted mb-2">
          {posterUrl ? (
            <img
              src={posterUrl}
              alt={mediaTitle}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-muted">
              {result.mediaType === 'movie' ? (
                <Film className="h-12 w-12 text-muted-foreground" />
              ) : (
                <Tv className="h-12 w-12 text-muted-foreground" />
              )}
            </div>
          )}
          
          <div className="absolute top-2 left-2">
            <Badge 
              className={cn(
                "text-[10px] px-1.5 py-0.5 font-medium",
                result.mediaType === 'movie' 
                  ? "bg-blue-600 hover:bg-blue-600 text-white" 
                  : "bg-purple-600 hover:bg-purple-600 text-white"
              )}
            >
              {result.mediaType === 'movie' ? wishes.movie : wishes.series}
            </Badge>
          </div>

          {isAvailable(result) && (
            <div className="absolute top-2 right-2">
              <div className="bg-green-500 rounded-full p-0.5">
                <Check className="h-3 w-3 text-white" />
              </div>
            </div>
          )}
          {isRequested(result) && !isAvailable(result) && (
            <div className="absolute top-2 right-2">
              <div className="bg-yellow-500 rounded-full w-4 h-4 flex items-center justify-center">
                <span className="text-[8px] font-bold text-black">●</span>
              </div>
            </div>
          )}

          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3">
            <div>
              <p className="text-white text-sm font-medium line-clamp-2">{mediaTitle}</p>
              <div className="flex items-center gap-2 text-xs text-gray-300 mt-1">
                {year && <span>{year}</span>}
                {result.voteAverage > 0 && (
                  <span className="flex items-center gap-0.5">
                    <Star className="h-3 w-3 fill-yellow-500 text-yellow-500" />
                    {result.voteAverage.toFixed(1)}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Browse grid component with pagination
  const BrowseGrid = ({ 
    items, 
    isLoading, 
    page, 
    totalPages, 
    onPageChange,
  }: { 
    items: DiscoverResult[]; 
    isLoading: boolean; 
    page: number;
    totalPages: number;
    onPageChange: (page: number) => void;
  }) => {
    if (isLoading) {
      return (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {[...Array(20)].map((_, i) => (
            <div key={i} className="aspect-[2/3] bg-muted rounded-lg animate-pulse" />
          ))}
        </div>
      );
    }

    return (
      <div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {items.map((result) => {
            const mediaTitle = result.mediaType === 'movie' ? result.title : result.name;
            const date = result.mediaType === 'movie' ? result.releaseDate : result.firstAirDate;
            const year = getYear(date);
            const posterUrl = result.posterPath
              ? `https://image.tmdb.org/t/p/w300${result.posterPath}`
              : null;

            return (
              <div
                key={result.id}
                className="cursor-pointer group"
                onClick={() => handleMediaClick(result)}
              >
                <div className="relative aspect-[2/3] rounded-lg overflow-hidden bg-muted mb-2">
                  {posterUrl ? (
                    <img
                      src={posterUrl}
                      alt={mediaTitle}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-muted">
                      {result.mediaType === 'movie' ? (
                        <Film className="h-12 w-12 text-muted-foreground" />
                      ) : (
                        <Tv className="h-12 w-12 text-muted-foreground" />
                      )}
                    </div>
                  )}
                  
                  {isAvailable(result) && (
                    <div className="absolute top-2 right-2">
                      <div className="bg-green-500 rounded-full p-0.5">
                        <Check className="h-3 w-3 text-white" />
                      </div>
                    </div>
                  )}
                  {isRequested(result) && !isAvailable(result) && (
                    <div className="absolute top-2 right-2">
                      <div className="bg-yellow-500 rounded-full w-4 h-4 flex items-center justify-center">
                        <span className="text-[8px] font-bold text-black">●</span>
                      </div>
                    </div>
                  )}
                </div>
                <p className="text-sm font-medium line-clamp-1">{mediaTitle}</p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {year && <span>{year}</span>}
                  {result.voteAverage > 0 && (
                    <span className="flex items-center gap-0.5">
                      <Star className="h-3 w-3 fill-yellow-500 text-yellow-500" />
                      {result.voteAverage.toFixed(1)}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        
        {/* Pagination */}
        <div className="flex items-center justify-center gap-2 mt-8">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
          >
            <ChevronLeft className="h-4 w-4" />
            {wishes.previous}
          </Button>
          <span className="text-sm text-muted-foreground px-4">
            {wishes.page} {page} {wishes.of} {Math.min(totalPages, 500)}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages || page >= 500}
          >
            {wishes.next}
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  };

  // Search results grid
  const SearchResultsGrid = ({ items }: { items: DiscoverResult[] }) => (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
      {items.map((result) => {
        const mediaTitle = result.mediaType === 'movie' ? result.title : result.name;
        const date = result.mediaType === 'movie' ? result.releaseDate : result.firstAirDate;
        const year = getYear(date);
        const posterUrl = result.posterPath
          ? `https://image.tmdb.org/t/p/w300${result.posterPath}`
          : null;

        return (
          <div
            key={result.id}
            className="cursor-pointer group"
            onClick={() => handleMediaClick(result)}
          >
            <div className="relative aspect-[2/3] rounded-lg overflow-hidden bg-muted mb-2">
              {posterUrl ? (
                <img
                  src={posterUrl}
                  alt={mediaTitle}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  loading="lazy"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-muted">
                  {result.mediaType === 'movie' ? (
                    <Film className="h-12 w-12 text-muted-foreground" />
                  ) : (
                    <Tv className="h-12 w-12 text-muted-foreground" />
                  )}
                </div>
              )}
              
              <div className="absolute top-2 left-2">
                <Badge 
                  className={cn(
                    "text-[10px] px-1.5 py-0.5 font-medium",
                    result.mediaType === 'movie' 
                      ? "bg-blue-600 hover:bg-blue-600 text-white" 
                      : "bg-purple-600 hover:bg-purple-600 text-white"
                  )}
                >
                  {result.mediaType === 'movie' ? wishes.movie : wishes.series}
                </Badge>
              </div>

              {isAvailable(result) && (
                <div className="absolute top-2 right-2">
                  <div className="bg-green-500 rounded-full p-0.5">
                    <Check className="h-3 w-3 text-white" />
                  </div>
                </div>
              )}
              {isRequested(result) && !isAvailable(result) && (
                <div className="absolute top-2 right-2">
                  <div className="bg-yellow-500 rounded-full w-4 h-4 flex items-center justify-center">
                    <span className="text-[8px] font-bold text-black">●</span>
                  </div>
                </div>
              )}
            </div>
            <p className="text-sm font-medium line-clamp-1">{mediaTitle}</p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {year && <span>{year}</span>}
              {result.voteAverage > 0 && (
                <span className="flex items-center gap-0.5">
                  <Star className="h-3 w-3 fill-yellow-500 text-yellow-500" />
                  {result.voteAverage.toFixed(1)}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );

  if (loading || isLoadingSettings) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-12 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (!jellyseerrUrl) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-12">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {wishes.notConfigured || 'Jellyseerr is not configured. Go to Admin settings to configure.'}
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-7xl mx-auto">
          {/* Search bar with type filter */}
          <form onSubmit={handleSearch} className="mb-6">
            <div className="flex gap-2 max-w-3xl mx-auto">
              <Select value={searchType} onValueChange={(v) => setSearchType(v as any)}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{wishes.allTypes}</SelectItem>
                  <SelectItem value="movie">{wishes.movies}</SelectItem>
                  <SelectItem value="tv">{wishes.series}</SelectItem>
                </SelectContent>
              </Select>
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder={wishes.searchPlaceholder}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-muted/50 border-muted"
                />
              </div>
              <Button type="submit" disabled={isSearching || !searchQuery.trim()}>
                {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : wishes.search}
              </Button>
              {searchResults.length > 0 && (
                <Button type="button" variant="outline" onClick={clearSearch}>
                  {wishes.clear}
                </Button>
              )}
            </div>
          </form>

          {/* Connection errors */}
          {connectionError === 'ssl' && (
            <Alert variant="destructive" className="mb-6">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <p className="font-semibold">{wishes.sslErrorTitle || 'SSL Certificate Error'}</p>
                <p>{wishes.sslError}</p>
                <Button onClick={() => navigate('/admin')} size="sm" className="mt-2">
                  {wishes.goToAdminSettings || 'Go to Admin Settings'}
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {connectionError === 'network' && (
            <Alert variant="destructive" className="mb-6">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <p className="font-semibold">{wishes.networkErrorTitle || 'Network Error'}</p>
                <p>{wishes.networkError}</p>
                <Button onClick={() => navigate('/admin')} size="sm" className="mt-2">
                  {wishes.goToAdminSettings || 'Go to Admin Settings'}
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {/* Search results or tabbed content */}
          {searchResults.length > 0 ? (
            <div>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold">{wishes.searchResults} ({searchResults.length})</h2>
                <Button variant="outline" onClick={clearSearch}>
                  {wishes.back}
                </Button>
              </div>
              <SearchResultsGrid items={searchResults} />
            </div>
          ) : (
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="mb-6">
                <TabsTrigger value="home" className="gap-2">
                  <Home className="h-4 w-4" />
                  {wishes.home}
                </TabsTrigger>
                <TabsTrigger value="movies" className="gap-2">
                  <Film className="h-4 w-4" />
                  {wishes.movies}
                </TabsTrigger>
                <TabsTrigger value="series" className="gap-2">
                  <Tv className="h-4 w-4" />
                  {wishes.series}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="home" className="mt-0">
                <MediaRow 
                  title={wishes.popularMovies} 
                  items={trendingMovies} 
                  isLoading={isLoadingTrendingMovies} 
                />
                <MediaRow 
                  title={wishes.popularSeries} 
                  items={trendingSeries} 
                  isLoading={isLoadingTrendingSeries} 
                />
                <MediaRow 
                  title={wishes.discoverMovies} 
                  items={discoverMovies} 
                  isLoading={isLoadingDiscoverMovies} 
                />
                <MediaRow 
                  title={wishes.discoverSeries} 
                  items={discoverSeries} 
                  isLoading={isLoadingDiscoverSeries} 
                />
              </TabsContent>

              <TabsContent value="movies" className="mt-0">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold">{wishes.browseMovies}</h2>
                  <Select 
                    value={movieGenre} 
                    onValueChange={(v) => {
                      setMovieGenre(v);
                      setMoviePage(1);
                    }}
                  >
                    <SelectTrigger className="w-48">
                      <Grid3X3 className="h-4 w-4 mr-2" />
                      <SelectValue placeholder={wishes.selectGenre} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{wishes.allGenres}</SelectItem>
                      {MOVIE_GENRES.map(genre => (
                        <SelectItem key={genre.id} value={String(genre.id)}>
                          {getGenreName(genre.key)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <BrowseGrid
                  items={browseMovies}
                  isLoading={isLoadingBrowseMovies}
                  page={moviePage}
                  totalPages={totalMoviePages}
                  onPageChange={setMoviePage}
                />
              </TabsContent>

              <TabsContent value="series" className="mt-0">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold">{wishes.browseSeries}</h2>
                  <Select 
                    value={seriesGenre} 
                    onValueChange={(v) => {
                      setSeriesGenre(v);
                      setSeriesPage(1);
                    }}
                  >
                    <SelectTrigger className="w-48">
                      <Grid3X3 className="h-4 w-4 mr-2" />
                      <SelectValue placeholder={wishes.selectGenre} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{wishes.allGenres}</SelectItem>
                      {TV_GENRES.map(genre => (
                        <SelectItem key={genre.id} value={String(genre.id)}>
                          {getGenreName(genre.key)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <BrowseGrid
                  items={browseSeries}
                  isLoading={isLoadingBrowseSeries}
                  page={seriesPage}
                  totalPages={totalSeriesPages}
                  onPageChange={setSeriesPage}
                />
              </TabsContent>
            </Tabs>
          )}

          {selectedMedia && (
            <MediaDetailDialog
              open={detailDialogOpen}
              onOpenChange={setDetailDialogOpen}
              mediaId={selectedMedia.id}
              mediaType={selectedMedia.mediaType}
              onRequest={handleRequestFromDetail}
              isRequesting={jellyseerrRequest.isPending}
            />
          )}

          {selectedTvShow && (
            <SeasonSelectDialog
              open={seasonDialogOpen}
              onOpenChange={setSeasonDialogOpen}
              tvId={selectedTvShow.id}
              tvTitle={selectedTvShow.title}
              onConfirm={handleSeasonConfirm}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default Wishes;
