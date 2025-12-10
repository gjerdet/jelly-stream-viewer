import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  AlertCircle, 
  CheckCircle, 
  Clock, 
  Film, 
  Tv,
  MessageSquare,
  Volume2,
  VideoOff,
  Subtitles,
  FileQuestion,
  HelpCircle,
  Loader2,
  RefreshCw,
  Trash2,
  Play,
  ExternalLink
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { nb } from "date-fns/locale";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

type ReportCategory = "buffering" | "no_audio" | "no_video" | "subtitle_issues" | "wrong_file" | "quality_issues" | "other";

interface MediaReport {
  id: string;
  user_id: string;
  jellyfin_item_id: string;
  jellyfin_item_name: string;
  jellyfin_item_type: string;
  jellyfin_series_name: string | null;
  image_url: string | null;
  category: ReportCategory;
  status: string;
  admin_notes: string | null;
  resolved_at: string | null;
  created_at: string;
}

const CATEGORY_CONFIG: Record<ReportCategory, { label: string; icon: React.ElementType; color: string }> = {
  buffering: { label: "Buffering", icon: Loader2, color: "text-orange-500" },
  no_audio: { label: "Ingen lyd", icon: Volume2, color: "text-red-500" },
  no_video: { label: "Ingen bilde", icon: VideoOff, color: "text-red-500" },
  subtitle_issues: { label: "Undertekstproblemer", icon: Subtitles, color: "text-yellow-500" },
  wrong_file: { label: "Feil fil", icon: FileQuestion, color: "text-purple-500" },
  quality_issues: { label: "Kvalitetsproblemer", icon: AlertCircle, color: "text-blue-500" },
  other: { label: "Annet", icon: HelpCircle, color: "text-gray-500" },
};

