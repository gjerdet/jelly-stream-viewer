import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Tv, ChevronDown, ChevronRight } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface Episode {
  id: number;
  episodeNumber: number;
  name: string;
  overview: string;
  airDate?: string;
  stillPath?: string;
}

interface Season {
  id: number;
  seasonNumber: number;
  name: string;
  overview: string;
  episodeCount: number;
  posterPath?: string;
  airDate?: string;
  episodes?: Episode[];
}

interface TVDetails {
  id: number;
  name: string;
  seasons: Season[];
}

interface SelectedItems {
  seasons: number[];
  episodes: { [seasonNumber: number]: number[] };
}

interface SeasonSelectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tvId: number;
  tvTitle: string;
  onConfirm: (selection: SelectedItems) => void;
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
  const [selectedEpisodes, setSelectedEpisodes] = useState<{ [seasonNumber: number]: number[] }>({});
  const [expandedSeasons, setExpandedSeasons] = useState<number[]>([]);
  const [loadingEpisodes, setLoadingEpisodes] = useState<{ [seasonNumber: number]: boolean }>({});
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
      // Start with no seasons selected - let user choose
      setSelectedSeasons([]);
      setSelectedEpisodes({});
      setSelectAll(false);
    } catch (error) {
      console.error('Error fetching TV details:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchSeasonEpisodes = async (seasonNumber: number) => {
    if (tvDetails?.seasons?.find(s => s.seasonNumber === seasonNumber)?.episodes) {
      return; // Already loaded
    }

    setLoadingEpisodes(prev => ({ ...prev, [seasonNumber]: true }));
    
    try {
      const { data, error } = await supabase.functions.invoke("jellyseerr-season-details", {
        body: { tvId, seasonNumber },
      });

      if (error || data?.error) {
        console.error('Failed to fetch season episodes:', error || data);
        return;
      }

      // Update the season with episodes
      setTvDetails(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          seasons: prev.seasons?.map(s => 
            s.seasonNumber === seasonNumber 
              ? { ...s, episodes: data.episodes || [] }
              : s
          ) || []
        };
      });
    } catch (error) {
      console.error('Error fetching season episodes:', error);
    } finally {
      setLoadingEpisodes(prev => ({ ...prev, [seasonNumber]: false }));
    }
  };

  const toggleSeasonExpand = async (seasonNumber: number) => {
    const isExpanded = expandedSeasons.includes(seasonNumber);
    
    if (isExpanded) {
      setExpandedSeasons(prev => prev.filter(s => s !== seasonNumber));
    } else {
      setExpandedSeasons(prev => [...prev, seasonNumber]);
      await fetchSeasonEpisodes(seasonNumber);
    }
  };

  const toggleSeason = (seasonNumber: number) => {
    const isSelected = selectedSeasons.includes(seasonNumber);
    
    if (isSelected) {
      // Deselect season and all its episodes
      setSelectedSeasons(prev => prev.filter(s => s !== seasonNumber));
      setSelectedEpisodes(prev => {
        const newSelected = { ...prev };
        delete newSelected[seasonNumber];
        return newSelected;
      });
    } else {
      // Select entire season
      setSelectedSeasons(prev => [...prev, seasonNumber]);
      setSelectedEpisodes(prev => {
        const newSelected = { ...prev };
        delete newSelected[seasonNumber]; // Clear any episode selections
        return newSelected;
      });
    }
    setSelectAll(false);
  };

  const toggleEpisode = (seasonNumber: number, episodeNumber: number) => {
    setSelectedEpisodes(prev => {
      const seasonEpisodes = prev[seasonNumber] || [];
      const isSelected = seasonEpisodes.includes(episodeNumber);
      
      if (isSelected) {
        const newSeasonEpisodes = seasonEpisodes.filter(e => e !== episodeNumber);
        if (newSeasonEpisodes.length === 0) {
          const newSelected = { ...prev };
          delete newSelected[seasonNumber];
          return newSelected;
        }
        return { ...prev, [seasonNumber]: newSeasonEpisodes };
      } else {
        // Remove season from selectedSeasons if it was selected
        setSelectedSeasons(prevSeasons => prevSeasons.filter(s => s !== seasonNumber));
        return { ...prev, [seasonNumber]: [...seasonEpisodes, episodeNumber].sort((a, b) => a - b) };
      }
    });
  };

  const isSeasonFullySelected = (seasonNumber: number) => {
    return selectedSeasons.includes(seasonNumber);
  };

  const isSeasonPartiallySelected = (seasonNumber: number) => {
    return !selectedSeasons.includes(seasonNumber) && (selectedEpisodes[seasonNumber]?.length || 0) > 0;
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
    onConfirm({
      seasons: selectedSeasons,
      episodes: selectedEpisodes,
    });
    onOpenChange(false);
  };

  const getTotalSelectionCount = () => {
    let count = 0;
    // Count full seasons
    count += selectedSeasons.length;
    // Count episodes
    Object.values(selectedEpisodes).forEach(episodes => {
      count += episodes.length;
    });
    return count;
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
                className="text-sm font-medium cursor-pointer flex-1"
              >
                Velg alle sesonger ({regularSeasons.length})
              </label>
              <span className="text-xs text-muted-foreground">
                Eller velg spesifikke sesonger/episoder under
              </span>
            </div>

            <ScrollArea className="max-h-[500px] pr-4">
              <div className="space-y-2">
                {regularSeasons.map((season) => (
                  <Collapsible
                    key={season.id}
                    open={expandedSeasons.includes(season.seasonNumber)}
                    onOpenChange={() => toggleSeasonExpand(season.seasonNumber)}
                  >
                    <div className="border rounded-lg overflow-hidden">
                      <div className="flex items-start gap-3 p-3 hover:bg-secondary/50 smooth-transition">
                        <Checkbox
                          id={`season-${season.seasonNumber}`}
                          checked={isSeasonFullySelected(season.seasonNumber) || isSeasonPartiallySelected(season.seasonNumber)}
                          onCheckedChange={() => toggleSeason(season.seasonNumber)}
                          className="mt-1"
                          onClick={(e) => e.stopPropagation()}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <label 
                              htmlFor={`season-${season.seasonNumber}`}
                              className="font-medium cursor-pointer"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {season.name}
                            </label>
                            {isSeasonPartiallySelected(season.seasonNumber) && (
                              <span className="text-xs text-muted-foreground">
                                ({selectedEpisodes[season.seasonNumber]?.length} valgt)
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">
                            {season.episodeCount} episoder
                            {season.airDate && ` • ${new Date(season.airDate).getFullYear()}`}
                          </p>
                        </div>
                        <CollapsibleTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            {expandedSeasons.includes(season.seasonNumber) ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </Button>
                        </CollapsibleTrigger>
                      </div>

                      <CollapsibleContent>
                        <div className="border-t bg-secondary/20">
                          {loadingEpisodes[season.seasonNumber] ? (
                            <div className="flex items-center justify-center py-4">
                              <Loader2 className="h-4 w-4 animate-spin text-primary" />
                            </div>
                          ) : season.episodes && season.episodes.length > 0 ? (
                            <div className="p-2 space-y-1">
                              {season.episodes.map((episode) => (
                                <div
                                  key={episode.id}
                                  className="flex items-start gap-2 p-2 rounded hover:bg-secondary/50 smooth-transition cursor-pointer"
                                  onClick={() => toggleEpisode(season.seasonNumber, episode.episodeNumber)}
                                >
                                  <Checkbox
                                    id={`episode-${season.seasonNumber}-${episode.episodeNumber}`}
                                    checked={
                                      isSeasonFullySelected(season.seasonNumber) ||
                                      selectedEpisodes[season.seasonNumber]?.includes(episode.episodeNumber) || false
                                    }
                                    disabled={isSeasonFullySelected(season.seasonNumber)}
                                    onCheckedChange={() => toggleEpisode(season.seasonNumber, episode.episodeNumber)}
                                    className="mt-1"
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                  <div className="flex-1 min-w-0">
                                    <label 
                                      htmlFor={`episode-${season.seasonNumber}-${episode.episodeNumber}`}
                                      className="text-sm font-medium cursor-pointer block"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      {episode.episodeNumber}. {episode.name}
                                    </label>
                                    {episode.airDate && (
                                      <p className="text-xs text-muted-foreground">
                                        {new Date(episode.airDate).toLocaleDateString('nb-NO')}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      </CollapsibleContent>
                    </div>
                  </Collapsible>
                ))}
              </div>
            </ScrollArea>

            <div className="flex gap-2 justify-end pt-4 border-t">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Avbryt
              </Button>
              <Button 
                onClick={handleConfirm}
                disabled={getTotalSelectionCount() === 0}
              >
                Be om valgt innhold ({getTotalSelectionCount()})
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
