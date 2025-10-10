import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import MediaGrid from "@/components/MediaGrid";
import SeriesHistoryItem from "@/components/SeriesHistoryItem";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface WatchHistoryItem {
  id: string;
  jellyfin_item_id: string;
  jellyfin_item_name: string;
  jellyfin_item_type: string;
  jellyfin_series_id?: string;
  jellyfin_series_name?: string;
  jellyfin_season_id?: string;
  image_url?: string;
  watched_at: string;
  last_position_ticks?: number;
  runtime_ticks?: number;
}

const History = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && !user) {
      navigate("/");
    }
  }, [user, loading, navigate]);

  const { data: historyItems, refetch } = useQuery({
    queryKey: ["watch-history", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("watch_history")
        .select("*")
        .order("watched_at", { ascending: false });

      if (error) throw error;
      return data as WatchHistoryItem[];
    },
    enabled: !!user,
  });

  const handleClearHistory = async () => {
    if (!user) return;
    
    const { error } = await supabase
      .from("watch_history")
      .delete()
      .eq("user_id", user.id);

    if (error) {
      toast.error("Kunne ikke slette historikk");
      return;
    }

    toast.success("Historikk slettet");
    refetch();
  };

  const groupHistoryBySeries = (items?: WatchHistoryItem[]) => {
    if (!items) return { series: [], movies: [] };
    
    const seriesMap = new Map<string, {
      seriesId: string;
      seriesName: string;
      seriesImage?: string;
      seasons: Map<string, any[]>;
    }>();
    
    const movies: WatchHistoryItem[] = [];

    items.forEach((item) => {
      // Skip "Series" type items - we only want Episodes and Movies
      if (item.jellyfin_item_type === "Series") {
        return;
      }
      
      if (item.jellyfin_item_type === "Episode" && item.jellyfin_series_id) {
        if (!seriesMap.has(item.jellyfin_series_id)) {
          seriesMap.set(item.jellyfin_series_id, {
            seriesId: item.jellyfin_series_id,
            seriesName: item.jellyfin_series_name || "Ukjent serie",
            seriesImage: item.image_url,
            seasons: new Map(),
          });
        }
        
        const series = seriesMap.get(item.jellyfin_series_id)!;
        const seasonId = item.jellyfin_season_id || "unknown";
        
        if (!series.seasons.has(seasonId)) {
          series.seasons.set(seasonId, []);
        }
        
        series.seasons.get(seasonId)!.push(item);
      } else if (item.jellyfin_item_type === "Movie") {
        movies.push(item);
      }
    });

    const seriesArray = Array.from(seriesMap.values()).map((series) => ({
      ...series,
      seasons: Array.from(series.seasons.entries()).map(([seasonId, episodes]) => ({
        seasonId,
        seasonNumber: seasonId.split("-").pop() || "?",
        episodes: episodes.sort((a, b) => 
          new Date(b.watched_at).getTime() - new Date(a.watched_at).getTime()
        ),
      })).sort((a, b) => Number(a.seasonNumber) - Number(b.seasonNumber)),
    }));

    return { series: seriesArray, movies };
  };

  const mapHistoryToMediaItems = (items: WatchHistoryItem[]) => {
    return items.map((item) => ({
      id: item.jellyfin_item_id,
      title: item.jellyfin_item_name,
      image: item.image_url || "https://images.unsplash.com/photo-1509347528160-9a9e33742cdb?w=400&h=600&fit=crop",
      year: new Date(item.watched_at).toLocaleDateString("no-NO"),
      rating: item.runtime_ticks && item.last_position_ticks
        ? `${Math.round((item.last_position_ticks / item.runtime_ticks) * 100)}%`
        : undefined,
    }));
  };

  const handleItemClick = (id: string) => {
    navigate(`/detail/${id}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Laster...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2">Historikk</h1>
            <p className="text-muted-foreground">
              {historyItems?.length || 0} elementer
            </p>
          </div>
          {historyItems && historyItems.length > 0 && (
            <Button
              variant="outline"
              onClick={handleClearHistory}
              className="gap-2"
            >
              <Trash2 className="h-4 w-4" />
              Slett historikk
            </Button>
          )}
        </div>

        {historyItems && historyItems.length > 0 ? (
          <div className="space-y-8">
            {(() => {
              const { series, movies } = groupHistoryBySeries(historyItems);
              return (
                <>
                  {series.length > 0 && (
                    <div className="space-y-6">
                      <h2 className="text-xl font-semibold">Serier</h2>
                      {series.map((seriesItem) => (
                        <SeriesHistoryItem
                          key={seriesItem.seriesId}
                          seriesName={seriesItem.seriesName}
                          seriesId={seriesItem.seriesId}
                          seriesImage={seriesItem.seriesImage}
                          seasons={seriesItem.seasons}
                        />
                      ))}
                    </div>
                  )}
                  
                  {movies.length > 0 && (
                    <div>
                      <MediaGrid
                        title="Filmer"
                        items={mapHistoryToMediaItems(movies)}
                        onItemClick={handleItemClick}
                      />
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        ) : (
          <div className="text-center py-20">
            <p className="text-muted-foreground text-lg">
              Ingen historikk ennå
            </p>
            <p className="text-muted-foreground text-sm mt-2">
              Start å se noe, så vil det dukke opp her
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default History;
