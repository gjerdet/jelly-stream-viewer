import { useNavigate, useParams } from "react-router-dom";
import { useEffect } from "react";
import Header from "@/components/Header";
import { useAuth } from "@/hooks/useAuth";
import { useServerSettings, getJellyfinImageUrl } from "@/hooks/useServerSettings";
import { useJellyfinApi } from "@/hooks/useJellyfinApi";
import { Button } from "@/components/ui/button";
import { ChevronLeft, User } from "lucide-react";

interface PersonDetail {
  Id: string;
  Name: string;
  Overview?: string;
  PremiereDate?: string;
  ImageTags?: { Primary?: string };
}

interface MediaItem {
  Id: string;
  Name: string;
  Type: string;
  ProductionYear?: number;
  ImageTags?: { Primary?: string };
  UserData?: {
    PlaybackPositionTicks?: number;
  };
}

interface PersonItemsResponse {
  Items: MediaItem[];
}

const Person = () => {
  const navigate = useNavigate();
  const { personId } = useParams();
  const { user, loading } = useAuth();
  const { serverUrl } = useServerSettings();

  useEffect(() => {
    if (!loading && !user) {
      navigate("/");
    }
  }, [user, loading, navigate]);

  // Fetch users to get user ID
  const { data: usersData } = useJellyfinApi<{ Id: string }[]>(
    ["jellyfin-users"],
    {
      endpoint: `/Users`,
    },
    !!user
  );

  const userId = usersData?.[0]?.Id;

  // Fetch person details
  const { data: person, isLoading: personLoading } = useJellyfinApi<PersonDetail>(
    ["person-detail", personId || ""],
    {
      endpoint: personId && userId 
        ? `/Users/${userId}/Items/${personId}` 
        : "",
    },
    !!user && !!userId && !!personId
  );

  // Fetch all items this person appears in
  const { data: itemsData, isLoading: itemsLoading } = useJellyfinApi<PersonItemsResponse>(
    ["person-items", personId || ""],
    {
      endpoint: personId && userId
        ? `/Items?PersonIds=${personId}&UserId=${userId}&Recursive=true&Fields=PrimaryImageAspectRatio&IncludeItemTypes=Movie,Series`
        : "",
    },
    !!user && !!userId && !!personId
  );

  if (loading || personLoading || itemsLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Laster...</p>
      </div>
    );
  }

  if (!person) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-20">
          <p className="text-center text-muted-foreground">Person ikke funnet</p>
        </div>
      </div>
    );
  }

  const personImageUrl = person.ImageTags?.Primary && serverUrl
    ? getJellyfinImageUrl(serverUrl, person.Id, 'Primary', { maxHeight: '600' })
    : null;

  const movies = itemsData?.Items.filter(item => item.Type === "Movie") || [];
  const series = itemsData?.Items.filter(item => item.Type === "Series") || [];

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <div className="container mx-auto px-4 py-8">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(-1)}
          className="mb-6"
        >
          <ChevronLeft className="mr-2 h-4 w-4" />
          Tilbake
        </Button>

        {/* Person Header */}
        <div className="flex flex-col md:flex-row gap-8 mb-12">
          <div className="w-48 h-72 flex-shrink-0 rounded-lg overflow-hidden bg-secondary">
            {personImageUrl ? (
              <img
                src={personImageUrl}
                alt={person.Name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <User className="h-24 w-24 text-muted-foreground" />
              </div>
            )}
          </div>
          
          <div className="flex-1">
            <h1 className="text-4xl font-bold mb-4">{person.Name}</h1>
            
            {person.PremiereDate && (
              <p className="text-muted-foreground mb-4">
                Født: {new Date(person.PremiereDate).toLocaleDateString('no-NO', { 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}
              </p>
            )}
            
            {person.Overview && (
              <p className="text-muted-foreground leading-relaxed">{person.Overview}</p>
            )}
          </div>
        </div>

        {/* Movies */}
        {movies.length > 0 && (
          <div className="mb-12">
            <h2 className="text-2xl font-bold mb-6">Filmer</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {movies.map((movie) => (
                <div
                  key={movie.Id}
                  onClick={() => navigate(`/detail/${movie.Id}`)}
                  className="cursor-pointer group"
                >
                  <div className="aspect-[2/3] rounded-lg overflow-hidden bg-secondary smooth-transition group-hover:scale-105">
                    {movie.ImageTags?.Primary && serverUrl ? (
                      <img
                        src={getJellyfinImageUrl(serverUrl, movie.Id, 'Primary', { maxHeight: '400' })}
                        alt={movie.Name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                        Ingen bilde
                      </div>
                    )}
                  </div>
                  <div className="mt-2">
                    <p className="font-medium line-clamp-1 group-hover:text-primary smooth-transition">
                      {movie.Name}
                    </p>
                    {movie.ProductionYear && (
                      <p className="text-sm text-muted-foreground">{movie.ProductionYear}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Series */}
        {series.length > 0 && (
          <div>
            <h2 className="text-2xl font-bold mb-6">Serier</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {series.map((show) => (
                <div
                  key={show.Id}
                  onClick={() => navigate(`/detail/${show.Id}`)}
                  className="cursor-pointer group"
                >
                  <div className="aspect-[2/3] rounded-lg overflow-hidden bg-secondary smooth-transition group-hover:scale-105">
                    {show.ImageTags?.Primary && serverUrl ? (
                      <img
                        src={getJellyfinImageUrl(serverUrl, show.Id, 'Primary', { maxHeight: '400' })}
                        alt={show.Name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                        Ingen bilde
                      </div>
                    )}
                  </div>
                  <div className="mt-2">
                    <p className="font-medium line-clamp-1 group-hover:text-primary smooth-transition">
                      {show.Name}
                    </p>
                    {show.ProductionYear && (
                      <p className="text-sm text-muted-foreground">{show.ProductionYear}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {movies.length === 0 && series.length === 0 && (
          <p className="text-center text-muted-foreground py-12">
            Ingen filmer eller serier funnet for denne personen
          </p>
        )}
      </div>
    </div>
  );
};

export default Person;
