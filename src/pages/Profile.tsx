import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { User, Mail, Save, ArrowLeft, LogOut } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";

const Profile = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { language } = useLanguage();
  
  const [jellyfinUsername, setJellyfinUsername] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [profileLoading, setProfileLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      navigate("/");
      return;
    }
    
    fetchProfile();
  }, [user, navigate]);

  const fetchProfile = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (error) throw error;

      if (data) {
        setJellyfinUsername(data.jellyfin_username || "");
        setEmail(data.email || user.email || "");
      }
    } catch (error) {
      console.error("Error fetching profile:", error);
      setEmail(user.email || "");
    } finally {
      setProfileLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          jellyfin_username: jellyfinUsername.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id);

      if (error) throw error;

      toast.success(language === 'no' ? "Profil oppdatert!" : "Profile updated!");
    } catch (error) {
      console.error("Error updating profile:", error);
      toast.error(language === 'no' ? "Kunne ikke oppdatere profil" : "Could not update profile");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await signOut();
    navigate("/");
  };

  if (profileLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="container max-w-2xl mx-auto p-4 sm:p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(-1)}
          className="shrink-0"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-2xl font-bold">
          {language === 'no' ? 'Min profil' : 'My Profile'}
        </h1>
      </div>

      <Card className="border-border/50">
        <CardHeader className="text-center pb-2">
          <div className="flex justify-center mb-4">
            <Avatar className="h-20 w-20">
              <AvatarFallback className="text-2xl bg-primary/20 text-primary">
                {jellyfinUsername?.charAt(0)?.toUpperCase() || email?.charAt(0)?.toUpperCase() || "U"}
              </AvatarFallback>
            </Avatar>
          </div>
          <CardTitle>{jellyfinUsername || email}</CardTitle>
          <CardDescription>
            {language === 'no' ? 'Administrer profilinnstillingene dine' : 'Manage your profile settings'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email" className="flex items-center gap-2">
              <Mail className="h-4 w-4" />
              {language === 'no' ? 'E-post' : 'Email'}
            </Label>
            <Input
              id="email"
              type="email"
              value={email}
              disabled
              className="bg-secondary/30 border-border/50"
            />
            <p className="text-xs text-muted-foreground">
              {language === 'no' ? 'E-post kan ikke endres' : 'Email cannot be changed'}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="username" className="flex items-center gap-2">
              <User className="h-4 w-4" />
              {language === 'no' ? 'Jellyfin-brukernavn' : 'Jellyfin Username'}
            </Label>
            <Input
              id="username"
              type="text"
              placeholder={language === 'no' ? 'Ditt Jellyfin-brukernavn' : 'Your Jellyfin username'}
              value={jellyfinUsername}
              onChange={(e) => setJellyfinUsername(e.target.value)}
              className="bg-secondary/50 border-border/50"
            />
          </div>

          <Button
            onClick={handleSaveProfile}
            disabled={loading}
            className="w-full cinema-glow"
          >
            <Save className="h-4 w-4 mr-2" />
            {loading 
              ? (language === 'no' ? 'Lagrer...' : 'Saving...') 
              : (language === 'no' ? 'Lagre endringer' : 'Save Changes')}
          </Button>
        </CardContent>
      </Card>

      <Card className="border-border/50 border-destructive/20">
        <CardHeader>
          <CardTitle className="text-destructive">
            {language === 'no' ? 'Handlinger' : 'Actions'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Button
            variant="destructive"
            onClick={handleLogout}
            className="w-full"
          >
            <LogOut className="h-4 w-4 mr-2" />
            {language === 'no' ? 'Logg ut' : 'Log out'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default Profile;
