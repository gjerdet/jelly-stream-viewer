import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Film, Tv, Star, Calendar, Clock, Download } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface MediaDetails {
  id: number;
  title?: string;
  name?: string;
  overview: string;
  posterPath?: string;
  backdropPath?: string;
  voteAverage: number;
  releaseDate?: string;
  firstAirDate?: string;
  runtime?: number;
  numberOfSeasons?: number;
  numberOfEpisodes?: number;
  genres?: Array<{ id: number; name: string }>;
  status?: string;
  mediaInfo?: {
    status: number;
    requests?: any[];
  };
}

interface MediaDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mediaId: number;
  mediaType: 'movie' | 'tv';
  onRequest: () => void;
  isRequesting: boolean;
}

export const MediaDetailDialog = ({
  open,
  onOpenChange,
  mediaId,
  mediaType,
  onRequest,
  isRequesting,
}: MediaDetailDialogProps) => {
  const [details, setDetails] = useState<MediaDetails | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (open && mediaId) {
      fetchDetails();
    }
  }, [open, mediaId, mediaType]);

  const fetchDetails = async () => {
    setIsLoading(true);
    try {
      const functionName = mediaType === 'tv' ? 'jellyseerr-tv-details' : 'jellyseerr-movie-details';
      const body = mediaType === 'tv' ? { tvId: mediaId } : { movieId: mediaId };

      const { data, error } = await supabase.functions.invoke(functionName, { body });

      if (error) {
        console.error('Failed to fetch details:', error);
        return;
      }

      if (data?.error) {
        console.error('Details error:', data);
        return;
      }

      setDetails(data);
    } catch (error) {
      console.error('Error fetching details:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const title = details?.title || details?.name || 'Ukjent';
  const date = details?.releaseDate || details?.firstAirDate;
  const year = date ? new Date(date).getFullYear() : null;
  const posterUrl = details?.posterPath
    ? `https://image.tmdb.org/t/p/w500${details.posterPath}`
    : null;
  const backdropUrl = details?.backdropPath
    ? `https://image.tmdb.org/t/p/w1280${details.backdropPath}`
    : null;

  const status = details?.mediaInfo?.status;
  const isAvailable = status === 5;
  const isRequested = status === 3 || status === 4;

  const getStatusBadge = () => {
    if (isAvailable) {
      return <Badge variant="outline" className="border-green-500 text-green-500">Tilgjengelig</Badge>;
    } else if (isRequested) {
      return <Badge variant="outline" className="border-blue-500 text-blue-500">Forespurt</Badge>;
    }
    return null;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] p-0">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : details ? (
          <div className="flex flex-col">
            {/* Backdrop/Header */}
            {backdropUrl && (
              <div className="relative h-64 w-full">
                <img
                  src={backdropUrl}
                  alt={title}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
              </div>
            )}

            <ScrollArea className="max-h-[calc(90vh-16rem)] p-6">
              <div className="flex gap-6">
                {/* Poster */}
                {posterUrl && (
                  <div className="flex-shrink-0">
                    <img
                      src={posterUrl}
                      alt={title}
                      className="w-48 rounded-lg shadow-lg"
                    />
                  </div>
                )}

                {/* Details */}
                <div className="flex-1">
                  <DialogHeader>
                    <DialogTitle className="text-3xl mb-2">{title}</DialogTitle>
                  </DialogHeader>

                  <div className="flex items-center gap-3 mb-4 flex-wrap">
                    {year && (
                      <span className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Calendar className="h-4 w-4" />
                        {year}
                      </span>
                    )}
                    {details.voteAverage > 0 && (
                      <span className="flex items-center gap-1 text-sm">
                        <Star className="h-4 w-4 fill-yellow-500 text-yellow-500" />
                        {details.voteAverage.toFixed(1)}
                      </span>
                    )}
                    {details.runtime && (
                      <span className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Clock className="h-4 w-4" />
                        {details.runtime} min
                      </span>
                    )}
                    {mediaType === 'tv' && details.numberOfSeasons && (
                      <Badge variant="secondary">
                        {details.numberOfSeasons} sesong{details.numberOfSeasons !== 1 ? 'er' : ''}
                      </Badge>
                    )}
                    {getStatusBadge()}
                  </div>

                  {details.genres && details.genres.length > 0 && (
                    <div className="flex gap-2 mb-4 flex-wrap">
                      {details.genres.map((genre) => (
                        <Badge key={genre.id} variant="outline">
                          {genre.name}
                        </Badge>
                      ))}
                    </div>
                  )}

                  {details.overview && (
                    <div className="mb-4">
                      <h3 className="text-lg font-semibold mb-2">Oversikt</h3>
                      <p className="text-muted-foreground leading-relaxed">
                        {details.overview}
                      </p>
                    </div>
                  )}

                  {details.status && (
                    <div className="mb-4">
                      <span className="text-sm text-muted-foreground">
                        Status: {details.status}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </ScrollArea>

            {/* Actions */}
            <div className="flex gap-2 justify-end p-6 border-t bg-background">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Lukk
              </Button>
              {!isAvailable && !isRequested && (
                <Button
                  onClick={onRequest}
                  disabled={isRequesting}
                  className="gap-2"
                >
                  {isRequesting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Ber om...
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4" />
                      Be om {mediaType === 'tv' ? 'serie' : 'film'}
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            {mediaType === 'movie' ? (
              <Film className="h-12 w-12 text-muted-foreground mb-4" />
            ) : (
              <Tv className="h-12 w-12 text-muted-foreground mb-4" />
            )}
            <p className="text-muted-foreground">Kunne ikke laste detaljer</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
