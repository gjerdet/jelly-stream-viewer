import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { Film } from "lucide-react";
import { Button } from "@/components/ui/button";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="text-center space-y-6">
        <div className="flex justify-center">
          <div className="p-4 rounded-2xl bg-destructive/10">
            <Film className="h-16 w-16 text-destructive" />
          </div>
        </div>
        <div className="space-y-2">
          <h1 className="text-6xl font-bold">404</h1>
          <p className="text-xl text-muted-foreground">Oops! Siden ble ikke funnet</p>
        </div>
        <Link to="/">
          <Button className="cinema-glow">
            Tilbake til forsiden
          </Button>
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
