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

  const syncInstalledVersion = async () => {
    try {
      // Prompt user for current commit SHA
      const commitSha = prompt('Lim inn commit SHA fra git log (kjør: git rev-parse HEAD)');
      
      if (!commitSha) {
        toast.error('Commit SHA er påkrevd');
        return;
      }

      toast.info('Synkroniserer installert versjon...');

      const { data, error: syncError } = await supabase.functions.invoke('sync-installed-version', {
        body: { commitSha: commitSha.trim() }
      });

      if (syncError) {
        console.error('Sync error:', syncError);
        toast.error('Kunne ikke synkronisere versjon');
        return;
      }

      toast.success('Installert versjon synkronisert!');
      
      // Check for updates again
      await checkForUpdates();
    } catch (err: any) {
      console.error('Sync error:', err);
      toast.error('Kunne ikke synkronisere versjon');
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

          // Stop updating state and refresh when completed
          if (newData.status === 'completed') {
            setUpdating(false);
            toast.success('Oppdatering fullført! Siden laster på nytt om 3 sekunder...');
            setTimeout(() => {
              window.location.reload();
            }, 3000);
          }
          
          // Stop updating on failure
          if (newData.status === 'failed') {
            setUpdating(false);
            toast.error('Oppdatering feilet. Se loggene for detaljer.');
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [updateStatus?.id]);

  const installUpdate = async () => {
    // In Lovable preview/staging, we can't reach your self-hosted git-pull server.
    if (window.location.hostname.endsWith('lovableproject.com')) {
      toast.info('Installer oppdatering virker kun på selvhostede installasjoner. Dette vil fungere når appen kjører på din egen server.');
      return;
    }

    setUpdating(true);
    setShowLogs(true); // Åpne terminal-vinduet umiddelbart
    
    try {
      // Create initial update status entry
      const { data: statusData, error: statusError } = await supabase
        .from('update_status')
        .insert({
          status: 'starting',
          progress: 0,
          current_step: 'Forbereder oppdatering...',
          logs: JSON.stringify([{
            timestamp: new Date().toISOString(),
            message: 'Oppdatering startet...',
            level: 'info'
          }])
        })
        .select()
        .single();

      if (statusError) {
        throw statusError;
      }

      const updateId = statusData.id;

      // Set initial status for UI immediately after creating DB entry
      setUpdateStatus({
        id: updateId,
        status: 'starting',
        progress: 0,
        current_step: 'Forbereder oppdatering...',
        logs: [{
          timestamp: new Date().toISOString(),
          message: 'Oppdatering startet...',
          level: 'info'
        }]
      });

      // Get git_pull_secret and git_pull_server_url for HMAC signature and endpoint
      const { data: secretData } = await supabase
        .from('server_settings')
        .select('setting_value')
        .eq('setting_key', 'git_pull_secret')
        .maybeSingle();

      const { data: serverUrlData } = await supabase
        .from('server_settings')
        .select('setting_value')
        .eq('setting_key', 'git_pull_server_url')
        .maybeSingle();

      const secret = secretData?.setting_value || '';
      const serverUrl = serverUrlData?.setting_value || 'http://192.168.9.24:3002/git-pull';

      // Add log about contacting git-pull server
      const contactingLog = [...(statusData.logs ? JSON.parse(statusData.logs as any) : []), {
        timestamp: new Date().toISOString(),
        message: `Kontakter git-pull server på ${serverUrl}...`,
        level: 'info'
      }];
      
      setUpdateStatus(prev => prev ? {
        ...prev,
        logs: contactingLog
      } : null);

      // Prepare request body
      const requestBody = JSON.stringify({ updateId });

      // Generate HMAC signature if secret is configured
      let signature = '';
      if (secret) {
        const encoder = new TextEncoder();
        const keyData = encoder.encode(secret);
        const messageData = encoder.encode(requestBody);
        const cryptoKey = await crypto.subtle.importKey(
          'raw',
          keyData,
          { name: 'HMAC', hash: 'SHA-256' },
          false,
          ['sign']
        );
        const signatureBuffer = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
        signature = Array.from(new Uint8Array(signatureBuffer))
          .map(b => b.toString(16).padStart(2, '0'))
          .join('');
      }

      // Call git-pull server using configured URL
      const response = await fetch(serverUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(signature && { 'X-Update-Signature': signature })
        },
        body: requestBody
      });

      if (!response.ok) {
        throw new Error(`Git pull server returned ${response.status}`);
      }

      toast.success('Oppdatering startet! Se terminal-vinduet for fremgang.');
      
    } catch (err: any) {
      console.error('Install update error:', err);
      
      const errorMessage = err.message || 'Kunne ikke starte oppdatering';
      const isConnectionError = errorMessage.includes('fetch') || errorMessage.includes('NetworkError');
      
      // Create detailed error logs
      const errorLogs = [
        {
          timestamp: new Date().toISOString(),
          message: 'Oppdatering startet...',
          level: 'info' as const
        },
        {
          timestamp: new Date().toISOString(),
          message: 'Kontakter git-pull server på localhost:3002...',
          level: 'info' as const
        },
        {
          timestamp: new Date().toISOString(),
          message: `❌ FEIL: ${errorMessage}`,
          level: 'error' as const
        }
      ];
      
      if (isConnectionError) {
        errorLogs.push({
          timestamp: new Date().toISOString(),
          message: '💡 TIP: Sjekk at git-pull-server kjører på serveren:',
          level: 'info' as const
        });
        errorLogs.push({
          timestamp: new Date().toISOString(),
          message: '   sudo systemctl status jelly-git-pull',
          level: 'info' as const
        });
        errorLogs.push({
          timestamp: new Date().toISOString(),
          message: '   sudo systemctl start jelly-git-pull',
          level: 'info' as const
        });
      }
      
      // Update status in UI to show error - keep terminal open!
      setUpdateStatus({
        id: 'error-' + Date.now(),
        status: 'failed',
        progress: 0,
        current_step: 'Feil: Kunne ikke kontakte git-pull server',
        error: errorMessage,
        logs: errorLogs
      });
      
      toast.error('Oppdatering feilet - se terminal for detaljer');
      setUpdating(false);
      // Don't close the logs dialog - let user see what went wrong!
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

                  {/* Progress bar inside dialog */}
                  <div className="space-y-1 mb-4">
                    <p className="text-xs text-muted-foreground">
                      {language === 'no'
                        ? `Fremdrift: ${updateStatus.progress}%`
                        : `Progress: ${updateStatus.progress}%`}
                    </p>
                    <Progress value={updateStatus.progress} className="h-1.5" />
                  </div>

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

                  {/* Hint for manuelt kjørt oppdatering */}
                  <p className="mt-3 text-xs text-muted-foreground">
                    {language === 'no'
                      ? 'Hvis du har kjørt oppdateringen manuelt på serveren, klikk «Sjekk etter oppdatering» under for å oppdatere statusen.'
                      : 'If you ran the update manually on the server, click "Check for updates" below to refresh the status.'}
                  </p>
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
            <>
              <Button
                onClick={syncInstalledVersion}
                variant="secondary"
                size="sm"
                className="flex-shrink-0"
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                {language === 'no' ? 'Synk versjon' : 'Sync version'}
              </Button>
              
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
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
