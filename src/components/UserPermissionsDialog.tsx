import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Loader2, Shield, User, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import {
  useUserPermissions,
  useSetUserPermission,
  PERMISSION_LABELS,
  AppPermission,
} from "@/hooks/usePermissions";

interface UserPermissionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  userName: string;
}

const ALL_PERMISSIONS: AppPermission[] = [
  'admin_panel',
  'manage_users',
  'manage_settings',
  'manage_news',
  'view_statistics',
  'manage_requests'
];

export const UserPermissionsDialog = ({
  open,
  onOpenChange,
  userId,
  userName,
}: UserPermissionsDialogProps) => {
  const { data: permData, isLoading } = useUserPermissions(userId);
  const setPermission = useSetUserPermission();
  const [pendingChanges, setPendingChanges] = useState<Record<AppPermission, boolean | null>>({} as any);

  const handleToggle = async (permission: AppPermission, currentValue: boolean, source: 'role' | 'user') => {
    const newGranted = !currentValue;
    
    try {
      await setPermission.mutateAsync({
        userId,
        permission,
        granted: newGranted,
      });
      toast.success(`Tillatelse ${newGranted ? 'gitt' : 'fjernet'}`);
    } catch (error) {
      toast.error("Kunne ikke oppdatere tillatelse");
    }
  };

  const handleResetToRole = async (permission: AppPermission) => {
    try {
      await setPermission.mutateAsync({
        userId,
        permission,
        granted: null, // Remove override
      });
      toast.success("Tilbakestilt til rolle-standard");
    } catch (error) {
      toast.error("Kunne ikke tilbakestille tillatelse");
    }
  };

  if (isLoading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Tillatelser for {userName}
          </DialogTitle>
          <DialogDescription>
            Administrer individuelle tillatelser. Overstyringer vises med blå ramme.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          {/* Show user roles */}
          <div className="flex items-center gap-2 mb-4 p-3 bg-secondary/30 rounded-lg">
            <User className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Rolle:</span>
            {permData?.userRoles?.map(role => (
              <Badge key={role} variant={role === 'admin' ? 'default' : 'secondary'}>
                {role === 'admin' ? 'Administrator' : 'Bruker'}
              </Badge>
            ))}
          </div>

          {/* Permission list */}
          <div className="space-y-3">
            {ALL_PERMISSIONS.map((permission) => {
              const effective = permData?.effectivePermissions[permission];
              const isOverride = effective?.source === 'user';
              
              return (
                <div
                  key={permission}
                  className={`flex items-center justify-between p-3 rounded-lg border ${
                    isOverride 
                      ? 'border-primary/50 bg-primary/5' 
                      : 'border-border bg-secondary/20'
                  }`}
                >
                  <div className="flex-1">
                    <div className="font-medium text-sm">
                      {PERMISSION_LABELS[permission]}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {isOverride ? (
                        <span className="text-primary">Individuell overstyring</span>
                      ) : (
                        <span>Fra rolle</span>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {isOverride && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleResetToRole(permission)}
                        title="Tilbakestill til rolle-standard"
                      >
                        <RotateCcw className="h-4 w-4" />
                      </Button>
                    )}
                    <Switch
                      checked={effective?.granted ?? false}
                      onCheckedChange={() => 
                        handleToggle(permission, effective?.granted ?? false, effective?.source ?? 'role')
                      }
                      disabled={setPermission.isPending}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex justify-end pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Lukk
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
