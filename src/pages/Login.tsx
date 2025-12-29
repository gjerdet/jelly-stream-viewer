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
import { useSiteSettings } from "@/hooks/useSiteSettings";

const authSchema = z.object({
  username: z.string().trim().min(1, "Brukernavn er påkrevd").max(255),
  password: z.string().min(1, "Passord er påkrevd"),
});

const Login = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { loginBackgroundUrl, loginTransparency, loginTitle, loginDescription } = useSiteSettings();
  const { serverUrl, isLoading: serverSettingsLoading } = useServerSettings();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ username?: string; password?: string }>({});
  const showDemo = import.meta.env.DEV;

  useEffect(() => {
    if (user) {
      navigate("/browse");
    }
  }, [user, navigate]);

  const handleDemoLogin = async () => {
    setErrors({});
    setLoading(true);

    try {
      const demoPassword = "demo_jellyfin_test_user_2024";

      const getOrCreateDemoEmail = () => {
        const key = "demo_auth_email";
        const existing = localStorage.getItem(key);
        if (existing) return existing;

        const id =
          typeof crypto !== "undefined" &&
          "randomUUID" in crypto &&
          typeof (crypto as Crypto).randomUUID === "function"
            ? (crypto as Crypto).randomUUID()
            : `${Date.now()}_${Math.random().toString(16).slice(2)}`;

        const email = `demo+${id}@jellyfin.local`;
        localStorage.setItem(key, email);
        return email;
      };

      const demoEmail = getOrCreateDemoEmail();

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: demoEmail,
        password: demoPassword,
      });

      if (signInError && signInError.message.includes("Invalid login credentials")) {
        const { error: signUpError } = await supabase.auth.signUp({
          email: demoEmail,
          password: demoPassword,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
            data: {
              jellyfin_user_id: "demo-user-id",
              jellyfin_username: "Demo User",
            },
          },
        });

        if (signUpError) {
          // Hvis denne enheten har en gammel demo-email liggende, generer en ny automatisk
          localStorage.removeItem("demo_auth_email");
          return await handleDemoLogin();
        }

        const { error: loginError } = await supabase.auth.signInWithPassword({
          email: demoEmail,
          password: demoPassword,
        });

        if (loginError) throw loginError;
      } else if (signInError) {
        throw signInError;
      }

      toast.success("Logget inn i demo-modus!");
      navigate("/browse");
    } catch (error) {
      console.error("Demo login error:", error);
      toast.error("Demo-innlogging feilet");
    } finally {
      setLoading(false);
    }
  };

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

    setLoading(true);

    try {
      // Normal Jellyfin-autentisering via backend-funksjon
      const { data: authData, error: authError } = await supabase.functions.invoke(
        "jellyfin-authenticate",
        {
          body: { username: username.trim(), password },
        }
      );

      if (authError || !authData) {
        console.error("Authentication error:", authError);
        throw new Error(authData?.error || "Autentisering feilet");
      }

      // Sett Supabase session først
      if (authData.supabase_session) {
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: authData.supabase_session.access_token,
          refresh_token: authData.supabase_session.refresh_token,
        });

        if (sessionError) {
          console.error("Failed to set Supabase session:", sessionError);
          throw new Error("Kunne ikke sette brukerøkt");
        }
      }

      // Lagre Jellyfin-sesjon i localStorage
      localStorage.setItem("jellyfin_session", JSON.stringify(authData.jellyfin_session));
      window.dispatchEvent(new Event("jellyfin-session-change"));

      toast.success("Logget inn!");
      navigate("/browse");
    } catch (error) {
      console.error("Login error:", error);
      if (error instanceof Error) {
        if (error.message.includes("Failed to fetch")) {
          toast.error(
            "Kunne ikke koble til Jellyfin-serveren. Sjekk at URL er korrekt."
          );
        } else {
          toast.error(error.message || "Feil brukernavn eller passord");
        }
      } else {
        toast.error("Feil brukernavn eller passord");
      }
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-3 sm:p-4 relative overflow-hidden">
      {loginBackgroundUrl ? (
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: `url(${loginBackgroundUrl})` }}
        >
          <div className="absolute inset-0 bg-black/60" />
        </div>
      ) : (
        <div className="absolute inset-0 gradient-hero opacity-50" />
      )}
      
      <Card className="w-full max-w-md relative z-10 border-border/50 backdrop-blur-xl mx-2 sm:mx-4" style={{ backgroundColor: `hsl(var(--card) / ${loginTransparency / 100})` }}>
        <CardHeader className="space-y-3 sm:space-y-4 text-center px-4 sm:px-6 pt-4 sm:pt-6">
          <div className="flex justify-center">
            <div className="p-3 sm:p-4 rounded-2xl bg-primary/10 cinema-glow">
              <Film className="h-8 w-8 sm:h-12 sm:w-12 text-primary" />
            </div>
          </div>
          <CardTitle className="text-2xl sm:text-3xl font-bold">{loginTitle}</CardTitle>
          <CardDescription className="text-sm sm:text-base">
            {loginDescription}
          </CardDescription>
          {!serverSettingsLoading && !serverUrl && (
            <p className="text-xs text-muted-foreground mt-2">
              Første gang? <a href="/setup" className="text-primary hover:underline">Sett opp serveren først</a>
            </p>
          )}
        </CardHeader>
        <CardContent className="px-4 sm:px-6 pb-4 sm:pb-6">
          <form onSubmit={handleLogin} className="space-y-3 sm:space-y-4">
            <div className="space-y-1.5 sm:space-y-2">
              <Label htmlFor="username" className="text-sm">Brukernavn</Label>
              <Input
                id="username"
                type="text"
                placeholder="Skriv inn brukernavn"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="bg-secondary/50 border-border/50 h-11 text-base"
              />
              {errors.username && (
                <p className="text-xs sm:text-sm text-destructive">{errors.username}</p>
              )}
            </div>
            <div className="space-y-1.5 sm:space-y-2">
              <Label htmlFor="password" className="text-sm">Passord</Label>
              <Input
                id="password"
                type="password"
                placeholder="Skriv inn passord"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-secondary/50 border-border/50 h-11 text-base"
              />
              {errors.password && (
                <p className="text-xs sm:text-sm text-destructive">{errors.password}</p>
              )}
            </div>
            <Button
              type="submit"
              className="w-full cinema-glow smooth-transition hover:scale-[1.02] h-11 sm:h-12 text-base"
              disabled={loading}
            >
              {loading ? "Logger inn..." : "Logg inn"}
            </Button>

            {showDemo && (
              <Button
                type="button"
                variant="secondary"
                className="w-full"
                onClick={handleDemoLogin}
                disabled={loading}
              >
                Demo-modus (kun testing)
              </Button>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default Login;
