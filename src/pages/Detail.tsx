import { useNavigate, useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import Header from "@/components/Header";
import { useAuth } from "@/hooks/useAuth";
import { useServerSettings } from "@/hooks/useServerSettings";
import { useJellyfinApi } from "@/hooks/useJellyfinApi";
import { Button } from "@/components/ui/button";
import { Play, Plus, ThumbsUp, ChevronLeft, Subtitles } from "lucide-react";
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
  People?: { Name: string; Role: string; Type: string }[];
  MediaStreams?: MediaStream[];
}

const Detail = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { user, loading } = useAuth();
  const { serverUrl } = useServerSettings();
  const [selectedSubtitle, setSelectedSubtitle] = useState<string>("");

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

  // Fetch item details with media streams
  const { data: item, isLoading: itemLoading } = useJellyfinApi<JellyfinItemDetail>(
    ["item-detail", id || ""],
    {
      endpoint: id && userId ? `/Users/${userId}/Items/${id}?Fields=MediaStreams` : "",
    },
    !!user && !!userId && !!id
  );

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
    ? `${serverUrl}/Items/${item.Id}/Images/Backdrop?maxHeight=1080`
    : item.ImageTags?.Primary && serverUrl
    ? `${serverUrl}/Items/${item.Id}/Images/Primary?maxHeight=1080`
    : "https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=1920&h=1080&fit=crop";

  const runtime = item.RunTimeTicks ? Math.round(item.RunTimeTicks / 600000000) : null;

  // Filter subtitle streams
  const subtitles = item.MediaStreams?.filter(stream => stream.Type === "Subtitle") || [];

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      {/* Hero Section with Backdrop */}
      <div className="relative h-[70vh] overflow-hidden">
        <div className="absolute inset-0">
          <img
            src={backdropUrl}
            alt={item.Name}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
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
            <Button size="lg" className="gap-2">
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
                {item.People.filter(p => p.Type === "Actor").slice(0, 6).map((person, index) => (
                  <div key={index} className="text-sm">
                    <p className="font-medium">{person.Name}</p>
                    {person.Role && (
                      <p className="text-muted-foreground text-xs">{person.Role}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Detail;
