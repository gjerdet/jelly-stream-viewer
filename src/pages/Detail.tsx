import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useEffect, useState, useRef } from "react";
import Header from "@/components/Header";
import { useAuth } from "@/hooks/useAuth";
import { useServerSettings, getJellyfinImageUrl } from "@/hooks/useServerSettings";
import { useJellyfinApi } from "@/hooks/useJellyfinApi";
import { useJellyseerrRequest } from "@/hooks/useJellyseerr";
import { Button } from "@/components/ui/button";
import { Play, Plus, ThumbsUp, ChevronLeft, Subtitles, User, CheckCircle, Download } from "lucide-react";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface MediaStream {
  Index: number;
  Type: string;
  DisplayTitle?: string;
  Language?: string;
  Codec?: string;
  IsDefault?: boolean;
}

interface JellyfinItemDetail {
  Id: string;
  Name: string;
  Type: string;
  ProductionYear?: number;
  CommunityRating?: number;
  Overview?: string;
  ImageTags?: { Primary?: string; Backdrop?: string };
  BackdropImageTags?: string[];
  RunTimeTicks?: number;
  OfficialRating?: string;
  Genres?: string[];
  Studios?: { Name: string }[];
  People?: { 
    Name: string; 
    Role: string; 
    Type: string; 
    Id?: string;
    PrimaryImageTag?: string;
  }[];
  MediaStreams?: MediaStream[];
  ProviderIds?: {
    Tmdb?: string;
    Imdb?: string;
  };
}

interface Season {
  Id: string;
  Name: string;
  IndexNumber?: number;
  ImageTags?: { Primary?: string };
}

interface Episode {
  Id: string;
  Name: string;
  IndexNumber?: number;
  SeasonId: string;
  Overview?: string;
  ImageTags?: { Primary?: string };
  RunTimeTicks?: number;
  UserData?: {
    Played?: boolean;
    PlaybackPositionTicks?: number;
  };
}

interface SeasonsResponse {
  Items: Season[];
}

interface EpisodesResponse {
  Items: Episode[];
}

