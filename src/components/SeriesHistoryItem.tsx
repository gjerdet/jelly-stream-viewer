import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronDown, ChevronRight, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface Episode {
  id: string;
  jellyfin_item_id: string;
  jellyfin_item_name: string;
  jellyfin_season_id: string;
  image_url?: string;
  watched_at: string;
  last_position_ticks?: number;
  runtime_ticks?: number;
}

interface Season {
  seasonId: string;
  seasonNumber: string;
  episodes: Episode[];
}

interface SeriesHistoryItemProps {
  seriesName: string;
  seriesId: string;
  seriesImage?: string;
  seasons: Season[];
}

const SeriesHistoryItem = ({ seriesName, seriesId, seriesImage, seasons }: SeriesHistoryItemProps) => {
  const navigate = useNavigate();
  const [expandedSeasons, setExpandedSeasons] = useState<Set<string>>(new Set());

  const toggleSeason = (seasonId: string) => {
    setExpandedSeasons((prev) => {
      const next = new Set(prev);
      if (next.has(seasonId)) {
        next.delete(seasonId);
      } else {
        next.add(seasonId);
      }
      return next;
    });
  };

  const formatProgress = (position?: number, runtime?: number) => {
    if (!position || !runtime) return null;
    return Math.round((position / runtime) * 100);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("no-NO", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  return (
    <Card className="p-6 bg-card/50 border-border/50">
      <div className="flex gap-4 mb-4">
        <img
          src={seriesImage || "https://images.unsplash.com/photo-1509347528160-9a9e33742cdb?w=200&h=300&fit=crop"}
          alt={seriesName}
          className="w-32 h-48 object-cover rounded"
          onClick={() => navigate(`/detail/${seriesId}`)}
        />
        <div className="flex-1">
          <h2
            className="text-2xl font-bold mb-2 cursor-pointer hover:text-primary transition-colors"
            onClick={() => navigate(`/detail/${seriesId}`)}
          >
            {seriesName}
          </h2>
          <p className="text-muted-foreground">
            {seasons.length} sesong{seasons.length !== 1 ? "er" : ""}
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {seasons.map((season) => {
          const isExpanded = expandedSeasons.has(season.seasonId);
          return (
            <div key={season.seasonId}>
              <Button
                variant="ghost"
                className="w-full justify-between p-3 h-auto"
                onClick={() => toggleSeason(season.seasonId)}
              >
                <span className="font-semibold">
                  Sesong {season.seasonNumber} ({season.episodes.length} episode{season.episodes.length !== 1 ? "r" : ""})
                </span>
                {isExpanded ? (
                  <ChevronDown className="h-5 w-5" />
                ) : (
                  <ChevronRight className="h-5 w-5" />
                )}
              </Button>

              {isExpanded && (
                <div className="space-y-2 mt-2 pl-4">
                  {season.episodes.map((episode) => {
                    const progress = formatProgress(episode.last_position_ticks, episode.runtime_ticks);
                    return (
                      <div
                        key={episode.id}
                        className="flex gap-3 p-3 rounded-lg hover:bg-accent/50 transition-colors cursor-pointer group"
                        onClick={() => navigate(`/player/${episode.jellyfin_item_id}`)}
                      >
                        <div className="relative w-40 h-24 flex-shrink-0">
                          <img
                            src={episode.image_url || seriesImage || "https://images.unsplash.com/photo-1509347528160-9a9e33742cdb?w=300&h=200&fit=crop"}
                            alt={episode.jellyfin_item_name}
                            className="w-full h-full object-cover rounded"
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded">
                            <Play className="h-8 w-8 text-white" />
                          </div>
                          {progress !== null && (
                            <div className="absolute bottom-0 left-0 right-0 h-1 bg-muted">
                              <div
                                className="h-full bg-primary"
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium line-clamp-1 mb-1">
                            {episode.jellyfin_item_name}
                          </h4>
                          <p className="text-sm text-muted-foreground mb-2">
                            Sist sett: {formatDate(episode.watched_at)}
                          </p>
                          {progress !== null && (
                            <p className="text-xs text-muted-foreground">
                              {progress}% fullført
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
};

export default SeriesHistoryItem;
