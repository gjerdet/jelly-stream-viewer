import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { RefreshCw, Download, AlertCircle, CheckCircle, GitBranch } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { nb } from "date-fns/locale";

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

export const UpdateManager = () => {
  const [checking, setChecking] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSetupComplete, setIsSetupComplete] = useState<boolean | null>(null);

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

  const installUpdate = async () => {
    setUpdating(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('trigger-update');
      
      if (error) {
        throw error;
      }

      if (data?.needsSetup) {
        toast.error(data.message);
        setError(data.error);
        return;
      }

      toast.success(data.message);
      
      // Wait a bit then reload the page
      setTimeout(() => {
        window.location.reload();
      }, 5000);
      
    } catch (err: any) {
      console.error('Install update error:', err);
      toast.error(err.message || 'Kunne ikke installere oppdatering');
    } finally {
      setUpdating(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <GitBranch className="h-5 w-5" />
          Oppdateringshåndtering
        </CardTitle>
        <CardDescription>
          Sjekk og installer automatiske oppdateringer fra GitHub
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Setup instructions - show by default until setup is verified */}
        {isSetupComplete === false && (
          <div className="p-4 bg-muted/50 border border-border rounded-lg">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium mb-2">GitHub oppdateringer er ikke konfigurert (valgfritt)</p>
                <ol className="list-decimal list-inside space-y-1 text-xs text-muted-foreground ml-2">
                  <li>Sett <code className="bg-background px-1 rounded">github_repo_url</code> i Server Innstillinger</li>
                  <li>Sett <code className="bg-background px-1 rounded">update_webhook_url</code> til din server</li>
                  <li>Kjør update-server scriptet på serveren din</li>
                </ol>
              </div>
            </div>
          </div>
        )}

        {error && isSetupComplete === false && (
          <div className="p-3 bg-muted/30 rounded-lg text-sm text-muted-foreground">
            Denne funksjonen er valgfri. Du kan fortsatt administrere applikasjonen uten GitHub-integrasjon.
          </div>
        )}

        {updateInfo && (
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-secondary/20 rounded-lg">
              <div>
                <p className="text-sm font-medium">Installert versjon</p>
                <p className="text-xs text-muted-foreground font-mono">
                  {updateInfo.installedVersion.shortSha || 'Ukjent'}
                </p>
              </div>
              {updateInfo.updateAvailable ? (
                <Badge variant="secondary">Utdatert</Badge>
              ) : (
                <Badge variant="default" className="bg-green-500">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Oppdatert
                </Badge>
              )}
            </div>

            {updateInfo.updateAvailable && (
              <div className="p-4 border border-primary/20 rounded-lg bg-primary/5">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-medium">Ny versjon tilgjengelig!</p>
                    <p className="text-xs text-muted-foreground font-mono mt-1">
                      {updateInfo.latestVersion.shortSha}
                    </p>
                  </div>
                  <Badge variant="outline">Ny</Badge>
                </div>
                <div className="mt-3 space-y-1 text-sm">
                  <p className="font-medium">{updateInfo.latestVersion.message}</p>
                  <p className="text-xs text-muted-foreground">
                    av {updateInfo.latestVersion.author} •{' '}
                    {format(new Date(updateInfo.latestVersion.date), "d. MMM yyyy 'kl.' HH:mm", { locale: nb })}
                  </p>
                </div>
              </div>
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
            {checking ? 'Sjekker...' : 'Sjekk etter oppdatering'}
          </Button>

          {updateInfo?.updateAvailable && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button disabled={updating} className="flex-1">
                  <Download className="h-4 w-4 mr-2" />
                  {updating ? 'Installerer...' : 'Installer oppdatering'}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Installer oppdatering?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Dette vil laste ned den nyeste versjonen fra GitHub og restarte serveren.
                    Operasjonen tar vanligvis 30-60 sekunder. Siden vil automatisk laste på nytt når oppdateringen er ferdig.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Avbryt</AlertDialogCancel>
                  <AlertDialogAction onClick={installUpdate}>
                    Installer nå
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
