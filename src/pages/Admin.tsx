import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Header from "@/components/Header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { useServerSettings } from "@/hooks/useServerSettings";
import { Settings } from "lucide-react";

const Admin = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { data: userRole, isLoading: roleLoading } = useUserRole(user?.id);
  const { serverUrl, updateServerUrl } = useServerSettings();
  const [newServerUrl, setNewServerUrl] = useState("");

  useEffect(() => {
    if (serverUrl && !newServerUrl) {
      setNewServerUrl(serverUrl);
    }
  }, [serverUrl]);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/");
    } else if (!roleLoading && userRole !== "admin") {
      navigate("/browse");
    }
  }, [user, userRole, authLoading, roleLoading, navigate]);

  const handleUpdateUrl = () => {
    updateServerUrl.mutate(newServerUrl);
  };

  if (authLoading || roleLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-12">
          <p className="text-center text-muted-foreground">Laster...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-primary/10">
              <Settings className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Admin-innstillinger</h1>
              <p className="text-muted-foreground">Administrer Jellyfin-server</p>
            </div>
          </div>

          <Card className="border-border/50">
            <CardHeader>
              <CardTitle>Server konfigurering</CardTitle>
              <CardDescription>
                Oppdater Jellyfin server URL for alle brukere
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="server-url">Jellyfin Server URL</Label>
                <Input
                  id="server-url"
                  type="url"
                  placeholder="http://jellyfin.gjerdet.casa/"
                  value={newServerUrl}
                  onChange={(e) => setNewServerUrl(e.target.value)}
                  className="bg-secondary/50 border-border/50"
                />
              </div>
              <Button 
                onClick={handleUpdateUrl}
                disabled={updateServerUrl.isPending || newServerUrl === serverUrl}
                className="cinema-glow"
              >
                {updateServerUrl.isPending ? "Oppdaterer..." : "Oppdater URL"}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Admin;
