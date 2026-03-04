import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, ChevronRight, Server, Film, Tv, Subtitles, Clapperboard, Cloud, Settings } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface ServiceStatus {
  key: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  settingKeys: string[];
  tabTarget: string;
  configured: boolean | null;
}

interface QuickSetupOverviewProps {
  onNavigateToTab: (tab: string) => void;
}

export const QuickSetupOverview = ({ onNavigateToTab }: QuickSetupOverviewProps) => {
  const [services, setServices] = useState<ServiceStatus[]>([
    {
      key: "jellyfin",
      label: "Jellyfin",
      description: "Hoved-mediaserver – kreves for å bruke appen",
      icon: <Server className="h-5 w-5" />,
      settingKeys: ["jellyfin_server_url"],
      tabTarget: "servers",
      configured: null,
    },
    {
      key: "jellyseerr",
      label: "Jellyseerr",
      description: "Mediabehov og forespørsler fra brukere",
      icon: <Clapperboard className="h-5 w-5" />,
      settingKeys: ["jellyseerr_url"],
      tabTarget: "servers",
      configured: null,
    },
    {
      key: "radarr",
      label: "Radarr",
      description: "Automatisk nedlasting av filmer",
      icon: <Film className="h-5 w-5" />,
      settingKeys: ["radarr_url"],
      tabTarget: "radarr",
      configured: null,
    },
    {
      key: "sonarr",
      label: "Sonarr",
      description: "Automatisk nedlasting av TV-serier",
      icon: <Tv className="h-5 w-5" />,
      settingKeys: ["sonarr_url"],
      tabTarget: "sonarr",
      configured: null,
    },
    {
      key: "bazarr",
      label: "Bazarr",
      description: "Automatisk nedlasting av undertekster",
      icon: <Subtitles className="h-5 w-5" />,
      settingKeys: ["bazarr_url"],
      tabTarget: "bazarr",
      configured: null,
    },
  ]);

  useEffect(() => {
    const loadStatuses = async () => {
      const allKeys = services.flatMap(s => s.settingKeys);
      const { data } = await supabase
        .from("server_settings")
        .select("setting_key, setting_value")
        .in("setting_key", allKeys);

      setServices(prev =>
        prev.map(service => {
          const found = data?.find(d => service.settingKeys.includes(d.setting_key));
          return {
            ...service,
            configured: !!(found?.setting_value && found.setting_value.trim() !== ""),
          };
        })
      );
    };
    loadStatuses();
  }, []);

  const configuredCount = services.filter(s => s.configured === true).length;
  const allDone = configuredCount === services.length;

  return (
    <div className="space-y-6">
      {/* Intro banner */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="pt-6 pb-5">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-xl bg-primary/10">
              <Cloud className="h-7 w-7 text-primary" />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-bold mb-1">Kom i gang med Jelly Stream Viewer</h2>
              <p className="text-sm text-muted-foreground mb-3">
                Appen bruker <strong>Lovable Cloud</strong> for autentisering og database – det er allerede klart.
                Konfigurer tjenestene nedenfor for å få full funksjonalitet.
                Alle tjenester utenom Jellyfin er valgfrie.
              </p>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-2 rounded-full bg-secondary overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all duration-500"
                    style={{ width: `${(configuredCount / services.length) * 100}%` }}
                  />
                </div>
                <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">
                  {configuredCount} / {services.length} konfigurert
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lovable Cloud – always done */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Settings className="h-4 w-4 text-primary" />
            Infrastruktur
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <ServiceRow
            icon={<Cloud className="h-5 w-5" />}
            label="Lovable Cloud (backend)"
            description="Database, autentisering og edge functions – konfigurert automatisk"
            configured={true}
            onConfigure={null}
          />
        </CardContent>
      </Card>

      {/* Services */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Server className="h-4 w-4 text-primary" />
            Tjenester
            {allDone && (
              <Badge className="ml-auto bg-primary/20 text-primary border-0">Alle konfigurert ✓</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {services.map(service => (
            <ServiceRow
              key={service.key}
              icon={service.icon}
              label={service.label}
              description={service.description}
              configured={service.configured}
              onConfigure={() => onNavigateToTab(service.tabTarget)}
            />
          ))}
        </CardContent>
      </Card>

      {/* Tips */}
      <Card className="border-border/50 bg-secondary/20">
        <CardContent className="pt-4 pb-4">
          <h3 className="text-sm font-semibold mb-2">💡 Tips</h3>
          <ul className="text-xs text-muted-foreground space-y-1.5">
            <li>• <strong>Jellyfin</strong> er påkrevd – uten det fungerer ikke browsing og avspilling</li>
            <li>• <strong>Jellyseerr</strong> lar brukere forespørre nytt innhold via Forespørsler-siden</li>
            <li>• <strong>Radarr/Sonarr</strong> aktiverer bibliotekstatistikk og nedlastingsoversikt i Admin</li>
            <li>• <strong>Bazarr</strong> gir automatisk undertekst-nedlasting og -håndtering</li>
            <li>• API-nøkler finner du i hvert enkelt verktøys dashboard under <em>Settings → API Key</em></li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
};

const ServiceRow = ({
  icon,
  label,
  description,
  configured,
  onConfigure,
}: {
  icon: React.ReactNode;
  label: string;
  description: string;
  configured: boolean | null;
  onConfigure: (() => void) | null;
}) => (
  <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors">
    <div className="p-2 rounded-lg bg-primary/10 text-primary">{icon}</div>
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2">
        <p className="font-medium text-sm">{label}</p>
        {configured === true && (
          <Badge className="text-[10px] py-0 h-4 bg-primary/20 text-primary border-0">Konfigurert</Badge>
        )}
        {configured === false && (
          <Badge variant="outline" className="text-[10px] py-0 h-4 text-muted-foreground">Ikke satt opp</Badge>
        )}
      </div>
      <p className="text-xs text-muted-foreground truncate">{description}</p>
    </div>
    <div className="flex items-center gap-2">
      {configured === true ? (
        <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0" />
      ) : configured === false ? (
        <XCircle className="h-5 w-5 text-muted-foreground flex-shrink-0" />
      ) : (
        <div className="h-5 w-5 rounded-full bg-secondary animate-pulse" />
      )}
      {onConfigure && (
        <Button
          size="sm"
          variant={configured ? "ghost" : "default"}
          className="gap-1 text-xs h-7 px-2"
          onClick={onConfigure}
        >
          {configured ? "Endre" : "Konfigurer"}
          <ChevronRight className="h-3 w-3" />
        </Button>
      )}
    </div>
  </div>
);
