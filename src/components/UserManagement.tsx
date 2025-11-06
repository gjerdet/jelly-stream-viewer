import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, Shield, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { nb } from "date-fns/locale";
import { useJellyfinUsers } from "@/hooks/useJellyfinUsers";

export const UserManagement = () => {
  const { data: users, isLoading } = useJellyfinUsers();

  const getRoleBadgeVariant = (isAdmin: boolean) => {
    return isAdmin ? "default" as const : "outline" as const;
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
          Viser alle brukere registrert i Jellyfin
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
                      <p className="font-medium truncate">{user.name}</p>
                      {user.isDisabled && (
                        <Badge variant="destructive" className="text-xs">Deaktivert</Badge>
                      )}
                    </div>
                    
                    <div className="flex flex-wrap gap-2 mb-2">
                      {user.isAdministrator && (
                        <Badge variant={getRoleBadgeVariant(true)} className="text-xs">
                          <Shield className="h-3 w-3 mr-1" />
                          Administrator
                        </Badge>
                      )}
                      {!user.isAdministrator && (
                        <Badge variant={getRoleBadgeVariant(false)} className="text-xs">
                          Bruker
                        </Badge>
                      )}
                    </div>

                    <div className="text-xs text-muted-foreground space-y-1">
                      {user.lastLogin && (
                        <p>
                          Sist innlogget: {format(new Date(user.lastLogin), "d. MMM yyyy 'kl.' HH:mm", { locale: nb })}
                        </p>
                      )}
                      <p className="font-mono text-[10px] text-muted-foreground/70">
                        Jellyfin ID: {user.id}
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
