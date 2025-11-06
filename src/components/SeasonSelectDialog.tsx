import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Tv } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Season {
  id: number;
  seasonNumber: number;
  name: string;
  overview: string;
  episodeCount: number;
  posterPath?: string;
  airDate?: string;
}

interface TVDetails {
  id: number;
  name: string;
  seasons: Season[];
}

interface SeasonSelectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tvId: number;
  tvTitle: string;
  onConfirm: (selectedSeasons: number[]) => void;
}

export const SeasonSelectDialog = ({
  open,
  onOpenChange,
  tvId,
  tvTitle,
  onConfirm,
}: SeasonSelectDialogProps) => {
  const [tvDetails, setTvDetails] = useState<TVDetails | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedSeasons, setSelectedSeasons] = useState<number[]>([]);
  const [selectAll, setSelectAll] = useState(false);

  useEffect(() => {
    if (open && tvId) {
      fetchTVDetails();
    }
  }, [open, tvId]);

  const fetchTVDetails = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("jellyseerr-tv-details", {
        body: { tvId },
      });

      if (error) {
        console.error('Failed to fetch TV details:', error);
        return;
      }

      if (data?.error) {
        console.error('TV details error:', data);
        return;
      }

      setTvDetails(data);
      // Filter out season 0 (specials) by default
      const regularSeasons = data.seasons?.filter((s: Season) => s.seasonNumber > 0) || [];
      setSelectedSeasons(regularSeasons.map((s: Season) => s.seasonNumber));
      setSelectAll(regularSeasons.length > 0);
    } catch (error) {
      console.error('Error fetching TV details:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleSeason = (seasonNumber: number) => {
    setSelectedSeasons(prev => 
      prev.includes(seasonNumber)
        ? prev.filter(s => s !== seasonNumber)
        : [...prev, seasonNumber]
    );
    setSelectAll(false);
  };

  const toggleSelectAll = () => {
    if (selectAll) {
      setSelectedSeasons([]);
    } else {
      const allSeasons = tvDetails?.seasons
        ?.filter(s => s.seasonNumber > 0)
        .map(s => s.seasonNumber) || [];
      setSelectedSeasons(allSeasons);
    }
    setSelectAll(!selectAll);
  };

  const handleConfirm = () => {
    onConfirm(selectedSeasons);
    onOpenChange(false);
  };

  // Filter out season 0 (specials) from display
  const regularSeasons = tvDetails?.seasons?.filter(s => s.seasonNumber > 0) || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Velg sesonger</DialogTitle>
          <DialogDescription>
            Velg hvilke sesonger av <strong>{tvTitle}</strong> du vil be om
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : regularSeasons.length > 0 ? (
          <>
            <div className="flex items-center gap-2 p-3 border rounded-lg bg-secondary/20">
              <Checkbox 
                id="select-all"
                checked={selectAll}
                onCheckedChange={toggleSelectAll}
              />
              <label 
                htmlFor="select-all"
                className="text-sm font-medium cursor-pointer"
              >
                Velg alle sesonger ({regularSeasons.length})
              </label>
            </div>

            <ScrollArea className="max-h-[400px] pr-4">
              <div className="space-y-2">
                {regularSeasons.map((season) => (
                  <div
                    key={season.id}
                    className="flex items-start gap-3 p-3 border rounded-lg hover:bg-secondary/50 smooth-transition cursor-pointer"
                    onClick={() => toggleSeason(season.seasonNumber)}
                  >
                    <Checkbox
                      id={`season-${season.seasonNumber}`}
                      checked={selectedSeasons.includes(season.seasonNumber)}
                      onCheckedChange={() => toggleSeason(season.seasonNumber)}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <label 
                        htmlFor={`season-${season.seasonNumber}`}
                        className="font-medium cursor-pointer block"
                      >
                        {season.name}
                      </label>
                      <p className="text-sm text-muted-foreground mt-1">
                        {season.episodeCount} episoder
                        {season.airDate && ` • ${new Date(season.airDate).getFullYear()}`}
                      </p>
                      {season.overview && (
                        <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                          {season.overview}
                        </p>
                      )}
                    </div>
                    {season.posterPath && (
                      <img
                        src={`https://image.tmdb.org/t/p/w92${season.posterPath}`}
                        alt={season.name}
                        className="w-16 h-24 object-cover rounded"
                      />
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>

            <div className="flex gap-2 justify-end pt-4 border-t">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Avbryt
              </Button>
              <Button 
                onClick={handleConfirm}
                disabled={selectedSeasons.length === 0}
              >
                Be om {selectedSeasons.length} sesong{selectedSeasons.length !== 1 ? 'er' : ''}
              </Button>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Tv className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Ingen sesonger tilgjengelig</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
