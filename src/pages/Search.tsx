import { useNavigate, useSearchParams } from "react-router-dom";
import { useEffect } from "react";
import Header from "@/components/Header";
import MediaGrid from "@/components/MediaGrid";
import { useAuth } from "@/hooks/useAuth";
import { useServerSettings } from "@/hooks/useServerSettings";
import { useJellyfinApi } from "@/hooks/useJellyfinApi";

interface JellyfinItem {
  Id: string;
  Name: string;
  Type: string;
  ProductionYear?: number;
  CommunityRating?: number;
  ImageTags?: { Primary?: string };
}

interface JellyfinResponse {
  Items: JellyfinItem[];
}

const Search = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const searchQuery = searchParams.get("q") || "";
  const { user, loading } = useAuth();
  const { serverUrl, apiKey } = useServerSettings();

  useEffect(() => {
    if (!loading && !user) {
      navigate("/");
    }
  }, [user, loading, navigate]);

  // Fetch users to get a valid user ID
  const { data: usersData } = useJellyfinApi<{ Id: string }[]>(
    ["jellyfin-users"],
    {
      endpoint: `/Users`,
    },
    !!user
  );

  const userId = usersData?.[0]?.Id;

  // Search for items
  const { data: searchResults, error: searchError } = useJellyfinApi<JellyfinResponse>(
    ["search-items", userId || "", searchQuery],
    {
      endpoint: userId && searchQuery
        ? `/Users/${userId}/Items?SearchTerm=${encodeURIComponent(searchQuery)}&IncludeItemTypes=Movie,Series&Recursive=true&Fields=PrimaryImageAspectRatio,BasicSyncInfo&ImageTypeLimit=1&EnableImageTypes=Primary,Backdrop,Thumb`
        : "",
    },
    !!user && !!userId && !!searchQuery
  );

  const mapJellyfinItems = (items?: JellyfinItem[]) => {
    if (!items) return [];
    return items.map((item) => ({
      id: item.Id,
      title: item.Name,
      image: serverUrl && apiKey && item.ImageTags?.Primary
        ? `${serverUrl.replace(/\/$/, '')}/Items/${item.Id}/Images/Primary?maxHeight=600&api_key=${apiKey}`
        : "https://images.unsplash.com/photo-1509347528160-9a9e33742cdb?w=400&h=600&fit=crop",
      year: item.ProductionYear?.toString(),
      rating: item.CommunityRating?.toFixed(1),
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

  if (searchError) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-20">
          <div className="max-w-2xl mx-auto text-center">
            <p className="text-destructive">Kunne ikke søke: {searchError.message}</p>
          </div>
        </div>
      </div>
    );
  }

  const results = searchResults?.Items || [];

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-2">Søkeresultater</h1>
        <p className="text-muted-foreground mb-8">
          {results.length > 0 
            ? `${results.length} resultat${results.length !== 1 ? 'er' : ''} for "${searchQuery}"`
            : `Ingen resultater for "${searchQuery}"`
          }
        </p>

        {results.length > 0 && (
          <MediaGrid
            title=""
            items={mapJellyfinItems(results)}
            onItemClick={handleItemClick}
          />
        )}
      </div>
    </div>
  );
};

export default Search;
