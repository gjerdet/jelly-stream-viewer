import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useVersions } from "@/hooks/useVersions";
import { GitBranch, Plus, CheckCircle, Clock, ArrowUp, ArrowDown } from "lucide-react";
import { format } from "date-fns";
import { enUS, nb } from "date-fns/locale";
import { useLanguage } from "@/contexts/LanguageContext";

const compareVersions = (v1: string, v2: string): number => {
  const parts1 = v1.split('.').map(Number);
  const parts2 = v2.split('.').map(Number);
  
  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const part1 = parts1[i] || 0;
    const part2 = parts2[i] || 0;
    
    if (part1 > part2) return 1;
    if (part1 < part2) return -1;
  }
  
  return 0;
};

export const VersionManager = () => {
  const { versions, currentVersion, setCurrentVersion, addVersion } = useVersions();
  const { t, language } = useLanguage();
  const vm = t.versionManager as any;
  const dateLocale = language === 'no' ? nb : enUS;
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newVersion, setNewVersion] = useState({
    version_number: "",
    description: "",
    changelog: "",
  });

  const handleAddVersion = () => {
    addVersion({
      ...newVersion,
      is_current: false,
    });
    setShowAddDialog(false);
    setNewVersion({ version_number: "", description: "", changelog: "" });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <GitBranch className="h-5 w-5" />
              Versjonshåndtering
            </CardTitle>
            <CardDescription>
              Administrer app-versjoner og oppgraderinger
            </CardDescription>
          </div>
          <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Ny versjon
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Legg til ny versjon</DialogTitle>
                <DialogDescription>
                  Opprett en ny versjon av applikasjonen
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Versjonsnummer</label>
                  <Input
                    placeholder="1.2.0"
                    value={newVersion.version_number}
                    onChange={(e) => setNewVersion({ ...newVersion, version_number: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Beskrivelse</label>
                  <Input
                    placeholder="Kort beskrivelse av versjonen"
                    value={newVersion.description}
                    onChange={(e) => setNewVersion({ ...newVersion, description: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Endringslogg</label>
                  <Textarea
                    placeholder="- Ny funksjon X&#10;- Forbedret Y&#10;- Fikset bug Z"
                    value={newVersion.changelog}
                    onChange={(e) => setNewVersion({ ...newVersion, changelog: e.target.value })}
                    rows={5}
                  />
                </div>
                <Button onClick={handleAddVersion} className="w-full">
                  Legg til versjon
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {currentVersion && (
            <div className="p-4 border rounded-lg bg-primary/5">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-primary" />
                  <span className="font-semibold text-lg">v{currentVersion.version_number}</span>
                  <Badge variant="default">Aktiv</Badge>
                </div>
                <span className="text-sm text-muted-foreground">
                  {format(new Date(currentVersion.release_date), "d. MMM yyyy", { locale: nb })}
                </span>
              </div>
              {currentVersion.description && (
                <p className="text-sm text-muted-foreground mb-2">{currentVersion.description}</p>
              )}
              {currentVersion.changelog && (
                <div className="mt-3 p-3 bg-background rounded text-sm">
                  <p className="font-medium mb-1">Endringer:</p>
                  <pre className="whitespace-pre-wrap text-muted-foreground">{currentVersion.changelog}</pre>
                </div>
              )}
            </div>
          )}

          <div className="space-y-2">
            <h3 className="font-medium flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Tilgjengelige versjoner
            </h3>
            {versions?.filter((v) => !v.is_current).map((version) => {
              const isNewer = currentVersion && compareVersions(version.version_number, currentVersion.version_number) > 0;
              const actionText = isNewer ? "Oppgrader til" : "Tilbakerull til";
              const ActionIcon = isNewer ? ArrowUp : ArrowDown;
              
              return (
                <div key={version.id} className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">v{version.version_number}</span>
                      {isNewer && <Badge variant="secondary">Nyere</Badge>}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">
                        {format(new Date(version.release_date), "d. MMM yyyy", { locale: nb })}
                      </span>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="sm" variant="outline">
                            <ActionIcon className="h-4 w-4 mr-2" />
                            {actionText} V{version.version_number}
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>{actionText} V{version.version_number}?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Er du sikker på at du vil {isNewer ? 'oppgradere' : 'tilbakerulles'} til versjon {version.version_number}?
                              Dette vil kreve at du laster siden på nytt.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Avbryt</AlertDialogCancel>
                            <AlertDialogAction onClick={() => setCurrentVersion(version.id)}>
                              Bekreft
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                  {version.description && (
                    <p className="text-sm text-muted-foreground mb-2">{version.description}</p>
                  )}
                  {version.changelog && (
                    <div className="mt-2 p-2 bg-secondary/50 rounded text-sm">
                      <pre className="whitespace-pre-wrap text-muted-foreground">{version.changelog}</pre>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
