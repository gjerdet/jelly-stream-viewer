import { Link, useLocation, useNavigate } from "react-router-dom";
import { Film, Search, User, LogOut, Settings, X, Menu, RefreshCw, Activity, Zap, MessageSquare, Cast, Play, Pause, Square } from "lucide-react";
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
import { useJellyfinSession } from "@/hooks/useJellyfinSession";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { useChromecast } from "@/hooks/useChromecast";
import { useSidebar } from "@/components/ui/sidebar";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useLanguage } from "@/contexts/LanguageContext";
import { toast } from "sonner";
import { useState, useEffect, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

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
  const { castState, isLoading: castLoading, scanForDevices, requestSession, endSession, playOrPause } = useChromecast();
  const { t } = useLanguage();
  const header = t.header as any;
  
  
  const { siteName, logoUrl, headerTitle } = useSiteSettings();
  const { toggleSidebar } = useSidebar();
  const [searchQuery, setSearchQuery] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [showMobileSearch, setShowMobileSearch] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // Fetch pending requests count for admins
  const { data: pendingCount } = useQuery({
    queryKey: ['pending-requests-count'],
    queryFn: async () => {
      const { count } = await supabase
        .from('jellyseerr_requests')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');
      return count || 0;
    },
    enabled: !!user && userRole === 'admin',
    refetchInterval: 30000, // Refetch every 30 seconds
  });

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

  // Get userId from localStorage session (not /Users endpoint which requires admin)
  const { userId } = useJellyfinSession();

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
    localStorage.removeItem('jellyfin_session');
    window.dispatchEvent(new Event('jellyfin-session-change'));
    
    // Try to sign out, but don't fail if session is already gone
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.log('Sign out completed (session may have already expired)');
    }
    
    toast.success(header.loggedOut || "Logged out");
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
      toast.error(header.serverNotConfigured || "Server not configured");
      return;
    }
    
    toast.loading(header.syncStarted || "Syncing...");
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
      
      toast.success(header.syncStarted || "Synchronization started");
    } catch (error) {
      console.error("Sync error:", error);
      toast.error(header.couldNotSync || "Could not synchronize");
    }
  };

  const handleRefresh = () => {
    window.location.reload();
    toast.success(header.refreshing || "Refreshing");
  };

  const handleStatus = async () => {
    if (!serverUrl || !apiKey) {
      toast.error(header.serverNotConfigured || "Server not configured");
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
      toast.success(`${header.serverRunning || "Server running"}: ${data.ServerName || "Jellyfin"}`);
    } catch (error) {
      console.error("Status error:", error);
      toast.error(header.couldNotFetchStatus || "Could not fetch server status");
    }
  };

  const formatCastTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const navItems = [
    { name: header.home || "Home", path: "/browse" },
    { name: header.movies || "Movies", path: "/movies" },
    { name: header.series || "Series", path: "/series" },
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
            {/* Chromecast Button - Mobile only (desktop version lives in Action Buttons) */}
            <div className="sm:hidden">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={`h-9 w-9 relative ${castState.isConnected ? 'text-primary' : ''} ${castLoading ? 'animate-pulse' : ''}`}
                    disabled={castLoading}
                  >
                    <Cast className="h-4 w-4" />
                    {castState.isConnected && !castLoading && (
                      <span className="absolute top-1 right-1 h-2 w-2 bg-primary rounded-full" />
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80 p-0" align="end">
                  {castLoading ? (
                    <div className="p-4 space-y-2">
                      <h4 className="font-semibold text-sm">Laster Chromecast...</h4>
                    </div>
                  ) : !castState.isBrowserSupported ? (
                    <div className="p-4 space-y-3">
                      <h4 className="font-semibold text-sm">Chromecast</h4>
                      <p className="text-xs text-muted-foreground">
                        Bruk Chrome eller Edge for Chromecast-støtte på mobil.
                      </p>
                      <Button onClick={() => scanForDevices()} size="sm" className="w-full" disabled={castState.isScanning}>
                        {castState.isScanning ? "Søker..." : "Prøv likevel"}
                      </Button>
                    </div>
                  ) : castState.isConnected ? (
                    <div className="p-4 space-y-3">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-primary/10">
                          <Cast className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm truncate">
                            {castState.mediaInfo?.title || "Ingen media"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {castState.deviceName}
                          </p>
                        </div>
                      </div>
                      
                      {castState.mediaInfo && (
                        <div className="space-y-2">
                          <div className="h-1 bg-secondary rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-primary transition-all"
                              style={{ width: `${(castState.mediaInfo.currentTime / castState.mediaInfo.duration) * 100}%` }}
                            />
                          </div>
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>{formatCastTime(castState.mediaInfo.currentTime)}</span>
                            <span>{formatCastTime(castState.mediaInfo.duration)}</span>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={playOrPause}
                              className="flex-1"
                            >
                              {castState.mediaInfo.isPaused ? (
                                <>
                                  <Play className="h-4 w-4 mr-2" />
                                  Spill av
                                </>
                              ) : (
                                <>
                                  <Pause className="h-4 w-4 mr-2" />
                                  Pause
                                </>
                              )}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={endSession}
                            >
                              <Square className="h-4 w-4 mr-2" />
                              Stopp
                            </Button>
                          </div>
                        </div>
                      )}
                      
                      {!castState.mediaInfo && (
                        <Button variant="destructive" size="sm" onClick={endSession} className="w-full">
                          Koble fra
                        </Button>
                      )}
                    </div>
                  ) : (
                    <div className="p-4 space-y-3">
                      <h4 className="font-semibold text-sm">Chromecast</h4>
                      <p className="text-xs text-muted-foreground">
                        Koble til en Chromecast for å sende innhold til TV-en din.
                      </p>
                      <div className="flex flex-col gap-2">
                        <Button onClick={requestSession} size="sm" className="w-full">
                          <Cast className="h-4 w-4 mr-2" />
                          Koble til
                        </Button>
                        <Button onClick={() => scanForDevices()} variant="outline" size="sm" className="w-full" disabled={castState.isScanning}>
                          {castState.isScanning ? (
                            <>
                              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                              Søker...
                            </>
                          ) : (
                            <>
                              <Search className="h-4 w-4 mr-2" />
                              Søk etter enheter
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  )}
                </PopoverContent>
              </Popover>
            </div>

            {/* Mobile Search Button */}
            <Sheet open={showMobileSearch} onOpenChange={setShowMobileSearch}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden h-9 w-9">
                  <Search className="h-4 w-4" />
                </Button>
              </SheetTrigger>
              <SheetContent side="top" className="h-auto">
                <SheetHeader>
                  <SheetTitle>{header.search || "Search"}</SheetTitle>
                </SheetHeader>
                <div className="mt-4">
                  <form onSubmit={(e) => {
                    handleSearch(e);
                    setShowMobileSearch(false);
                  }}>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
                      <Input
                        placeholder={header.searchPlaceholder || "Search for movies and series..."}
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
                              {item.Type === "Movie" ? (header.movies || "Movies") : (header.series || "Series")}
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
                  placeholder={header.searchMobilePlaceholder || "Search..."}
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
                          {item.Type === "Movie" ? (header.movies || "Movies") : (header.series || "Series")}
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
                  <SheetTitle>{header.menu || "Menu"}</SheetTitle>
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
              {/* Chromecast Button with Popover - always visible */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={`h-9 w-9 relative ${castState.isConnected ? 'text-primary' : ''} ${castLoading ? 'animate-pulse' : ''} ${!castState.isAvailable && !castLoading ? 'opacity-50' : ''}`}
                    title={
                      castLoading 
                        ? (header.loadingChromecast || "Loading Chromecast...") 
                        : !castState.isAvailable
                          ? "Søk etter Chromecast"
                          : castState.isConnected 
                            ? `${header.connectedTo || "Connected to"} ${castState.deviceName}` 
                            : (header.connectToChromecast || "Connect to Chromecast")
                    }
                    disabled={castLoading}
                  >
                    <Cast className="h-4 w-4" />
                    {castLoading && (
                      <span className="absolute top-0 right-0 h-2 w-2 bg-yellow-500 rounded-full animate-ping" />
                    )}
                    {castState.isConnected && !castLoading && (
                      <span className="absolute top-1 right-1 h-2 w-2 bg-primary rounded-full" />
                    )}
                    {castState.isScanning && (
                      <span className="absolute top-0 right-0 h-2 w-2 bg-blue-500 rounded-full animate-ping" />
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80" align="end">
                  {castLoading ? (
                    <div className="space-y-2">
                      <h4 className="font-semibold">Laster Chromecast...</h4>
                      <p className="text-sm text-muted-foreground">
                        Venter på at Cast SDK skal laste inn
                      </p>
                    </div>
                  ) : !castState.isAvailable ? (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <h4 className="font-semibold">Chromecast</h4>
                        <p className="text-sm text-muted-foreground">
                          Cast er ikke tilgjengelig. Bruk Chrome eller Edge for Chromecast-støtte.
                        </p>
                        <Button
                          onClick={() => scanForDevices()}
                          className="w-full"
                          size="sm"
                          disabled={castState.isScanning}
                        >
                          {castState.isScanning ? (
                            <>
                              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                              Søker...
                            </>
                          ) : (
                            <>
                              <Search className="h-4 w-4 mr-2" />
                              Prøv likevel
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <h4 className="font-semibold">Chromecast</h4>
                        {castState.isConnected ? (
                          <>
                            <p className="text-sm text-muted-foreground">
                              Koblet til: <span className="text-foreground font-medium">{castState.deviceName}</span>
                            </p>
                            
                            {castState.mediaInfo && (
                              <div className="space-y-3 pt-2 border-t">
                                <div>
                                  <p className="text-sm font-medium">{castState.mediaInfo.title}</p>
                                  <p className="text-xs text-muted-foreground mt-1">
                                    {formatCastTime(castState.mediaInfo.currentTime)} / {formatCastTime(castState.mediaInfo.duration)}
                                  </p>
                                </div>
                                
                                <div className="flex gap-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={playOrPause}
                                    className="flex-1"
                                  >
                                    {castState.mediaInfo.isPaused ? (
                                      <>
                                        <Play className="h-4 w-4 mr-2" />
                                        Spill av
                                      </>
                                    ) : (
                                      <>
                                        <Pause className="h-4 w-4 mr-2" />
                                        Pause
                                      </>
                                    )}
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      endSession();
                                    }}
                                  >
                                    <Square className="h-4 w-4 mr-2" />
                                    Stopp
                                  </Button>
                                </div>
                              </div>
                            )}
                            
                            {!castState.mediaInfo && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  endSession();
                                }}
                                className="w-full mt-2"
                              >
                                Koble fra
                              </Button>
                            )}
                          </>
                        ) : (
                          <>
                            <p className="text-sm text-muted-foreground">
                              Ikke koblet til
                            </p>
                            <div className="flex flex-col gap-2">
                              <Button
                                onClick={() => scanForDevices()}
                                className="w-full"
                                size="sm"
                                disabled={castState.isScanning}
                              >
                                {castState.isScanning ? (
                                  <>
                                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                                    Søker...
                                  </>
                                ) : (
                                  <>
                                    <Search className="h-4 w-4 mr-2" />
                                    Søk etter enheter
                                  </>
                                )}
                              </Button>
                              <Button
                                onClick={() => requestSession()}
                                variant="outline"
                                className="w-full"
                                size="sm"
                              >
                                <Cast className="h-4 w-4 mr-2" />
                                Koble til
                              </Button>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </PopoverContent>
              </Popover>
              
              {userRole === "admin" && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleSync}
                  title="Synkroniser med Jellyfin"
                  className="h-9 w-9"
                >
                  <Zap className="h-4 w-4" />
                </Button>
              )}
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
              {userRole === "admin" && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleStatus}
                  title="Server-status"
                  className="h-9 w-9"
                >
                  <Activity className="h-4 w-4" />
                </Button>
              )}
            </div>
            
            <LanguageSwitcher />
            
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
                <DropdownMenuItem onClick={() => navigate("/profile")}>
                  <User className="mr-2 h-4 w-4" />
                  {header.profile || "Min profil"}
                </DropdownMenuItem>
                {userRole === "admin" && (
                  <>
                    <DropdownMenuItem onClick={() => navigate("/admin")}>
                      <Settings className="mr-2 h-4 w-4" />
                      Admin
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate("/requests-admin")}>
                      <MessageSquare className="mr-2 h-4 w-4" />
                      <span className="flex items-center gap-2">
                        Forespørsler
                        {pendingCount && pendingCount > 0 && (
                          <Badge variant="destructive" className="h-5 min-w-5 px-1 text-xs">
                            {pendingCount}
                          </Badge>
                        )}
                      </span>
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
