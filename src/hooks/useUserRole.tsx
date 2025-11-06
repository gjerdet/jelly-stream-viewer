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
        .eq("user_id", userId);

      if (error) throw error;
      
      // If user has multiple roles, prioritize admin over user
      if (!data || data.length === 0) return "user";
      
      const roles = data.map(r => r.role);
      if (roles.includes("admin")) return "admin";
      return "user";
    },
    enabled: !!userId,
  });
};
