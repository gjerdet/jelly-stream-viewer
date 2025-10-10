import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Header from "@/components/Header";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Newspaper, Pin } from "lucide-react";
import { format } from "date-fns";
import { nb } from "date-fns/locale";

interface NewsPost {
  id: string;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
  pinned: boolean;
}

const News = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

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

  if (loading || isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-12">
          <p className="text-center text-muted-foreground">Laster...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
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
        </div>
      </div>
    </div>
  );
};

export default News;
