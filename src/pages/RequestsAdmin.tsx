import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Film, Tv, Check, X, Clock, User, Calendar } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface JellyseerrRequest {
  id: string;
  user_id: string;
  media_type: 'movie' | 'tv';
  media_id: number;
  seasons: any;
  status: 'pending' | 'approved' | 'rejected';
  media_title: string;
  media_poster?: string;
  media_overview?: string;
  created_at: string;
  approved_at?: string;
  approved_by?: string;
  rejection_reason?: string;
  userEmail?: string;
}

const RequestsAdmin = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { data: role, isLoading: roleLoading } = useUserRole(user?.id);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/");
    }
    if (!roleLoading && role !== "admin") {
      navigate("/");
    }
  }, [user, role, authLoading, roleLoading, navigate]);

  const { data: requests, isLoading } = useQuery({
    queryKey: ['jellyseerr-requests'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('jellyseerr_requests')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch user profiles separately
      const userIds = [...new Set(data.map(r => r.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, email')
        .in('id', userIds);

      // Map emails to requests
      const profileMap = new Map(profiles?.map(p => [p.id, p.email]) || []);
      const requestsWithEmails = data.map(req => ({
        ...req,
        userEmail: profileMap.get(req.user_id) || 'Ukjent bruker'
      }));

      return requestsWithEmails as JellyseerrRequest[];
    },
    enabled: !!user && role === 'admin',
  });

  const approveMutation = useMutation({
    mutationFn: async (requestId: string) => {
      const request = requests?.find(r => r.id === requestId);
      if (!request) throw new Error("Forespørsel ikke funnet");

      // Send to Jellyseerr
      const { data, error } = await supabase.functions.invoke("jellyseerr-request", {
        body: {
          mediaType: request.media_type,
          mediaId: request.media_id,
          seasons: request.seasons ? JSON.parse(request.seasons) : undefined,
        },
      });

      if (error) throw error;

      // Update request status
      const { error: updateError } = await supabase
        .from('jellyseerr_requests')
        .update({
          status: 'approved',
          approved_at: new Date().toISOString(),
          approved_by: user?.id,
        })
        .eq('id', requestId);

      if (updateError) throw updateError;

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jellyseerr-requests'] });
      toast.success("Forespørsel godkjent og sendt til Jellyseerr!");
    },
    onError: (error: any) => {
      console.error('Approve error:', error);
      toast.error(error.message || "Kunne ikke godkjenne forespørsel");
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (requestId: string) => {
      const { error } = await supabase
        .from('jellyseerr_requests')
        .update({
          status: 'rejected',
          approved_at: new Date().toISOString(),
          approved_by: user?.id,
        })
        .eq('id', requestId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jellyseerr-requests'] });
      toast.success("Forespørsel avvist");
    },
    onError: (error: any) => {
      console.error('Reject error:', error);
      toast.error("Kunne ikke avvise forespørsel");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (requestId: string) => {
      const { error } = await supabase
        .from('jellyseerr_requests')
        .delete()
        .eq('id', requestId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jellyseerr-requests'] });
      toast.success("Forespørsel slettet");
    },
    onError: (error: any) => {
      console.error('Delete error:', error);
      toast.error("Kunne ikke slette forespørsel");
    },
  });

  if (authLoading || roleLoading || isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const pendingRequests = requests?.filter(r => r.status === 'pending') || [];
  const approvedRequests = requests?.filter(r => r.status === 'approved') || [];
  const rejectedRequests = requests?.filter(r => r.status === 'rejected') || [];

  const renderRequest = (request: JellyseerrRequest, showActions = true) => (
    <Card key={request.id} className="overflow-hidden">
      <CardContent className="p-0">
        <div className="flex gap-4 p-4">
          <div className="w-24 h-36 flex-shrink-0 rounded-lg overflow-hidden bg-secondary">
            {request.media_poster ? (
              <img
                src={request.media_poster}
                alt={request.media_title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                {request.media_type === 'movie' ? (
                  <Film className="h-8 w-8 text-muted-foreground" />
                ) : (
                  <Tv className="h-8 w-8 text-muted-foreground" />
                )}
              </div>
            )}
          </div>

          <div className="flex-1">
            <div className="flex items-start justify-between gap-4 mb-2">
              <div>
                <h3 className="text-lg font-semibold mb-1">{request.media_title}</h3>
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                  <span className="flex items-center gap-1">
                    {request.media_type === 'movie' ? (
                      <><Film className="h-4 w-4" /> Film</>
                    ) : (
                      <><Tv className="h-4 w-4" /> Serie</>
                    )}
                  </span>
                  <span className="flex items-center gap-1">
                    <User className="h-4 w-4" />
                    {request.userEmail}
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    {new Date(request.created_at).toLocaleDateString('nb-NO')}
                  </span>
                </div>
              </div>

              {request.status === 'pending' && (
                <Badge variant="outline" className="border-yellow-500 text-yellow-500">
                  <Clock className="h-3 w-3 mr-1" />
                  Venter
                </Badge>
              )}
              {request.status === 'approved' && (
                <Badge variant="outline" className="border-green-500 text-green-500">
                  <Check className="h-3 w-3 mr-1" />
                  Godkjent
                </Badge>
              )}
              {request.status === 'rejected' && (
                <Badge variant="outline" className="border-red-500 text-red-500">
                  <X className="h-3 w-3 mr-1" />
                  Avvist
                </Badge>
              )}
            </div>

            {request.media_overview && (
              <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                {request.media_overview}
              </p>
            )}

            {showActions && request.status === 'pending' && (
              <div className="flex gap-2">
                <Button
                  onClick={() => approveMutation.mutate(request.id)}
                  disabled={approveMutation.isPending}
                  size="sm"
                  className="gap-2"
                >
                  <Check className="h-4 w-4" />
                  Godkjenn
                </Button>
                <Button
                  onClick={() => rejectMutation.mutate(request.id)}
                  disabled={rejectMutation.isPending}
                  size="sm"
                  variant="destructive"
                  className="gap-2"
                >
                  <X className="h-4 w-4" />
                  Avvis
                </Button>
              </div>
            )}

            {request.status !== 'pending' && (
              <Button
                onClick={() => deleteMutation.mutate(request.id)}
                disabled={deleteMutation.isPending}
                size="sm"
                variant="outline"
                className="gap-2"
              >
                <X className="h-4 w-4" />
                Slett
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-6xl mx-auto">
          <div className="mb-8">
            <h1 className="text-4xl font-bold mb-2">Forespørsler</h1>
            <p className="text-muted-foreground">
              Administrer brukerforespørsler for innhold
            </p>
          </div>

          <Tabs defaultValue="pending" className="w-full">
            <TabsList className="grid w-full max-w-md mb-8 grid-cols-3">
              <TabsTrigger value="pending">
                Ventende ({pendingRequests.length})
              </TabsTrigger>
              <TabsTrigger value="approved">
                Godkjent ({approvedRequests.length})
              </TabsTrigger>
              <TabsTrigger value="rejected">
                Avvist ({rejectedRequests.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="pending">
              {pendingRequests.length === 0 ? (
                <Alert>
                  <AlertDescription>
                    Ingen ventende forespørsler
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="space-y-4">
                  {pendingRequests.map(request => renderRequest(request))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="approved">
              {approvedRequests.length === 0 ? (
                <Alert>
                  <AlertDescription>
                    Ingen godkjente forespørsler
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="space-y-4">
                  {approvedRequests.map(request => renderRequest(request, false))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="rejected">
              {rejectedRequests.length === 0 ? (
                <Alert>
                  <AlertDescription>
                    Ingen avviste forespørsler
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="space-y-4">
                  {rejectedRequests.map(request => renderRequest(request, false))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default RequestsAdmin;
