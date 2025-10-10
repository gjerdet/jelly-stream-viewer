import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Header from "@/components/Header";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

const Wishes = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [jellyseerrUrl, setJellyseerrUrl] = useState<string>("");
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);
  const [iframeError, setIframeError] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/");
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    const fetchJellyseerrUrl = async () => {
      const { data } = await supabase
        .from('server_settings')
        .select('setting_value')
        .eq('setting_key', 'jellyseerr_url')
        .maybeSingle();
      
      if (data?.setting_value) {
        setJellyseerrUrl(data.setting_value);
      }
      setIsLoadingSettings(false);
    };

    if (user) {
      fetchJellyseerrUrl();
    }
  }, [user]);

  if (loading || isLoadingSettings) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-12 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (!jellyseerrUrl) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-12">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Jellyseerr er ikke konfigurert. Gå til Admin-siden for å konfigurere.
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8">
            <h1 className="text-4xl font-bold mb-2">Ønsker</h1>
            <p className="text-muted-foreground">
              Søk og be om nytt innhold via Jellyseerr
            </p>
          </div>

          <Alert className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Av sikkerhetsgrunner kan ikke Jellyseerr vises direkte inne i appen.
              Du kan enten:
            </AlertDescription>
          </Alert>

          <div className="grid gap-4 md:grid-cols-2 mb-6">
            <a
              href={jellyseerrUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col p-6 border border-border rounded-lg hover:border-primary smooth-transition bg-card"
            >
              <h3 className="text-lg font-semibold mb-2">Åpne Jellyseerr</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Åpner Jellyseerr i en ny fane hvor du kan søke og be om innhold
              </p>
              <span className="text-primary text-sm font-medium">
                Åpne i ny fane →
              </span>
            </a>

            <div className="flex flex-col p-6 border border-border rounded-lg bg-card">
              <h3 className="text-lg font-semibold mb-2">Bruk Oppdag-fanene</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Bla gjennom populære filmer og serier direkte i appen
              </p>
              <div className="flex gap-2">
                <a
                  href="/discover-movies"
                  className="text-primary text-sm font-medium hover:underline"
                >
                  Oppdag filmer →
                </a>
                <a
                  href="/discover-series"
                  className="text-primary text-sm font-medium hover:underline"
                >
                  Oppdag serier →
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Wishes;
