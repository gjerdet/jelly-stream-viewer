import { useState, useEffect } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Zap, 
  Clock, 
  CheckCircle, 
  XCircle, 
  Loader2,
  Film,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  FileVideo,
  HardDrive,
  Trash2,
  StopCircle
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { nb } from "date-fns/locale";
import { toast } from "sonner";

interface LogEntry {
  timestamp: string;
  message: string;
  level: string;
}

interface TranscodeJob {
  id: string;
  jellyfin_item_id: string;
  jellyfin_item_name: string;
  file_path: string | null;
  output_format: string;
  status: string;
  progress: number;
  started_at: string | null;
  completed_at: string | null;
  error: string | null;
  logs: LogEntry[] | null;
  created_at: string;
  updated_at: string;
}

export const TranscodeJobsDashboard = () => {
  const queryClient = useQueryClient();
  const [expandedJob, setExpandedJob] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"active" | "completed" | "failed">("active");

  // Fetch jobs
  const { data: jobs, isLoading } = useQuery({
    queryKey: ["transcode-jobs", activeTab],
    queryFn: async () => {
      let query = supabase
        .from("transcode_jobs")
        .select("*")
        .order("created_at", { ascending: false });

      if (activeTab === "active") {
        query = query.in("status", ["pending", "processing"]);
      } else if (activeTab === "completed") {
        query = query.eq("status", "completed");
      } else if (activeTab === "failed") {
        query = query.eq("status", "failed");
      }

      const { data, error } = await query.limit(50);
      if (error) throw error;
      // Cast logs from Json to LogEntry[]
      return (data || []).map(job => ({
        ...job,
        logs: (job.logs as unknown) as LogEntry[] | null
      })) as TranscodeJob[];
    },
    refetchInterval: activeTab === "active" ? 3000 : false, // Poll active jobs every 3s
  });

  // Real-time subscription for job updates
  useEffect(() => {
    const channel = supabase
      .channel('transcode-jobs-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'transcode_jobs'
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["transcode-jobs"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // Count stats
  const { data: stats } = useQuery({
    queryKey: ["transcode-jobs-stats"],
    queryFn: async () => {
      const [activeResult, completedResult, failedResult] = await Promise.all([
        supabase.from("transcode_jobs").select("id", { count: "exact", head: true }).in("status", ["pending", "processing"]),
        supabase.from("transcode_jobs").select("id", { count: "exact", head: true }).eq("status", "completed"),
        supabase.from("transcode_jobs").select("id", { count: "exact", head: true }).eq("status", "failed"),
      ]);
      
      return {
        active: activeResult.count || 0,
        completed: completedResult.count || 0,
        failed: failedResult.count || 0,
      };
    },
    refetchInterval: 10000,
  });

  // Delete job mutation
  const deleteJobMutation = useMutation({
    mutationFn: async (jobId: string) => {
      const { error } = await supabase
        .from("transcode_jobs")
        .delete()
        .eq("id", jobId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transcode-jobs"] });
      queryClient.invalidateQueries({ queryKey: ["transcode-jobs-stats"] });
      toast.success("Jobb slettet");
    },
    onError: (error: Error) => {
      toast.error(`Kunne ikke slette jobb: ${error.message}`);
    },
  });

  // Cancel job mutation (set status to failed)
  const cancelJobMutation = useMutation({
    mutationFn: async (jobId: string) => {
      const { error } = await supabase
        .from("transcode_jobs")
        .update({ 
          status: "failed", 
          error: "Avbrutt av bruker",
          completed_at: new Date().toISOString()
        })
        .eq("id", jobId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transcode-jobs"] });
      queryClient.invalidateQueries({ queryKey: ["transcode-jobs-stats"] });
      toast.success("Jobb avbrutt");
    },
    onError: (error: Error) => {
      toast.error(`Kunne ikke avbryte jobb: ${error.message}`);
    },
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pending":
        return <Clock className="h-4 w-4 text-muted-foreground" />;
      case "processing":
        return <Loader2 className="h-4 w-4 text-primary animate-spin" />;
      case "completed":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "failed":
        return <XCircle className="h-4 w-4 text-destructive" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="secondary">Venter</Badge>;
      case "processing":
        return <Badge className="bg-primary">Kjører</Badge>;
      case "completed":
        return <Badge className="bg-green-500">Fullført</Badge>;
      case "failed":
        return <Badge variant="destructive">Feilet</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getOutputFormatInfo = (format: string) => {
    switch (format) {
      case "hevc":
      case "h265":
        return {
          name: "H.265/HEVC",
          encoder: "x265",
          container: "MKV",
          quality: "CRF 22",
          preset: "medium",
          description: "Moderne codec med god komprimering. Ca. 50% mindre filstørrelse enn H.264 med samme kvalitet."
        };
      case "h264":
        return {
          name: "H.264/AVC",
          encoder: "x264",
          container: "MP4",
          quality: "CRF 20",
          preset: "medium",
          description: "Bred kompatibilitet. Støttes av nesten alle enheter."
        };
      default:
        return {
          name: format.toUpperCase(),
          encoder: "ukjent",
          container: "ukjent",
          quality: "ukjent",
          preset: "ukjent",
          description: ""
        };
    }
  };

  const formatDuration = (startedAt: string | null, completedAt: string | null) => {
    if (!startedAt) return "-";
    const start = new Date(startedAt);
    const end = completedAt ? new Date(completedAt) : new Date();
    const diffMs = end.getTime() - start.getTime();
    const hours = Math.floor(diffMs / 3600000);
    const minutes = Math.floor((diffMs % 3600000) / 60000);
    const seconds = Math.floor((diffMs % 60000) / 1000);
    
    if (hours > 0) return `${hours}t ${minutes}m ${seconds}s`;
    if (minutes > 0) return `${minutes}m ${seconds}s`;
    return `${seconds}s`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Zap className="h-6 w-6 text-primary" />
            Omkodingsjobber
          </h2>
          <p className="text-muted-foreground">
            Overvåk pågående og fullførte omkodinger
          </p>
        </div>
        <Button 
          variant="outline" 
          size="sm"
          onClick={() => queryClient.invalidateQueries({ queryKey: ["transcode-jobs"] })}
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Oppdater
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Aktive</p>
                <p className="text-2xl font-bold text-primary">{stats?.active || 0}</p>
              </div>
              <Loader2 className={`h-8 w-8 text-primary ${stats?.active ? 'animate-spin' : ''}`} />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Fullført</p>
                <p className="text-2xl font-bold text-green-500">{stats?.completed || 0}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Feilet</p>
                <p className="text-2xl font-bold text-destructive">{stats?.failed || 0}</p>
              </div>
              <XCircle className="h-8 w-8 text-destructive" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Jobs List */}
      <Card>
        <CardHeader>
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
            <TabsList>
              <TabsTrigger value="active">
                Aktive ({stats?.active || 0})
              </TabsTrigger>
              <TabsTrigger value="completed">
                Fullført ({stats?.completed || 0})
              </TabsTrigger>
              <TabsTrigger value="failed">
                Feilet ({stats?.failed || 0})
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[600px]">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : !jobs?.length ? (
              <div className="text-center py-8 text-muted-foreground">
                <Film className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Ingen {activeTab === "active" ? "aktive" : activeTab === "completed" ? "fullførte" : "feilede"} jobber</p>
              </div>
            ) : (
              <div className="space-y-4">
                {jobs.map((job) => {
                  const isExpanded = expandedJob === job.id;
                  const formatInfo = getOutputFormatInfo(job.output_format);
                  
                  return (
                    <div 
                      key={job.id}
                      className="border border-border rounded-lg overflow-hidden"
                    >
                      {/* Job Header */}
                      <div 
                        className="p-4 bg-secondary/30 cursor-pointer hover:bg-secondary/50 transition-colors"
                        onClick={() => setExpandedJob(isExpanded ? null : job.id)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            {getStatusIcon(job.status)}
                            <div>
                              <h4 className="font-medium">{job.jellyfin_item_name}</h4>
                              <p className="text-xs text-muted-foreground">
                                {format(new Date(job.created_at), "d. MMM yyyy HH:mm", { locale: nb })}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            {getStatusBadge(job.status)}
                            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </div>
                        </div>

                        {/* Progress bar for active jobs */}
                        {(job.status === "processing" || job.status === "pending") && (
                          <div className="mt-3">
                            <div className="flex items-center justify-between text-sm mb-1">
                              <span className="text-muted-foreground">Fremgang</span>
                              <span className="font-medium">{job.progress}%</span>
                            </div>
                            <Progress value={job.progress} className="h-2" />
                          </div>
                        )}
                      </div>

                      {/* Expanded Details */}
                      {isExpanded && (
                        <div className="p-4 space-y-4 border-t border-border">
                          {/* Technical Info */}
                          <div>
                            <h5 className="font-medium mb-2 flex items-center gap-2">
                              <FileVideo className="h-4 w-4" />
                              Teknisk informasjon
                            </h5>
                            <div className="grid grid-cols-2 gap-4 bg-secondary/20 rounded-lg p-3">
                              <div>
                                <p className="text-xs text-muted-foreground">Output format</p>
                                <p className="font-medium">{formatInfo.name}</p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Encoder</p>
                                <p className="font-medium">{formatInfo.encoder}</p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Container</p>
                                <p className="font-medium">{formatInfo.container}</p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Kvalitet</p>
                                <p className="font-medium">{formatInfo.quality}</p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Preset</p>
                                <p className="font-medium">{formatInfo.preset}</p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Varighet</p>
                                <p className="font-medium">{formatDuration(job.started_at, job.completed_at)}</p>
                              </div>
                            </div>
                            {formatInfo.description && (
                              <p className="text-xs text-muted-foreground mt-2">
                                ℹ️ {formatInfo.description}
                              </p>
                            )}
                          </div>

                          {/* File Path */}
                          {job.file_path && (
                            <div>
                              <h5 className="font-medium mb-2 flex items-center gap-2">
                                <HardDrive className="h-4 w-4" />
                                Filsti
                              </h5>
                              <code className="text-xs bg-secondary/50 p-2 rounded block overflow-x-auto">
                                {job.file_path}
                              </code>
                            </div>
                          )}

                          {/* Error */}
                          {job.error && (
                            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
                              <h5 className="font-medium text-destructive mb-1">Feil</h5>
                              <p className="text-sm text-destructive">{job.error}</p>
                            </div>
                          )}

                          {/* Logs */}
                          {job.logs && job.logs.length > 0 && (
                            <div>
                              <h5 className="font-medium mb-2">Logger</h5>
                              <ScrollArea className="h-[200px] bg-secondary/20 rounded-lg p-3">
                                <div className="space-y-1 font-mono text-xs">
                                  {job.logs.map((log, i) => (
                                    <div 
                                      key={i} 
                                      className={`${
                                        log.level === 'error' ? 'text-destructive' : 
                                        log.level === 'success' ? 'text-green-500' : 
                                        'text-muted-foreground'
                                      }`}
                                    >
                                      <span className="opacity-50">
                                        {format(new Date(log.timestamp), "HH:mm:ss")}
                                      </span>{" "}
                                      {log.message}
                                    </div>
                                  ))}
                                </div>
                              </ScrollArea>
                            </div>
                          )}

                          {/* Timestamps */}
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <p className="text-muted-foreground">Opprettet</p>
                              <p>{format(new Date(job.created_at), "d. MMM yyyy HH:mm:ss", { locale: nb })}</p>
                            </div>
                            {job.started_at && (
                              <div>
                                <p className="text-muted-foreground">Startet</p>
                                <p>{format(new Date(job.started_at), "d. MMM yyyy HH:mm:ss", { locale: nb })}</p>
                              </div>
                            )}
                            {job.completed_at && (
                              <div>
                                <p className="text-muted-foreground">Fullført</p>
                                <p>{format(new Date(job.completed_at), "d. MMM yyyy HH:mm:ss", { locale: nb })}</p>
                              </div>
                            )}
                          </div>

                          {/* Action Buttons */}
                          <div className="flex gap-2 pt-2 border-t border-border">
                            {(job.status === "pending" || job.status === "processing") && (
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  cancelJobMutation.mutate(job.id);
                                }}
                                disabled={cancelJobMutation.isPending}
                              >
                                {cancelJobMutation.isPending ? (
                                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                ) : (
                                  <StopCircle className="h-4 w-4 mr-2" />
                                )}
                                Avbryt jobb
                              </Button>
                            )}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteJobMutation.mutate(job.id);
                              }}
                              disabled={deleteJobMutation.isPending}
                              className="text-destructive hover:text-destructive"
                            >
                              {deleteJobMutation.isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                              ) : (
                                <Trash2 className="h-4 w-4 mr-2" />
                              )}
                              Slett jobb
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
};
