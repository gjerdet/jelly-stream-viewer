import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { User, Mail, Save, ArrowLeft, LogOut, Lock, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import { z } from "zod";

const passwordSchema = z.object({
  currentPassword: z.string().optional(),
  newPassword: z.string().min(6, "Passord må være minst 6 tegn"),
  confirmPassword: z.string()
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passordene må være like",
  path: ["confirmPassword"],
});

const Profile = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading, signOut } = useAuth();
  const { language } = useLanguage();
  
  const [jellyfinUsername, setJellyfinUsername] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [profileLoading, setProfileLoading] = useState(true);
  
  // Password change state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordErrors, setPasswordErrors] = useState<{ currentPassword?: string; newPassword?: string; confirmPassword?: string }>({});

  useEffect(() => {
    // Wait for auth to finish loading before redirecting
    if (authLoading) return;
    
    if (!user) {
      navigate("/");
      return;
    }
    
    fetchProfile();
  }, [user, authLoading, navigate]);

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

  const handleChangePassword = async () => {
    setPasswordErrors({});
    
    try {
      passwordSchema.parse({ currentPassword, newPassword, confirmPassword });
    } catch (error) {
      if (error instanceof z.ZodError) {
        const fieldErrors: { currentPassword?: string; newPassword?: string; confirmPassword?: string } = {};
        error.errors.forEach((err) => {
          if (err.path[0]) {
            fieldErrors[err.path[0] as keyof typeof fieldErrors] = err.message;
          }
        });
        setPasswordErrors(fieldErrors);
        return;
      }
    }

    // Get Jellyfin session from localStorage
    const jellyfinSessionStr = localStorage.getItem('jellyfin_session');
    if (!jellyfinSessionStr) {
      toast.error(language === 'no' ? "Jellyfin-sesjon mangler. Logg inn på nytt." : "Jellyfin session missing. Please log in again.");
      return;
    }

    let jellyfinSession;
    try {
      jellyfinSession = JSON.parse(jellyfinSessionStr);
    } catch {
      toast.error(language === 'no' ? "Ugyldig Jellyfin-sesjon. Logg inn på nytt." : "Invalid Jellyfin session. Please log in again.");
      return;
    }

    setPasswordLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('jellyfin-change-password', {
        body: {
          currentPassword: currentPassword,
          newPassword: newPassword,
          jellyfinUserId: jellyfinSession.UserId,
          jellyfinToken: jellyfinSession.AccessToken,
        }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success(language === 'no' ? "Passord oppdatert i Jellyfin!" : "Password updated in Jellyfin!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error: any) {
      console.error("Error updating password:", error);
      toast.error(error.message || (language === 'no' ? "Kunne ikke oppdatere passord" : "Could not update password"));
    } finally {
      setPasswordLoading(false);
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

      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            {language === 'no' ? 'Endre passord' : 'Change Password'}
          </CardTitle>
          <CardDescription>
            {language === 'no' ? 'Oppdater passordet ditt' : 'Update your password'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="current-password">
              {language === 'no' ? 'Nåværende passord' : 'Current Password'}
            </Label>
            <div className="relative">
              <Input
                id="current-password"
                type={showCurrentPassword ? "text" : "password"}
                placeholder={language === 'no' ? 'Skriv inn nåværende passord' : 'Enter current password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="bg-secondary/50 border-border/50 pr-10"
              />
              <button
                type="button"
                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {passwordErrors?.currentPassword && (
              <p className="text-xs text-destructive">{passwordErrors.currentPassword}</p>
            )}
            <p className="text-xs text-muted-foreground">
              {language === 'no' ? 'La stå tom hvis ingen passord er satt' : 'Leave empty if no password is set'}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="new-password">
              {language === 'no' ? 'Nytt passord' : 'New Password'}
            </Label>
            <div className="relative">
              <Input
                id="new-password"
                type={showNewPassword ? "text" : "password"}
                placeholder={language === 'no' ? 'Skriv inn nytt passord' : 'Enter new password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="bg-secondary/50 border-border/50 pr-10"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {passwordErrors?.newPassword && (
              <p className="text-xs text-destructive">{passwordErrors.newPassword}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm-password">
              {language === 'no' ? 'Bekreft passord' : 'Confirm Password'}
            </Label>
            <div className="relative">
              <Input
                id="confirm-password"
                type={showConfirmPassword ? "text" : "password"}
                placeholder={language === 'no' ? 'Bekreft nytt passord' : 'Confirm new password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="bg-secondary/50 border-border/50 pr-10"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {passwordErrors?.confirmPassword && (
              <p className="text-xs text-destructive">{passwordErrors.confirmPassword}</p>
            )}
          </div>

          <Button
            onClick={handleChangePassword}
            disabled={passwordLoading || !newPassword || !confirmPassword}
            className="w-full"
            variant="secondary"
          >
            <Lock className="h-4 w-4 mr-2" />
            {passwordLoading 
              ? (language === 'no' ? 'Oppdaterer...' : 'Updating...') 
              : (language === 'no' ? 'Oppdater passord' : 'Update Password')}
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
