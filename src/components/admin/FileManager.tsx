import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  Folder,
  File,
  ArrowLeft,
  Save,
  Trash2,
  Edit3,
  X,
  RefreshCw,
  FileText,
  Home,
  ChevronRight,
} from "lucide-react";

interface FileEntry {
  name: string;
  isDirectory: boolean;
  isFile: boolean;
  size: number;
  modified: string | null;
}

async function getGitPullUrl(): Promise<string> {
  const { data } = await supabase
    .from("server_settings")
    .select("setting_key, setting_value")
    .in("setting_key", ["git_pull_server_url", "update_webhook_url"]);

  const url =
    data?.find((s) => s.setting_key === "git_pull_server_url")?.setting_value ||
    data?.find((s) => s.setting_key === "update_webhook_url")?.setting_value ||
    "";

  return url.replace(/\/$/, "");
}

function formatSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

function isTextFile(name: string): boolean {
  const textExtensions = [
    ".txt", ".md", ".json", ".js", ".cjs", ".mjs", ".ts", ".tsx", ".jsx",
    ".css", ".scss", ".html", ".xml", ".yml", ".yaml", ".toml", ".cfg",
    ".conf", ".ini", ".env", ".sh", ".bash", ".sql", ".log", ".csv",
    ".gitignore", ".eslintrc", ".prettierrc", ".editorconfig",
    ".service", ".timer", ".dockerfile", ".py", ".rb", ".go",
  ];
  const basename = name.toLowerCase();
  return textExtensions.some((ext) => basename.endsWith(ext)) || !basename.includes(".");
}

