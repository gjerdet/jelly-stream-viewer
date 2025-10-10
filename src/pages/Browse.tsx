import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import Header from "@/components/Header";
import Hero from "@/components/Hero";
import MediaRow from "@/components/MediaRow";
import { useAuth } from "@/hooks/useAuth";
import { useServerSettings } from "@/hooks/useServerSettings";
import { useJellyfinApi } from "@/hooks/useJellyfinApi";

interface JellyfinItem {
  Id: string;
  Name: string;
  Type: string;
  ProductionYear?: number;
  CommunityRating?: number;
  Overview?: string;
  ImageTags?: { Primary?: string };
}

interface JellyfinResponse {
  Items: JellyfinItem[];
}

const Browse = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { serverUrl } = useServerSettings();

  useEffect(() => {
    if (!loading && !user) {
      navigate("/");
    }
  }, [user, loading, navigate]);

  // Fetch latest items
  const { data: latestItems, error: latestError } = useJellyfinApi<JellyfinResponse>(
    ["latest-items"],
    {
      endpoint: `/Items/Latest?Limit=20&Fields=PrimaryImageAspectRatio,BasicSyncInfo&ImageTypeLimit=1&EnableImageTypes=Primary,Backdrop,Thumb`,
    },
    !!user
  );

  // Fetch resume items
  const { data: resumeItems, error: resumeError } = useJellyfinApi<JellyfinResponse>(
    ["resume-items"],
    {
      endpoint: `/Items/Resume?Limit=10&Fields=PrimaryImageAspectRatio,BasicSyncInfo&ImageTypeLimit=1&EnableImageTypes=Primary,Backdrop,Thumb`,
    },
    !!user
  );

  const hasApiError = latestError || resumeError;

  // Use first item as featured
  const featuredContent = latestItems?.Items?.[0]
    ? {
        title: latestItems.Items[0].Name,
        description: latestItems.Items[0].Overview || "Ingen beskrivelse tilgjengelig",
        image: serverUrl && latestItems.Items[0].ImageTags?.Primary
          ? `${serverUrl}/Items/${latestItems.Items[0].Id}/Images/Primary?maxHeight=600`
          : "https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=1920&h=1080&fit=crop",
        rating: latestItems.Items[0].CommunityRating?.toFixed(1),
        year: latestItems.Items[0].ProductionYear?.toString(),
      }
    : null;

  const mapJellyfinItems = (items?: JellyfinItem[]) => {
    if (!items) return [];
    return items.map((item) => ({
      id: item.Id,
      title: item.Name,
      image: serverUrl && item.ImageTags?.Primary
        ? `${serverUrl}/Items/${item.Id}/Images/Primary?maxHeight=600`
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

  // Show error message if API key is not configured
  if (hasApiError && !loading) {
    const errorMessage = latestError?.message || resumeError?.message || 'Ukjent feil';
    
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-20">
          <div className="max-w-2xl mx-auto text-center space-y-6">
            <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20">
              <h2 className="text-2xl font-bold mb-2">Kunne ikke koble til Jellyfin</h2>
              <p className="text-muted-foreground mb-4">
                {errorMessage}
              </p>
              <button
                onClick={() => navigate("/admin")}
                className="px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
              >
                Gå til Admin-innstillinger
              </button>
            </div>
            <div className="text-sm text-muted-foreground space-y-2">
              <p>Mulige årsaker:</p>
              <ul className="list-disc list-inside text-left max-w-md mx-auto space-y-1">
                <li>Jellyfin API-nøkkel er feil eller mangler</li>
                <li>Jellyfin server URL er feil</li>
                <li>Jellyfin-serveren er ikke tilgjengelig</li>
                <li>API-nøkkelen har ikke riktige tilganger</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      {featuredContent && <Hero {...featuredContent} />}
      
      <div className="space-y-12 py-12">
        <MediaRow
          title="Siste innhold"
          items={mapJellyfinItems(latestItems?.Items)}
          onItemClick={handleItemClick}
        />
        {resumeItems?.Items && resumeItems.Items.length > 0 && (
          <MediaRow
            title="Fortsett å se"
            items={mapJellyfinItems(resumeItems.Items)}
            onItemClick={handleItemClick}
          />
        )}
      </div>
    </div>
  );
};

export default Browse;
