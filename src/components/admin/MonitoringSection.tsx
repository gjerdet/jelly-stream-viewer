import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Server } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import { ServerMonitoring } from "@/components/ServerMonitoring";

interface MonitoringSectionProps {
  userRole?: string | null;
}

export const MonitoringSection = ({ userRole }: MonitoringSectionProps) => {
  const { t, language } = useLanguage();
  const admin = t.admin as any;
  const [monitoringUrl, setMonitoringUrl] = useState("");

  // Load monitoring URL
  useEffect(() => {
    const loadSettings = async () => {
      if (userRole !== "admin") return;
      
      const { data } = await supabase
        .from("server_settings")
        .select("setting_value")
        .eq("setting_key", "monitoring_url")
        .maybeSingle();
      
      if (data?.setting_value) {
        setMonitoringUrl(data.setting_value);
      }
    };
    
    loadSettings();
  }, [userRole]);

  const handleSaveMonitoringUrl = async () => {
    const { error } = await supabase
      .from("server_settings")
      .upsert({ 
        setting_key: "monitoring_url", 
        setting_value: monitoringUrl 
      }, { 
        onConflict: 'setting_key' 
      });
    
    if (error) {
      console.error('Monitoring URL update error:', error);
      toast.error(`${admin.couldNotUpdateMonitoring || "Could not update monitoring URL"}: ${error.message}`);
    } else {
      toast.success(admin.monitoringUpdated || "Monitoring URL updated!");
    }
  };

  const handleSetupNetdata = async () => {
    toast.dismiss();
    
    // Check if we're on a local network
    const isLocalNetwork = () => {
      const hostname = window.location.hostname;
      return (
        hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        hostname.startsWith('192.168.') ||
        hostname.startsWith('10.') ||
        hostname.startsWith('172.') ||
        hostname.endsWith('.local')
      );
    };

    if (!isLocalNetwork()) {
      toast.error(
        "Setup Netdata kan kun kjøres fra lokal nettverkstilgang. Åpne appen fra din lokale server (f.eks. http://192.168.x.x:5173) og prøv igjen.",
        { duration: 10000 }
      );
      return;
    }

    const toastId = toast.loading("Setter opp Netdata...");
    try {
      const { data: settings, error: settingsError } = await supabase
        .from("server_settings")
        .select("setting_key, setting_value")
        .in("setting_key", ["git_pull_server_url", "update_webhook_url"]);

      if (settingsError) throw settingsError;

      const settingsMap = new Map(
        (settings || []).map((row: any) => [row.setting_key, row.setting_value])
      );

      const gitPullUrl =
        settingsMap.get("git_pull_server_url") || settingsMap.get("update_webhook_url");

      if (!gitPullUrl) {
        throw new Error(
          "Git Pull Server URL er ikke konfigurert. Gå til Oppdatering-fanen og sett 'Update webhook URL'."
        );
      }

      let baseUrl = String(gitPullUrl).replace(/\/$/, "");
      if (baseUrl.endsWith("/git-pull")) {
        baseUrl = baseUrl.slice(0, -"/git-pull".length);
      }

      const setupUrl = `${baseUrl}/setup-netdata`;

      const response = await fetch(setupUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        mode: "cors",
      });

      if (!response.ok) {
        throw new Error(`Kunne ikke starte Netdata installasjon (HTTP ${response.status})`);
      }

      const result = await response.json().catch(() => ({} as any));

      toast.dismiss(toastId);
      if (result?.success) {
        toast.success(
          result.alreadyInstalled
            ? "Netdata er allerede installert."
            : "Netdata installasjon startet. Vent noen minutter.",
          { duration: 5000 }
        );

        // Auto-set the URL
        setMonitoringUrl("http://localhost:19999");
        await supabase
          .from("server_settings")
          .upsert(
            {
              setting_key: "monitoring_url",
              setting_value: "http://localhost:19999",
            },
            {
              onConflict: "setting_key",
            }
          );
      } else {
        toast.error(result?.message || "Kunne ikke sette opp Netdata", { duration: 5000 });
      }
    } catch (err: any) {
      console.error("[SetupNetdata] Error:", err);
      toast.dismiss(toastId);
      toast.error(err?.message || "Kunne ikke sette opp Netdata", { duration: 8000 });
    }
  };

  return (
    <div className="space-y-6">
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle>{admin.serverMonitoring || "Server Monitoring"}</CardTitle>
          <CardDescription>
            {admin.monitoringDescription || "Configure monitoring URL to display server statistics (CPU, RAM, disk, network)"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="monitoring-url">{admin.monitoringUrlLabel || "Monitoring URL (Netdata API)"}</Label>
            <Input
              id="monitoring-url"
              type="url"
              placeholder="http://localhost:19999"
              value={monitoringUrl}
              onChange={(e) => setMonitoringUrl(e.target.value)}
              className="bg-secondary/50 border-border/50"
            />
            <p className="text-xs text-muted-foreground">
              {admin.monitoringInstructions || "Install Netdata on your server for live statistics. Default port is 19999."}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <Button 
              onClick={handleSaveMonitoringUrl}
              className="cinema-glow"
            >
              {admin.saveMonitoringUrl || "Save Monitoring URL"}
            </Button>
            <Button 
              variant="outline"
              onClick={handleSetupNetdata}
              className="gap-2"
            >
              <Server className="h-4 w-4" />
              Setup Netdata
            </Button>
          </div>
        </CardContent>
      </Card>

      <ServerMonitoring monitoringUrl={monitoringUrl} />
    </div>
  );
};
