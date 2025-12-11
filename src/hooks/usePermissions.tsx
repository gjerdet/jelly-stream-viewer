import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type AppPermission = 
  | 'admin_panel'
  | 'manage_users'
  | 'manage_settings'
  | 'manage_news'
  | 'view_statistics'
  | 'manage_requests';

export const PERMISSION_LABELS: Record<AppPermission, string> = {
  admin_panel: 'Admin Panel',
  manage_users: 'Administrer brukere',
  manage_settings: 'Administrer innstillinger',
  manage_news: 'Administrer nyheter',
  view_statistics: 'Se statistikk',
  manage_requests: 'Administrer forespørsler',
};

interface UserPermission {
  id: string;
  user_id: string;
  permission: AppPermission;
  granted: boolean;
  granted_by: string | null;
  created_at: string;
}

interface RolePermission {
  id: string;
  role: 'admin' | 'user';
  permission: AppPermission;
  created_at: string;
}

// Hook to check if current user has a specific permission
export const useHasPermission = (permission: AppPermission) => {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ["user-permission", user?.id, permission],
    queryFn: async () => {
      if (!user?.id) return false;
      
      // First check for individual permission override
      const { data: userPerm } = await supabase
        .from("user_permissions")
        .select("granted")
        .eq("user_id", user.id)
        .eq("permission", permission)
        .maybeSingle();
      
      if (userPerm !== null) {
        return userPerm.granted;
      }
      
      // Fall back to role-based permission
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);
      
      if (!roles || roles.length === 0) return false;
      
      const userRoles = roles.map(r => r.role);
      
      const { data: rolePerms } = await supabase
        .from("role_permissions")
        .select("permission")
        .in("role", userRoles)
        .eq("permission", permission);
      
      return (rolePerms && rolePerms.length > 0);
    },
    enabled: !!user?.id,
  });
};

// Hook to get all permissions for a specific user (for admin UI)
export const useUserPermissions = (userId: string | undefined) => {
  return useQuery({
    queryKey: ["user-all-permissions", userId],
    queryFn: async () => {
      if (!userId) return { rolePermissions: [], userPermissions: [], effectivePermissions: {} };
      
      // Get user's role
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);
      
      const userRoles = roles?.map(r => r.role) || [];
      
      // Get role-based permissions
      let rolePerms: RolePermission[] = [];
      if (userRoles.length > 0) {
        const { data } = await supabase
          .from("role_permissions")
          .select("*")
          .in("role", userRoles);
        rolePerms = (data as RolePermission[]) || [];
      }
      
      // Get individual user permissions
      const { data: userPerms } = await supabase
        .from("user_permissions")
        .select("*")
        .eq("user_id", userId);
      
      // Calculate effective permissions
      const allPermissions: AppPermission[] = [
        'admin_panel',
        'manage_users',
        'manage_settings',
        'manage_news',
        'view_statistics',
        'manage_requests'
      ];
      
      const effectivePermissions: Record<AppPermission, { granted: boolean; source: 'role' | 'user' }> = {} as any;
      
      for (const perm of allPermissions) {
        const userOverride = userPerms?.find(up => up.permission === perm);
        const hasRolePerm = rolePerms?.some(rp => rp.permission === perm);
        
        if (userOverride) {
          effectivePermissions[perm] = { granted: userOverride.granted, source: 'user' };
        } else {
          effectivePermissions[perm] = { granted: hasRolePerm || false, source: 'role' };
        }
      }
      
      return {
        rolePermissions: rolePerms || [],
        userPermissions: userPerms || [],
        effectivePermissions,
        userRoles
      };
    },
    enabled: !!userId,
  });
};

// Hook to get all role permissions (for admin UI)
export const useRolePermissions = () => {
  return useQuery({
    queryKey: ["role-permissions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("role_permissions")
        .select("*")
        .order("role");
      
      if (error) throw error;
      return data as RolePermission[];
    },
  });
};

// Mutation to grant/revoke individual user permission
export const useSetUserPermission = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      userId, 
      permission, 
      granted 
    }: { 
      userId: string; 
      permission: AppPermission; 
      granted: boolean | null; // null = remove override (use role default)
    }) => {
      if (granted === null) {
        // Remove the override
        const { error } = await supabase
          .from("user_permissions")
          .delete()
          .eq("user_id", userId)
          .eq("permission", permission);
        
        if (error) throw error;
      } else {
        // Upsert the permission
        const { error } = await supabase
          .from("user_permissions")
          .upsert({
            user_id: userId,
            permission,
            granted,
          }, {
            onConflict: "user_id,permission"
          });
        
        if (error) throw error;
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["user-all-permissions", variables.userId] });
      queryClient.invalidateQueries({ queryKey: ["user-permission"] });
    },
  });
};

// Mutation to update role permissions
export const useSetRolePermission = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      role, 
      permission, 
      granted 
    }: { 
      role: 'admin' | 'user'; 
      permission: AppPermission; 
      granted: boolean;
    }) => {
      if (granted) {
        const { error } = await supabase
          .from("role_permissions")
          .upsert({
            role,
            permission,
          }, {
            onConflict: "role,permission"
          });
        
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("role_permissions")
          .delete()
          .eq("role", role)
          .eq("permission", permission);
        
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["role-permissions"] });
      queryClient.invalidateQueries({ queryKey: ["user-all-permissions"] });
      queryClient.invalidateQueries({ queryKey: ["user-permission"] });
    },
  });
};
