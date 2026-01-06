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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Copy } from "lucide-react";

interface ReportDuplicateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemId: string;
  itemName: string;
  itemType: string;
  seriesName?: string;
  imageUrl?: string;
}

export const ReportDuplicateDialog = ({
  open,
  onOpenChange,
  itemId,
  itemName,
  itemType,
  seriesName,
  imageUrl,
}: ReportDuplicateDialogProps) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [description, setDescription] = useState("");

  const submitReport = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Du må være logget inn");

      const { error } = await supabase.from("duplicate_reports").insert({
        user_id: user.id,
        jellyfin_item_id: itemId,
        jellyfin_item_name: itemName,
        jellyfin_item_type: itemType,
        jellyfin_series_name: seriesName || null,
        image_url: imageUrl || null,
        description: description.trim() || null,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Takk! Duplikatrapporten er sendt til admin.");
      queryClient.invalidateQueries({ queryKey: ["duplicate-reports"] });
      onOpenChange(false);
      setDescription("");
    },
    onError: (error) => {
      toast.error(`Kunne ikke sende rapport: ${error.message}`);
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Copy className="h-5 w-5" />
            Rapporter duplikat
          </DialogTitle>
          <DialogDescription>
            Meld inn at du har funnet en duplikat av denne tittelen i biblioteket.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="p-3 bg-secondary/50 rounded-lg">
            <p className="text-sm font-medium">{seriesName ? `${seriesName} - ` : ''}{itemName}</p>
            <p className="text-xs text-muted-foreground">{itemType === 'Movie' ? 'Film' : itemType === 'Episode' ? 'Episode' : itemType}</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Beskrivelse (valgfritt)</Label>
            <Textarea
              id="description"
              placeholder="Beskriv hvor du fant duplikaten, eller annen nyttig informasjon..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="min-h-[80px]"
            />
          </div>
        </div>

        <DialogFooter className="flex gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Avbryt
          </Button>
          <Button 
            onClick={() => submitReport.mutate()}
            disabled={submitReport.isPending}
          >
            {submitReport.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Send rapport
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
