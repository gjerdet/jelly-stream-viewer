import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, AlertCircle, Film, Tv, Star, Calendar, Search, ChevronLeft, ChevronRight, Check } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

const Wishes = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [jellyseerrUrl, setJellyseerrUrl] = useState<string>("");
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);
  const [trendingMovies, setTrendingMovies] = useState<DiscoverResult[]>([]);
  const [trendingSeries, setTrendingSeries] = useState<DiscoverResult[]>([]);
  const [discoverMovies, setDiscoverMovies] = useState<DiscoverResult[]>([]);
  const [discoverSeries, setDiscoverSeries] = useState<DiscoverResult[]>([]);
  const [isLoadingTrendingMovies, setIsLoadingTrendingMovies] = useState(false);
  const [isLoadingTrendingSeries, setIsLoadingTrendingSeries] = useState(false);
  const [isLoadingDiscoverMovies, setIsLoadingDiscoverMovies] = useState(false);
  const [isLoadingDiscoverSeries, setIsLoadingDiscoverSeries] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<DiscoverResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [seasonDialogOpen, setSeasonDialogOpen] = useState(false);
  const [selectedTvShow, setSelectedTvShow] = useState<{ id: number; title: string } | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<{ id: number; mediaType: 'movie' | 'tv' } | null>(null);
  const jellyseerrRequest = useJellyseerrRequest();

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
    if (user && jellyseerrUrl) {
      loadTrendingMovies();
      loadTrendingSeries();
      loadDiscoverMovies();
      loadDiscoverSeries();
    }
  }, [user, jellyseerrUrl]);

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

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setConnectionError(null);
    try {
      const { data, error } = await supabase.functions.invoke("jellyseerr-search", {
        body: { query: searchQuery },
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

      setSearchResults(data?.results || []);
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

    const allMedia = [...trendingMovies, ...trendingSeries, ...discoverMovies, ...discoverSeries, ...searchResults];
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

    const allSeries = [...trendingSeries, ...discoverSeries, ...searchResults];
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
                className="flex-shrink-0 w-36 cursor-pointer group"
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
                  
                  {/* Media type badge */}
                  <div className="absolute top-2 left-2">
                    <Badge 
                      className={cn(
                        "text-[10px] px-1.5 py-0.5 font-medium",
                        result.mediaType === 'movie' 
                          ? "bg-blue-600 hover:bg-blue-600 text-white" 
                          : "bg-purple-600 hover:bg-purple-600 text-white"
                      )}
                    >
                      {result.mediaType === 'movie' ? 'MOVIE' : 'TV'}
                    </Badge>
                  </div>

                  {/* Status indicator */}
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

                  {/* Hover overlay */}
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
          })}
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
                  {result.mediaType === 'movie' ? 'MOVIE' : 'TV'}
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
              Jellyseerr is not configured. Go to Admin settings to configure.
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
          {/* Search bar */}
          <form onSubmit={handleSearch} className="mb-8">
            <div className="flex gap-2 max-w-2xl mx-auto">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search Movies & TV"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-muted/50 border-muted"
                />
              </div>
              <Button type="submit" disabled={isSearching || !searchQuery.trim()}>
                {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : "Search"}
              </Button>
              {searchResults.length > 0 && (
                <Button type="button" variant="outline" onClick={clearSearch}>
                  Clear
                </Button>
              )}
            </div>
          </form>

          {/* Connection errors */}
          {connectionError === 'ssl' && (
            <Alert variant="destructive" className="mb-6">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <p className="font-semibold">SSL Certificate Error</p>
                <p>Your Jellyseerr server has an invalid SSL certificate. Try using HTTP instead.</p>
                <Button onClick={() => navigate('/admin')} size="sm" className="mt-2">
                  Go to Admin Settings
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {connectionError === 'network' && (
            <Alert variant="destructive" className="mb-6">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <p className="font-semibold">Network Error</p>
                <p>Cannot reach Jellyseerr server. Make sure it's accessible from the internet.</p>
                <Button onClick={() => navigate('/admin')} size="sm" className="mt-2">
                  Go to Admin Settings
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {/* Search results or discover content */}
          {searchResults.length > 0 ? (
            <div>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold">Search Results ({searchResults.length})</h2>
                <Button variant="outline" onClick={clearSearch}>
                  Back to Discover
                </Button>
              </div>
              <SearchResultsGrid items={searchResults} />
            </div>
          ) : (
            <>
              <MediaRow 
                title="Trending Movies" 
                items={trendingMovies} 
                isLoading={isLoadingTrendingMovies} 
              />
              <MediaRow 
                title="Trending TV Shows" 
                items={trendingSeries} 
                isLoading={isLoadingTrendingSeries} 
              />
              <MediaRow 
                title="Discover Movies" 
                items={discoverMovies} 
                isLoading={isLoadingDiscoverMovies} 
              />
              <MediaRow 
                title="Discover TV Shows" 
                items={discoverSeries} 
                isLoading={isLoadingDiscoverSeries} 
              />
            </>
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
