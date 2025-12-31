import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Chrome, Smartphone, Monitor, ExternalLink } from "lucide-react";

interface CastUnsupportedDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const CastUnsupportedDialog = ({ open, onOpenChange }: CastUnsupportedDialogProps) => {
  const getBrowserName = () => {
    const ua = navigator.userAgent.toLowerCase();
    if (/firefox/i.test(ua)) return "Firefox";
    if (/safari/i.test(ua) && !/chrome/i.test(ua)) return "Safari";
    return "denne nettleseren";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-background/95 backdrop-blur-sm border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Monitor className="h-5 w-5 text-primary" />
            Chromecast ikke støttet
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Chromecast fungerer dessverre ikke i {getBrowserName()}. Her er dine alternativer:
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          {/* Chrome option */}
          <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
            <Chrome className="h-8 w-8 text-primary shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="font-medium text-foreground">Bruk Chrome eller Edge</h4>
              <p className="text-sm text-muted-foreground">
                Åpne denne siden i Chrome, Edge eller annen Chromium-basert nettleser for å caste direkte.
              </p>
            </div>
          </div>

          {/* Mobile app option */}
          <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
            <Smartphone className="h-8 w-8 text-primary shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="font-medium text-foreground">Bruk Jellyfin-appen</h4>
              <p className="text-sm text-muted-foreground">
                Last ned Jellyfin-appen på mobilen din. Den har innebygd Cast-støtte som fungerer fra alle enheter.
              </p>
              <div className="flex gap-2 mt-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => window.open('https://apps.apple.com/app/jellyfin-mobile/id1480192618', '_blank')}
                >
                  <ExternalLink className="h-3 w-3 mr-1" />
                  iOS
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => window.open('https://play.google.com/store/apps/details?id=org.jellyfin.mobile', '_blank')}
                >
                  <ExternalLink className="h-3 w-3 mr-1" />
                  Android
                </Button>
              </div>
            </div>
          </div>

          {/* Chromecast built-in apps */}
          <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
            <Monitor className="h-8 w-8 text-primary shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="font-medium text-foreground">Jellyfin på Chromecast/TV</h4>
              <p className="text-sm text-muted-foreground">
                Hvis du har Chromecast med Google TV eller Android TV, kan du installere Jellyfin-appen direkte på enheten.
              </p>
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Lukk
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
