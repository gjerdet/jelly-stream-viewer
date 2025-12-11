import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, Shield, Loader2, RefreshCw, Settings2, UserCog } from "lucide-react";
import { format } from "date-fns";
import { nb, enUS } from "date-fns/locale";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import { UserPermissionsDialog } from "@/components/UserPermissionsDialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface UserWithRole {
  id: string;
  email: string;
  jellyfin_username: string | null;
  created_at: string | null;
  role: 'admin' | 'user' | null;
}

export const UserAccessManagement = () => {
  const { language } = useLanguage();
  const locale = language === 'no' ? nb : enUS;
  const queryClient = useQueryClient();
  const [selectedUser, setSelectedUser] = useState<{ id: string; name: string } | null>(null);

  // Fetch all users with their roles
  const { data: users, isLoading, refetch } = useQuery({
    queryKey: ["admin-users-with-roles"],
    queryFn: async () => {
      // Get profiles
      const { data: profiles, error: profileError } = await supabase
        .from("profiles")
        .select("id, email, jellyfin_username, created_at")
        .order("created_at", { ascending: false });

      if (profileError) throw profileError;

      // Get roles for all users
      const { data: roles, error: roleError } = await supabase
        .from("user_roles")
        .select("user_id, role");

      if (roleError) throw roleError;

      // Combine data
      const usersWithRoles: UserWithRole[] = profiles.map(profile => {
        const userRole = roles?.find(r => r.user_id === profile.id);
        return {
          ...profile,
          role: userRole?.role || null,
        };
      });

      return usersWithRoles;
    },
  });

  // Mutation to update user role
  const updateRole = useMutation({
    mutationFn: async ({ userId, newRole }: { userId: string; newRole: 'admin' | 'user' }) => {
      // First delete existing role
      await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", userId);

      // Insert new role
      const { error } = await supabase
        .from("user_roles")
        .insert({ user_id: userId, role: newRole });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users-with-roles"] });
      queryClient.invalidateQueries({ queryKey: ["user-all-permissions"] });
      toast.success("Rolle oppdatert");
    },
    onError: () => {
      toast.error("Kunne ikke oppdatere rolle");
    },
  });

  const handleRefresh = async () => {
    toast.info("Oppdaterer brukerliste...");
    try {
      await refetch();
      toast.success("Brukerliste oppdatert");
    } catch (error) {
      toast.error("Kunne ikke oppdatere brukerliste");
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserCog className="h-5 w-5" />
            Bruker- og tilgangsstyring
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <UserCog className="h-5 w-5" />
                Bruker- og tilgangsstyring
              </CardTitle>
              <CardDescription>
                Administrer roller og individuelle tillatelser for brukere
              </CardDescription>
            </div>
            <Button
              onClick={handleRefresh}
              disabled={isLoading}
              variant="outline"
              size="sm"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Oppdater
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <p>{users?.length || 0} brukere registrert</p>
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
                        <p className="font-medium truncate">
                          {user.jellyfin_username || user.email}
                        </p>
                        {user.role === 'admin' && (
                          <Badge variant="default" className="text-xs">
                            <Shield className="h-3 w-3 mr-1" />
                            Admin
                          </Badge>
                        )}
                      </div>
                      
                      <div className="text-xs text-muted-foreground space-y-1">
                        <p>{user.email}</p>
                        {user.created_at && (
                          <p>
                            Registrert: {format(new Date(user.created_at), language === 'no' ? "d. MMM yyyy" : "MMM d, yyyy", { locale })}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Role selector */}
                      <Select
                        value={user.role || 'user'}
                        onValueChange={(value: 'admin' | 'user') => {
                          updateRole.mutate({ userId: user.id, newRole: value });
                        }}
                        disabled={updateRole.isPending}
                      >
                        <SelectTrigger className="w-[120px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="user">Bruker</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                        </SelectContent>
                      </Select>

                      {/* Permissions button */}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedUser({
                          id: user.id,
                          name: user.jellyfin_username || user.email
                        })}
                      >
                        <Settings2 className="h-4 w-4 mr-1" />
                        Tillatelser
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {users?.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>Ingen brukere funnet</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Permissions dialog */}
      {selectedUser && (
        <UserPermissionsDialog
          open={!!selectedUser}
          onOpenChange={(open) => !open && setSelectedUser(null)}
          userId={selectedUser.id}
          userName={selectedUser.name}
        />
      )}
    </>
  );
};
