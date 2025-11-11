import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, Shield, Loader2, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { nb, enUS } from "date-fns/locale";
import { useJellyfinUsers } from "@/hooks/useJellyfinUsers";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";

export const UserManagement = () => {
  const { data: users, isLoading, refetch } = useJellyfinUsers();
  const { t, language } = useLanguage();
  const userMgmt = t.userManagement as any;
  const locale = language === 'no' ? nb : enUS;

  const handleRefresh = async () => {
    toast.info(userMgmt.updating);
    try {
      await refetch();
      toast.success(userMgmt.updated);
    } catch (error) {
      toast.error(userMgmt.couldNotUpdate);
    }
  };

  const getRoleBadgeVariant = (isAdmin: boolean) => {
    return isAdmin ? "default" as const : "outline" as const;
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            {userMgmt.title}
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
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              {userMgmt.title}
            </CardTitle>
            <CardDescription>
              {userMgmt.description}
            </CardDescription>
          </div>
          <Button
            onClick={handleRefresh}
            disabled={isLoading}
            variant="outline"
            size="sm"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            {userMgmt.refresh}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <p>{userMgmt.totalUsers.replace('{count}', users?.length || 0)}</p>
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
                        <Badge variant="destructive" className="text-xs">{userMgmt.disabled}</Badge>
                      )}
                    </div>
                    
                    <div className="flex flex-wrap gap-2 mb-2">
                      {user.isAdministrator && (
                        <Badge variant={getRoleBadgeVariant(true)} className="text-xs">
                          <Shield className="h-3 w-3 mr-1" />
                          {userMgmt.administrator}
                        </Badge>
                      )}
                      {!user.isAdministrator && (
                        <Badge variant={getRoleBadgeVariant(false)} className="text-xs">
                          {userMgmt.user}
                        </Badge>
                      )}
                    </div>

                    <div className="text-xs text-muted-foreground space-y-1">
                      {user.lastLogin && (
                        <p>
                          {userMgmt.lastLogin}: {format(new Date(user.lastLogin), language === 'no' ? "d. MMM yyyy 'kl.' HH:mm" : "MMM d, yyyy 'at' h:mm a", { locale })}
                        </p>
                      )}
                      <p className="font-mono text-[10px] text-muted-foreground/70">
                        {userMgmt.jellyfinId}: {user.id}
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
              <p>{userMgmt.noUsers}</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
