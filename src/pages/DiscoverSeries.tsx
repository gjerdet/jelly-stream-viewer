import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Header from "@/components/Header";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tv, Star, Calendar, Download, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useJellyseerrRequest } from "@/hooks/useJellyseerr";

interface DiscoverResult {
  id: number;
  mediaType: 'tv';
  name: string;
  overview: string;
  posterPath?: string;
  backdropPath?: string;
  voteAverage: number;
  firstAirDate?: string;
  mediaInfo?: {
    status: number;
    requests?: any[];
  };
}

interface DiscoverResponse {
  page: number;
  totalPages: number;
  totalResults: number;
  results: DiscoverResult[];
}

const DiscoverSeries = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [results, setResults] = useState<DiscoverResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const jellyseerrRequest = useJellyseerrRequest();

  useEffect(() => {
    if (!loading && !user) {
      navigate("/");
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user) {
      loadSeries();
    }
  }, [user, page]);

  const loadSeries = async () => {
    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("jellyseerr-discover", {
        body: { type: 'tv', page },
      });

      if (error) throw error;

      if (page === 1) {
        setResults(data.results || []);
      } else {
        setResults(prev => [...prev, ...(data.results || [])]);
      }
      
      setHasMore(page < data.totalPages);
    } catch (error: any) {
      console.error('Discover error:', error);
      toast.error(error.message || "Kunne ikke laste serier");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRequest = (result: DiscoverResult) => {
    jellyseerrRequest.mutate({
      mediaType: 'tv',
      mediaId: result.id,
      seasons: 'all',
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

  if (loading || (isLoading && page === 1)) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-12 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-6xl mx-auto">
          <div className="mb-8">
            <h1 className="text-4xl font-bold mb-2">Oppdag serier</h1>
            <p className="text-muted-foreground">
              Populære og anbefalte serier fra Jellyseerr
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {results.map((result) => {
              const year = getYear(result.firstAirDate);
              const posterUrl = result.posterPath
                ? `https://image.tmdb.org/t/p/w500${result.posterPath}`
                : null;

              return (
                <Card key={result.id} className="overflow-hidden border-border/50 hover:border-primary smooth-transition group">
                  <div className="aspect-[2/3] relative bg-secondary">
                    {posterUrl ? (
                      <img
                        src={posterUrl}
                        alt={result.name}
                        className="w-full h-full object-cover group-hover:scale-105 smooth-transition"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Tv className="h-16 w-16 text-muted-foreground" />
                      </div>
                    )}
                    
                    {getStatusBadge(result) && (
                      <div className="absolute top-2 right-2">
                        {getStatusBadge(result)}
                      </div>
                    )}
                  </div>

                  <CardContent className="p-3">
                    <h3 className="font-semibold text-sm mb-1 line-clamp-2">{result.name}</h3>
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
                        onClick={() => handleRequest(result)}
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

          {hasMore && (
            <div className="mt-8 text-center">
              <Button
                onClick={() => setPage(p => p + 1)}
                disabled={isLoading}
                size="lg"
              >
                {isLoading ? (
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
        </div>
      </div>
    </div>
  );
};

export default DiscoverSeries;
