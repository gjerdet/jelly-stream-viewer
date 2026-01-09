import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { useLanguage } from "@/contexts/LanguageContext";
import { useSiteSettings } from "@/hooks/useSiteSettings";

export const SiteSettingsSection = () => {
  const { t, language } = useLanguage();
  const admin = t.admin as any;
  const { 
    siteName, 
    logoUrl, 
    headerTitle, 
    loginBackgroundUrl, 
    loginTransparency, 
    loginTitle, 
    loginDescription, 
    updateSetting 
  } = useSiteSettings();

  const [newSiteName, setNewSiteName] = useState("");
  const [newLogoUrl, setNewLogoUrl] = useState("");
  const [newHeaderTitle, setNewHeaderTitle] = useState("");
  const [newLoginBackgroundUrl, setNewLoginBackgroundUrl] = useState("");
  const [newLoginTransparency, setNewLoginTransparency] = useState(95);
  const [newLoginTitle, setNewLoginTitle] = useState("");
  const [newLoginDescription, setNewLoginDescription] = useState("");

  useEffect(() => {
    if (siteName && !newSiteName) setNewSiteName(siteName);
    if (logoUrl !== undefined && !newLogoUrl) setNewLogoUrl(logoUrl);
    if (headerTitle && !newHeaderTitle) setNewHeaderTitle(headerTitle);
    if (loginBackgroundUrl !== undefined && !newLoginBackgroundUrl) setNewLoginBackgroundUrl(loginBackgroundUrl);
    if (loginTitle && !newLoginTitle) setNewLoginTitle(loginTitle);
    if (loginDescription && !newLoginDescription) setNewLoginDescription(loginDescription);
    setNewLoginTransparency(loginTransparency);
  }, [siteName, logoUrl, headerTitle, loginBackgroundUrl, loginTransparency, loginTitle, loginDescription]);

  const handleUpdateSiteName = () => {
    if (newSiteName.trim()) {
      updateSetting({ key: "site_name", value: newSiteName.trim() });
    }
  };

  const handleUpdateLogoUrl = () => {
    updateSetting({ key: "site_logo_url", value: newLogoUrl.trim() });
  };

  const handleUpdateHeaderTitle = () => {
    if (newHeaderTitle.trim()) {
      updateSetting({ key: "site_header_title", value: newHeaderTitle.trim() });
    }
  };

  return (
    <div className="space-y-6">
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle>{admin.siteNameTitle || "Site Name"}</CardTitle>
          <CardDescription>
            {admin.siteNameDescription || "Change the name of the website"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="site-name">{admin.siteName || "Site Name"}</Label>
            <Input
              id="site-name"
              type="text"
              placeholder="Jelly Stream Viewer"
              value={newSiteName}
              onChange={(e) => setNewSiteName(e.target.value)}
              className="bg-secondary/50 border-border/50"
            />
          </div>
          <Button onClick={handleUpdateSiteName} className="cinema-glow">
            {admin.updateSiteName || "Update Site Name"}
          </Button>
        </CardContent>
      </Card>

      <Card className="border-border/50">
        <CardHeader>
          <CardTitle>{admin.logoUrl || "Logo URL"}</CardTitle>
          <CardDescription>
            {admin.logoUrlDescription || "Add a logo that replaces the standard icon (leave blank for default)"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="logo-url">{admin.logoUrl || "Logo URL"}</Label>
            <Input
              id="logo-url"
              type="url"
              placeholder="https://example.com/logo.png"
              value={newLogoUrl}
              onChange={(e) => setNewLogoUrl(e.target.value)}
              className="bg-secondary/50 border-border/50"
            />
            {newLogoUrl && (
              <div className="mt-2 flex items-center gap-2">
                <span className="text-sm text-muted-foreground">{admin.preview || "Preview"}:</span>
                <img 
                  src={newLogoUrl} 
                  alt="Logo preview" 
                  className="h-8 w-auto object-contain border border-border rounded"
                  onError={(e) => (e.currentTarget.style.display = 'none')}
                />
              </div>
            )}
          </div>
          <Button onClick={handleUpdateLogoUrl} className="cinema-glow">
            {admin.updateLogo || "Update Logo"}
          </Button>
        </CardContent>
      </Card>

      <Card className="border-border/50">
        <CardHeader>
          <CardTitle>{admin.headerTitleLabel || "Header Title"}</CardTitle>
          <CardDescription>
            {admin.headerTitleDescription || "Change the text displayed in the header"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="header-title">{admin.headerTitle || "Header Title"}</Label>
            <Input
              id="header-title"
              type="text"
              placeholder="Jelly Stream"
              value={newHeaderTitle}
              onChange={(e) => setNewHeaderTitle(e.target.value)}
              className="bg-secondary/50 border-border/50"
            />
          </div>
          <Button onClick={handleUpdateHeaderTitle} className="cinema-glow">
            {admin.updateTitle || "Update Title"}
          </Button>
        </CardContent>
      </Card>

      <Card className="border-border/50">
        <CardHeader>
          <CardTitle>{language === 'no' ? 'Innloggingsside' : 'Login Page'}</CardTitle>
          <CardDescription>
            {language === 'no' ? 'Tilpass utseendet på innloggingssiden' : 'Customize the login page appearance'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="login-bg-url">{language === 'no' ? 'Bakgrunnsbilde URL' : 'Background Image URL'}</Label>
            <Input
              id="login-bg-url"
              type="url"
              placeholder="https://example.com/background.jpg"
              value={newLoginBackgroundUrl}
              onChange={(e) => setNewLoginBackgroundUrl(e.target.value)}
              className="bg-secondary/50 border-border/50"
            />
          </div>
          
          <div className="space-y-2">
            <Label>{language === 'no' ? 'Gjennomsiktighet' : 'Transparency'}: {newLoginTransparency}%</Label>
            <Slider
              value={[newLoginTransparency]}
              onValueChange={(value) => setNewLoginTransparency(value[0])}
              max={100}
              min={50}
              step={5}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="login-title">{language === 'no' ? 'Tittel' : 'Title'}</Label>
            <Input
              id="login-title"
              type="text"
              placeholder={language === 'no' ? 'Velkommen' : 'Welcome'}
              value={newLoginTitle}
              onChange={(e) => setNewLoginTitle(e.target.value)}
              className="bg-secondary/50 border-border/50"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="login-description">{language === 'no' ? 'Beskrivelse' : 'Description'}</Label>
            <Input
              id="login-description"
              type="text"
              placeholder={language === 'no' ? 'Logg inn for å fortsette' : 'Log in to continue'}
              value={newLoginDescription}
              onChange={(e) => setNewLoginDescription(e.target.value)}
              className="bg-secondary/50 border-border/50"
            />
          </div>

          <Button 
            onClick={() => {
              if (newLoginBackgroundUrl !== loginBackgroundUrl) {
                updateSetting({ key: "login_background_url", value: newLoginBackgroundUrl.trim() });
              }
              if (newLoginTransparency !== loginTransparency) {
                updateSetting({ key: "login_transparency", value: newLoginTransparency.toString() });
              }
              if (newLoginTitle.trim()) {
                updateSetting({ key: "login_title", value: newLoginTitle.trim() });
              }
              if (newLoginDescription.trim()) {
                updateSetting({ key: "login_description", value: newLoginDescription.trim() });
              }
            }}
            className="cinema-glow"
          >
            {language === 'no' ? 'Oppdater innloggingsside' : 'Update Login Page'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};
