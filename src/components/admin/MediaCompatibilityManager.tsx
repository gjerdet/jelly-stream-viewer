import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  Play, 
  RefreshCw, 
  Film, 
  Tv,
  Search,
  Check,
  X
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { nb } from "date-fns/locale";

type CompatibilityStatus = "compatible" | "needs_transcode" | "unknown" | "error";

interface MediaCompatibilityItem {
  id: string;
  jellyfin_item_id: string;
  jellyfin_item_name: string;
  jellyfin_item_type: string;
  jellyfin_series_name: string | null;
  image_url: string | null;
  video_codec: string | null;
  audio_codec: string | null;
  container: string | null;
  status: CompatibilityStatus;
  transcode_reason: string | null;
  resolved: boolean;
  resolved_at: string | null;
  last_scanned_at: string;
}

interface ScanSchedule {
  id: string;
  enabled: boolean;
  cron_expression: string;
  last_run_at: string | null;
  last_run_status: string | null;
  last_run_items_scanned: number | null;
  last_run_issues_found: number | null;
}

export const MediaCompatibilityManager = () => {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "needs_transcode" | "resolved">("needs_transcode");
  const [cronExpression, setCronExpression] = useState("0 3 * * *");

  // Fetch scan schedule
  const { data: scanSchedule, error: scheduleError, isLoading: scheduleLoading } = useQuery({
    queryKey: ["scan-schedule"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("scan_schedule")
        .select("*")
        .limit(1)
        .maybeSingle();
      
      if (error) throw error;
      return data as ScanSchedule | null;
    },
  });

  // Fetch compatibility issues
  const { data: compatibilityItems, isLoading } = useQuery({
    queryKey: ["media-compatibility", filterStatus, searchTerm],
    queryFn: async () => {
      let query = supabase
        .from("media_compatibility")
        .select("*")
        .order("last_scanned_at", { ascending: false });

      if (filterStatus === "needs_transcode") {
        query = query.eq("status", "needs_transcode").eq("resolved", false);
      } else if (filterStatus === "resolved") {
        query = query.eq("resolved", true);
      }

      if (searchTerm) {
        query = query.or(`jellyfin_item_name.ilike.%${searchTerm}%,jellyfin_series_name.ilike.%${searchTerm}%`);
      }

      const { data, error } = await query.limit(100);
      
      if (error) throw error;
      return data as MediaCompatibilityItem[];
    },
  });

  // Count stats
  const { data: stats } = useQuery({
    queryKey: ["media-compatibility-stats"],
    queryFn: async () => {
      const [totalResult, issuesResult, resolvedResult] = await Promise.all([
        supabase.from("media_compatibility").select("id", { count: "exact", head: true }),
        supabase.from("media_compatibility").select("id", { count: "exact", head: true }).eq("status", "needs_transcode").eq("resolved", false),
        supabase.from("media_compatibility").select("id", { count: "exact", head: true }).eq("resolved", true),
      ]);
      
      return {
        total: totalResult.count || 0,
        issues: issuesResult.count || 0,
        resolved: resolvedResult.count || 0,
      };
    },
  });

  // Run scan mutation
  const runScan = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("scan-media-compatibility");
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      toast.success(`Skanning fullført! ${data.itemsScanned} elementer skannet, ${data.issuesFound} problemer funnet.`);
      queryClient.invalidateQueries({ queryKey: ["media-compatibility"] });
      queryClient.invalidateQueries({ queryKey: ["media-compatibility-stats"] });
      queryClient.invalidateQueries({ queryKey: ["scan-schedule"] });
    },
    onError: (error) => {
      toast.error(`Skanning feilet: ${error.message}`);
    },
  });

  // Mark as resolved
  const markResolved = useMutation({
    mutationFn: async (itemId: string) => {
      const { error } = await supabase
        .from("media_compatibility")
        .update({ 
          resolved: true, 
          resolved_at: new Date().toISOString() 
        })
        .eq("id", itemId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Markert som løst");
      queryClient.invalidateQueries({ queryKey: ["media-compatibility"] });
      queryClient.invalidateQueries({ queryKey: ["media-compatibility-stats"] });
    },
  });

  // Unresolve item
  const unresolve = useMutation({
    mutationFn: async (itemId: string) => {
      const { error } = await supabase
        .from("media_compatibility")
        .update({ 
          resolved: false, 
          resolved_at: null 
        })
        .eq("id", itemId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Markering fjernet");
      queryClient.invalidateQueries({ queryKey: ["media-compatibility"] });
      queryClient.invalidateQueries({ queryKey: ["media-compatibility-stats"] });
    },
  });

  // Update schedule
  const updateSchedule = useMutation({
    mutationFn: async ({ enabled, cron }: { enabled: boolean; cron: string }) => {
      const { error } = await supabase
        .from("scan_schedule")
        .update({ 
          enabled, 
          cron_expression: cron,
        })
        .eq("id", scanSchedule?.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Tidsplan oppdatert");
      queryClient.invalidateQueries({ queryKey: ["scan-schedule"] });
    },
  });

  const getStatusIcon = (status: CompatibilityStatus, resolved: boolean) => {
    if (resolved) return <CheckCircle className="h-4 w-4 text-green-500" />;
    switch (status) {
      case "compatible":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "needs_transcode":
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: CompatibilityStatus, resolved: boolean) => {
    if (resolved) {
      return <Badge variant="outline" className="border-green-500 text-green-500">Løst</Badge>;
    }
    switch (status) {
      case "compatible":
        return <Badge variant="outline" className="border-green-500 text-green-500">Kompatibel</Badge>;
      case "needs_transcode":
        return <Badge variant="outline" className="border-yellow-500 text-yellow-500">Trenger omkoding</Badge>;
      default:
        return <Badge variant="outline">Ukjent</Badge>;
    }
  };

  // Show error state if queries fail
  if (scheduleError) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-8">
            <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h3 className="font-semibold text-lg mb-2">Kunne ikke laste kompatibilitetsseksjonen</h3>
            <p className="text-muted-foreground text-sm">
              Sjekk at databasen er riktig satt opp og at tabellene eksisterer.
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              Feil: {scheduleError.message}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Totalt skannet</p>
                <p className="text-2xl font-bold">{stats?.total || 0}</p>
              </div>
              <Film className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Trenger omkoding</p>
                <p className="text-2xl font-bold text-yellow-500">{stats?.issues || 0}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Løst</p>
                <p className="text-2xl font-bold text-green-500">{stats?.resolved || 0}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col gap-2">
              <p className="text-sm text-muted-foreground">Siste skanning</p>
              <p className="text-sm font-medium">
                {scanSchedule?.last_run_at 
                  ? format(new Date(scanSchedule.last_run_at), "d. MMM yyyy HH:mm", { locale: nb })
                  : "Aldri kjørt"
                }
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Scan Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            Kompatibilitetsskanning
          </CardTitle>
          <CardDescription>
            Skann biblioteket for å finne media som trenger omkoding
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="flex-1 min-w-[200px]">
              <Label htmlFor="cron">Cron-uttrykk (tidsplan)</Label>
              <Input 
                id="cron"
                value={cronExpression}
                onChange={(e) => setCronExpression(e.target.value)}
                placeholder="0 3 * * *"
                className="bg-secondary/50"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Eksempel: "0 3 * * *" = kl. 03:00 hver dag
              </p>
            </div>
            <Button 
              variant="outline"
              onClick={() => updateSchedule.mutate({ 
                enabled: !scanSchedule?.enabled, 
                cron: cronExpression 
              })}
              disabled={updateSchedule.isPending}
            >
              {scanSchedule?.enabled ? "Deaktiver tidsplan" : "Aktiver tidsplan"}
            </Button>
            <Button 
              onClick={() => runScan.mutate()}
              disabled={runScan.isPending}
              className="gap-2"
            >
              {runScan.isPending ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Skanner...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4" />
                  Kjør nå
                </>
              )}
            </Button>
          </div>
          
          {scanSchedule?.last_run_items_scanned !== null && (
            <p className="text-sm text-muted-foreground">
              Siste kjøring: {scanSchedule.last_run_items_scanned} elementer skannet, 
              {scanSchedule.last_run_issues_found} problemer funnet
            </p>
          )}
        </CardContent>
      </Card>

      {/* Issues List */}
      <Card>
        <CardHeader>
          <CardTitle>Media med problemer</CardTitle>
          <CardDescription>
            Filer som trenger omkoding for optimal avspilling
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Filters */}
            <div className="flex flex-wrap gap-4 items-center">
              <div className="flex-1 min-w-[200px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input 
                    placeholder="Søk etter tittel..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 bg-secondary/50"
                  />
                </div>
              </div>
              <Tabs value={filterStatus} onValueChange={(v) => setFilterStatus(v as typeof filterStatus)}>
                <TabsList>
                  <TabsTrigger value="needs_transcode">Uløst ({stats?.issues || 0})</TabsTrigger>
                  <TabsTrigger value="resolved">Løst ({stats?.resolved || 0})</TabsTrigger>
                  <TabsTrigger value="all">Alle</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            {/* List */}
            <ScrollArea className="h-[500px]">
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : !compatibilityItems?.length ? (
                <div className="text-center py-8 text-muted-foreground">
                  {filterStatus === "needs_transcode" 
                    ? "Ingen uløste problemer funnet" 
                    : "Ingen elementer funnet"
                  }
                </div>
              ) : (
                <div className="space-y-2">
                  {compatibilityItems.map((item) => (
                    <div 
                      key={item.id}
                      className="flex items-center gap-4 p-3 rounded-lg border border-border/50 hover:bg-secondary/30 transition-colors"
                    >
                      {/* Thumbnail */}
                      <div className="flex-shrink-0 w-16 h-24 bg-secondary rounded overflow-hidden">
                        {item.image_url ? (
                          <img 
                            src={item.image_url} 
                            alt={item.jellyfin_item_name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            {item.jellyfin_item_type === "Episode" ? (
                              <Tv className="h-6 w-6 text-muted-foreground" />
                            ) : (
                              <Film className="h-6 w-6 text-muted-foreground" />
                            )}
                          </div>
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(item.status, item.resolved)}
                          <h4 className="font-medium truncate">{item.jellyfin_item_name}</h4>
                        </div>
                        {item.jellyfin_series_name && (
                          <p className="text-sm text-muted-foreground truncate">
                            {item.jellyfin_series_name}
                          </p>
                        )}
                        <div className="flex flex-wrap gap-2 mt-1">
                          {getStatusBadge(item.status, item.resolved)}
                          {item.video_codec && (
                            <Badge variant="secondary" className="text-xs">
                              Video: {item.video_codec}
                            </Badge>
                          )}
                          {item.audio_codec && (
                            <Badge variant="secondary" className="text-xs">
                              Lyd: {item.audio_codec}
                            </Badge>
                          )}
                        </div>
                        {item.transcode_reason && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {item.transcode_reason}
                          </p>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex-shrink-0">
                        {item.resolved ? (
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => unresolve.mutate(item.id)}
                            disabled={unresolve.isPending}
                          >
                            <X className="h-4 w-4 mr-1" />
                            Angre
                          </Button>
                        ) : (
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => markResolved.mutate(item.id)}
                            disabled={markResolved.isPending}
                          >
                            <Check className="h-4 w-4 mr-1" />
                            Løst
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
