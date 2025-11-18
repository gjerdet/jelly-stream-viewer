import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { useLanguage } from "@/contexts/LanguageContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Newspaper, Pin, MessageSquare, Send, Clock, CheckCircle, XCircle, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { nb, enUS } from "date-fns/locale";
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
  const { data: role } = useUserRole(user?.id);
  const { t, language } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [feedbackTitle, setFeedbackTitle] = useState("");
  const [feedbackDescription, setFeedbackDescription] = useState("");
  const [errors, setErrors] = useState<{ title?: string; description?: string }>({});

  const isAdmin = role === "admin";
  const dateLocale = language === 'en' ? enUS : nb;
  const news = t.news as any;
  const common = t.common as any;

  // Dynamiske oversettelser for zod
  const feedbackSchema = z.object({
    title: z.string().trim().min(3, news.titleMin as string).max(200, news.titleMax as string),
    description: z.string().trim().min(10, news.descMin as string).max(2000, news.descMax as string),
  });

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
        title: news.feedbackSent,
        description: news.feedbackThanks,
      });
    },
    onError: (error) => {
      toast({
        title: common.error,
        description: news.feedbackError,
        variant: "destructive",
      });
    },
  });

  const updateFeedbackStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from("user_feedback")
        .update({ status })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-feedbacks"] });
      toast({
        title: news.statusUpdated,
        description: news.statusUpdateDesc,
      });
    },
    onError: () => {
      toast({
        title: common.error,
        description: news.statusUpdateError,
        variant: "destructive",
      });
    },
  });

  const deleteFeedbackMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("user_feedback")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-feedbacks"] });
      toast({
        title: news.deleted,
        description: news.deletedDesc,
      });
    },
    onError: () => {
      toast({
        title: common.error,
        description: news.deleteError,
        variant: "destructive",
      });
    },
  });

  const handleSubmitFeedback = () => {
    setErrors({});
    const parseResult = feedbackSchema.safeParse({
      title: feedbackTitle,
      description: feedbackDescription,
    });
    
    if (!parseResult.success) {
      const fieldErrors: { title?: string; description?: string } = {};
      parseResult.error.errors.forEach((err) => {
        if (err.path[0] === "title") fieldErrors.title = err.message;
        if (err.path[0] === "description") fieldErrors.description = err.message;
      });
      setErrors(fieldErrors);
      return;
    }
    
    createFeedbackMutation.mutate(parseResult.data as { title: string; description: string });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="secondary" className="gap-1"><Clock className="h-3 w-3" />{news.statusPending}</Badge>;
      case "in_progress":
        return <Badge variant="default" className="gap-1 bg-blue-600"><MessageSquare className="h-3 w-3" />{news.statusInProgress}</Badge>;
      case "completed":
        return <Badge variant="default" className="gap-1 bg-green-600"><CheckCircle className="h-3 w-3" />{news.statusCompleted}</Badge>;
      case "rejected":
        return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" />{news.statusRejected}</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  if (loading || isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-12">
          <p className="text-center text-muted-foreground">{common.loading}</p>
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
              <h1 className="text-3xl font-bold">{news.title}</h1>
              <p className="text-muted-foreground">{news.subtitle}</p>
            </div>
          </div>

          <Tabs defaultValue="news" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="news">{news.tabNews}</TabsTrigger>
              <TabsTrigger value="feedback">{news.tabFeedback}</TabsTrigger>
            </TabsList>

            <TabsContent value="news" className="mt-6">
              {!posts || posts.length === 0 ? (
                <Card className="border-border/50">
                  <CardContent className="py-12 text-center">
                    <Newspaper className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-lg text-muted-foreground">{news.noNews}</p>
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
                            {format(new Date(post.created_at), "d. MMMM yyyy", { locale: dateLocale })}
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
                      {news.addFeedback}
                    </CardTitle>
                    <CardDescription>
                      {news.addFeedbackDesc}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Input
                        placeholder={news.feedbackTitle}
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
                        placeholder={news.feedbackDescription}
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
                        {feedbackDescription.length}/2000 {news.characters}
                      </p>
                    </div>
                    <Button
                      onClick={handleSubmitFeedback}
                      disabled={createFeedbackMutation.isPending || !feedbackTitle || !feedbackDescription}
                      className="w-full"
                    >
                      <Send className="h-4 w-4 mr-2" />
                      {createFeedbackMutation.isPending ? news.feedbackSending : news.feedbackSend}
                    </Button>
                  </CardContent>
                </Card>

                {/* Display feedbacks */}
                {isLoadingFeedbacks ? (
                  <p className="text-center text-muted-foreground">{news.loadingFeedback}</p>
                ) : !feedbacks || feedbacks.length === 0 ? (
                  <Card className="border-border/50">
                    <CardContent className="py-12 text-center">
                      <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <p className="text-lg text-muted-foreground">{news.noFeedback}</p>
                      <p className="text-sm text-muted-foreground mt-2">{news.beFirstFeedback}</p>
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
                            <div className="flex items-center gap-2">
                              {isAdmin && (
                                <>
                                  <Select
                                    value={feedback.status}
                                    onValueChange={(value) =>
                                      updateFeedbackStatusMutation.mutate({ id: feedback.id, status: value })
                                    }
                                  >
                                    <SelectTrigger className="w-[140px] h-8">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="pending">
                                        <div className="flex items-center gap-2">
                                          <Clock className="h-3 w-3" />
                                          {news.statusPending}
                                        </div>
                                      </SelectItem>
                                      <SelectItem value="in_progress">
                                        <div className="flex items-center gap-2">
                                          <MessageSquare className="h-3 w-3" />
                                          {news.statusInProgress}
                                        </div>
                                      </SelectItem>
                                      <SelectItem value="completed">
                                        <div className="flex items-center gap-2">
                                          <CheckCircle className="h-3 w-3" />
                                          {news.statusCompleted}
                                        </div>
                                      </SelectItem>
                                      <SelectItem value="rejected">
                                        <div className="flex items-center gap-2">
                                          <XCircle className="h-3 w-3" />
                                          {news.statusRejected}
                                        </div>
                                      </SelectItem>
                                    </SelectContent>
                                  </Select>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                    onClick={() => {
                                      if (confirm(news.deleteConfirm)) {
                                        deleteFeedbackMutation.mutate(feedback.id);
                                      }
                                    }}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </>
                              )}
                              {!isAdmin && (
                                <div className="flex flex-col items-end gap-2">
                                  {getStatusBadge(feedback.status)}
                                </div>
                              )}
                              <time className="text-xs text-muted-foreground whitespace-nowrap">
                                {format(new Date(feedback.created_at), "d. MMM yyyy", { locale: dateLocale })}
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