export const MediaReportsManager = () => {
  const queryClient = useQueryClient();
  const [filterStatus, setFilterStatus] = useState<"pending" | "resolved" | "all">("pending");
  const [selectedReport, setSelectedReport] = useState<MediaReport | null>(null);
  const [adminNotes, setAdminNotes] = useState("");

  // Fetch reports
  const { data: reports, isLoading } = useQuery({
    queryKey: ["media-reports-admin", filterStatus],
    queryFn: async () => {
      let query = supabase
        .from("media_reports")
        .select("*")
        .order("created_at", { ascending: false });

      if (filterStatus === "pending") {
        query = query.eq("status", "pending");
      } else if (filterStatus === "resolved") {
        query = query.eq("status", "resolved");
      }

      const { data, error } = await query.limit(100);
      
      if (error) throw error;
      return data as MediaReport[];
    },
  });

  // Count stats
  const { data: stats } = useQuery({
    queryKey: ["media-reports-stats"],
    queryFn: async () => {
      const [pendingResult, resolvedResult] = await Promise.all([
        supabase.from("media_reports").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("media_reports").select("id", { count: "exact", head: true }).eq("status", "resolved"),
      ]);
      
      return {
        pending: pendingResult.count || 0,
        resolved: resolvedResult.count || 0,
      };
    },
  });

  // Resolve report
  const resolveReport = useMutation({
    mutationFn: async ({ reportId, notes }: { reportId: string; notes: string }) => {
      const { error } = await supabase
        .from("media_reports")
        .update({ 
          status: "resolved",
          resolved_at: new Date().toISOString(),
          admin_notes: notes || null,
        })
        .eq("id", reportId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Rapport markert som løst");
      queryClient.invalidateQueries({ queryKey: ["media-reports"] });
      queryClient.invalidateQueries({ queryKey: ["media-reports-stats"] });
      setSelectedReport(null);
      setAdminNotes("");
    },
  });

  // Delete report
  const deleteReport = useMutation({
    mutationFn: async (reportId: string) => {
      const { error } = await supabase
        .from("media_reports")
        .delete()
        .eq("id", reportId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Rapport slettet");
      queryClient.invalidateQueries({ queryKey: ["media-reports"] });
      queryClient.invalidateQueries({ queryKey: ["media-reports-stats"] });
    },
  });

  const getCategoryIcon = (category: ReportCategory) => {
    const config = CATEGORY_CONFIG[category];
    const Icon = config.icon;
    return <Icon className={`h-4 w-4 ${config.color}`} />;
  };

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Ventende rapporter</p>
                <p className="text-2xl font-bold text-yellow-500">{stats?.pending || 0}</p>
              </div>
              <Clock className="h-8 w-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Løste rapporter</p>
                <p className="text-2xl font-bold text-green-500">{stats?.resolved || 0}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Reports List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Brukerrapporter
          </CardTitle>
          <CardDescription>
            Problemer rapportert av brukere
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Filter */}
            <Tabs value={filterStatus} onValueChange={(v) => setFilterStatus(v as typeof filterStatus)}>
              <TabsList>
                <TabsTrigger value="pending">Ventende ({stats?.pending || 0})</TabsTrigger>
                <TabsTrigger value="resolved">Løst ({stats?.resolved || 0})</TabsTrigger>
                <TabsTrigger value="all">Alle</TabsTrigger>
              </TabsList>
            </Tabs>

            {/* List */}
            <ScrollArea className="h-[500px]">
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : !reports?.length ? (
                <div className="text-center py-8 text-muted-foreground">
                  {filterStatus === "pending" 
                    ? "Ingen ventende rapporter" 
                    : "Ingen rapporter funnet"
                  }
                </div>
              ) : (
                <div className="space-y-2">
                  {reports.map((report) => (
                    <div 
                      key={report.id}
                      className="flex items-center gap-4 p-3 rounded-lg border border-border/50 hover:bg-secondary/30 transition-colors"
                    >
                      {/* Thumbnail */}
                      <div className="flex-shrink-0 w-12 h-18 bg-secondary rounded overflow-hidden">
                        {report.image_url ? (
                          <img 
                            src={report.image_url} 
                            alt={report.jellyfin_item_name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            {report.jellyfin_item_type === "Episode" ? (
                              <Tv className="h-5 w-5 text-muted-foreground" />
                            ) : (
                              <Film className="h-5 w-5 text-muted-foreground" />
                            )}
                          </div>
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          {getCategoryIcon(report.category)}
                          <h4 className="font-medium truncate">{report.jellyfin_item_name}</h4>
                        </div>
                        {report.jellyfin_series_name && (
                          <p className="text-sm text-muted-foreground truncate">
                            {report.jellyfin_series_name}
                          </p>
                        )}
                        <div className="flex flex-wrap gap-2 mt-1">
                          <Badge variant="secondary">
                            {CATEGORY_CONFIG[report.category].label}
                          </Badge>
                          <Badge 
                            variant={report.status === "pending" ? "outline" : "default"}
                            className={report.status === "resolved" ? "bg-green-500/20 text-green-500" : ""}
                          >
                            {report.status === "pending" ? "Ventende" : "Løst"}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Rapportert: {format(new Date(report.created_at), "d. MMM yyyy HH:mm", { locale: nb })}
                        </p>
                      </div>

                      {/* Actions */}
                      <div className="flex-shrink-0 flex gap-2">
                        <Button 
                          variant="secondary" 
                          size="sm"
                          asChild
                        >
                          <Link to={`/player/${report.jellyfin_item_id}`} target="_blank">
                            <Play className="h-4 w-4 mr-1" />
                            Spill av
                            <ExternalLink className="h-3 w-3 ml-1" />
                          </Link>
                        </Button>
                        {report.status === "pending" && (
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => {
                              setSelectedReport(report);
                              setAdminNotes(report.admin_notes || "");
                            }}
                          >
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Løs
                          </Button>
                        )}
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => deleteReport.mutate(report.id)}
                          disabled={deleteReport.isPending}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        </CardContent>
      </Card>

      {/* Resolve Dialog */}
      <Dialog open={!!selectedReport} onOpenChange={(open) => !open && setSelectedReport(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Løs rapport</DialogTitle>
            <DialogDescription>
              {selectedReport?.jellyfin_item_name}
              {selectedReport?.jellyfin_series_name && ` - ${selectedReport.jellyfin_series_name}`}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="flex items-center gap-2">
              {selectedReport && getCategoryIcon(selectedReport.category)}
              <span className="font-medium">
                {selectedReport && CATEGORY_CONFIG[selectedReport.category].label}
              </span>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Admin-notater (valgfritt)</label>
              <Textarea 
                placeholder="Beskriv hva som ble gjort for å løse problemet..."
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                className="min-h-[100px]"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedReport(null)}>
              Avbryt
            </Button>
            <Button 
              onClick={() => selectedReport && resolveReport.mutate({ 
                reportId: selectedReport.id, 
                notes: adminNotes 
              })}
              disabled={resolveReport.isPending}
            >
              {resolveReport.isPending ? "Lagrer..." : "Merk som løst"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
