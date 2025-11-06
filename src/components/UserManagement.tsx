import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Users, Shield, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { nb } from "date-fns/locale";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

interface UserWithRoles {
  id: string;
  email: string;
  created_at: string;
  roles: AppRole[];
}

export const UserManagement = () => {

  // Fetch all users with their roles
  const { data: users, isLoading } = useQuery({
    queryKey: ["all-users"],
    queryFn: async () => {
      // Get profiles with email
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, email, created_at");

      if (profilesError) throw profilesError;

      // Get roles for all users
      const { data: rolesData, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id, role");

      if (rolesError) throw rolesError;

      // Combine data
      const usersWithRoles: UserWithRoles[] = profiles?.map(profile => {
        const userRoles = rolesData?.filter(r => r.user_id === profile.id).map(r => r.role) || [];
        
        return {
          id: profile.id,
          email: profile.email,
          created_at: profile.created_at || new Date().toISOString(),
          roles: userRoles,
        };
      }) || [];

      return usersWithRoles.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    },
  });

  const getRoleBadgeVariant = (role: AppRole) => {
    switch (role) {
      case "admin":
        return "default" as const;
      default:
        return "outline" as const;
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Brukerbehandling
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Brukerbehandling
        </CardTitle>
        <CardDescription>
          Administrer brukere og deres roller i systemet
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <p>Totalt {users?.length || 0} registrerte brukere</p>
          </div>

          <div className="space-y-3">
            {users?.map((user) => (
              <div
                key={user.id}
                className="p-4 border rounded-lg bg-card hover:bg-accent/5 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-medium truncate">{user.email}</p>
                      {user.roles.length === 0 && (
                        <Badge variant="outline" className="text-xs">Ingen rolle</Badge>
                      )}
                    </div>
                    
                    <div className="flex flex-wrap gap-2 mb-2">
                      {user.roles.map((role) => (
                        <Badge
                          key={role}
                          variant={getRoleBadgeVariant(role)}
                          className="text-xs"
                        >
                          <Shield className="h-3 w-3 mr-1" />
                          {role === "admin" ? "Administrator" : "Bruker"}
                        </Badge>
                      ))}
                    </div>

                    <div className="text-xs text-muted-foreground space-y-1">
                      <p>
                        Registrert: {format(new Date(user.created_at), "d. MMM yyyy 'kl.' HH:mm", { locale: nb })}
                      </p>
                      <p className="font-mono text-[10px] text-muted-foreground/70">
                        ID: {user.id}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {users?.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Ingen brukere registrert ennå</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
