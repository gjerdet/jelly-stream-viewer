import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Copy, CheckCircle, XCircle, Clock, Loader2, MessageSquare, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { nb } from "date-fns/locale";

interface DuplicateReport {
  id: string;
  user_id: string;
  jellyfin_item_id: string;
  jellyfin_item_name: string;
  jellyfin_item_type: string;
  jellyfin_series_name: string | null;
  image_url: string | null;
  description: string | null;
  status: string;
  admin_notes: string | null;
  created_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
}

export const DuplicateReportsManager = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedReport, setSelectedReport] = useState<string | null>(null);
  const [adminNotes, setAdminNotes] = useState("");

  const { data: reports, isLoading } = useQuery({
    queryKey: ["duplicate-reports"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("duplicate_reports")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as DuplicateReport[];
    },
  });

  const { data: profiles } = useQuery({
    queryKey: ["profiles-map"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, jellyfin_username, email");

      if (error) throw error;
      return data.reduce((acc, profile) => {
        acc[profile.id] = profile.jellyfin_username || profile.email;
        return acc;
      }, {} as Record<string, string>);
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status, notes }: { id: string; status: string; notes?: string }) => {
      const updateData: any = {
        status,
        updated_at: new Date().toISOString(),
      };

      if (status === "resolved" || status === "rejected") {
        updateData.resolved_at = new Date().toISOString();
        updateData.resolved_by = user?.id;
      }

      if (notes !== undefined) {
        updateData.admin_notes = notes;
      }

      const { error } = await supabase
        .from("duplicate_reports")
        .update(updateData)
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Rapport oppdatert");
      queryClient.invalidateQueries({ queryKey: ["duplicate-reports"] });
      setSelectedReport(null);
      setAdminNotes("");
    },
    onError: () => {
      toast.error("Kunne ikke oppdatere rapport");
    },
  });

  const deleteReport = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("duplicate_reports")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Rapport slettet");
      queryClient.invalidateQueries({ queryKey: ["duplicate-reports"] });
    },
    onError: () => {
      toast.error("Kunne ikke slette rapport");
    },
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="outline" className="border-yellow-500 text-yellow-500"><Clock className="h-3 w-3 mr-1" />Venter</Badge>;
      case "in_progress":
        return <Badge variant="outline" className="border-blue-500 text-blue-500"><Loader2 className="h-3 w-3 mr-1" />Under behandling</Badge>;
      case "resolved":
        return <Badge variant="outline" className="border-green-500 text-green-500"><CheckCircle className="h-3 w-3 mr-1" />Løst</Badge>;
      case "rejected":
        return <Badge variant="outline" className="border-red-500 text-red-500"><XCircle className="h-3 w-3 mr-1" />Avvist</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const pendingCount = reports?.filter(r => r.status === "pending").length || 0;

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Copy className="h-5 w-5" />
          Brukerrapporterte duplikater
          {pendingCount > 0 && (
            <Badge variant="destructive" className="ml-2">
              {pendingCount} nye
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          Duplikater rapportert av brukere som ikke ble fanget opp automatisk
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!reports || reports.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">
            Ingen duplikatrapporter ennå
          </p>
        ) : (
          <ScrollArea className="h-[500px] pr-4">
            <div className="space-y-4">
              {reports.map((report) => (
                <div
                  key={report.id}
                  className="border rounded-lg p-4 space-y-3"
                >
                  <div className="flex items-start gap-4">
                    {report.image_url && (
                      <img
                        src={report.image_url}
                        alt={report.jellyfin_item_name}
                        className="w-16 h-24 object-cover rounded"
                      />
                    )}
                    <div className="flex-1 space-y-2">
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-medium">
                            {report.jellyfin_series_name && (
                              <span className="text-muted-foreground">{report.jellyfin_series_name} - </span>
                            )}
                            {report.jellyfin_item_name}
                          </h4>
                          <p className="text-sm text-muted-foreground">
                            {report.jellyfin_item_type === "Movie" ? "Film" : 
                             report.jellyfin_item_type === "Episode" ? "Episode" : report.jellyfin_item_type}
                          </p>
                        </div>
                        {getStatusBadge(report.status)}
                      </div>

                      <div className="text-sm text-muted-foreground">
                        <span>Rapportert av: </span>
                        <span className="font-medium text-foreground">
                          {profiles?.[report.user_id] || "Ukjent bruker"}
                        </span>
                        <span className="mx-2">•</span>
                        <span>
                          {format(new Date(report.created_at), "d. MMM yyyy HH:mm", { locale: nb })}
                        </span>
                      </div>

                      {report.description && (
                        <div className="bg-secondary/50 rounded p-2 text-sm">
                          <MessageSquare className="h-3 w-3 inline mr-1" />
                          {report.description}
                        </div>
                      )}

                      {report.admin_notes && (
                        <div className="bg-primary/10 rounded p-2 text-sm">
                          <span className="font-medium">Admin-notat: </span>
                          {report.admin_notes}
                        </div>
                      )}
                    </div>
                  </div>

                  {selectedReport === report.id ? (
                    <div className="space-y-2 pt-2 border-t">
                      <Textarea
                        placeholder="Legg til admin-notat (valgfritt)..."
                        value={adminNotes}
                        onChange={(e) => setAdminNotes(e.target.value)}
                        className="min-h-[60px]"
                      />
                      <div className="flex gap-2 flex-wrap">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedReport(null);
                            setAdminNotes("");
                          }}
                        >
                          Avbryt
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => updateStatus.mutate({ 
                            id: report.id, 
                            status: "in_progress",
                            notes: adminNotes || undefined
                          })}
                          disabled={updateStatus.isPending}
                        >
                          Under behandling
                        </Button>
                        <Button
                          size="sm"
                          variant="default"
                          className="bg-green-600 hover:bg-green-700"
                          onClick={() => updateStatus.mutate({ 
                            id: report.id, 
                            status: "resolved",
                            notes: adminNotes || undefined
                          })}
                          disabled={updateStatus.isPending}
                        >
                          <CheckCircle className="h-4 w-4 mr-1" />
                          Merk som løst
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => updateStatus.mutate({ 
                            id: report.id, 
                            status: "rejected",
                            notes: adminNotes || undefined
                          })}
                          disabled={updateStatus.isPending}
                        >
                          <XCircle className="h-4 w-4 mr-1" />
                          Avvis
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-2 pt-2 border-t">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelectedReport(report.id);
                          setAdminNotes(report.admin_notes || "");
                        }}
                      >
                        Behandle
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        onClick={() => deleteReport.mutate(report.id)}
                        disabled={deleteReport.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
};
