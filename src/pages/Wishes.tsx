import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, AlertCircle, Film, Tv, Star, Calendar, Download, Search } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useJellyseerrRequest } from "@/hooks/useJellyseerr";

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
  const [movies, setMovies] = useState<DiscoverResult[]>([]);
  const [series, setSeries] = useState<DiscoverResult[]>([]);
  const [isLoadingMovies, setIsLoadingMovies] = useState(false);
  const [isLoadingSeries, setIsLoadingSeries] = useState(false);
  const [moviePage, setMoviePage] = useState(1);
  const [seriesPage, setSeriesPage] = useState(1);
  const [hasMoreMovies, setHasMoreMovies] = useState(true);
  const [hasMoreSeries, setHasMoreSeries] = useState(true);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<DiscoverResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
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
    if (user) {
      loadMovies();
    }
  }, [user, moviePage]);

  useEffect(() => {
    if (user) {
      loadSeries();
    }
  }, [user, seriesPage]);

  const loadMovies = async () => {
    setIsLoadingMovies(true);
    setConnectionError(null);
    try {
      const { data, error } = await supabase.functions.invoke("jellyseerr-discover", {
        body: { type: 'movie', page: moviePage },
      });

      if (error) {
        console.error('Edge function error:', error);
        const errorString = JSON.stringify(error);
        const dataString = data ? JSON.stringify(data) : '';
        
        if (errorString.includes('Connection timed out') || errorString.includes('tcp connect error') ||
            dataString.includes('Connection timed out') || dataString.includes('tcp connect error')) {
          setConnectionError('network');
        } else if (errorString.includes('SSL') || errorString.includes('sertifikat') || 
            dataString.includes('SSL') || dataString.includes('sertifikat') ||
            dataString.includes('invalid peer certificate')) {
          setConnectionError('ssl');
        }
        throw error;
      }

      if (data?.error || data?.details) {
        console.error('Data contains error:', data);
        const dataString = JSON.stringify(data);
        if (dataString.includes('Connection timed out') || dataString.includes('tcp connect error')) {
          setConnectionError('network');
        } else if (dataString.includes('SSL') || dataString.includes('sertifikat') || dataString.includes('invalid peer certificate')) {
          setConnectionError('ssl');
        }
        return;
      }

      if (moviePage === 1) {
        setMovies(data.results || []);
      } else {
        setMovies(prev => [...prev, ...(data.results || [])]);
      }
      
      setHasMoreMovies(moviePage < data.totalPages);
    } catch (error: any) {
      console.error('Discover error:', error);
      const errorString = JSON.stringify(error);
      if (errorString.includes('Connection timed out') || errorString.includes('tcp connect error')) {
        setConnectionError('network');
      } else {
        setConnectionError('ssl');
      }
    } finally {
      setIsLoadingMovies(false);
    }
  };

  const loadSeries = async () => {
    setIsLoadingSeries(true);
    setConnectionError(null);
    try {
      const { data, error } = await supabase.functions.invoke("jellyseerr-discover", {
        body: { type: 'tv', page: seriesPage },
      });

      if (error) {
        console.error('Edge function error:', error);
        const errorString = JSON.stringify(error);
        const dataString = data ? JSON.stringify(data) : '';
        
        if (errorString.includes('Connection timed out') || errorString.includes('tcp connect error') ||
            dataString.includes('Connection timed out') || dataString.includes('tcp connect error')) {
          setConnectionError('network');
        } else if (errorString.includes('SSL') || errorString.includes('sertifikat') || 
            dataString.includes('SSL') || dataString.includes('sertifikat') ||
            dataString.includes('invalid peer certificate')) {
          setConnectionError('ssl');
        }
        throw error;
      }

      if (data?.error || data?.details) {
        console.error('Data contains error:', data);
        const dataString = JSON.stringify(data);
        if (dataString.includes('Connection timed out') || dataString.includes('tcp connect error')) {
          setConnectionError('network');
        } else if (dataString.includes('SSL') || dataString.includes('sertifikat') || dataString.includes('invalid peer certificate')) {
          setConnectionError('ssl');
        }
        return;
      }

      if (seriesPage === 1) {
        setSeries(data.results || []);
      } else {
        setSeries(prev => [...prev, ...(data.results || [])]);
      }
      
      setHasMoreSeries(seriesPage < data.totalPages);
    } catch (error: any) {
      console.error('Discover error:', error);
      const errorString = JSON.stringify(error);
      if (errorString.includes('Connection timed out') || errorString.includes('tcp connect error')) {
        setConnectionError('network');
      } else {
        setConnectionError('ssl');
      }
    } finally {
      setIsLoadingSeries(false);
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
        console.error('Edge function error:', error);
        const errorString = JSON.stringify(error);
        const dataString = data ? JSON.stringify(data) : '';
        
        if (errorString.includes('Connection timed out') || errorString.includes('tcp connect error') ||
            dataString.includes('Connection timed out') || dataString.includes('tcp connect error')) {
          setConnectionError('network');
        } else if (errorString.includes('SSL') || errorString.includes('sertifikat') || 
            dataString.includes('SSL') || dataString.includes('sertifikat') ||
            dataString.includes('invalid peer certificate')) {
          setConnectionError('ssl');
        }
        throw error;
      }

      if (data?.error || data?.details) {
        console.error('Data contains error:', data);
        const dataString = JSON.stringify(data);
        if (dataString.includes('Connection timed out') || dataString.includes('tcp connect error')) {
          setConnectionError('network');
        } else if (dataString.includes('SSL') || dataString.includes('sertifikat') || dataString.includes('invalid peer certificate')) {
          setConnectionError('ssl');
        }
        return;
      }

      setSearchResults(data.results || []);
    } catch (error: any) {
      console.error('Search error:', error);
      const errorString = JSON.stringify(error);
      if (errorString.includes('Connection timed out') || errorString.includes('tcp connect error')) {
        setConnectionError('network');
      } else {
        setConnectionError('ssl');
      }
    } finally {
      setIsSearching(false);
    }
  };

  const clearSearch = () => {
    setSearchQuery("");
    setSearchResults([]);
  };

  const handleRequest = (result: DiscoverResult, mediaType: 'movie' | 'tv') => {
    const title = mediaType === 'movie' ? result.title : result.name;
    const posterUrl = result.posterPath
      ? `https://image.tmdb.org/t/p/w500${result.posterPath}`
      : undefined;

    jellyseerrRequest.mutate({
      mediaType,
      mediaId: result.id,
      ...(mediaType === 'tv' && { seasons: 'all' }),
      mediaTitle: title || 'Ukjent',
      mediaPoster: posterUrl,
      mediaOverview: result.overview,
    });
  };

  const getYear = (date?: string) => date ? new Date(date).getFullYear() : null;

  const getStatusBadge = (result: DiscoverResult) => {
    const status = result.mediaInfo?.status;
    
    if (status === 5) {
      return <Badge variant="outline" className="border-green-500 text-green-500">Tilgjengelig</Badge>;
    } else if (status === 3 || status === 4) {
      return <Badge variant="outline" className="border-blue-500 text-blue-500">Forespurt</Badge>;
    }
    return null;
  };

  const isAvailable = (result: DiscoverResult) => result.mediaInfo?.status === 5;
  const isRequested = (result: DiscoverResult) => {
    const status = result.mediaInfo?.status;
    return status === 3 || status === 4;
  };

  const renderMediaGrid = (items: DiscoverResult[], mediaType: 'movie' | 'tv') => (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
      {items.map((result) => {
        const title = mediaType === 'movie' ? result.title : result.name;
        const date = mediaType === 'movie' ? result.releaseDate : result.firstAirDate;
        const year = getYear(date);
        const posterUrl = result.posterPath
          ? `https://image.tmdb.org/t/p/w500${result.posterPath}`
          : null;

        return (
          <Card key={result.id} className="overflow-hidden border-border/50 hover:border-primary smooth-transition group">
            <div className="aspect-[2/3] relative bg-secondary">
              {posterUrl ? (
                <img
                  src={posterUrl}
                  alt={title}
                  className="w-full h-full object-cover group-hover:scale-105 smooth-transition"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  {mediaType === 'movie' ? (
                    <Film className="h-16 w-16 text-muted-foreground" />
                  ) : (
                    <Tv className="h-16 w-16 text-muted-foreground" />
                  )}
                </div>
              )}
              
              {getStatusBadge(result) && (
                <div className="absolute top-2 right-2">
                  {getStatusBadge(result)}
                </div>
              )}
            </div>

            <CardContent className="p-3">
              <h3 className="font-semibold text-sm mb-1 line-clamp-2">{title}</h3>
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                {year && (
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {year}
                  </span>
                )}
                {result.voteAverage > 0 && (
                  <span className="flex items-center gap-1">
                    <Star className="h-3 w-3 fill-yellow-500 text-yellow-500" />
                    {result.voteAverage.toFixed(1)}
                  </span>
                )}
              </div>

              {!isAvailable(result) && !isRequested(result) && (
                <Button
                  onClick={() => handleRequest(result, mediaType)}
                  disabled={jellyseerrRequest.isPending}
                  size="sm"
                  className="w-full gap-2"
                >
                  <Download className="h-3 w-3" />
                  Be om
                </Button>
              )}
            </CardContent>
          </Card>
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
              Jellyseerr er ikke konfigurert. Gå til Admin-siden for å konfigurere.
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-6xl mx-auto">
          <div className="mb-8">
            <h1 className="text-4xl font-bold mb-2">Ønsker</h1>
            <p className="text-muted-foreground">
              Søk etter eller oppdag nytt innhold
            </p>
          </div>

          <form onSubmit={handleSearch} className="mb-6">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Søk etter filmer og serier..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Button type="submit" disabled={isSearching || !searchQuery.trim()}>
                {isSearching ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Søker...
                  </>
                ) : (
                  'Søk'
                )}
              </Button>
              {searchResults.length > 0 && (
                <Button type="button" variant="outline" onClick={clearSearch}>
                  Tøm søk
                </Button>
              )}
            </div>
          </form>

          {connectionError === 'ssl' && (
            <Alert variant="destructive" className="mb-6">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-2">
                  <p className="font-semibold">SSL-sertifikatfeil oppdaget</p>
                  <p>Jellyseerr-serveren din (<strong>{jellyseerrUrl}</strong>) omdirigerer HTTP til HTTPS med et ugyldig SSL-sertifikat.</p>
                  <p className="font-medium">Løsninger:</p>
                  <ol className="list-decimal list-inside space-y-1 ml-2">
                    <li>Fiks SSL-sertifikatet på Jellyseerr-serveren</li>
                    <li>Bruk en offentlig tilgjengelig URL med gyldig SSL</li>
                    <li>Konfigurer Jellyseerr til å akseptere HTTP uten omdirigering til HTTPS</li>
                  </ol>
                  <Button
                    onClick={() => navigate('/admin')}
                    size="sm"
                    className="mt-2"
                  >
                    Gå til Admin for å endre URL
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {connectionError === 'network' && (
            <Alert variant="destructive" className="mb-6">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-2">
                  <p className="font-semibold">Nettverksproblem - kan ikke nå lokal server</p>
                  <p>Jellyseerr-serveren din (<strong>{jellyseerrUrl}</strong>) er en lokal IP-adresse som ikke kan nås fra skyen.</p>
                  <div className="p-2 bg-muted rounded text-sm">
                    <strong>Forklaring:</strong> Edge functions kjører på Lovable Cloud-servere som ikke har tilgang til ditt lokale nettverk.
                  </div>
                  <p className="font-medium">Løsninger:</p>
                  <ol className="list-decimal list-inside space-y-1 ml-2">
                    <li><strong>Anbefalt:</strong> Bruk en offentlig tilgjengelig URL (f.eks. via domenenavn med gyldig SSL)</li>
                    <li>Sett opp en tunnel-tjeneste (f.eks. Cloudflare Tunnel, Tailscale, ngrok)</li>
                    <li>Kjør applikasjonen lokalt i stedet for i skyen</li>
                  </ol>
                  <Button
                    onClick={() => navigate('/admin')}
                    size="sm"
                    className="mt-2"
                  >
                    Gå til Admin for å endre URL
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          )}

          <Alert className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Eller{" "}
              <a
                href={jellyseerrUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline font-medium"
              >
                åpne Jellyseerr i ny fane
              </a>
              {" "}for å søke direkte
            </AlertDescription>
          </Alert>

          {searchResults.length > 0 ? (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold">Søkeresultater ({searchResults.length})</h2>
                <Button variant="outline" onClick={clearSearch}>
                  Vis anbefalinger
                </Button>
              </div>
              {renderMediaGrid(searchResults, searchResults[0]?.mediaType || 'movie')}
            </div>
          ) : (
            <Tabs defaultValue="movies" className="w-full">
              <TabsList className="grid w-full max-w-md mx-auto mb-8 grid-cols-2">
                <TabsTrigger value="movies">Filmer</TabsTrigger>
                <TabsTrigger value="series">Serier</TabsTrigger>
              </TabsList>

              <TabsContent value="movies">
                {renderMediaGrid(movies, 'movie')}
                
                {hasMoreMovies && (
                  <div className="mt-8 text-center">
                    <Button
                      onClick={() => setMoviePage(p => p + 1)}
                      disabled={isLoadingMovies}
                      size="lg"
                    >
                      {isLoadingMovies ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Laster...
                        </>
                      ) : (
                        'Last inn mer'
                      )}
                    </Button>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="series">
                {renderMediaGrid(series, 'tv')}
                
                {hasMoreSeries && (
                  <div className="mt-8 text-center">
                    <Button
                      onClick={() => setSeriesPage(p => p + 1)}
                      disabled={isLoadingSeries}
                      size="lg"
                    >
                      {isLoadingSeries ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Laster...
                        </>
                      ) : (
                        'Last inn mer'
                      )}
                    </Button>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          )}
        </div>
      </div>
    </div>
  );
};

export default Wishes;
