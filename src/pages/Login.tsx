import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Film } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useServerSettings } from "@/hooks/useServerSettings";

const authSchema = z.object({
  email: z.string().trim().email("Ugyldig e-postadresse").max(255),
  password: z.string().min(6, "Passord må være minst 6 tegn"),
});

const Login = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { serverUrl } = useServerSettings();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

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
      authSchema.parse({ email, password });
    } catch (error) {
      if (error instanceof z.ZodError) {
        const fieldErrors: { email?: string; password?: string } = {};
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

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Logget inn!");
      navigate("/browse");
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    
    try {
      authSchema.parse({ email, password });
    } catch (error) {
      if (error instanceof z.ZodError) {
        const fieldErrors: { email?: string; password?: string } = {};
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

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/browse`
      }
    });

    setLoading(false);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Konto opprettet! Du kan nå logge inn.");
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
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Logg inn</TabsTrigger>
              <TabsTrigger value="signup">Registrer</TabsTrigger>
            </TabsList>
            
            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email-login">E-post</Label>
                  <Input
                    id="email-login"
                    type="email"
                    placeholder="din@epost.no"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="bg-secondary/50 border-border/50"
                  />
                  {errors.email && (
                    <p className="text-sm text-destructive">{errors.email}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password-login">Passord</Label>
                  <Input
                    id="password-login"
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
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={handleSignUp} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email-signup">E-post</Label>
                  <Input
                    id="email-signup"
                    type="email"
                    placeholder="din@epost.no"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="bg-secondary/50 border-border/50"
                  />
                  {errors.email && (
                    <p className="text-sm text-destructive">{errors.email}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password-signup">Passord</Label>
                  <Input
                    id="password-signup"
                    type="password"
                    placeholder="Minst 6 tegn"
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
                  {loading ? "Registrerer..." : "Opprett konto"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
          
          <p className="text-xs text-muted-foreground text-center mt-4">
            Jellyfin server: {serverUrl || "Laster..."}
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default Login;
