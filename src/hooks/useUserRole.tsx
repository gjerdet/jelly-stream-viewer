import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const useUserRole = (userId: string | undefined) => {
  return useQuery({
    queryKey: ["user-role", userId],
    queryFn: async () => {
      if (!userId) return null;

      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .maybeSingle();

      if (error) throw error;
      return data?.role || "user";
    },
    enabled: !!userId,
  });
};
