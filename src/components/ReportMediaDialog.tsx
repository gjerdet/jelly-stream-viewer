import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { 
  Loader2, 
  Volume2, 
  VideoOff, 
  Subtitles, 
  FileQuestion, 
  AlertCircle,
  HelpCircle
} from "lucide-react";

type ReportCategory = "buffering" | "no_audio" | "no_video" | "subtitle_issues" | "wrong_file" | "quality_issues" | "other";

interface ReportMediaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemId: string;
  itemName: string;
  itemType: string;
  seriesName?: string;
  imageUrl?: string;
}

const CATEGORIES: { value: ReportCategory; label: string; icon: React.ElementType; description: string }[] = [
  { value: "buffering", label: "Buffering", icon: Loader2, description: "Filmen/episoden stopper og laster ofte" },
  { value: "no_audio", label: "Ingen lyd", icon: Volume2, description: "Det er ikke lyd i avspillingen" },
  { value: "no_video", label: "Ingen bilde", icon: VideoOff, description: "Det er ikke bilde, bare lyd" },
  { value: "subtitle_issues", label: "Undertekstproblemer", icon: Subtitles, description: "Undertekster mangler eller er feil" },
  { value: "wrong_file", label: "Feil fil", icon: FileQuestion, description: "Feil film/episode spilles av" },
  { value: "quality_issues", label: "Kvalitetsproblemer", icon: AlertCircle, description: "Dårlig bilde- eller lydkvalitet" },
  { value: "other", label: "Annet", icon: HelpCircle, description: "Andre problemer" },
];

export const ReportMediaDialog = ({
  open,
  onOpenChange,
  itemId,
  itemName,
  itemType,
  seriesName,
  imageUrl,
}: ReportMediaDialogProps) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedCategory, setSelectedCategory] = useState<ReportCategory | null>(null);
  const [otherDescription, setOtherDescription] = useState("");

  const submitReport = useMutation({
    mutationFn: async () => {
      if (!user || !selectedCategory) throw new Error("Missing data");
      
      // Validate "other" category requires description
      if (selectedCategory === "other" && !otherDescription.trim()) {
        throw new Error("Vennligst beskriv problemet");
      }

      const { error } = await supabase.from("media_reports").insert({
        user_id: user.id,
        jellyfin_item_id: itemId,
        jellyfin_item_name: itemName,
        jellyfin_item_type: itemType,
        jellyfin_series_name: seriesName || null,
        image_url: imageUrl || null,
        category: selectedCategory,
        admin_notes: selectedCategory === "other" ? `Bruker beskrev: ${otherDescription.trim()}` : null,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Takk for rapporten! Admin vil se på det.");
      queryClient.invalidateQueries({ queryKey: ["media-reports"] });
      onOpenChange(false);
      setSelectedCategory(null);
      setOtherDescription("");
    },
    onError: (error) => {
      toast.error(`Kunne ikke sende rapport: ${error.message}`);
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Rapporter problem</DialogTitle>
          <DialogDescription>
            {itemName}
            {seriesName && ` - ${seriesName}`}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <p className="text-sm text-muted-foreground mb-4">
            Hva slags problem har du med dette innholdet?
          </p>
          
          <RadioGroup 
            value={selectedCategory || ""} 
            onValueChange={(v) => setSelectedCategory(v as ReportCategory)}
            className="space-y-2"
          >
            {CATEGORIES.map((category) => {
              const Icon = category.icon;
              return (
                <div 
                  key={category.value}
                  className={`flex items-start space-x-3 p-3 rounded-lg border transition-colors cursor-pointer ${
                    selectedCategory === category.value 
                      ? "border-primary bg-primary/5" 
                      : "border-border/50 hover:border-border"
                  }`}
                  onClick={() => setSelectedCategory(category.value)}
                >
                  <RadioGroupItem value={category.value} id={category.value} className="mt-0.5" />
                  <div className="flex-1">
                    <Label 
                      htmlFor={category.value} 
                      className="flex items-center gap-2 font-medium cursor-pointer"
                    >
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      {category.label}
                    </Label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {category.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </RadioGroup>

          {/* Free text field for "other" category */}
          {selectedCategory === "other" && (
            <div className="mt-4 space-y-2">
              <Label htmlFor="other-description">Beskriv problemet</Label>
              <Textarea
                id="other-description"
                placeholder="Fortell oss hva som er galt..."
                value={otherDescription}
                onChange={(e) => setOtherDescription(e.target.value)}
                className="min-h-[100px] bg-secondary/50"
                maxLength={500}
              />
              <p className="text-xs text-muted-foreground text-right">
                {otherDescription.length}/500
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Avbryt
          </Button>
          <Button 
            onClick={() => submitReport.mutate()}
            disabled={!selectedCategory || submitReport.isPending || (selectedCategory === "other" && !otherDescription.trim())}
          >
            {submitReport.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Sender...
              </>
            ) : (
              "Send rapport"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
