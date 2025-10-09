import { Link, useLocation, useNavigate } from "react-router-dom";
import { Film, Search, User, LogOut, Settings } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { toast } from "sonner";

const Header = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: userRole } = useUserRole(user?.id);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Logget ut");
    navigate("/");
  };

  const navItems = [
    { name: "Hjem", path: "/browse" },
    { name: "Filmer", path: "/movies" },
    { name: "Serier", path: "/series" },
    { name: "Min liste", path: "/mylist" },
  ];

  return (
    <header className="sticky top-0 z-50 bg-background/95 backdrop-blur-lg border-b border-border/50">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between gap-8">
          <div className="flex items-center gap-8">
            <Link to="/browse" className="flex items-center gap-2 group">
              <div className="p-2 rounded-lg bg-primary/10 group-hover:bg-primary/20 smooth-transition">
                <Film className="h-6 w-6 text-primary" />
              </div>
              <span className="text-xl font-bold hidden sm:block">Jellyfin</span>
            </Link>

            <nav className="hidden md:flex items-center gap-6">
              {navItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`text-sm font-medium smooth-transition hover:text-primary ${
                    location.pathname === item.path
                      ? "text-primary"
                      : "text-muted-foreground"
                  }`}
                >
                  {item.name}
                </Link>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative hidden sm:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Søk..."
                className="pl-10 w-64 bg-secondary/50 border-border/50"
              />
            </div>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full">
                  <User className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <div className="px-2 py-1.5 text-sm font-normal">
                  <p className="text-xs text-muted-foreground truncate">
                    {user?.email}
                  </p>
                </div>
                <DropdownMenuSeparator />
                {userRole === "admin" && (
                  <>
                    <DropdownMenuItem onClick={() => navigate("/admin")}>
                      <Settings className="mr-2 h-4 w-4" />
                      Admin
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                )}
                <DropdownMenuItem onClick={handleLogout}>
                  <LogOut className="mr-2 h-4 w-4" />
                  Logg ut
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
