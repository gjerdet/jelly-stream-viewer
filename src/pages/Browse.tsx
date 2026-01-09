import { useNavigate, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import MediaRow from "@/components/MediaRow";
import FeaturedCarousel from "@/components/FeaturedCarousel";
import MediaGrid from "@/components/MediaGrid";
import { useAuth } from "@/hooks/useAuth";
import { useServerSettings, getJellyfinImageUrl } from "@/hooks/useServerSettings";
import { useJellyfinApi } from "@/hooks/useJellyfinApi";
import { useJellyfinSession } from "@/hooks/useJellyfinSession";
import { Button } from "@/components/ui/button";
import { Film } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
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
  ChildCount?: number;
  RecursiveItemCount?: number;
}

interface JellyfinResponse {
  Items: JellyfinItem[];
}

const Browse = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading } = useAuth();
  const { serverUrl } = useServerSettings();
  const { t } = useLanguage();
  const common = t.common as any;
  const browse = t.browse as any;
  const [selectedGenre, setSelectedGenre] = useState<string>("all");

  // Get userId from localStorage session (not /Users endpoint which requires admin)
  const { userId } = useJellyfinSession();

  // Determine what content type to show based on route
  const contentType = location.pathname === '/movies' ? 'movies' : 
                      location.pathname === '/series' ? 'series' : 
                      'all';

  useEffect(() => {
    if (!loading && !user) {
      navigate("/");
    }
  }, [user, loading, navigate]);

  // Fetch all media items based on content type
  const includeItemTypes = contentType === 'movies' ? 'Movie' : 
                           contentType === 'series' ? 'Series' : 
                           'Movie,Series';

  const { data: allItems, error: itemsError, isLoading: itemsLoading } = useJellyfinApi<JellyfinResponse>(
    ["all-items", userId || "", contentType],
    {
      endpoint: userId
        ? `/Users/${userId}/Items?SortBy=DateCreated,SortName&SortOrder=Descending&IncludeItemTypes=${includeItemTypes}&Recursive=true&Fields=PrimaryImageAspectRatio,BasicSyncInfo,Genres,ChildCount,RecursiveItemCount&ImageTypeLimit=1&EnableImageTypes=Primary,Backdrop,Thumb`
        : "",
    },
    !!user && !!userId
  );

  // Fetch resume items with user ID
  const { data: resumeItems, error: resumeError, isLoading: resumeLoading } = useJellyfinApi<JellyfinResponse>(
    ["resume-items", userId || ""],
    {
      endpoint: userId
        ? `/Users/${userId}/Items/Resume?Limit=20&Fields=PrimaryImageAspectRatio,BasicSyncInfo,SeriesId,SeasonId&ImageTypeLimit=1&EnableImageTypes=Primary,Backdrop,Thumb`
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
  const isDataLoading = itemsLoading || resumeLoading || !userId;
  const hasNoData = !isDataLoading && (!allItems || allItems.Items?.length === 0);

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
      episodeCount: item.RecursiveItemCount || item.ChildCount,
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

  if (loading || isDataLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-foreground">{common.loading}</p>
      </div>
    );
  }

  // Show error message if server is not available or no data
  if ((hasApiError && !isDataLoading) || (hasNoData && !loading && !isDataLoading)) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-20">
          <div className="max-w-2xl mx-auto text-center space-y-6">
            <div className="p-8 rounded-xl bg-card border border-border">
              <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
                <Film className="w-8 h-8 text-destructive" />
              </div>
              <h2 className="text-2xl font-bold mb-3 text-foreground">
                {browse.cannotConnect}
              </h2>
              <p className="text-muted-foreground mb-6">
                {browse.cannotConnectDesc}
              </p>
              <div className="space-y-3">
                <Button 
                  onClick={() => navigate("/setup")} 
                  variant="default"
                  className="w-full"
                >
                  {common.goToSetup}
                </Button>
                <Button 
                  onClick={() => window.location.reload()} 
                  variant="outline"
                  className="w-full"
                >
                  {common.retry}
                </Button>
              </div>
            </div>
            <div className="text-sm text-muted-foreground space-y-2">
              <p>{browse.whatCanYouDo}</p>
              <ul className="list-disc list-inside text-left max-w-md mx-auto space-y-1">
                <li>{browse.setupServer}</li>
                <li>{browse.exploreApp}</li>
                <li>{browse.whenConnected}</li>
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
    <div className="min-h-screen bg-background overflow-x-hidden">
      {/* Featured Carousel - Only on home page */}
      {contentType === 'all' && carouselItemsWithImages.length > 0 && (
        <div className="w-full px-2 sm:px-4 pt-4 sm:pt-8">
          <div className="container mx-auto">
            <FeaturedCarousel items={carouselItemsWithImages} onItemClick={handleItemClick} />
          </div>
        </div>
      )}
      
      <div className="space-y-6 sm:space-y-8 md:space-y-12 py-6 sm:py-8 md:py-12">
        {contentType === 'all' && recommendedItems?.Items && recommendedItems.Items.length > 0 && (
          <MediaRow
            title={browse.recommendedForYou}
            items={mapJellyfinItems(recommendedItems.Items)}
            onItemClick={(id) => {
              const item = recommendedItems.Items.find(i => i.Id === id);
              handleItemClick(id, { type: item?.Type, seriesId: item?.SeriesId, seasonId: item?.SeasonId });
            }}
          />
        )}
        {contentType === 'all' && resumeItems?.Items && resumeItems.Items.length > 0 && (
          <MediaRow
            title={browse.continueWatching}
            items={mapJellyfinItems(resumeItems.Items)}
            onItemClick={(id) => {
              const item = resumeItems.Items.find(i => i.Id === id);
              handleItemClick(id, { type: item?.Type, seriesId: item?.SeriesId, seasonId: item?.SeasonId });
            }}
          />
        )}
        
        {/* Movies by genre for home page */}
        {contentType === 'all' && Object.entries(moviesByGenre).map(([genre, genreMovies]) => (
          <MediaRow
            key={genre}
            title={`${genre} ${browse.movies}`}
            items={mapJellyfinItems(genreMovies)}
            onItemClick={handleItemClick}
          />
        ))}
        
        {contentType === 'all' && series.length > 0 && (
          <MediaRow
            title={browse.series}
            items={mapJellyfinItems(series)}
            onItemClick={handleItemClick}
          />
        )}
        

        {/* Movies page with genre filter */}
        {contentType === 'movies' && (
          <div className="container mx-auto px-3 sm:px-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 sm:mb-6">
              <h2 className="text-lg sm:text-xl md:text-2xl font-bold">{browse.movies}</h2>
              <Select value={selectedGenre} onValueChange={setSelectedGenre}>
                <SelectTrigger className="w-full sm:w-[180px] md:w-[200px] h-10">
                  <SelectValue placeholder={browse.selectGenre} />
                </SelectTrigger>
                <SelectContent className="bg-background z-50">
                  <SelectItem value="all">{browse.allGenres}</SelectItem>
                  {genres.map((genre) => (
                    <SelectItem key={genre} value={genre}>
                      {genre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {filteredMovies.length > 0 ? (
              <MediaGrid
                title=""
                items={mapJellyfinItems(filteredMovies)}
                onItemClick={handleItemClick}
              />
            ) : (
              <div className="flex flex-col items-center justify-center py-12 sm:py-20 text-center px-4">
                <div className="p-4 sm:p-6 rounded-xl bg-card border border-border max-w-md w-full">
                  <h3 className="text-lg sm:text-xl font-semibold mb-2">{browse.noMoviesFound}</h3>
                  <p className="text-sm sm:text-base text-muted-foreground mb-4">
                    {browse.noMoviesServer}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Series page with genre filter */}
        {contentType === 'series' && (
          <div className="container mx-auto px-3 sm:px-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 sm:mb-6">
              <h2 className="text-lg sm:text-xl md:text-2xl font-bold">{browse.series}</h2>
              <Select value={selectedGenre} onValueChange={setSelectedGenre}>
                <SelectTrigger className="w-full sm:w-[180px] md:w-[200px] h-10">
                  <SelectValue placeholder={browse.selectGenre} />
                </SelectTrigger>
                <SelectContent className="bg-background z-50">
                  <SelectItem value="all">{browse.allGenres}</SelectItem>
                  {genres.map((genre) => (
                    <SelectItem key={genre} value={genre}>
                      {genre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {filteredSeries.length > 0 ? (
              <MediaGrid
                title=""
                items={mapJellyfinItems(filteredSeries)}
                onItemClick={handleItemClick}
              />
            ) : (
              <div className="flex flex-col items-center justify-center py-12 sm:py-20 text-center px-4">
                <div className="p-4 sm:p-6 rounded-xl bg-card border border-border max-w-md w-full">
                  <h3 className="text-lg sm:text-xl font-semibold mb-2">{browse.noSeriesFound}</h3>
                  <p className="text-sm sm:text-base text-muted-foreground mb-4">
                    {browse.noSeriesServer}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Browse;
