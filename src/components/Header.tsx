import { Link, useLocation, useNavigate } from "react-router-dom";
import { Film, Search, User, LogOut, Settings, X, Menu, RefreshCw, Activity, Zap } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { useServerSettings } from "@/hooks/useServerSettings";
import { useJellyfinApi } from "@/hooks/useJellyfinApi";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { useSidebar } from "@/components/ui/sidebar";
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
  const { data: userRole, isLoading: roleLoading } = useUserRole(user?.id);
  const { serverUrl, apiKey } = useServerSettings();
  
  console.log('User role:', userRole, 'Loading:', roleLoading);
  const { siteName, logoUrl, headerTitle } = useSiteSettings();
  const { toggleSidebar } = useSidebar();
  const [searchQuery, setSearchQuery] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [showMobileSearch, setShowMobileSearch] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
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

  const handleSync = async () => {
    if (!serverUrl || !apiKey) {
      toast.error("Server ikke konfigurert");
      return;
    }
    
    toast.loading("Synkroniserer med Jellyfin...");
    try {
      const response = await fetch(`${serverUrl.replace(/\/$/, '')}/Library/Refresh`, {
        method: "POST",
        headers: {
          "X-Emby-Token": apiKey,
          "Content-Type": "application/json",
        },
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      toast.success("Synkronisering startet");
    } catch (error) {
      console.error("Sync error:", error);
      toast.error("Kunne ikke synkronisere");
    }
  };

  const handleRefresh = () => {
    window.location.reload();
    toast.success("Laster inn på nytt");
  };

  const handleStatus = async () => {
    if (!serverUrl || !apiKey) {
      toast.error("Server ikke konfigurert");
      return;
    }
    
    try {
      const response = await fetch(`${serverUrl.replace(/\/$/, '')}/System/Info`, {
        method: "GET",
        headers: {
          "X-Emby-Token": apiKey,
          "Content-Type": "application/json",
        },
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      toast.success(`Server kjører: ${data.ServerName || "Jellyfin"}`);
    } catch (error) {
      console.error("Status error:", error);
      toast.error("Kunne ikke hente server-status");
    }
  };

  const navItems = [
    { name: "Hjem", path: "/browse" },
    { name: "Filmer", path: "/movies" },
    { name: "Serier", path: "/series" },
  ];

  return (
    <header className="sticky top-0 z-50 bg-background/95 backdrop-blur-lg border-b border-border/50 w-full">
      <div className="container mx-auto px-3 sm:px-4 py-3 sm:py-4">
        <div className="flex items-center justify-between gap-2 sm:gap-4">
          <div className="flex items-center gap-2 sm:gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleSidebar}
              className="flex-shrink-0 h-9 w-9 sm:h-10 sm:w-10"
            >
              <Menu className="h-4 w-4 sm:h-5 sm:w-5" />
            </Button>
            
            <Link to="/browse" className="flex items-center gap-2 group flex-shrink-0">
              {logoUrl ? (
                <img 
                  src={logoUrl} 
                  alt={siteName}
                  className="h-7 sm:h-8 w-auto object-contain"
                />
              ) : (
                <div className="p-1.5 sm:p-2 rounded-lg bg-primary/10 group-hover:bg-primary/20 smooth-transition">
                  <Film className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                </div>
              )}
              <span className="text-base sm:text-lg font-bold hidden lg:block">{headerTitle}</span>
            </Link>

            <nav className="hidden lg:flex items-center gap-4">
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

          <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
            {/* Mobile Search Button */}
            <Sheet open={showMobileSearch} onOpenChange={setShowMobileSearch}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden h-9 w-9">
                  <Search className="h-4 w-4" />
                </Button>
              </SheetTrigger>
              <SheetContent side="top" className="h-auto">
                <SheetHeader>
                  <SheetTitle>Søk</SheetTitle>
                </SheetHeader>
                <div className="mt-4">
                  <form onSubmit={(e) => {
                    handleSearch(e);
                    setShowMobileSearch(false);
                  }}>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
                      <Input
                        placeholder="Søk etter filmer og serier..."
                        value={searchQuery}
                        onChange={handleInputChange}
                        className="pl-10 pr-10 text-base"
                        autoFocus
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
                    </div>
                  </form>

                  {suggestions?.Items && suggestions.Items.length > 0 && searchQuery.trim() && (
                    <div className="mt-4 space-y-2">
                      {suggestions.Items.map((item) => (
                        <button
                          key={item.Id}
                          onClick={() => {
                            handleSuggestionClick(item.Id);
                            setShowMobileSearch(false);
                          }}
                          className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-accent smooth-transition text-left"
                        >
                          <div className="w-12 h-16 flex-shrink-0 bg-secondary rounded overflow-hidden">
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
              </SheetContent>
            </Sheet>

            {/* Desktop Search */}
            <div ref={searchRef} className="relative hidden md:block">
              <form onSubmit={handleSearch}>
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
                <Input
                  placeholder="Søk..."
                  value={searchQuery}
                  onChange={handleInputChange}
                  onFocus={() => searchQuery.trim() && setShowSuggestions(true)}
                  className="pl-10 pr-10 w-48 lg:w-64 bg-secondary/50 border-border/50"
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

            {/* Mobile Menu */}
            <Sheet open={showMobileMenu} onOpenChange={setShowMobileMenu}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="lg:hidden h-9 w-9">
                  <Menu className="h-4 w-4" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right">
                <SheetHeader>
                  <SheetTitle>Meny</SheetTitle>
                </SheetHeader>
                <nav className="mt-6 space-y-1">
                  {navItems.map((item) => (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={() => setShowMobileMenu(false)}
                      className={`block px-4 py-3 rounded-lg text-base font-medium smooth-transition ${
                        location.pathname === item.path
                          ? "bg-primary/10 text-primary"
                          : "hover:bg-accent"
                      }`}
                    >
                      {item.name}
                    </Link>
                  ))}
                </nav>
              </SheetContent>
            </Sheet>

            {/* Action Buttons */}
            <div className="hidden sm:flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleSync}
                title="Synkroniser med Jellyfin"
                className="h-9 w-9"
              >
                <Zap className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleRefresh}
                title="Last inn på nytt"
                className="h-9 w-9"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
              {userRole === "admin" && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => navigate("/admin")}
                  title="Innstillinger"
                  className="h-9 w-9"
                >
                  <Settings className="h-4 w-4" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={handleStatus}
                title="Server-status"
                className="h-9 w-9"
              >
                <Activity className="h-4 w-4" />
              </Button>
            </div>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full h-9 w-9 sm:h-10 sm:w-10">
                  <User className="h-4 w-4 sm:h-5 sm:w-5" />
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
