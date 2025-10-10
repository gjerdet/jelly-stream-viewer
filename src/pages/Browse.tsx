import { useNavigate, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import Header from "@/components/Header";
import Hero from "@/components/Hero";
import MediaRow from "@/components/MediaRow";
import MediaGrid from "@/components/MediaGrid";
import { useAuth } from "@/hooks/useAuth";
import { useServerSettings } from "@/hooks/useServerSettings";
import { useJellyfinApi } from "@/hooks/useJellyfinApi";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface JellyfinItem {
  Id: string;
  Name: string;
  Type: string;
  ProductionYear?: number;
  CommunityRating?: number;
  Overview?: string;
  ImageTags?: { Primary?: string };
  Genres?: string[];
}

interface JellyfinResponse {
  Items: JellyfinItem[];
}

const Browse = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading } = useAuth();
  const { serverUrl } = useServerSettings();
  const [selectedGenre, setSelectedGenre] = useState<string>("all");

  // Determine what content type to show based on route
  const contentType = location.pathname === '/movies' ? 'movies' : 
                      location.pathname === '/series' ? 'series' : 
                      'all';

  useEffect(() => {
    if (!loading && !user) {
      navigate("/");
    }
  }, [user, loading, navigate]);

  // First fetch users to get a valid user ID
  const { data: usersData } = useJellyfinApi<{ Id: string }[]>(
    ["jellyfin-users"],
    {
      endpoint: `/Users`,
    },
    !!user
  );

  const userId = usersData?.[0]?.Id;

  // Fetch all media items based on content type
  const includeItemTypes = contentType === 'movies' ? 'Movie' : 
                           contentType === 'series' ? 'Series' : 
                           'Movie,Series';

  const { data: allItems, error: itemsError } = useJellyfinApi<JellyfinResponse>(
    ["all-items", userId || "", contentType],
    {
      endpoint: userId 
        ? `/Users/${userId}/Items?SortBy=DateCreated,SortName&SortOrder=Descending&IncludeItemTypes=${includeItemTypes}&Recursive=true&Fields=PrimaryImageAspectRatio,BasicSyncInfo,Genres&ImageTypeLimit=1&EnableImageTypes=Primary,Backdrop,Thumb`
        : "",
    },
    !!user && !!userId
  );

  // Fetch resume items with user ID
  const { data: resumeItems, error: resumeError } = useJellyfinApi<JellyfinResponse>(
    ["resume-items", userId || ""],
    {
      endpoint: userId
        ? `/Users/${userId}/Items/Resume?Limit=20&Fields=PrimaryImageAspectRatio,BasicSyncInfo&ImageTypeLimit=1&EnableImageTypes=Primary,Backdrop,Thumb`
        : "",
    },
    !!user && !!userId
  );

  // Fetch recommended items
  const { data: recommendedItems } = useJellyfinApi<JellyfinResponse>(
    ["recommended-items", userId || ""],
    {
      endpoint: userId
        ? `/Users/${userId}/Suggestions?Limit=20&Fields=PrimaryImageAspectRatio,BasicSyncInfo&ImageTypeLimit=1&EnableImageTypes=Primary,Backdrop,Thumb`
        : "",
    },
    !!user && !!userId
  );

  // Separate movies and series
  const movies = allItems?.Items?.filter(item => item.Type === "Movie") || [];
  const series = allItems?.Items?.filter(item => item.Type === "Series") || [];

  // Extract all unique genres
  const allGenres = new Set<string>();
  allItems?.Items?.forEach(item => {
    item.Genres?.forEach(genre => allGenres.add(genre));
  });
  const genres = Array.from(allGenres).sort();

  // Filter items by selected genre
  const filteredMovies = selectedGenre === "all" 
    ? movies 
    : movies.filter(movie => movie.Genres?.includes(selectedGenre));
  const filteredSeries = selectedGenre === "all"
    ? series
    : series.filter(show => show.Genres?.includes(selectedGenre));

  // Group movies by genre for home page
  const moviesByGenre = genres.reduce((acc, genre) => {
    const genreMovies = movies.filter(movie => movie.Genres?.includes(genre));
    if (genreMovies.length > 0) {
      acc[genre] = genreMovies;
    }
    return acc;
  }, {} as Record<string, JellyfinItem[]>);

  const hasApiError = itemsError || resumeError;

  // Use first item as featured
  const featuredContent = allItems?.Items?.[0]
    ? {
        title: allItems.Items[0].Name,
        description: allItems.Items[0].Overview || "Ingen beskrivelse tilgjengelig",
        image: serverUrl && allItems.Items[0].ImageTags?.Primary
          ? `${serverUrl.replace(/\/$/, '')}/Items/${allItems.Items[0].Id}/Images/Primary?maxHeight=600`
          : "https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=1920&h=1080&fit=crop",
        rating: allItems.Items[0].CommunityRating?.toFixed(1),
        year: allItems.Items[0].ProductionYear?.toString(),
      }
    : null;

  const mapJellyfinItems = (items?: JellyfinItem[]) => {
    if (!items) return [];
    return items.map((item) => ({
      id: item.Id,
      title: item.Name,
      image: serverUrl && item.ImageTags?.Primary
        ? `${serverUrl.replace(/\/$/, '')}/Items/${item.Id}/Images/Primary?maxHeight=600`
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
    const errorMessage = itemsError?.message || resumeError?.message || 'Ukjent feil';
    
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
      {contentType === 'all' && featuredContent && <Hero {...featuredContent} />}
      
      <div className="space-y-12 py-12">
        {contentType === 'all' && recommendedItems?.Items && recommendedItems.Items.length > 0 && (
          <MediaRow
            title="Anbefalt for deg"
            items={mapJellyfinItems(recommendedItems.Items)}
            onItemClick={handleItemClick}
          />
        )}
        {contentType === 'all' && resumeItems?.Items && resumeItems.Items.length > 0 && (
          <MediaRow
            title="Fortsett å se"
            items={mapJellyfinItems(resumeItems.Items)}
            onItemClick={handleItemClick}
          />
        )}
        
        {/* Movies by genre for home page */}
        {contentType === 'all' && Object.entries(moviesByGenre).map(([genre, genreMovies]) => (
          <MediaRow
            key={genre}
            title={`${genre} filmer`}
            items={mapJellyfinItems(genreMovies)}
            onItemClick={handleItemClick}
          />
        ))}
        
        {contentType === 'all' && series.length > 0 && (
          <MediaRow
            title="Serier"
            items={mapJellyfinItems(series)}
            onItemClick={handleItemClick}
          />
        )}

        {/* Movies page with genre filter */}
        {contentType === 'movies' && (
          <div className="container mx-auto px-4">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold">Filmer</h2>
              <Select value={selectedGenre} onValueChange={setSelectedGenre}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Velg sjanger" />
                </SelectTrigger>
                <SelectContent className="bg-background z-50">
                  <SelectItem value="all">Alle sjangere</SelectItem>
                  {genres.map((genre) => (
                    <SelectItem key={genre} value={genre}>
                      {genre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {filteredMovies.length > 0 && (
              <MediaGrid
                title=""
                items={mapJellyfinItems(filteredMovies)}
                onItemClick={handleItemClick}
              />
            )}
          </div>
        )}

        {/* Series page with genre filter */}
        {contentType === 'series' && (
          <div className="container mx-auto px-4">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold">Serier</h2>
              <Select value={selectedGenre} onValueChange={setSelectedGenre}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Velg sjanger" />
                </SelectTrigger>
                <SelectContent className="bg-background z-50">
                  <SelectItem value="all">Alle sjangere</SelectItem>
                  {genres.map((genre) => (
                    <SelectItem key={genre} value={genre}>
                      {genre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {filteredSeries.length > 0 && (
              <MediaGrid
                title=""
                items={mapJellyfinItems(filteredSeries)}
                onItemClick={handleItemClick}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Browse;
