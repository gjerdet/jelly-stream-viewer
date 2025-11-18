import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import { Film } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useServerSettings } from "@/hooks/useServerSettings";

const authSchema = z.object({
  username: z.string().trim().min(1, "Brukernavn er påkrevd").max(255),
  password: z.string().min(1, "Passord er påkrevd"),
});

const Login = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { serverUrl } = useServerSettings();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ username?: string; password?: string }>({});

  useEffect(() => {
    if (user) {
      navigate("/browse");
    }
  }, [user, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    
    // Valider input
    try {
      authSchema.parse({ username, password });
    } catch (error) {
      if (error instanceof z.ZodError) {
        const fieldErrors: { username?: string; password?: string } = {};
        error.errors.forEach((err) => {
          if (err.path[0]) {
            fieldErrors[err.path[0] as keyof typeof fieldErrors] = err.message;
          }
        });
        setErrors(fieldErrors);
        return;
      }
    }

    if (!serverUrl) {
      toast.error("Server URL ikke konfigurert. Gå til /setup først.");
      return;
    }

    setLoading(true);

    try {
      // Autentiser direkte mot Jellyfin (lokal server)
      let jellyfinUrl = serverUrl.replace(/\/$/, '');
      
      // Legg til http:// hvis protokoll mangler
      if (!jellyfinUrl.startsWith('http://') && !jellyfinUrl.startsWith('https://')) {
        jellyfinUrl = `http://${jellyfinUrl}`;
      }
      
      const authUrl = `${jellyfinUrl}/Users/AuthenticateByName`;
      
      const response = await fetch(authUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Emby-Authorization': 'MediaBrowser Client="Jellyfin Web", Device="Browser", DeviceId="browser-' + Date.now() + '", Version="1.0.0"',
        },
        body: JSON.stringify({
          Username: username.trim(),
          Pw: password,
        }),
      });

      if (!response.ok) {
        throw new Error('Autentisering feilet');
      }

      const jellyfinData = await response.json();

      // Lagre Jellyfin-sesjon i localStorage
      const jellyfinSession = {
        AccessToken: jellyfinData.AccessToken,
        UserId: jellyfinData.User.Id,
        Username: jellyfinData.User.Name,
        ServerId: jellyfinData.ServerId,
      };
      localStorage.setItem('jellyfin_session', JSON.stringify(jellyfinSession));

      // Opprett eller logg inn Supabase-bruker
      const userEmail = `${jellyfinData.User.Id}@jellyfin.local`;
      const userPassword = `jellyfin_${jellyfinData.User.Id}`;

      // Prøv å logge inn først
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: userEmail,
        password: userPassword,
      });

      // Hvis bruker ikke eksisterer, opprett dem
      if (signInError && signInError.message.includes('Invalid login credentials')) {
        const { error: signUpError } = await supabase.auth.signUp({
          email: userEmail,
          password: userPassword,
          options: {
            data: {
              jellyfin_user_id: jellyfinData.User.Id,
              jellyfin_username: jellyfinData.User.Name,
            },
          },
        });

        if (signUpError) {
          console.error('Supabase signup error:', signUpError);
          // Fortsett likevel hvis Jellyfin-autentisering var vellykket
        }
      }
      
      toast.success("Logget inn!");
      navigate("/browse");
    } catch (error) {
      console.error('Login error:', error);
      toast.error("Feil brukernavn eller passord");
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 relative overflow-hidden">
      <div className="absolute inset-0 gradient-hero opacity-50" />
      
      <Card className="w-full max-w-md relative z-10 border-border/50 bg-card/95 backdrop-blur-xl">
        <CardHeader className="space-y-4 text-center">
          <div className="flex justify-center">
            <div className="p-4 rounded-2xl bg-primary/10 cinema-glow">
              <Film className="h-12 w-12 text-primary" />
            </div>
          </div>
          <CardTitle className="text-3xl font-bold">Jellyfin Streaming</CardTitle>
          <CardDescription className="text-base">
            Logg inn på din Jellyfin-server for å se innhold
          </CardDescription>
          <p className="text-xs text-muted-foreground mt-2">
            Første gang? <a href="/setup" className="text-primary hover:underline">Sett opp serveren først</a>
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Brukernavn</Label>
              <Input
                id="username"
                type="text"
                placeholder="Skriv inn brukernavn"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="bg-secondary/50 border-border/50"
              />
              {errors.username && (
                <p className="text-sm text-destructive">{errors.username}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Passord</Label>
              <Input
                id="password"
                type="password"
                placeholder="Skriv inn passord"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-secondary/50 border-border/50"
              />
              {errors.password && (
                <p className="text-sm text-destructive">{errors.password}</p>
              )}
            </div>
            <Button 
              type="submit" 
              className="w-full cinema-glow smooth-transition hover:scale-[1.02]"
              disabled={loading}
            >
              {loading ? "Logger inn..." : "Logg inn"}
            </Button>
          </form>
          
          <p className="text-xs text-muted-foreground text-center mt-4">
            Jellyfin server: {serverUrl || "Laster..."}
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default Login;