export function FileManager() {
  const queryClient = useQueryClient();
  const [currentPath, setCurrentPath] = useState(".");
  const [editingFile, setEditingFile] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [renamingFile, setRenamingFile] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<{ path: string; name: string; isDir: boolean } | null>(null);

  // Fetch git pull server URL
  const { data: baseUrl } = useQuery({
    queryKey: ["git-pull-url"],
    queryFn: getGitPullUrl,
    staleTime: 60000,
  });

  // List files
  const {
    data: filesData,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["file-list", currentPath, baseUrl],
    queryFn: async () => {
      if (!baseUrl) throw new Error("Server URL not configured");
      const res = await fetch(`${baseUrl}/files/list?path=${encodeURIComponent(currentPath)}`);
      if (!res.ok) throw new Error((await res.json()).error || "Failed to list files");
      return res.json() as Promise<{ success: boolean; path: string; files: FileEntry[] }>;
    },
    enabled: !!baseUrl,
  });

  // Read file
  const readFileMutation = useMutation({
    mutationFn: async (filePath: string) => {
      if (!baseUrl) throw new Error("No server URL");
      const res = await fetch(`${baseUrl}/files/read?path=${encodeURIComponent(filePath)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to read file");
      return data as { success: boolean; path: string; content: string; size: number };
    },
    onSuccess: (data) => {
      setEditingFile(data.path);
      setEditContent(data.content);
    },
    onError: (err: any) => toast.error(err.message),
  });

  // Write file
  const writeFileMutation = useMutation({
    mutationFn: async ({ path, content }: { path: string; content: string }) => {
      if (!baseUrl) throw new Error("No server URL");
      const res = await fetch(`${baseUrl}/files/write`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path, content }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save");
      return data;
    },
    onSuccess: () => {
      toast.success("Fil lagret!");
      setEditingFile(null);
      refetch();
    },
    onError: (err: any) => toast.error(err.message),
  });

  // Rename
  const renameMutation = useMutation({
    mutationFn: async ({ oldPath, newPath }: { oldPath: string; newPath: string }) => {
      if (!baseUrl) throw new Error("No server URL");
      const res = await fetch(`${baseUrl}/files/rename`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ oldPath, newPath }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to rename");
      return data;
    },
    onSuccess: () => {
      toast.success("Omdøpt!");
      setRenamingFile(null);
      refetch();
    },
    onError: (err: any) => toast.error(err.message),
  });

  // Delete
  const deleteMutation = useMutation({
    mutationFn: async (filePath: string) => {
      if (!baseUrl) throw new Error("No server URL");
      const res = await fetch(`${baseUrl}/files/delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: filePath }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete");
      return data;
    },
    onSuccess: () => {
      toast.success("Slettet!");
      setDeleteTarget(null);
      refetch();
    },
    onError: (err: any) => toast.error(err.message),
  });

  const navigateTo = (dirName: string) => {
    if (currentPath === ".") {
      setCurrentPath(dirName);
    } else {
      setCurrentPath(`${currentPath}/${dirName}`);
    }
  };

  const navigateUp = () => {
    if (currentPath === "." || currentPath === "") return;
    const parts = currentPath.split("/");
    parts.pop();
    setCurrentPath(parts.length === 0 ? "." : parts.join("/"));
  };

  const getFilePath = (fileName: string) => {
    return currentPath === "." ? fileName : `${currentPath}/${fileName}`;
  };

  const breadcrumbs = currentPath === "." ? ["root"] : ["root", ...currentPath.split("/")];

  // If editing a file, show the editor
  if (editingFile) {
    return (
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-5 w-5" />
              {editingFile}
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={() => writeFileMutation.mutate({ path: editingFile, content: editContent })}
                disabled={writeFileMutation.isPending}
              >
                <Save className="h-4 w-4 mr-1" />
                {writeFileMutation.isPending ? "Lagrer..." : "Lagre"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEditingFile(null)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            className="font-mono text-sm min-h-[500px] bg-secondary/30"
            spellCheck={false}
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Folder className="h-5 w-5" />
              Filbehandler
            </CardTitle>
            <Button size="sm" variant="ghost" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
          {/* Breadcrumbs */}
          <div className="flex items-center gap-1 text-sm text-muted-foreground flex-wrap">
            {breadcrumbs.map((crumb, i) => (
              <span key={i} className="flex items-center gap-1">
                {i > 0 && <ChevronRight className="h-3 w-3" />}
                <button
                  className="hover:text-foreground transition-colors"
                  onClick={() => {
                    if (i === 0) setCurrentPath(".");
                    else setCurrentPath(breadcrumbs.slice(1, i + 1).join("/"));
                  }}
                >
                  {i === 0 ? <Home className="h-3 w-3 inline" /> : crumb}
                </button>
              </span>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          {!baseUrl && (
            <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg text-sm text-yellow-400">
              ⚠️ Git Pull Server URL er ikke konfigurert. Sett den opp under Servers-fanen.
            </div>
          )}

          {error && (
            <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-sm text-destructive">
              {(error as Error).message}
            </div>
          )}

          {isLoading && <p className="text-muted-foreground text-sm">Laster filer...</p>}

          {filesData?.files && (
            <div className="space-y-1">
              {/* Go up button */}
              {currentPath !== "." && (
                <button
                  onClick={navigateUp}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-secondary/50 transition-colors text-left"
                >
                  <ArrowLeft className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">..</span>
                </button>
              )}

              {filesData.files
                .filter((f) => !f.name.startsWith(".git") || f.name === ".gitignore")
                .filter((f) => f.name !== "node_modules")
                .map((file) => {
                  const filePath = getFilePath(file.name);
                  const isRenaming = renamingFile === filePath;

                  return (
                    <div
                      key={file.name}
                      className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-secondary/50 transition-colors group"
                    >
                      {/* Icon */}
                      {file.isDirectory ? (
                        <Folder className="h-4 w-4 text-primary flex-shrink-0" />
                      ) : (
                        <File className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      )}

                      {/* Name */}
                      {isRenaming ? (
                        <div className="flex items-center gap-2 flex-1">
                          <Input
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            className="h-7 text-sm"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                const dir = currentPath === "." ? "" : currentPath + "/";
                                renameMutation.mutate({ oldPath: filePath, newPath: dir + newName });
                              }
                              if (e.key === "Escape") setRenamingFile(null);
                            }}
                          />
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0"
                            onClick={() => {
                              const dir = currentPath === "." ? "" : currentPath + "/";
                              renameMutation.mutate({ oldPath: filePath, newPath: dir + newName });
                            }}
                          >
                            <Save className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0"
                            onClick={() => setRenamingFile(null)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ) : (
                        <button
                          className="flex-1 text-left text-sm truncate hover:underline"
                          onClick={() => {
                            if (file.isDirectory) {
                              navigateTo(file.name);
                            } else if (isTextFile(file.name)) {
                              readFileMutation.mutate(filePath);
                            }
                          }}
                        >
                          {file.name}
                        </button>
                      )}

                      {/* Size */}
                      {file.isFile && !isRenaming && (
                        <span className="text-xs text-muted-foreground flex-shrink-0">
                          {formatSize(file.size)}
                        </span>
                      )}

                      {/* Actions */}
                      {!isRenaming && (
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {file.isFile && isTextFile(file.name) && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0"
                              onClick={() => readFileMutation.mutate(filePath)}
                              title="Rediger"
                            >
                              <Edit3 className="h-3 w-3" />
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0"
                            onClick={() => {
                              setRenamingFile(filePath);
                              setNewName(file.name);
                            }}
                            title="Gi nytt navn"
                          >
                            <Edit3 className="h-3 w-3 text-blue-400" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0 text-destructive"
                            onClick={() =>
                              setDeleteTarget({ path: filePath, name: file.name, isDir: file.isDirectory })
                            }
                            title="Slett"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}

              {filesData.files.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">Tom mappe</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Slett {deleteTarget?.isDir ? "mappe" : "fil"}?</AlertDialogTitle>
            <AlertDialogDescription>
              Er du sikker på at du vil slette <strong>{deleteTarget?.name}</strong>?
              {deleteTarget?.isDir && " Alle filer i mappen vil bli slettet."}
              {" "}Denne handlingen kan ikke angres.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Avbryt</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.path)}
            >
              {deleteMutation.isPending ? "Sletter..." : "Slett"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
