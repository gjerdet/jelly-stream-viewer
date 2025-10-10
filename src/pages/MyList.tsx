import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import MediaGrid from "@/components/MediaGrid";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Trash2, ListX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface FavoriteItem {
  id: string;
  jellyfin_item_id: string;
  jellyfin_item_name: string;
  jellyfin_item_type: string;
  image_url?: string;
  created_at: string;
}

const MyList = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && !user) {
      navigate("/");
    }
  }, [user, loading, navigate]);

  const { data: favoriteItems, refetch } = useQuery({
    queryKey: ["user-favorites", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_favorites")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as FavoriteItem[];
    },
    enabled: !!user,
  });

  const handleClearList = async () => {
    if (!user) return;
    
    const { error } = await supabase
      .from("user_favorites")
      .delete()
      .eq("user_id", user.id);

    if (error) {
      toast.error("Kunne ikke tømme listen");
      return;
    }

    toast.success("Listen er tømt");
    refetch();
  };

  const mapFavoritesToMediaItems = (items?: FavoriteItem[]) => {
    if (!items) return [];
    return items.map((item) => ({
      id: item.jellyfin_item_id,
      title: item.jellyfin_item_name,
      image: item.image_url || "https://images.unsplash.com/photo-1509347528160-9a9e33742cdb?w=400&h=600&fit=crop",
      year: new Date(item.created_at).toLocaleDateString("no-NO"),
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
            <h1 className="text-3xl font-bold mb-2">Min liste</h1>
            <p className="text-muted-foreground">
              {favoriteItems?.length || 0} favoritt{favoriteItems?.length !== 1 ? "er" : ""}
            </p>
          </div>
          {favoriteItems && favoriteItems.length > 0 && (
            <Button
              variant="outline"
              onClick={handleClearList}
              className="gap-2"
            >
              <Trash2 className="h-4 w-4" />
              Tøm liste
            </Button>
          )}
        </div>

        {favoriteItems && favoriteItems.length > 0 ? (
          <MediaGrid
            title=""
            items={mapFavoritesToMediaItems(favoriteItems)}
            onItemClick={handleItemClick}
          />
        ) : (
          <div className="text-center py-20">
            <ListX className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground text-lg mb-2">
              Ingen favoritter ennå
            </p>
            <p className="text-muted-foreground text-sm">
              Legg til filmer og serier i din liste ved å trykke på "+ Min liste" knappen
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default MyList;