const Detail = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const episodeId = searchParams.get('episodeId');
  const seasonIdFromUrl = searchParams.get('seasonId');
  const { user, loading } = useAuth();
  const { serverUrl } = useServerSettings();
  const [selectedSubtitle, setSelectedSubtitle] = useState<string>("");
  const [selectedSeasonId, setSelectedSeasonId] = useState<string>("");
  const episodeRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const jellyseerrRequest = useJellyseerrRequest();

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

  // Fetch item details with media streams and backdrop images
  const { data: item, isLoading: itemLoading } = useJellyfinApi<JellyfinItemDetail>(
    ["item-detail", id || ""],
    {
      endpoint: id && userId 
        ? `/Users/${userId}/Items/${id}?Fields=MediaStreams,Overview,Genres,People,Studios&EnableImageTypes=Primary,Backdrop,Thumb` 
        : "",
    },
    !!user && !!userId && !!id
  );

  // Fetch seasons if this is a series
  const { data: seasonsData } = useJellyfinApi<SeasonsResponse>(
    ["series-seasons", id || ""],
    {
      endpoint: id && userId && item?.Type === "Series"
        ? `/Shows/${id}/Seasons?UserId=${userId}&Fields=PrimaryImageAspectRatio`
        : "",
    },
    !!user && !!userId && !!id && item?.Type === "Series"
  );

  // Fetch episodes for selected season
  const { data: episodesData } = useJellyfinApi<EpisodesResponse>(
    ["season-episodes", selectedSeasonId],
    {
      endpoint: selectedSeasonId && userId
        ? `/Shows/${id}/Episodes?SeasonId=${selectedSeasonId}&UserId=${userId}&Fields=Overview,PrimaryImageAspectRatio`
        : "",
    },
    !!selectedSeasonId && !!userId
  );

  // Auto-select season based on URL parameter or first season
  useEffect(() => {
    if (seasonsData?.Items && seasonsData.Items.length > 0) {
      if (seasonIdFromUrl) {
        // If seasonId is in URL, select that season
        const season = seasonsData.Items.find(s => s.Id === seasonIdFromUrl);
        if (season) {
          setSelectedSeasonId(season.Id);
        }
      } else {
        // Otherwise select first season
        setSelectedSeasonId(seasonsData.Items[0].Id);
      }
    }
  }, [seasonsData, seasonIdFromUrl]);

  // Scroll to episode when episodes load and episodeId is in URL
  useEffect(() => {
    if (episodeId && episodesData?.Items && episodesData.Items.length > 0) {
      const episode = episodesData.Items.find(e => e.Id === episodeId);
      if (episode && episodeRefs.current[episodeId]) {
        setTimeout(() => {
          episodeRefs.current[episodeId]?.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'center' 
          });
        }, 300);
      }
    }
  }, [episodeId, episodesData]);

  if (loading || itemLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Laster...</p>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-20">
          <p className="text-center text-muted-foreground">Innhold ikke funnet</p>
        </div>
      </div>
    );
  }

  const backdropUrl = item.BackdropImageTags?.[0] && serverUrl
    ? getJellyfinImageUrl(serverUrl, item.Id, 'Backdrop', { maxHeight: '1080' })
    : item.ImageTags?.Primary && serverUrl
    ? getJellyfinImageUrl(serverUrl, item.Id, 'Primary', { maxHeight: '1080' })
    : "https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=1920&h=1080&fit=crop";

  // Check if we're using the primary image as backdrop (needs blur effect)
  const isUsingPrimaryAsBackdrop = !item.BackdropImageTags?.[0] && item.ImageTags?.Primary;

  const runtime = item.RunTimeTicks ? Math.round(item.RunTimeTicks / 600000000) : null;

  // Filter subtitle streams
  const subtitles = item.MediaStreams?.filter(stream => stream.Type === "Subtitle") || [];

  const handleJellyseerrRequest = () => {
    const tmdbId = item.ProviderIds?.Tmdb;
    
    if (!tmdbId) {
      toast.error("TMDB ID ikke funnet for dette innholdet");
      return;
    }

    const mediaType = item.Type === "Movie" ? "movie" : "tv";
    
    jellyseerrRequest.mutate({
      mediaType,
      mediaId: parseInt(tmdbId),
      seasons: mediaType === "tv" ? "all" : undefined,
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      {/* Hero Section with Backdrop */}
      <div className="relative h-[70vh] overflow-hidden">
        {/* Backdrop Image with Blur */}
        <div className="absolute inset-0">
          <img
            src={backdropUrl}
            alt={item.Name}
            className={`w-full h-full object-cover animate-fade-in ${
              isUsingPrimaryAsBackdrop 
                ? 'scale-150 blur-2xl brightness-75' 
                : 'scale-110'
            }`}
          />
          {/* Multiple gradient layers for depth */}
          <div className="absolute inset-0 bg-gradient-to-r from-background via-background/50 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-l from-transparent via-transparent to-background/60" />
          {/* Vignette effect */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(0,0,0,0.3)_100%)]" />
          {/* Stronger overlay when using primary as backdrop */}
          {isUsingPrimaryAsBackdrop && (
            <div className="absolute inset-0 bg-background/40" />
          )}
          {/* Subtle noise texture */}
          <div className="absolute inset-0 opacity-[0.02] bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMDAiIGhlaWdodD0iMzAwIj48ZmlsdGVyIGlkPSJhIiB4PSIwIiB5PSIwIj48ZmVUdXJidWxlbmNlIGJhc2VGcmVxdWVuY3k9Ii43NSIgc3RpdGNoVGlsZXM9InN0aXRjaCIgdHlwZT0iZnJhY3RhbE5vaXNlIi8+PGZlQ29sb3JNYXRyaXggdHlwZT0ic2F0dXJhdGUiIHZhbHVlcz0iMCIvPjwvZmlsdGVyPjxwYXRoIGQ9Ik0wIDBoMzAwdjMwMEgweiIgZmlsdGVyPSJ1cmwoI2EpIiBvcGFjaXR5PSIuMDUiLz48L3N2Zz4=')]" />
        </div>

        <div className="relative container mx-auto px-4 h-full flex flex-col justify-end pb-20">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(-1)}
            className="absolute top-4 left-4 text-white hover:bg-white/20"
          >
            <ChevronLeft className="mr-2 h-4 w-4" />
            Tilbake
          </Button>

          {/* Cover Image */}
          <div className="flex items-end gap-6 mb-6">
            {item.ImageTags?.Primary && serverUrl && (
              <div className="w-48 h-72 flex-shrink-0 rounded-lg overflow-hidden shadow-2xl border-2 border-white/20">
                <img
                  src={getJellyfinImageUrl(serverUrl, item.Id, 'Primary', { maxHeight: '600' })}
                  alt={item.Name}
                  className="w-full h-full object-cover"
                />
              </div>
            )}
            
            <div className="flex-1">
              <h1 className="text-5xl font-bold mb-4 text-white drop-shadow-lg">
                {item.Name}
              </h1>

              <div className="flex items-center gap-4 mb-6 text-sm text-white/90">
                {item.CommunityRating && (
                  <span className="font-semibold text-green-400">
                    {item.CommunityRating.toFixed(1)} ⭐
                  </span>
                )}
                {item.ProductionYear && <span>{item.ProductionYear}</span>}
                {item.OfficialRating && (
                  <span className="px-2 py-1 border border-white/50 rounded">
                    {item.OfficialRating}
                  </span>
                )}
                {runtime && <span>{runtime} min</span>}
              </div>

              <div className="flex flex-wrap gap-3 mb-6">
                <Button 
                  size="lg" 
                  className="gap-2"
                  onClick={() => navigate(`/player/${id}`)}
                >
                  <Play className="h-5 w-5" />
                  Spill av
                </Button>
                <Button size="lg" variant="outline" className="gap-2">
                  <Plus className="h-5 w-5" />
                  Min liste
                </Button>
                <Button size="lg" variant="outline">
                  <ThumbsUp className="h-5 w-5" />
                </Button>
                {item.ProviderIds?.Tmdb && (
                  <Button 
                    size="lg" 
                    variant="outline" 
                    className="gap-2"
                    onClick={handleJellyseerrRequest}
                    disabled={jellyseerrRequest.isPending}
                  >
                    <Download className="h-5 w-5" />
                    {jellyseerrRequest.isPending ? "Sender..." : "Be om innhold"}
                  </Button>
                )}
                {subtitles.length > 0 && (
                  <Select value={selectedSubtitle} onValueChange={setSelectedSubtitle}>
                    <SelectTrigger className="w-[200px] bg-background/80 backdrop-blur-sm border-white/20 text-white">
                      <Subtitles className="mr-2 h-4 w-4" />
                      <SelectValue placeholder="Undertekster" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Ingen undertekster</SelectItem>
                      {subtitles.map((subtitle) => (
                        <SelectItem key={subtitle.Index} value={subtitle.Index.toString()}>
                          {subtitle.DisplayTitle || subtitle.Language || `Undertekst ${subtitle.Index}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {item.Overview && (
                <p className="max-w-2xl text-white/90 text-lg leading-relaxed">
                  {item.Overview}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Additional Info */}
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {item.Genres && item.Genres.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold mb-2 text-muted-foreground">Sjangere</h3>
              <p>{item.Genres.join(", ")}</p>
            </div>
          )}

          {item.Studios && item.Studios.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold mb-2 text-muted-foreground">Studio</h3>
              <p>{item.Studios.map(s => s.Name).join(", ")}</p>
            </div>
          )}

          {item.People && item.People.length > 0 && (
            <div className="md:col-span-3">
              <h3 className="text-lg font-semibold mb-4 text-muted-foreground">Skuespillere</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {item.People.filter(p => p.Type === "Actor").slice(0, 6).map((person, index) => {
                  const personImageUrl = person.Id && person.PrimaryImageTag && serverUrl
                    ? getJellyfinImageUrl(serverUrl, person.Id, 'Primary', { tag: person.PrimaryImageTag, maxHeight: '300' })
                    : null;
                  
                  return (
                    <div key={index} className="text-sm space-y-2">
                      <div className="aspect-[2/3] rounded-lg overflow-hidden bg-secondary">
                        {personImageUrl ? (
                          <img
                            src={personImageUrl}
                            alt={person.Name}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              const parent = e.currentTarget.parentElement;
                              if (parent) {
                                parent.innerHTML = `<div class="w-full h-full flex items-center justify-center"><svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-muted-foreground"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg></div>`;
                              }
                            }}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <User className="h-12 w-12 text-muted-foreground" />
                          </div>
                        )}
                      </div>
                      <div>
                        <p className="font-medium truncate">{person.Name}</p>
                        {person.Role && (
                          <p className="text-muted-foreground text-xs truncate">{person.Role}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Seasons and Episodes for Series */}
      {item.Type === "Series" && seasonsData?.Items && seasonsData.Items.length > 0 && (
        <div className="container mx-auto px-4 py-12 border-t border-border">
          <h2 className="text-2xl font-bold mb-6">Episoder</h2>
          
          {/* Season Selector */}
          <div className="flex gap-2 mb-6 overflow-x-auto scrollbar-hide pb-2">
            {seasonsData.Items.map((season) => (
              <Button
                key={season.Id}
                variant={selectedSeasonId === season.Id ? "default" : "outline"}
                onClick={() => setSelectedSeasonId(season.Id)}
                className="whitespace-nowrap"
              >
                {season.Name}
              </Button>
            ))}
          </div>

          {/* Episodes Grid */}
          {episodesData?.Items && episodesData.Items.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {episodesData.Items.map((episode) => {
                const episodeImageUrl = episode.ImageTags?.Primary && serverUrl
                  ? getJellyfinImageUrl(serverUrl, episode.Id, 'Primary', { maxHeight: '300' })
                  : null;
                const episodeRuntime = episode.RunTimeTicks 
                  ? Math.round(episode.RunTimeTicks / 600000000) 
                  : null;
                const watchedPercentage = episode.UserData?.PlaybackPositionTicks && episode.RunTimeTicks
                  ? (episode.UserData.PlaybackPositionTicks / episode.RunTimeTicks) * 100
                  : 0;
                const isWatched = episode.UserData?.Played || watchedPercentage >= 95;

                return (
                  <div
                    key={episode.Id}
                    ref={(el) => episodeRefs.current[episode.Id] = el}
                    onClick={() => navigate(`/player/${episode.Id}`)}
                    className={`group cursor-pointer bg-card rounded-lg overflow-hidden border smooth-transition ${
                      episodeId === episode.Id ? 'border-primary ring-2 ring-primary' : 'border-border hover:border-primary'
                    }`}
                  >
                    <div className="aspect-video relative bg-secondary">
                      {episodeImageUrl ? (
                        <img
                          src={episodeImageUrl}
                          alt={episode.Name}
                          className="w-full h-full object-cover group-hover:scale-105 smooth-transition"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Play className="h-12 w-12 text-muted-foreground" />
                        </div>
                      )}
                      {isWatched && (
                        <div className="absolute top-2 right-2 bg-green-600 rounded-full p-1">
                          <CheckCircle className="h-5 w-5 text-white" />
                        </div>
                      )}
                      {watchedPercentage > 0 && watchedPercentage < 95 && (
                        <div className="absolute bottom-0 left-0 right-0 h-1 bg-secondary/50">
                          <div 
                            className="h-full bg-primary"
                            style={{ width: `${watchedPercentage}%` }}
                          />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent opacity-0 group-hover:opacity-100 smooth-transition flex items-center justify-center">
                        <Play className="h-12 w-12 text-white" />
                      </div>
                    </div>
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <h3 className="font-semibold line-clamp-1">
                          {episode.IndexNumber && `${episode.IndexNumber}. `}{episode.Name}
                        </h3>
                        {episodeRuntime && (
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            {episodeRuntime} min
                          </span>
                        )}
                      </div>
                      {episode.Overview && (
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {episode.Overview}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Detail;
