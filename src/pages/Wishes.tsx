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
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      
      <div className="flex-1 container mx-auto px-4 py-6">
        <div className="mb-4">
          <h1 className="text-3xl font-bold mb-2">Ønsker</h1>
          <p className="text-muted-foreground">
            Søk og be om nytt innhold via Jellyseerr
          </p>
        </div>

        {iframeError && (
          <Alert className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Jellyseerr kan ikke vises direkte i appen på grunn av sikkerhetsinnstillinger.
              Bruk "Oppdag filmer" og "Oppdag serier" fanene i stedet.
            </AlertDescription>
          </Alert>
        )}

        <div className="w-full h-[calc(100vh-220px)] rounded-lg overflow-hidden border border-border bg-secondary">
          <iframe
            src={jellyseerrUrl}
            className="w-full h-full"
            title="Jellyseerr"
            onError={() => setIframeError(true)}
            sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
          />
        </div>
      </div>
    </div>
  );
};

export default Wishes;
