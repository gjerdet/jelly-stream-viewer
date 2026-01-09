import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, Shield, Loader2, RefreshCw, Settings2, UserCog, KeyRound } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
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
  jellyfin_user_id: string | null;
  created_at: string | null;
  role: 'admin' | 'user' | null;
}
interface UserAccessManagementProps {
  userRole?: string | null;
}

export const UserAccessManagement = ({ userRole }: UserAccessManagementProps) => {
  const { language } = useLanguage();
  const locale = language === 'no' ? nb : enUS;
  const queryClient = useQueryClient();
  const [selectedUser, setSelectedUser] = useState<{ id: string; name: string } | null>(null);
  const [resetPasswordUser, setResetPasswordUser] = useState<{ id: string; name: string; jellyfinUserId: string | null } | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [passwordStatus, setPasswordStatus] = useState<{
    before?: { hasPassword: boolean; hasConfiguredPassword: boolean };
    after?: { hasPassword: boolean; hasConfiguredPassword: boolean };
  } | null>(null);

  // Fetch all users with their roles - only when admin
  const { data: users, isLoading, refetch } = useQuery({
    queryKey: ["admin-users-with-roles"],
    queryFn: async () => {
      // Get profiles with jellyfin_user_id
      const { data: profilesRaw, error: profileError } = await supabase
        .from("profiles")
        .select("id, email, jellyfin_username, jellyfin_user_id, created_at")
        .order("created_at", { ascending: false });

      if (profileError) throw profileError;

      // Get roles for all users
      const { data: rolesRaw, error: roleError } = await supabase
        .from("user_roles")
        .select("user_id, role");

      if (roleError) throw roleError;

      const profiles = profilesRaw ?? [];
      const roles = rolesRaw ?? [];

      // Defensive dedupe (prevents accidental double-render if backend returns duplicates)
      const seenProfileIds = new Set<string>();
      const uniqueProfiles = profiles.filter((p) => {
        if (seenProfileIds.has(p.id)) return false;
        seenProfileIds.add(p.id);
        return true;
      });

      const roleByUserId = new Map<string, UserWithRole["role"]>();
      for (const r of roles) {
        if (!roleByUserId.has(r.user_id)) {
          roleByUserId.set(r.user_id, r.role);
        }
      }

      return uniqueProfiles.map((profile) => ({
        ...profile,
        jellyfin_user_id: profile.jellyfin_user_id ?? null,
        role: roleByUserId.get(profile.id) ?? null,
      })) as UserWithRole[];
    },
    enabled: userRole === 'admin',
  });

  // Mutation to reset user password
  const resetPassword = useMutation({
    mutationFn: async ({ jellyfinUserId, newPassword }: { jellyfinUserId: string; newPassword: string }) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Ikke innlogget");

      const response = await supabase.functions.invoke('jellyfin-admin-reset-password', {
        body: { jellyfinUserId, newPassword }
      });

      if (response.error) throw new Error(response.error.message);
      if (response.data?.error) throw new Error(response.data.error);

      return response.data;
    },
    onSuccess: (data) => {
      // Show password status from API response
      if (data?.hasPasswordBefore !== undefined || data?.hasPasswordAfter !== undefined) {
        setPasswordStatus({
          before: { hasPassword: data.hasPasswordBefore, hasConfiguredPassword: data.hasConfiguredPasswordBefore },
          after: { hasPassword: data.hasPasswordAfter, hasConfiguredPassword: data.hasConfiguredPasswordAfter },
        });
      }
      toast.success("Passord resatt");
      setResetPasswordUser(null);
      setNewPassword("");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Kunne ikke resette passord");
      setPasswordStatus(null);
    },
  });

  // Mutation to update user role
  const updateRole = useMutation({
    mutationFn: async ({ userId, newRole }: { userId: string; newRole: 'admin' | 'user' }) => {
      // First delete existing role
      const { error: deleteError } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", userId);

      if (deleteError) throw deleteError;

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

                      {/* Reset password button */}
                      {user.jellyfin_user_id && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setResetPasswordUser({
                            id: user.id,
                            name: user.jellyfin_username || user.email,
                            jellyfinUserId: user.jellyfin_user_id
                          })}
                        >
                          <KeyRound className="h-4 w-4 mr-1" />
                          Reset passord
                        </Button>
                      )}

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

      {/* Reset password dialog */}
      <Dialog open={!!resetPasswordUser} onOpenChange={(open) => {
        if (!open) {
          setResetPasswordUser(null);
          setNewPassword("");
          setPasswordStatus(null);
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset passord</DialogTitle>
            <DialogDescription>
              Sett nytt passord for {resetPasswordUser?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">Nytt passord</Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Skriv inn nytt passord"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setResetPasswordUser(null);
                setNewPassword("");
              }}
            >
              Avbryt
            </Button>
            <Button
              onClick={() => {
                if (resetPasswordUser?.jellyfinUserId && newPassword) {
                  resetPassword.mutate({
                    jellyfinUserId: resetPasswordUser.jellyfinUserId,
                    newPassword
                  });
                }
              }}
              disabled={!newPassword || resetPassword.isPending}
            >
              {resetPassword.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Resetter...
                </>
              ) : (
                "Reset passord"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
