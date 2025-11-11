import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { RefreshCw, Download, AlertCircle, CheckCircle, GitBranch, FileText, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { nb, enUS } from "date-fns/locale";
import { useLanguage } from "@/contexts/LanguageContext";

interface UpdateInfo {
  updateAvailable: boolean;
  installedVersion: {
    sha: string;
    shortSha: string;
  };
  latestVersion: {
    sha: string;
    shortSha: string;
    message: string;
    author: string;
    date: string;
  };
}

interface UpdateStatus {
  id: string;
  status: string;
  progress: number;
  current_step: string;
  logs: Array<{
    timestamp: string;
    message: string;
    level: 'info' | 'success' | 'error' | 'warning';
  }>;
  error?: string;
}

export const UpdateManager = () => {
  const { language, t } = useLanguage();
  const dateLocale = language === 'no' ? nb : enUS;
  const updates = t.updates as any; // Cast to any for simplicity
  const common = t.common as any;
  const [checking, setChecking] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSetupComplete, setIsSetupComplete] = useState<boolean | null>(null);
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus | null>(null);
  const [showLogs, setShowLogs] = useState(false);

  const checkForUpdates = async () => {
    setChecking(true);
    setError(null);
    
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('check-updates');
      
      // Handle function invocation errors gracefully
      if (invokeError) {
        console.error('Function invocation error:', invokeError);
        setError('Kunne ikke sjekke for oppdateringer');
        setIsSetupComplete(false);
        return;
      }

      if (data?.needsSetup) {
        setError(data.error);
        setIsSetupComplete(false);
        toast.info('GitHub repository må konfigureres først');
        return;
      }

      setIsSetupComplete(true);
      setUpdateInfo(data);
      
      if (data.updateAvailable) {
        toast.success('Ny oppdatering tilgjengelig!');
      } else {
        toast.info('Du har den nyeste versjonen');
      }
    } catch (err: any) {
      console.error('Check updates error:', err);
      setError('Kunne ikke sjekke for oppdateringer');
      setIsSetupComplete(false);
    } finally {
      setChecking(false);
    }
  };

  // Subscribe to realtime updates
  useEffect(() => {
    if (!updateStatus?.id) return;

    const channel = supabase
      .channel('update-status-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'update_status',
          filter: `id=eq.${updateStatus.id}`
        },
        (payload) => {
          console.log('Update status changed:', payload);
          const newData = payload.new as any;
          setUpdateStatus({
            id: newData.id,
            status: newData.status,
            progress: newData.progress,
            current_step: newData.current_step,
            logs: typeof newData.logs === 'string' ? JSON.parse(newData.logs) : newData.logs,
            error: newData.error
          });

          // Auto-reload when completed
          if (newData.status === 'completed') {
            setTimeout(() => {
              window.location.reload();
            }, 3000);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [updateStatus?.id]);

  const installUpdate = async () => {
    setUpdating(true);
    setUpdateStatus(null);
    
    try {
      const { data, error } = await supabase.functions.invoke('trigger-update');
      
      if (error) {
        throw error;
      }

      if (data?.needsSetup) {
        toast.error(data.message);
        setError(data.error);
        setUpdating(false);
        return;
      }

      // Set initial status
      if (data?.updateId) {
        setUpdateStatus({
          id: data.updateId,
          status: 'starting',
          progress: 0,
          current_step: 'Starter oppdatering...',
          logs: []
        });
      }

      toast.success(data.message);
      
    } catch (err: any) {
      console.error('Install update error:', err);
      toast.error(err.message || 'Kunne ikke installere oppdatering');
      setUpdating(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <GitBranch className="h-5 w-5" />
          {updates?.title || 'Update Management'}
        </CardTitle>
        <CardDescription>
          {updates?.description || 'Check and install automatic updates from GitHub'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Info banner explaining this is for self-hosted only */}
        <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-5 w-5 text-blue-400 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-blue-400 mb-1">
                {updates?.selfHostedOnly || 'For self-hosted installations only'}
              </p>
              <p className="text-xs text-muted-foreground">
                {updates?.selfHostedDescription || 'This feature is only for self-hosted installations...'}
              </p>
            </div>
          </div>
        </div>

        {/* Setup instructions - show by default until setup is verified */}
        {isSetupComplete === false && (
          <div className="p-4 bg-muted/50 border border-border rounded-lg">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium mb-2">
                  {updates?.setupRequired || 'Setup for self-hosted installation'}
                </p>
                <ol className="list-decimal list-inside space-y-1 text-xs text-muted-foreground ml-2">
                  <li>{updates?.setupSteps?.step1 || 'Go to "Servers" tab'}</li>
                  <li>{updates?.setupSteps?.step2 || 'Set GitHub Repository URL'}</li>
                  <li>{updates?.setupSteps?.step3 || 'Set Update Webhook URL'}</li>
                  <li>{updates?.setupSteps?.step4 || 'Run the update-server script'}</li>
                </ol>
                <p className="text-xs text-muted-foreground mt-2">
                  <strong>{common?.note || 'Note'}:</strong> {updates?.note || 'This requires a self-hosted server...'}
                </p>
              </div>
            </div>
          </div>
        )}

        {updateInfo && (
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-secondary/20 rounded-lg">
              <div>
                <p className="text-sm font-medium">{updates?.installedVersion || 'Installed version'}</p>
                <p className="text-xs text-muted-foreground font-mono">
                  {updateInfo.installedVersion.shortSha || (language === 'no' ? 'Ukjent' : 'Unknown')}
                </p>
              </div>
              {updateInfo.updateAvailable ? (
                <Badge variant="secondary">{language === 'no' ? 'Utdatert' : 'Outdated'}</Badge>
              ) : (
                <Badge variant="default" className="bg-green-500">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  {language === 'no' ? 'Oppdatert' : 'Up to date'}
                </Badge>
              )}
            </div>

            {updateInfo.updateAvailable && (
              <div className="p-4 border border-primary/20 rounded-lg bg-primary/5">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-medium">{updates?.updateAvailable || 'New version available!'}</p>
                    <p className="text-xs text-muted-foreground font-mono mt-1">
                      {updateInfo.latestVersion.shortSha}
                    </p>
                  </div>
                  <Badge variant="outline">{language === 'no' ? 'Ny' : 'New'}</Badge>
                </div>
                <div className="mt-3 space-y-1 text-sm">
                  <p className="font-medium">{updateInfo.latestVersion.message}</p>
                  <p className="text-xs text-muted-foreground">
                    {language === 'no' ? 'av' : 'by'} {updateInfo.latestVersion.author} •{' '}
                    {format(new Date(updateInfo.latestVersion.date), "d. MMM yyyy 'kl.' HH:mm", { locale: dateLocale })}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Update Progress */}
        {updateStatus && (
          <div className="space-y-3 p-4 border border-primary/20 rounded-lg bg-primary/5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Loader2 className={`h-4 w-4 ${updateStatus.status === 'completed' ? '' : 'animate-spin'}`} />
                <span className="text-sm font-medium">{updateStatus.current_step}</span>
              </div>
              <Dialog open={showLogs} onOpenChange={setShowLogs}>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="sm">
                    <FileText className="h-4 w-4 mr-1" />
                    {updates?.viewLogs || 'View logs'}
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>{updates?.logsTitle || 'Update logs'}</DialogTitle>
                    <DialogDescription>
                      {updates?.logsDescription || 'Detailed log of the update process'}
                    </DialogDescription>
                  </DialogHeader>
                  <ScrollArea className="h-96 w-full rounded-md border p-4">
                    <div className="space-y-2">
                      {updateStatus.logs.map((log, idx) => (
                        <div key={idx} className="flex gap-2 text-sm">
                          <span className="text-muted-foreground font-mono text-xs">
                            {format(new Date(log.timestamp), 'HH:mm:ss')}
                          </span>
                          <span className={`
                            ${log.level === 'error' ? 'text-red-400' : ''}
                            ${log.level === 'success' ? 'text-green-400' : ''}
                            ${log.level === 'warning' ? 'text-yellow-400' : ''}
                            ${log.level === 'info' ? 'text-muted-foreground' : ''}
                          `}>
                            {log.message}
                          </span>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </DialogContent>
              </Dialog>
            </div>
            <Progress value={updateStatus.progress} className="h-2" />
            {updateStatus.error && (
              <p className="text-sm text-red-400">{updateStatus.error}</p>
            )}
          </div>
        )}

        <div className="flex gap-2">
          <Button
            onClick={checkForUpdates}
            disabled={checking || updating}
            variant="outline"
            className="flex-1"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${checking ? 'animate-spin' : ''}`} />
            {checking ? (updates?.checking || 'Checking...') : (updates?.checkForUpdates || 'Check for updates')}
          </Button>

          {updateInfo?.updateAvailable && !updateStatus && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button disabled={updating} className="flex-1">
                  <Download className="h-4 w-4 mr-2" />
                  {updates?.installUpdate || 'Install update'}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{updates?.installUpdate || 'Install update'}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    {language === 'no' 
                      ? 'Dette vil laste ned den nyeste versjonen fra GitHub og restarte serveren. Operasjonen tar vanligvis 30-60 sekunder. Siden vil automatisk laste på nytt når oppdateringen er ferdig.'
                      : 'This will download the latest version from GitHub and restart the server. The operation usually takes 30-60 seconds. The page will automatically reload when the update is complete.'}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{common?.cancel || 'Cancel'}</AlertDialogCancel>
                  <AlertDialogAction onClick={installUpdate}>
                    {language === 'no' ? 'Installer nå' : 'Install now'}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
