import { useNavigate, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import MediaRow from "@/components/MediaRow";
import FeaturedCarousel from "@/components/FeaturedCarousel";
import MediaGrid from "@/components/MediaGrid";
import { useAuth } from "@/hooks/useAuth";
import { useServerSettings, getJellyfinImageUrl } from "@/hooks/useServerSettings";
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
  BackdropImageTags?: string[];
  Genres?: string[];
  SeriesId?: string;
  SeasonId?: string;
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

  // Fetch recommended items with Series and Season IDs for episodes
  const { data: recommendedItems } = useJellyfinApi<JellyfinResponse>(
    ["recommended-items", userId || ""],
    {
      endpoint: userId
        ? `/Users/${userId}/Suggestions?Limit=20&Fields=PrimaryImageAspectRatio,BasicSyncInfo,SeriesId,SeasonId&ImageTypeLimit=1&EnableImageTypes=Primary,Backdrop,Thumb`
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

  const mapJellyfinItems = (items?: JellyfinItem[]) => {
    if (!items || !serverUrl) return [];
    return items.map((item) => ({
      id: item.Id,
      title: item.Name,
      image: item.ImageTags?.Primary
        ? getJellyfinImageUrl(serverUrl, item.Id, 'Primary', { maxHeight: '600' })
        : "https://images.unsplash.com/photo-1509347528160-9a9e33742cdb?w=400&h=600&fit=crop",
      year: item.ProductionYear?.toString(),
      rating: item.CommunityRating?.toFixed(1),
      type: item.Type,
      seriesId: item.SeriesId,
      seasonId: item.SeasonId,
    }));
  };

  const handleItemClick = (id: string, item?: { type?: string; seriesId?: string; seasonId?: string }) => {
    // If it's an episode, navigate to the series with episode parameters
    if (item?.type === 'Episode' && item.seriesId) {
      navigate(`/detail/${item.seriesId}?episodeId=${id}${item.seasonId ? `&seasonId=${item.seasonId}` : ''}`);
    } else {
      navigate(`/detail/${id}`);
    }
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

  // Get latest 10 items for carousel
  const latestItems = allItems?.Items?.slice(0, 10).map(item => ({
    id: item.Id,
    title: item.Name,
    imageTag: item.ImageTags?.Primary,
    backdropTag: item.BackdropImageTags?.[0],
    year: item.ProductionYear?.toString(),
  })) || [];

  // Generate carousel image URLs  
  const carouselItemsWithImages = latestItems.map(item => ({
    ...item,
    imageUrl: serverUrl && item.backdropTag
      ? getJellyfinImageUrl(serverUrl, item.id, 'Backdrop', { maxHeight: '800' })
      : serverUrl && item.imageTag
      ? getJellyfinImageUrl(serverUrl, item.id, 'Primary', { maxHeight: '800' })
      : "https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=1920&h=800&fit=crop"
  }));

  return (
    <div className="min-h-screen bg-background">
      {/* Featured Carousel - Only on home page */}
      {contentType === 'all' && carouselItemsWithImages.length > 0 && (
        <div className="container mx-auto px-4 pt-8 relative z-0">
          <FeaturedCarousel items={carouselItemsWithImages} onItemClick={handleItemClick} />
        </div>
      )}
      
      <div className="space-y-12 py-12">
        {contentType === 'all' && recommendedItems?.Items && recommendedItems.Items.length > 0 && (
          <MediaRow
            title="Anbefalt for deg"
            items={mapJellyfinItems(recommendedItems.Items)}
            onItemClick={(id) => {
              const item = recommendedItems.Items.find(i => i.Id === id);
              handleItemClick(id, { type: item?.Type, seriesId: item?.SeriesId, seasonId: item?.SeasonId });
            }}
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
