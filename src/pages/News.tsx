import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Newspaper, Pin, MessageSquare, Send, Clock, CheckCircle, XCircle } from "lucide-react";
import { format } from "date-fns";
import { nb } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";

interface NewsPost {
  id: string;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
  pinned: boolean;
}

interface Feedback {
  id: string;
  user_id: string;
  title: string;
  description: string;
  status: string;
  created_at: string;
  updated_at: string;
}

const feedbackSchema = z.object({
  title: z.string().trim().min(3, "Tittel må være minst 3 tegn").max(200, "Tittel kan ikke være lengre enn 200 tegn"),
  description: z.string().trim().min(10, "Beskrivelse må være minst 10 tegn").max(2000, "Beskrivelse kan ikke være lengre enn 2000 tegn"),
});

const News = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [feedbackTitle, setFeedbackTitle] = useState("");
  const [feedbackDescription, setFeedbackDescription] = useState("");
  const [errors, setErrors] = useState<{ title?: string; description?: string }>({});

  useEffect(() => {
    if (!loading && !user) {
      navigate("/");
    }
  }, [user, loading, navigate]);

  const { data: posts, isLoading } = useQuery({
    queryKey: ["news-posts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("news_posts")
        .select("*")
        .eq("published", true)
        .order("pinned", { ascending: false })
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as NewsPost[];
    },
    enabled: !!user,
  });

  const { data: feedbacks, isLoading: isLoadingFeedbacks } = useQuery({
    queryKey: ["user-feedbacks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_feedback")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Feedback[];
    },
    enabled: !!user,
  });

  const createFeedbackMutation = useMutation({
    mutationFn: async (feedback: { title: string; description: string }) => {
      if (!user) throw new Error("Ikke logget inn");

      const { data, error } = await supabase
        .from("user_feedback")
        .insert({
          user_id: user.id,
          title: feedback.title,
          description: feedback.description,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-feedbacks"] });
      setFeedbackTitle("");
      setFeedbackDescription("");
      setErrors({});
      toast({
        title: "Tilbakemelding sendt",
        description: "Takk for din tilbakemelding!",
      });
    },
    onError: (error) => {
      toast({
        title: "Feil",
        description: "Kunne ikke sende tilbakemelding. Prøv igjen.",
        variant: "destructive",
      });
    },
  });

  const handleSubmitFeedback = () => {
    try {
      setErrors({});
      const validated = feedbackSchema.parse({
        title: feedbackTitle,
        description: feedbackDescription,
      });
      createFeedbackMutation.mutate(validated);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const fieldErrors: { title?: string; description?: string } = {};
        error.errors.forEach((err) => {
          if (err.path[0] === "title") fieldErrors.title = err.message;
          if (err.path[0] === "description") fieldErrors.description = err.message;
        });
        setErrors(fieldErrors);
      }
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="secondary" className="gap-1"><Clock className="h-3 w-3" />Venter</Badge>;
      case "in_progress":
        return <Badge variant="default" className="gap-1 bg-blue-600"><MessageSquare className="h-3 w-3" />Pågår</Badge>;
      case "completed":
        return <Badge variant="default" className="gap-1 bg-green-600"><CheckCircle className="h-3 w-3" />Fullført</Badge>;
      case "rejected":
        return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" />Avvist</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  if (loading || isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-12">
          <p className="text-center text-muted-foreground">Laster...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-4 mb-8">
            <div className="p-3 rounded-xl bg-primary/10">
              <Newspaper className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Info & Nyheter</h1>
              <p className="text-muted-foreground">Siste oppdateringer og informasjon</p>
            </div>
          </div>

          <Tabs defaultValue="news" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="news">Nyheter</TabsTrigger>
              <TabsTrigger value="feedback">Tilbakemeldinger</TabsTrigger>
            </TabsList>

            <TabsContent value="news" className="mt-6">
              {!posts || posts.length === 0 ? (
                <Card className="border-border/50">
                  <CardContent className="py-12 text-center">
                    <Newspaper className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-lg text-muted-foreground">Ingen nyheter ennå</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-6">
                  {posts.map((post) => (
                    <Card key={post.id} className={`border-border/50 ${post.pinned ? 'border-primary/50 bg-primary/5' : ''}`}>
                      <CardHeader>
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              {post.pinned && (
                                <Pin className="h-4 w-4 text-primary fill-current" />
                              )}
                              <CardTitle className="text-2xl">{post.title}</CardTitle>
                            </div>
                          </div>
                          <time className="text-sm text-muted-foreground whitespace-nowrap">
                            {format(new Date(post.created_at), "d. MMMM yyyy", { locale: nb })}
                          </time>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="prose prose-invert max-w-none">
                          <p className="whitespace-pre-wrap">{post.content}</p>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="feedback" className="mt-6">
              <div className="space-y-6">
                {/* Add new feedback form */}
                <Card className="border-border/50">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <MessageSquare className="h-5 w-5" />
                      Legg inn forbedringsforslag
                    </CardTitle>
                    <CardDescription>
                      Del dine tanker om hva som kan forbedres
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Input
                        placeholder="Tittel på forslag"
                        value={feedbackTitle}
                        onChange={(e) => setFeedbackTitle(e.target.value)}
                        maxLength={200}
                        className={errors.title ? "border-destructive" : ""}
                      />
                      {errors.title && (
                        <p className="text-sm text-destructive">{errors.title}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Textarea
                        placeholder="Beskriv forslaget ditt..."
                        value={feedbackDescription}
                        onChange={(e) => setFeedbackDescription(e.target.value)}
                        rows={4}
                        maxLength={2000}
                        className={errors.description ? "border-destructive" : ""}
                      />
                      {errors.description && (
                        <p className="text-sm text-destructive">{errors.description}</p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {feedbackDescription.length}/2000 tegn
                      </p>
                    </div>
                    <Button
                      onClick={handleSubmitFeedback}
                      disabled={createFeedbackMutation.isPending || !feedbackTitle || !feedbackDescription}
                      className="w-full"
                    >
                      <Send className="h-4 w-4 mr-2" />
                      {createFeedbackMutation.isPending ? "Sender..." : "Send tilbakemelding"}
                    </Button>
                  </CardContent>
                </Card>

                {/* Display feedbacks */}
                {isLoadingFeedbacks ? (
                  <p className="text-center text-muted-foreground">Laster tilbakemeldinger...</p>
                ) : !feedbacks || feedbacks.length === 0 ? (
                  <Card className="border-border/50">
                    <CardContent className="py-12 text-center">
                      <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <p className="text-lg text-muted-foreground">Ingen tilbakemeldinger ennå</p>
                      <p className="text-sm text-muted-foreground mt-2">Vær den første til å dele dine forslag!</p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-4">
                    {feedbacks.map((feedback) => (
                      <Card key={feedback.id} className="border-border/50">
                        <CardHeader>
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <CardTitle className="text-xl">{feedback.title}</CardTitle>
                            </div>
                            <div className="flex flex-col items-end gap-2">
                              {getStatusBadge(feedback.status)}
                              <time className="text-xs text-muted-foreground whitespace-nowrap">
                                {format(new Date(feedback.created_at), "d. MMM yyyy", { locale: nb })}
                              </time>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <p className="text-muted-foreground whitespace-pre-wrap">{feedback.description}</p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default News;
