import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import { QBittorrentStatus } from "@/components/QBittorrentStatus";

interface QBittorrentSectionProps {
  userRole?: string | null;
}

export const QBittorrentSection = ({ userRole }: QBittorrentSectionProps) => {
  const { t, language } = useLanguage();
  const admin = t.admin as any;
  
  const [qbittorrentUrl, setQbittorrentUrl] = useState("");
  const [qbittorrentPort, setQbittorrentPort] = useState("8080");
  const [qbittorrentUsername, setQbittorrentUsername] = useState("");
  const [qbittorrentPassword, setQbittorrentPassword] = useState("");

  // Load qBittorrent settings
  useEffect(() => {
    const loadSettings = async () => {
      if (userRole !== "admin") return;
      
      const { data } = await supabase
        .from("server_settings")
        .select("setting_key, setting_value")
        .in("setting_key", [
          "qbittorrent_url",
          "qbittorrent_port",
          "qbittorrent_username",
          "qbittorrent_password"
        ]);
      
      data?.forEach(setting => {
        if (setting.setting_key === "qbittorrent_url") setQbittorrentUrl(setting.setting_value || "");
        if (setting.setting_key === "qbittorrent_port") setQbittorrentPort(setting.setting_value || "8080");
        if (setting.setting_key === "qbittorrent_username") setQbittorrentUsername(setting.setting_value || "");
        if (setting.setting_key === "qbittorrent_password") setQbittorrentPassword(setting.setting_value || "");
      });
    };
    
    loadSettings();
  }, [userRole]);

  const handleSaveSettings = async () => {
    const updates = [
      { setting_key: "qbittorrent_url", setting_value: qbittorrentUrl },
      { setting_key: "qbittorrent_port", setting_value: qbittorrentPort },
      { setting_key: "qbittorrent_username", setting_value: qbittorrentUsername },
      { setting_key: "qbittorrent_password", setting_value: qbittorrentPassword },
    ];
    
    const { error } = await supabase
      .from("server_settings")
      .upsert(updates, { onConflict: 'setting_key' });
    
    if (error) {
      console.error('qBittorrent settings update error:', error);
      toast.error(`${admin.couldNotUpdateQbittorrent || "Could not update qBittorrent settings"}: ${error.message}`);
    } else {
      toast.success(admin.qbittorrentUpdated || "qBittorrent settings updated!");
    }
  };

  return (
    <div className="space-y-6">
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle>{admin.qbittorrentIntegration || "qBittorrent Integration"}</CardTitle>
          <CardDescription>
            {admin.qbittorrentDescription || "Configure qBittorrent Web UI to display download status"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="qbittorrent-url">{admin.qbittorrentUrlLabel || "qBittorrent Host/IP"}</Label>
            <Input
              id="qbittorrent-url"
              type="text"
              placeholder="http://localhost eller http://192.168.1.100"
              value={qbittorrentUrl}
              onChange={(e) => setQbittorrentUrl(e.target.value)}
              className="bg-secondary/50 border-border/50"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="qbittorrent-port">{admin.qbittorrentPortLabel || "Port"}</Label>
            <Input
              id="qbittorrent-port"
              type="number"
              placeholder="8080"
              value={qbittorrentPort}
              onChange={(e) => setQbittorrentPort(e.target.value)}
              className="bg-secondary/50 border-border/50"
            />
            <p className="text-sm text-muted-foreground">
              {admin.qbittorrentPortHint || "For Docker: ofte 30000-30100 range (f.eks. 30024)"}
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="qbittorrent-username">{admin.qbittorrentUsername || "Username"}</Label>
            <Input
              id="qbittorrent-username"
              type="text"
              placeholder="admin"
              value={qbittorrentUsername}
              onChange={(e) => setQbittorrentUsername(e.target.value)}
              className="bg-secondary/50 border-border/50"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="qbittorrent-password">{admin.qbittorrentPassword || "Password"}</Label>
            <Input
              id="qbittorrent-password"
              type="password"
              placeholder="••••••••"
              value={qbittorrentPassword}
              onChange={(e) => setQbittorrentPassword(e.target.value)}
              className="bg-secondary/50 border-border/50"
            />
          </div>
          <Button 
            onClick={handleSaveSettings}
            className="cinema-glow"
          >
            {admin.saveQbittorrentSettings || "Save qBittorrent Settings"}
          </Button>
        </CardContent>
      </Card>

      <QBittorrentStatus qbUrl={qbittorrentUrl && qbittorrentPort ? `${qbittorrentUrl}:${qbittorrentPort}` : ""} />
    </div>
  );
};
