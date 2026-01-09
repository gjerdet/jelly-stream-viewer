import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Trash2, Pin, Loader2, Edit, Save, X, Bold, Italic, List, Link } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/hooks/useAuth";

interface NewsManagementSectionProps {
  userRole?: string | null;
}

export const NewsManagementSection = ({ userRole }: NewsManagementSectionProps) => {
  const { t, language } = useLanguage();
  const admin = t.admin as any;
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const [newPostTitle, setNewPostTitle] = useState("");
  const [newPostContent, setNewPostContent] = useState("");
  const [editingPost, setEditingPost] = useState<string | null>(null);
  const [editPostTitle, setEditPostTitle] = useState("");
  const [editPostContent, setEditPostContent] = useState("");

  const { data: newsPosts } = useQuery({
    queryKey: ["admin-news-posts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("news_posts")
        .select("*")
        .order("pinned", { ascending: false })
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: userRole === "admin",
  });

  const createNewsPost = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not authenticated");
      
      const { error } = await supabase
        .from("news_posts")
        .insert({
          title: newPostTitle.trim(),
          content: newPostContent.trim(),
          created_by: user.id,
          published: true,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-news-posts"] });
      queryClient.invalidateQueries({ queryKey: ["news-posts"] });
      setNewPostTitle("");
      setNewPostContent("");
      toast.success("Nyhet publisert!");
    },
    onError: () => {
      toast.error("Kunne ikke publisere nyhet");
    },
  });

  const deleteNewsPost = useMutation({
    mutationFn: async (postId: string) => {
      const { error } = await supabase
        .from("news_posts")
        .delete()
        .eq("id", postId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-news-posts"] });
      queryClient.invalidateQueries({ queryKey: ["news-posts"] });
      toast.success("Nyhet slettet");
    },
    onError: () => {
      toast.error("Kunne ikke slette nyhet");
    },
  });

  const togglePin = useMutation({
    mutationFn: async ({ postId, currentPinned }: { postId: string; currentPinned: boolean }) => {
      const { error } = await supabase
        .from("news_posts")
        .update({ pinned: !currentPinned })
        .eq("id", postId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-news-posts"] });
      queryClient.invalidateQueries({ queryKey: ["news-posts"] });
      toast.success("Nyhet oppdatert");
    },
    onError: () => {
      toast.error("Kunne ikke oppdatere nyhet");
    },
  });

  const updateNewsPost = useMutation({
    mutationFn: async ({ postId, title, content }: { postId: string; title: string; content: string }) => {
      const { error } = await supabase
        .from("news_posts")
        .update({ title, content, updated_at: new Date().toISOString() })
        .eq("id", postId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-news-posts"] });
      queryClient.invalidateQueries({ queryKey: ["news-posts"] });
      setEditingPost(null);
      setEditPostTitle("");
      setEditPostContent("");
      toast.success("Nyhet oppdatert!");
    },
    onError: () => {
      toast.error("Kunne ikke oppdatere nyhet");
    },
  });

  const startEditingPost = (post: { id: string; title: string; content: string }) => {
    setEditingPost(post.id);
    setEditPostTitle(post.title);
    setEditPostContent(post.content);
  };

  const cancelEditing = () => {
    setEditingPost(null);
    setEditPostTitle("");
    setEditPostContent("");
  };

  const saveEditedPost = () => {
    if (editingPost && editPostTitle.trim() && editPostContent.trim()) {
      updateNewsPost.mutate({
        postId: editingPost,
        title: editPostTitle.trim(),
        content: editPostContent.trim(),
      });
    }
  };

  const handleCreatePost = () => {
    if (newPostTitle.trim() && newPostContent.trim()) {
      createNewsPost.mutate();
    }
  };

  const insertFormatting = (textareaId: string, format: string, content: string, setContent: (val: string) => void) => {
    const textarea = document.getElementById(textareaId) as HTMLTextAreaElement;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const selectedText = content.substring(start, end);
      let newContent = '';
      
      switch (format) {
        case 'bold':
          newContent = content.substring(0, start) + `**${selectedText}**` + content.substring(end);
          break;
        case 'italic':
          newContent = content.substring(0, start) + `*${selectedText}*` + content.substring(end);
          break;
        case 'list':
          newContent = content.substring(0, start) + `\n• ` + content.substring(start);
          break;
        case 'link':
          newContent = content.substring(0, start) + `[${selectedText || 'lenketekst'}](https://example.com)` + content.substring(end);
          break;
        default:
          newContent = content.substring(0, start) + format + ' ' + content.substring(start);
      }
      
      setContent(newContent);
    }
  };

  const FormattingToolbar = ({ textareaId, content, setContent }: { textareaId: string; content: string; setContent: (val: string) => void }) => (
    <div className="flex flex-wrap gap-1 p-2 bg-secondary/30 rounded-t-md border border-border/50 border-b-0">
      <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => insertFormatting(textareaId, 'bold', content, setContent)} title="Fet tekst">
        <Bold className="h-4 w-4" />
      </Button>
      <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => insertFormatting(textareaId, 'italic', content, setContent)} title="Kursiv tekst">
        <Italic className="h-4 w-4" />
      </Button>
      <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => insertFormatting(textareaId, 'list', content, setContent)} title="Punktliste">
        <List className="h-4 w-4" />
      </Button>
      <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => insertFormatting(textareaId, 'link', content, setContent)} title="Lenke">
        <Link className="h-4 w-4" />
      </Button>
      <div className="border-l border-border mx-1 h-6 self-center" />
      {['✅', '⚠️', '🎬', '📺', '🔧', '🚀', '❌', '💡'].map((emoji) => (
        <Button key={emoji} type="button" variant="ghost" size="sm" className="h-8 px-2 text-base" onClick={() => insertFormatting(textareaId, emoji, content, setContent)}>
          {emoji}
        </Button>
      ))}
    </div>
  );

  return (
    <div className="space-y-6">
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle>{admin.createNewPost || "Create New Post"}</CardTitle>
          <CardDescription>
            {admin.newPostDescription || "Add a new post that is visible to all users"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="post-title">{admin.postTitleLabel || "Title"}</Label>
            <Input
              id="post-title"
              type="text"
              placeholder={admin.titlePlaceholder || "Post title..."}
              value={newPostTitle}
              onChange={(e) => setNewPostTitle(e.target.value)}
              className="bg-secondary/50 border-border/50"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="post-content">{admin.postContentLabel || "Content"}</Label>
            <FormattingToolbar textareaId="post-content" content={newPostContent} setContent={setNewPostContent} />
            <Textarea
              id="post-content"
              placeholder={admin.contentPlaceholder || "Write the content..."}
              value={newPostContent}
              onChange={(e) => setNewPostContent(e.target.value)}
              className="bg-secondary/50 border-border/50 min-h-[200px] rounded-t-none"
            />
            <p className="text-xs text-muted-foreground">
              Tips: Bruk **tekst** for fet, *tekst* for kursiv. Emojis vises som de er.
            </p>
          </div>
          <Button 
            onClick={handleCreatePost}
            disabled={createNewsPost.isPending || !newPostTitle.trim() || !newPostContent.trim()}
            className="cinema-glow"
          >
            {createNewsPost.isPending ? (admin.publishing || "Publishing...") : (admin.publishPost || "Publish Post")}
          </Button>
        </CardContent>
      </Card>

      <Card className="border-border/50">
        <CardHeader>
          <CardTitle>{admin.existingPosts || "Existing Posts"}</CardTitle>
          <CardDescription>
            {admin.existingPostsDescription || "Manage and delete published posts"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!newsPosts || newsPosts.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">{admin.noPosts || "No posts yet"}</p>
          ) : (
            <div className="space-y-4">
              {newsPosts.map((post) => (
                <div key={post.id} className="p-4 border border-border rounded-lg space-y-2">
                  {editingPost === post.id ? (
                    <div className="space-y-3">
                      <Input
                        value={editPostTitle}
                        onChange={(e) => setEditPostTitle(e.target.value)}
                        placeholder={admin.titlePlaceholder || "Title..."}
                        className="bg-secondary/50 border-border/50"
                      />
                      <FormattingToolbar textareaId="edit-post-content" content={editPostContent} setContent={setEditPostContent} />
                      <Textarea
                        id="edit-post-content"
                        value={editPostContent}
                        onChange={(e) => setEditPostContent(e.target.value)}
                        placeholder={admin.contentPlaceholder || "Write the content..."}
                        className="bg-secondary/50 border-border/50 min-h-[200px] rounded-t-none"
                      />
                      <div className="flex gap-2 justify-end">
                        <Button variant="ghost" size="sm" onClick={cancelEditing} disabled={updateNewsPost.isPending}>
                          <X className="h-4 w-4 mr-1" />
                          {language === 'no' ? 'Avbryt' : 'Cancel'}
                        </Button>
                        <Button size="sm" onClick={saveEditedPost} disabled={updateNewsPost.isPending || !editPostTitle.trim() || !editPostContent.trim()} className="cinema-glow">
                          {updateNewsPost.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
                          {language === 'no' ? 'Lagre' : 'Save'}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold">{post.title}</h3>
                          {post.pinned && (
                            <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded">
                              {admin.pinned || "Pinned"}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2">{post.content}</p>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="icon" onClick={() => startEditingPost(post)} title="Rediger">
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => togglePin.mutate({ postId: post.id, currentPinned: !!post.pinned })}
                          disabled={togglePin.isPending}
                          title={post.pinned ? (admin.unpinFromTop || "Unpin from top") : (admin.pinToTop || "Pin to top")}
                        >
                          <Pin className={`h-4 w-4 ${post.pinned ? 'text-primary' : ''}`} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteNewsPost.mutate(post.id)}
                          disabled={deleteNewsPost.isPending}
                          title={admin.delete || "Delete"}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
