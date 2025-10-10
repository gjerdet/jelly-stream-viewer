import { Link, useLocation, useNavigate } from "react-router-dom";
import { Film, Search, User, LogOut, Settings, X } from "lucide-react";
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
import { useServerSettings } from "@/hooks/useServerSettings";
import { useJellyfinApi } from "@/hooks/useJellyfinApi";
import { toast } from "sonner";
import { useState, useEffect, useRef } from "react";

interface JellyfinItem {
  Id: string;
  Name: string;
  Type: string;
  ProductionYear?: number;
  ImageTags?: { Primary?: string };
}

interface JellyfinResponse {
  Items: JellyfinItem[];
}

const Header = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: userRole } = useUserRole(user?.id);
  const { serverUrl } = useServerSettings();
  const [searchQuery, setSearchQuery] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const searchRef = useRef<HTMLDivElement>(null);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Fetch users to get user ID
  const { data: usersData } = useJellyfinApi<{ Id: string }[]>(
    ["jellyfin-users-header"],
    {
      endpoint: `/Users`,
    },
    !!user
  );

  const userId = usersData?.[0]?.Id;

  // Search suggestions
  const { data: suggestions } = useJellyfinApi<JellyfinResponse>(
    ["search-suggestions", userId || "", debouncedQuery],
    {
      endpoint: userId && debouncedQuery.trim()
        ? `/Users/${userId}/Items?SearchTerm=${encodeURIComponent(debouncedQuery.trim())}&IncludeItemTypes=Movie,Series&Recursive=true&Fields=PrimaryImageAspectRatio&ImageTypeLimit=1&EnableImageTypes=Primary&Limit=5`
        : "",
    },
    !!user && !!userId && !!debouncedQuery.trim()
  );

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Logget ut");
    navigate("/");
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      setShowSuggestions(false);
      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const handleSuggestionClick = (id: string) => {
    setShowSuggestions(false);
    setSearchQuery("");
    navigate(`/detail/${id}`);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchQuery(value);
    setShowSuggestions(value.trim().length > 0);
  };

  const handleClearSearch = () => {
    setSearchQuery("");
    setShowSuggestions(false);
  };

  const navItems = [
    { name: "Hjem", path: "/browse" },
    { name: "Filmer", path: "/movies" },
    { name: "Serier", path: "/series" },
    { name: "Min liste", path: "/my-list" },
    { name: "Ønsker", path: "/wishes" },
    { name: "Søk", path: "/requests" },
    { name: "Historikk", path: "/history" },
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
            <div ref={searchRef} className="relative hidden sm:block">
              <form onSubmit={handleSearch}>
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
                <Input
                  placeholder="Søk..."
                  value={searchQuery}
                  onChange={handleInputChange}
                  onFocus={() => searchQuery.trim() && setShowSuggestions(true)}
                  className="pl-10 pr-10 w-64 bg-secondary/50 border-border/50"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={handleClearSearch}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </form>

              {showSuggestions && suggestions?.Items && suggestions.Items.length > 0 && (
                <div className="absolute top-full mt-2 w-full bg-card border border-border rounded-lg shadow-lg overflow-hidden z-50">
                  {suggestions.Items.map((item) => (
                    <button
                      key={item.Id}
                      onClick={() => handleSuggestionClick(item.Id)}
                      className="w-full flex items-center gap-3 p-3 hover:bg-accent smooth-transition text-left"
                    >
                      <div className="w-10 h-14 flex-shrink-0 bg-secondary rounded overflow-hidden">
                        {serverUrl && item.ImageTags?.Primary ? (
                          <img
                            src={`${serverUrl.replace(/\/$/, '')}/Items/${item.Id}/Images/Primary?maxHeight=100`}
                            alt={item.Name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Film className="h-5 w-5 text-muted-foreground" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{item.Name}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.Type === "Movie" ? "Film" : "Serie"}
                          {item.ProductionYear && ` • ${item.ProductionYear}`}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
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
