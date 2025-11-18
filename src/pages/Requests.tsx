import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, Film, Tv, Star, Calendar, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useJellyseerrRequest } from "@/hooks/useJellyseerr";
import { useLanguage } from "@/contexts/LanguageContext";

interface SearchResult {
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

interface SearchResponse {
  page: number;
  totalPages: number;
  totalResults: number;
  results: SearchResult[];
}

const Requests = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { t } = useLanguage();
  const requests = t.requests as any;
  const [searchQuery, setSearchQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const jellyseerrRequest = useJellyseerrRequest();

  if (!loading && !user) {
    navigate("/");
    return null;
  }

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!searchQuery.trim()) {
      toast.error(requests.enterSearch);
      return;
    }

    setIsSearching(true);

    try {
      const { data, error } = await supabase.functions.invoke("jellyseerr-search", {
        body: { query: searchQuery.trim() },
      });

      if (error) throw error;

      setResults(data.results || []);
      
      if (data.results?.length === 0) {
        toast.info("Ingen resultater funnet");
      }
    } catch (error: any) {
      console.error('Search error:', error);
      toast.error(error.message || "Søket feilet");
    } finally {
      setIsSearching(false);
    }
  };

  const handleRequest = (result: SearchResult) => {
    const title = getTitle(result);
    const posterUrl = result.posterPath
      ? `https://image.tmdb.org/t/p/w500${result.posterPath}`
      : undefined;

    jellyseerrRequest.mutate({
      mediaType: result.mediaType,
      mediaId: result.id,
      seasons: result.mediaType === 'tv' ? 'all' : undefined,
      mediaTitle: title,
      mediaPoster: posterUrl,
      mediaOverview: result.overview,
    });
  };

  const getTitle = (result: SearchResult) => result.title || result.name || 'Ukjent tittel';
  const getYear = (result: SearchResult) => {
    const date = result.releaseDate || result.firstAirDate;
    return date ? new Date(date).getFullYear() : null;
  };

  const getStatusBadge = (result: SearchResult) => {
    const status = result.mediaInfo?.status;
    
    if (status === 5) {
      return <Badge variant="outline" className="border-green-500 text-green-500">Tilgjengelig</Badge>;
    } else if (status === 3 || status === 4) {
      return <Badge variant="outline" className="border-blue-500 text-blue-500">Forespurt</Badge>;
    }
    return null;
  };

  const isAvailable = (result: SearchResult) => result.mediaInfo?.status === 5;
  const isRequested = (result: SearchResult) => {
    const status = result.mediaInfo?.status;
    return status === 3 || status === 4;
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold mb-2">{requests.title}</h1>
            <p className="text-muted-foreground">
              {requests.subtitle}
            </p>
          </div>

          <form onSubmit={handleSearch} className="mb-8">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                type="text"
                placeholder={requests.searchPlaceholder}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-12 pr-4 h-14 text-lg bg-secondary/50 border-border/50"
              />
              <Button
                type="submit"
                disabled={isSearching}
                className="absolute right-2 top-1/2 -translate-y-1/2"
                size="lg"
              >
                {isSearching ? requests.searching : requests.searchButton}
              </Button>
            </div>
          </form>

          {results.length > 0 && (
            <div className="space-y-4">
              {results.map((result) => {
                const title = getTitle(result);
                const year = getYear(result);
                const posterUrl = result.posterPath
                  ? `https://image.tmdb.org/t/p/w500${result.posterPath}`
                  : null;

                return (
                  <Card key={`${result.mediaType}-${result.id}`} className="overflow-hidden border-border/50">
                    <CardContent className="p-0">
                      <div className="flex gap-4 p-4">
                        <div className="w-24 h-36 flex-shrink-0 rounded-lg overflow-hidden bg-secondary">
                          {posterUrl ? (
                            <img
                              src={posterUrl}
                              alt={title}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              {result.mediaType === 'movie' ? (
                                <Film className="h-8 w-8 text-muted-foreground" />
                              ) : (
                                <Tv className="h-8 w-8 text-muted-foreground" />
                              )}
                            </div>
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-4 mb-2">
                            <div className="flex-1">
                              <h3 className="text-xl font-semibold mb-1">{title}</h3>
                              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  {result.mediaType === 'movie' ? (
                                    <><Film className="h-4 w-4" /> {requests.movie}</>
                                  ) : (
                                    <><Tv className="h-4 w-4" /> {requests.series}</>
                                  )}
                                </span>
                                {year && (
                                  <span className="flex items-center gap-1">
                                    <Calendar className="h-4 w-4" />
                                    {year}
                                  </span>
                                )}
                                {result.voteAverage > 0 && (
                                  <span className="flex items-center gap-1">
                                    <Star className="h-4 w-4 fill-yellow-500 text-yellow-500" />
                                    {result.voteAverage.toFixed(1)}
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              {getStatusBadge(result)}
                              {!isAvailable(result) && !isRequested(result) && (
                                <Button
                                  onClick={() => handleRequest(result)}
                                  disabled={jellyseerrRequest.isPending}
                                  size="sm"
                                  className="gap-2"
                                >
                                  <Download className="h-4 w-4" />
                                  Be om
                                </Button>
                              )}
                            </div>
                          </div>

                          {result.overview && (
                            <p className="text-sm text-muted-foreground line-clamp-2">
                              {result.overview}
                            </p>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {results.length === 0 && !isSearching && (
            <div className="text-center py-12">
              <Search className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                {requests.noResults}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Requests;
