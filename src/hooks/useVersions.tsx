import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface AppVersion {
  id: string;
  version_number: string;
  release_date: string;
  description: string | null;
  changelog: string | null;
  is_current: boolean;
  created_at: string;
}

export const useVersions = () => {
  const queryClient = useQueryClient();

  const { data: versions, isLoading } = useQuery({
    queryKey: ["app-versions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_versions")
        .select("*")
        .order("release_date", { ascending: false });

      if (error) throw error;
      return data as AppVersion[];
    },
  });

  const currentVersion = versions?.find((v) => v.is_current);

  const setCurrentVersion = useMutation({
    mutationFn: async (versionId: string) => {
      // First, set all versions to not current
      await supabase
        .from("app_versions")
        .update({ is_current: false })
        .neq("id", "00000000-0000-0000-0000-000000000000");

      // Then set the selected version as current
      const { error } = await supabase
        .from("app_versions")
        .update({ is_current: true })
        .eq("id", versionId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["app-versions"] });
      toast.success("Versjon oppdatert! Last siden på nytt for å se endringer.");
    },
    onError: () => {
      toast.error("Kunne ikke oppdatere versjon");
    },
  });

  const addVersion = useMutation({
    mutationFn: async (version: Omit<AppVersion, "id" | "created_at" | "release_date">) => {
      const { error } = await supabase
        .from("app_versions")
        .insert(version);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["app-versions"] });
      toast.success("Ny versjon lagt til");
    },
    onError: () => {
      toast.error("Kunne ikke legge til versjon");
    },
  });

  return {
    versions,
    currentVersion,
    isLoading,
    setCurrentVersion: setCurrentVersion.mutate,
    addVersion: addVersion.mutate,
  };
};
