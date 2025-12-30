import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { RefreshCw, Download, AlertCircle, CheckCircle, GitBranch, FileText, Loader2, Home, Globe } from "lucide-react";
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
  const [forceLocalMode, setForceLocalMode] = useState(false);
  const [gitPullUrlIsLocal, setGitPullUrlIsLocal] = useState<boolean | null>(null);

  // Helper to check if a URL is a local/private IP
  const isLocalUrl = (url: string) => {
    if (!url) return false;
    try {
      const parsedUrl = new URL(url);
      const hostname = parsedUrl.hostname;
      return (
        hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        hostname.startsWith('192.168.') ||
        hostname.startsWith('10.') ||
        hostname.startsWith('172.16.') ||
        hostname.startsWith('172.17.') ||
        hostname.startsWith('172.18.') ||
        hostname.startsWith('172.19.') ||
        hostname.startsWith('172.20.') ||
        hostname.startsWith('172.21.') ||
        hostname.startsWith('172.22.') ||
        hostname.startsWith('172.23.') ||
        hostname.startsWith('172.24.') ||
        hostname.startsWith('172.25.') ||
        hostname.startsWith('172.26.') ||
        hostname.startsWith('172.27.') ||
        hostname.startsWith('172.28.') ||
        hostname.startsWith('172.29.') ||
        hostname.startsWith('172.30.') ||
        hostname.startsWith('172.31.')
      );
    } catch {
      return false;
    }
  };

  // Check if we can run updates (local URL requires local network)
  const canRunUpdate = () => {
    if (gitPullUrlIsLocal === null) return true; // Not yet checked
    if (!gitPullUrlIsLocal) return true; // Public URL - always OK
    return isLocalNetwork(); // Local URL - only OK on local network
  };

  // Fetch git-pull URL to check if it's local
  useEffect(() => {
    const checkGitPullUrl = async () => {
      const { data: settings } = await supabase
        .from('server_settings')
        .select('setting_key, setting_value')
        .in('setting_key', ['git_pull_server_url', 'update_webhook_url']);
      
      const settingsMap = new Map(
        (settings || []).map((row: any) => [row.setting_key, row.setting_value])
      );
      
      const gitPullUrl = settingsMap.get('git_pull_server_url') || settingsMap.get('update_webhook_url') || '';
      setGitPullUrlIsLocal(isLocalUrl(gitPullUrl));
    };
    checkGitPullUrl();
  }, []);

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

  // Poll for update completion when git-pull-server can't send status updates
  useEffect(() => {
    if (!updating) return;

    // Store the initial installed SHA to detect changes
    const initialSha = updateInfo?.installedVersion?.sha || '';
    let pollCount = 0;
    const maxPolls = 24; // 2 minutes max (5s * 24)

    const pollInterval = setInterval(async () => {
      pollCount++;
      console.log(`[UpdateManager] Polling for completion (${pollCount}/${maxPolls})...`);
      
      // Add polling log to UI
      setUpdateStatus(prev => prev ? {
        ...prev,
        logs: [...(prev.logs || []), {
          timestamp: new Date().toISOString(),
          message: `🔄 Sjekker status... (${pollCount}/${maxPolls})`,
          level: 'info' as const
        }]
      } : null);

      try {
        const { data } = await supabase.functions.invoke('check-updates');
        
        // Check if installed version changed (update completed)
        if (data && data.installedVersion?.sha && data.installedVersion.sha !== initialSha) {
          // Update completed!
          clearInterval(pollInterval);
          
          setUpdateStatus(prev => prev ? {
            ...prev,
            status: 'completed',
            progress: 100,
            current_step: 'Oppdatering fullført!',
            logs: [...(prev.logs || []), {
              timestamp: new Date().toISOString(),
              message: '✅ Oppdatering fullført! Versjonen er nå oppdatert.',
              level: 'success' as const
            }]
          } : null);
          
          setUpdateInfo(data);
          setUpdating(false);
          toast.success('Oppdatering fullført!');
        } else if (!data?.updateAvailable && pollCount > 3) {
          // No update available and we've polled a few times - probably completed
          clearInterval(pollInterval);
          
          setUpdateStatus(prev => prev ? {
            ...prev,
            status: 'completed',
            progress: 100,
            current_step: 'Oppdatering fullført!',
            logs: [...(prev.logs || []), {
              timestamp: new Date().toISOString(),
              message: '✅ Ingen oppdatering tilgjengelig - du har nyeste versjon.',
              level: 'success' as const
            }]
          } : null);
          
          setUpdateInfo(data);
          setUpdating(false);
          toast.success('Du har nyeste versjon!');
        } else if (pollCount >= maxPolls) {
          // Timeout
          clearInterval(pollInterval);
          
          setUpdateStatus(prev => prev ? {
            ...prev,
            status: 'unknown',
            current_step: 'Tidsavbrudd - sjekk serverlogs',
            logs: [...(prev.logs || []), {
              timestamp: new Date().toISOString(),
              message: '⚠️ Tidsavbrudd - klikk "Sjekk etter oppdatering" manuelt',
              level: 'warning' as const
            }]
          } : null);
          
          setUpdating(false);
          toast.warning('Tidsavbrudd - klikk "Sjekk etter oppdatering" for å se status');
        }
      } catch (err) {
        console.error('[UpdateManager] Poll error:', err);
      }
    }, 5000); // Poll every 5 seconds

    return () => clearInterval(pollInterval);
  }, [updating]);

  // Check if we're on a local network (private IP)
  const isLocalNetwork = () => {
    const hostname = window.location.hostname;
    return (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname.startsWith('192.168.') ||
      hostname.startsWith('10.') ||
      hostname.startsWith('172.16.') ||
      hostname.startsWith('172.17.') ||
      hostname.startsWith('172.18.') ||
      hostname.startsWith('172.19.') ||
      hostname.startsWith('172.20.') ||
      hostname.startsWith('172.21.') ||
      hostname.startsWith('172.22.') ||
      hostname.startsWith('172.23.') ||
      hostname.startsWith('172.24.') ||
      hostname.startsWith('172.25.') ||
      hostname.startsWith('172.26.') ||
      hostname.startsWith('172.27.') ||
      hostname.startsWith('172.28.') ||
      hostname.startsWith('172.29.') ||
      hostname.startsWith('172.30.') ||
      hostname.startsWith('172.31.')
    );
  };

  const installUpdate = async () => {
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

      // Determine if we should call locally or via edge function
      const useLocalCall = forceLocalMode || isLocalNetwork();
      console.log('[UpdateManager] forceLocalMode:', forceLocalMode, 'isLocalNetwork:', isLocalNetwork(), 'useLocalCall:', useLocalCall);
      
      if (useLocalCall) {
        // Try to get git_pull_server_url or update_webhook_url from database
        const { data: settings } = await supabase
          .from('server_settings')
          .select('setting_key, setting_value')
          .in('setting_key', ['git_pull_server_url', 'update_webhook_url', 'git_pull_secret', 'update_webhook_secret']);
        
        const settingsMap = new Map(
          (settings || []).map((row: any) => [row.setting_key, row.setting_value])
        );
        
        // Check for git_pull_server_url first, then fallback to update_webhook_url
        const gitPullUrl = settingsMap.get('git_pull_server_url') || settingsMap.get('update_webhook_url');
        
        if (!gitPullUrl) {
          throw new Error('Git Pull URL er ikke konfigurert. Gå til Servere-fanen og sett opp Git Pull URL.');
        }
        
        // Get secret (check both keys)
        const gitPullSecret = settingsMap.get('git_pull_secret') || settingsMap.get('update_webhook_secret');
        
        console.log('[UpdateManager] Calling git-pull server directly (local mode):', gitPullUrl);
        
        const contactingLog = [{
          timestamp: new Date().toISOString(),
          message: 'Oppdatering startet...',
          level: 'info' as const
        }, {
          timestamp: new Date().toISOString(),
          message: `🏠 Lokal modus: Kontakter git-pull server direkte på ${gitPullUrl}`,
          level: 'info' as const
        }];
        
        setUpdateStatus(prev => prev ? {
          ...prev,
          logs: contactingLog
        } : null);

        // Update status in database
        await supabase
          .from('update_status')
          .update({
            logs: JSON.stringify(contactingLog)
          })
          .eq('id', updateId);
        
        // Ensure URL ends with /git-pull
        let targetUrl = gitPullUrl;
        if (!targetUrl.endsWith('/git-pull')) {
          targetUrl = targetUrl.replace(/\/$/, '') + '/git-pull';
        }
        
        // Build headers
        const headers: Record<string, string> = {
          'Content-Type': 'application/json'
        };
        
        // Add signature if secret is available and crypto.subtle is supported
        // Note: crypto.subtle is only available in secure contexts (HTTPS or localhost)
        if (gitPullSecret && typeof crypto !== 'undefined' && crypto.subtle) {
          try {
            const body = JSON.stringify({ updateId });
            const encoder = new TextEncoder();
            const key = await crypto.subtle.importKey(
              'raw',
              encoder.encode(gitPullSecret),
              { name: 'HMAC', hash: 'SHA-256' },
              false,
              ['sign']
            );
            const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(body));
            const signatureHex = Array.from(new Uint8Array(signature))
              .map(b => b.toString(16).padStart(2, '0'))
              .join('');
            headers['X-Update-Signature'] = signatureHex;
          } catch (cryptoError) {
            console.warn('Could not generate signature (crypto.subtle not available):', cryptoError);
          }
        } else if (gitPullSecret) {
          console.warn('Signature skipped: crypto.subtle not available (requires HTTPS or localhost)');
        }
        
        const response = await fetch(targetUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify({ updateId })
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Git-pull server svarte med feil: ${response.status} - ${errorText}`);
        }
        
        console.log('[UpdateManager] Git pull triggered successfully (local mode)');
        toast.success('Oppdatering startet! Se terminal-vinduet for fremgang.');
        
      } else {
        // Use edge function for remote access
        console.log('[UpdateManager] Calling git-pull-proxy edge function (remote mode)');
        
        const contactingLog = [{
          timestamp: new Date().toISOString(),
          message: 'Oppdatering startet...',
          level: 'info' as const
        }, {
          timestamp: new Date().toISOString(),
          message: '☁️ Ekstern modus: Kontakter git-pull server via Edge Function...',
          level: 'info' as const
        }, {
          timestamp: new Date().toISOString(),
          message: '⚠️ OBS: Edge Functions kan ikke nå lokale IP-adresser. Sett opp en offentlig URL eller kjør lokalt.',
          level: 'warning' as const
        }];
        
        setUpdateStatus(prev => prev ? {
          ...prev,
          logs: contactingLog
        } : null);

        await supabase
          .from('update_status')
          .update({
            logs: JSON.stringify(contactingLog)
          })
          .eq('id', updateId);

        const { data, error: invokeError } = await supabase.functions.invoke('git-pull-proxy', {
          body: { updateId }
        });

        if (invokeError) {
          console.error('[UpdateManager] Edge function error:', invokeError);
          throw new Error(invokeError.message || 'Edge function feilet');
        }

        if (!data?.success) {
          throw new Error(data?.error || 'Ukjent feil fra git-pull-proxy');
        }

        console.log('[UpdateManager] Git pull triggered successfully:', data);
        toast.success('Oppdatering startet! Se terminal-vinduet for fremgang.');
      }
      
    } catch (err: any) {
      console.error('Install update error:', err);
      
      const errorMessage = err.message || 'Kunne ikke starte oppdatering';
      
      // Create detailed error logs
      const errorLogs = [
        {
          timestamp: new Date().toISOString(),
          message: 'Oppdatering startet...',
          level: 'info' as const
        },
        {
          timestamp: new Date().toISOString(),
          message: `❌ FEIL: ${errorMessage}`,
          level: 'error' as const
        }
      ];
      
      // Update status in UI to show error - keep terminal open!
      // Use crypto.randomUUID() for a valid UUID format
      setUpdateStatus(prev => ({
        id: prev?.id || crypto.randomUUID(),
        status: 'failed',
        progress: 0,
        current_step: 'Feil: Kunne ikke kontakte git-pull server',
        error: errorMessage,
        logs: errorLogs
      }));
      
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
        {/* Network mode info - show current detection */}
        {gitPullUrlIsLocal !== null && (
          <div className="p-3 bg-secondary/30 border border-border rounded-lg">
            <div className="flex items-center gap-2">
              {isLocalNetwork() ? (
                <Home className="h-4 w-4 text-green-400" />
              ) : (
                <Globe className="h-4 w-4 text-blue-400" />
              )}
              <div>
                <p className="text-sm font-medium">
                  {isLocalNetwork() 
                    ? (language === 'no' ? 'Lokalt nettverk' : 'Local network')
                    : (language === 'no' ? 'Eksternt nettverk' : 'External network')}
                </p>
                <p className="text-xs text-muted-foreground">
                  {isLocalNetwork() 
                    ? (language === 'no' ? 'Du kan køyre oppdateringar direkte' : 'You can run updates directly')
                    : (language === 'no' ? 'Oppdateringar krev lokal tilgang' : 'Updates require local access')}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Warning when git-pull URL is local but user is on external network */}
        {gitPullUrlIsLocal && !isLocalNetwork() && (
          <div className="p-4 bg-destructive/10 border border-destructive/30 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-destructive mb-1">
                  {language === 'no' ? 'Kan ikkje oppdatere eksternt' : 'Cannot update externally'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {language === 'no' 
                    ? 'Git-pull serveren din brukar ein lokal IP-adresse (192.168.x.x). Oppdateringar kan berre køyrast frå same lokale nettverk. Opne appen på din self-hosted server (ikkje Lovable preview) for å installere oppdateringar.'
                    : 'Your git-pull server uses a local IP address (192.168.x.x). Updates can only be run from the same local network. Open the app on your self-hosted server (not Lovable preview) to install updates.'}
                </p>
              </div>
            </div>
          </div>
        )}

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
                  <Button disabled={updating || !canRunUpdate()} className="flex-1">
                    <Download className="h-4 w-4 mr-2" />
                    {!canRunUpdate() 
                      ? (language === 'no' ? 'Køyr lokalt' : 'Run locally')
                      : (updates?.installUpdate || 'Install update')}
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
