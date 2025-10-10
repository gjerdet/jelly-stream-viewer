import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import Header from "@/components/Header";
import MediaGrid from "@/components/MediaGrid";
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
  jellyfin_series_name?: string;
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

  const mapHistoryToMediaItems = (items?: WatchHistoryItem[]) => {
    if (!items) return [];
    return items.map((item) => ({
      id: item.jellyfin_item_id,
      title: item.jellyfin_series_name || item.jellyfin_item_name,
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
      <Header />
      
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
          <MediaGrid
            title=""
            items={mapHistoryToMediaItems(historyItems)}
            onItemClick={handleItemClick}
          />
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
