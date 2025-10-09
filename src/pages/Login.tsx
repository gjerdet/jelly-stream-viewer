import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Film } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

// Sett din Jellyfin server URL her
const JELLYFIN_SERVER_URL = "https://din-jellyfin-server.com";

const loginSchema = z.object({
  username: z.string().trim().min(1, "Brukernavn er påkrevd").max(100),
  password: z.string().min(1, "Passord er påkrevd"),
});

const Login = () => {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ username?: string; password?: string }>({});

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    
    // Valider input
    try {
      loginSchema.parse({ username, password });
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

    // Her vil du kalle Jellyfin API med JELLYFIN_SERVER_URL
    // Eksempel: await fetch(`${JELLYFIN_SERVER_URL}/Users/AuthenticateByName`, ...)
    
    // Simulert login - bytt ut med faktisk Jellyfin API-kall
    setTimeout(() => {
      setLoading(false);
      toast.success("Logget inn!");
      navigate("/browse");
    }, 1000);
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
            Kobler til: {JELLYFIN_SERVER_URL}
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default Login;
