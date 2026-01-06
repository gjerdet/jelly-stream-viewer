import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Users, History, Film, Tv, CheckCircle2, XCircle, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { nb } from "date-fns/locale";

interface SyncSchedule {
  id: string;
  sync_type: string;
  enabled: boolean;
  last_run_at: string | null;
  last_run_status: string | null;
  last_run_details: Record<string, unknown> | null;
}

const SYNC_TYPE_INFO: Record<string, { label: string; icon: React.ReactNode }> = {
  jellyfin_users: { label: "Brukere", icon: <Users className="h-4 w-4" /> },
  jellyfin_history: { label: "Historikk", icon: <History className="h-4 w-4" /> },
  radarr_library: { label: "Filmer", icon: <Film className="h-4 w-4" /> },
  sonarr_library: { label: "Serier", icon: <Tv className="h-4 w-4" /> },
};

export const SyncStatusWidget = () => {
  const { data: schedules, isLoading } = useQuery({
    queryKey: ["sync-schedule-widget"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sync_schedule")
        .select("*")
        .order("sync_type");

      if (error) throw error;
      return data as SyncSchedule[];
    },
    refetchInterval: 60000, // Refresh every minute
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-6">
          <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const hasRecentRun = schedules?.some(s => s.last_run_at);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <RefreshCw className="h-4 w-4" />
          Synkroniseringsstatus
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!hasRecentRun ? (
          <p className="text-sm text-muted-foreground">Ingen synkroniseringer kjørt ennå</p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {schedules?.map((schedule) => {
              const info = SYNC_TYPE_INFO[schedule.sync_type] || {
                label: schedule.sync_type,
                icon: <RefreshCw className="h-4 w-4" />,
              };

              return (
                <div
                  key={schedule.id}
                  className="flex items-center gap-2 p-2 rounded-md bg-muted/30"
                >
                  <div className="text-muted-foreground">{info.icon}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{info.label}</p>
                    {schedule.last_run_at ? (
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        {schedule.last_run_status === "completed" ? (
                          <CheckCircle2 className="h-3 w-3 text-green-500" />
                        ) : schedule.last_run_status === "failed" ? (
                          <XCircle className="h-3 w-3 text-destructive" />
                        ) : (
                          <Clock className="h-3 w-3" />
                        )}
                        {formatDistanceToNow(new Date(schedule.last_run_at), {
                          addSuffix: true,
                          locale: nb,
                        })}
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground">Aldri kjørt</p>
                    )}
                  </div>
                  {!schedule.enabled && (
                    <Badge variant="secondary" className="text-xs">Av</Badge>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
