import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { RefreshCw, Clock, Play, CheckCircle2, XCircle, Loader2, Users, History, Film, Tv } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { nb } from "date-fns/locale";

interface SyncSchedule {
  id: string;
  sync_type: string;
  cron_expression: string;
  enabled: boolean;
  last_run_at: string | null;
  last_run_status: string | null;
  last_run_details: Record<string, unknown> | null;
}

const SYNC_TYPE_INFO: Record<string, { label: string; description: string; icon: React.ReactNode }> = {
  jellyfin_users: {
    label: "Jellyfin-brukere",
    description: "Synkroniserer brukere fra Jellyfin",
    icon: <Users className="h-4 w-4" />,
  },
  jellyfin_history: {
    label: "Sehistorikk",
    description: "Synkroniserer sehistorikk fra Jellyfin",
    icon: <History className="h-4 w-4" />,
  },
  radarr_library: {
    label: "Radarr-bibliotek",
    description: "Synkroniserer filmer fra Radarr",
    icon: <Film className="h-4 w-4" />,
  },
  sonarr_library: {
    label: "Sonarr-bibliotek",
    description: "Synkroniserer serier fra Sonarr",
    icon: <Tv className="h-4 w-4" />,
  },
};

const EDGE_FUNCTION_MAP: Record<string, string> = {
  jellyfin_users: "sync-jellyfin-users",
  jellyfin_history: "sync-jellyfin-history",
  radarr_library: "sync-radarr-library",
  sonarr_library: "sync-sonarr-library",
};

export const SyncScheduleManager = () => {
  const queryClient = useQueryClient();
  const [runningSync, setRunningSync] = useState<string | null>(null);
  const [editingSchedule, setEditingSchedule] = useState<string | null>(null);
  const [editCron, setEditCron] = useState("");

  const { data: schedules, isLoading } = useQuery({
    queryKey: ["sync-schedule"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sync_schedule")
        .select("*")
        .order("sync_type");

      if (error) throw error;
      return data as SyncSchedule[];
    },
  });

  const updateScheduleMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: { enabled?: boolean; cron_expression?: string } }) => {
      const { error } = await supabase
        .from("sync_schedule")
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sync-schedule"] });
      toast.success("Synkroniseringsplan oppdatert");
      setEditingSchedule(null);
    },
    onError: () => {
      toast.error("Kunne ikke oppdatere plan");
    },
  });

  const runSync = async (syncType: string) => {
    const functionName = EDGE_FUNCTION_MAP[syncType];
    if (!functionName) {
      toast.error("Ukjent synkroniseringstype");
      return;
    }

    setRunningSync(syncType);
    const startTime = Date.now();

    try {
      const { data, error } = await supabase.functions.invoke(functionName, {
        method: "POST",
      });

      const duration = ((Date.now() - startTime) / 1000).toFixed(1);

      if (error) {
        toast.error(`Synkronisering feilet: ${error.message}`);
      } else {
        toast.success(`Synkronisering fullført på ${duration}s`);
        queryClient.invalidateQueries({ queryKey: ["sync-schedule"] });
      }
    } catch (err) {
      toast.error("Kunne ikke kjøre synkronisering");
    } finally {
      setRunningSync(null);
    }
  };

  const parseCronToReadable = (cron: string): string => {
    const parts = cron.split(" ");
    if (parts.length !== 5) return cron;

    const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;

    if (dayOfMonth === "*" && month === "*" && dayOfWeek === "*") {
      return `Hver dag kl. ${hour.padStart(2, "0")}:${minute.padStart(2, "0")}`;
    }

    return cron;
  };

  const handleStartEdit = (schedule: SyncSchedule) => {
    setEditingSchedule(schedule.id);
    setEditCron(schedule.cron_expression);
  };

  const handleSaveEdit = (id: string) => {
    updateScheduleMutation.mutate({ id, updates: { cron_expression: editCron } });
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <RefreshCw className="h-5 w-5" />
          Synkroniseringsplaner
        </CardTitle>
        <CardDescription>
          Konfigurer automatisk synkronisering mellom Jellyfin, Radarr, Sonarr og appen
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {schedules?.map((schedule) => {
          const info = SYNC_TYPE_INFO[schedule.sync_type] || {
            label: schedule.sync_type,
            description: "",
            icon: <RefreshCw className="h-4 w-4" />,
          };
          const isRunning = runningSync === schedule.sync_type;
          const isEditing = editingSchedule === schedule.id;

          return (
            <div
              key={schedule.id}
              className="flex flex-col gap-3 p-4 rounded-lg border bg-card"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-md bg-primary/10 text-primary">
                    {info.icon}
                  </div>
                  <div>
                    <h4 className="font-medium">{info.label}</h4>
                    <p className="text-sm text-muted-foreground">{info.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={schedule.enabled}
                    onCheckedChange={(enabled) =>
                      updateScheduleMutation.mutate({ id: schedule.id, updates: { enabled } })
                    }
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => runSync(schedule.sync_type)}
                    disabled={isRunning || runningSync !== null}
                  >
                    {isRunning ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                        Kjører...
                      </>
                    ) : (
                      <>
                        <Play className="h-4 w-4 mr-1" />
                        Kjør nå
                      </>
                    )}
                  </Button>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-4 text-sm">
                {isEditing ? (
                  <div className="flex items-center gap-2">
                    <Label htmlFor={`cron-${schedule.id}`} className="sr-only">
                      Cron-uttrykk
                    </Label>
                    <Input
                      id={`cron-${schedule.id}`}
                      value={editCron}
                      onChange={(e) => setEditCron(e.target.value)}
                      className="w-40 h-8 text-sm"
                      placeholder="0 3 * * *"
                    />
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleSaveEdit(schedule.id)}
                      disabled={updateScheduleMutation.isPending}
                    >
                      Lagre
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setEditingSchedule(null)}
                    >
                      Avbryt
                    </Button>
                  </div>
                ) : (
                  <button
                    className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
                    onClick={() => handleStartEdit(schedule)}
                  >
                    <Clock className="h-3 w-3" />
                    {parseCronToReadable(schedule.cron_expression)}
                  </button>
                )}

                {schedule.last_run_at && (
                  <div className="flex items-center gap-1 text-muted-foreground">
                    {schedule.last_run_status === "completed" ? (
                      <CheckCircle2 className="h-3 w-3 text-green-500" />
                    ) : schedule.last_run_status === "failed" ? (
                      <XCircle className="h-3 w-3 text-destructive" />
                    ) : null}
                    <span>
                      Sist kjørt{" "}
                      {formatDistanceToNow(new Date(schedule.last_run_at), {
                        addSuffix: true,
                        locale: nb,
                      })}
                    </span>
                  </div>
                )}

                {!schedule.enabled && (
                  <Badge variant="secondary">Deaktivert</Badge>
                )}
              </div>

              {schedule.last_run_details && (
                <div className="text-xs text-muted-foreground bg-muted/50 rounded p-2">
                  {Object.entries(schedule.last_run_details as Record<string, unknown>).map(([key, value]) => {
                    if (key === "new_user_names" || key === "deleted_user_names") return null;
                    return (
                      <span key={key} className="mr-3">
                        {key.replace(/_/g, " ")}: <strong>{String(value)}</strong>
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {(!schedules || schedules.length === 0) && (
          <p className="text-center text-muted-foreground py-4">
            Ingen synkroniseringsplaner funnet
          </p>
        )}
      </CardContent>
    </Card>
  );
};
