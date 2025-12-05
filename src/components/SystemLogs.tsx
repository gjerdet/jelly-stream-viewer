import { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Terminal, Database, Shield, Globe, Search, X, Filter, RefreshCw, Film } from "lucide-react";
import { format } from "date-fns";
import { enUS, nb } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";

interface LogEntry {
  timestamp: number;
  level?: string;
  message: string;
  error?: string;
  path?: string;
  status?: string;
  type?: string;
}

export const SystemLogs = () => {
  const { t, language } = useLanguage();
  const logs = t.systemLogs as any;
  const dateLocale = language === 'no' ? nb : enUS;
  const [searchQuery, setSearchQuery] = useState("");
  const [levelFilter, setLevelFilter] = useState<string>("all");
  const [timeFilter, setTimeFilter] = useState<string>("all");
  
  const consoleLogs: LogEntry[] = []; // No console logs in production
  const [authLogs, setAuthLogs] = useState<LogEntry[]>([]);
  const [dbLogs, setDbLogs] = useState<LogEntry[]>([]);
  const [edgeLogs, setEdgeLogs] = useState<LogEntry[]>([]);
  const [jellyfinLogs, setJellyfinLogs] = useState<LogEntry[]>([]);
  
  const [loadingAuth, setLoadingAuth] = useState(false);
  const [loadingDb, setLoadingDb] = useState(false);
  const [loadingEdge, setLoadingEdge] = useState(false);
  const [loadingJellyfin, setLoadingJellyfin] = useState(false);
  const [activeTab, setActiveTab] = useState("jellyfin");

  // Fetch logs function
  const fetchLogs = async (logType: 'auth' | 'database' | 'edge') => {
    try {
      const setLoading = logType === 'auth' ? setLoadingAuth : 
                         logType === 'database' ? setLoadingDb : setLoadingEdge;
      
      setLoading(true);

      const { data, error } = await supabase.functions.invoke('fetch-system-logs', {
        body: { logType }
      });

      if (error) throw error;

      // Show message if provided
      if (data?.message) {
        toast.info(data.message);
      }

      const logs = (data?.logs || []).map((log: any) => ({
        timestamp: log.timestamp || Date.now() * 1000,
        level: log.level || log.error_severity || 'info',
        message: log.msg || log.event_message || 'No message',
        error: log.error,
        path: log.path,
        status: log.status || log.status_code?.toString(),
      }));

      if (logType === 'auth') setAuthLogs(logs);
      else if (logType === 'database') setDbLogs(logs);
      else setEdgeLogs(logs);

    } catch (error) {
      console.error(`Error fetching ${logType} logs:`, error);
      toast.error(logs.couldNotFetch.replace('{type}', logType));
    } finally {
      const setLoading = logType === 'auth' ? setLoadingAuth : 
                         logType === 'database' ? setLoadingDb : setLoadingEdge;
      setLoading(false);
    }
  };

  // Fetch Jellyfin activity logs
  const fetchJellyfinLogs = async () => {
    try {
      setLoadingJellyfin(true);

      const { data, error } = await supabase.functions.invoke('jellyfin-logs');

      if (error) throw error;

      if (data?.error) {
        toast.error(data.error);
        setJellyfinLogs([]);
        return;
      }

      setJellyfinLogs(data?.logs || []);
    } catch (error) {
      console.error('Error fetching Jellyfin logs:', error);
      toast.error('Kunne ikke hente Jellyfin-logger');
    } finally {
      setLoadingJellyfin(false);
    }
  };

  // Load logs when tab changes
  useEffect(() => {
    if (activeTab === 'jellyfin' && jellyfinLogs.length === 0) {
      fetchJellyfinLogs();
    } else if (activeTab === 'auth' && authLogs.length === 0) {
      fetchLogs('auth');
    } else if (activeTab === 'database' && dbLogs.length === 0) {
      fetchLogs('database');
    } else if (activeTab === 'edge' && edgeLogs.length === 0) {
      fetchLogs('edge');
    }
  }, [activeTab]);

  const formatTimestamp = (timestamp: number) => {
    try {
      return format(new Date(timestamp / 1000), "dd.MM.yyyy HH:mm:ss", { locale: dateLocale });
    } catch {
      return logs.invalidTime;
    }
  };

  const getLevelColor = (level?: string) => {
    switch (level?.toLowerCase()) {
      case "error":
        return "bg-red-500/20 text-red-400 border-red-500/50";
      case "warn":
      case "warning":
        return "bg-yellow-500/20 text-yellow-400 border-yellow-500/50";
      case "info":
        return "bg-blue-500/20 text-blue-400 border-blue-500/50";
      default:
        return "bg-muted text-muted-foreground border-border";
    }
  };

  const filterLogs = (logs: LogEntry[]) => {
    return logs.filter((log) => {
      // Search query filter
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch = 
        !searchQuery ||
        log.message.toLowerCase().includes(searchLower) ||
        log.error?.toLowerCase().includes(searchLower) ||
        log.path?.toLowerCase().includes(searchLower);

      // Level filter
      const matchesLevel = 
        levelFilter === "all" ||
        log.level?.toLowerCase() === levelFilter.toLowerCase();

      // Time filter
      let matchesTime = true;
      if (timeFilter !== "all") {
        const now = Date.now() * 1000; // Convert to microseconds
        const logTime = log.timestamp;
        
        switch (timeFilter) {
          case "1h":
            matchesTime = logTime > now - 3600 * 1000000;
            break;
          case "24h":
            matchesTime = logTime > now - 86400 * 1000000;
            break;
          case "7d":
            matchesTime = logTime > now - 7 * 86400 * 1000000;
            break;
        }
      }

      return matchesSearch && matchesLevel && matchesTime;
    });
  };

  const filteredConsoleLogs = useMemo(() => filterLogs(consoleLogs), [
    consoleLogs,
    searchQuery,
    levelFilter,
    timeFilter,
  ]);

  const filteredAuthLogs = useMemo(() => filterLogs(authLogs), [
    authLogs,
    searchQuery,
    levelFilter,
    timeFilter,
  ]);

  const filteredDbLogs = useMemo(() => filterLogs(dbLogs), [
    dbLogs,
    searchQuery,
    levelFilter,
    timeFilter,
  ]);

  const filteredEdgeLogs = useMemo(() => filterLogs(edgeLogs), [
    edgeLogs,
    searchQuery,
    levelFilter,
    timeFilter,
  ]);

  const filteredJellyfinLogs = useMemo(() => filterLogs(jellyfinLogs), [
    jellyfinLogs,
    searchQuery,
    levelFilter,
    timeFilter,
  ]);

  const clearFilters = () => {
    setSearchQuery("");
    setLevelFilter("all");
    setTimeFilter("all");
  };

  const hasActiveFilters = searchQuery || levelFilter !== "all" || timeFilter !== "all";

  const renderLogEntry = (log: LogEntry, index: number) => (
    <div
      key={index}
      className="p-3 rounded-lg bg-secondary/30 border border-border/50 space-y-2"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground font-mono">
          {formatTimestamp(log.timestamp)}
        </span>
        {log.level && (
          <Badge
            variant="outline"
            className={`text-xs ${getLevelColor(log.level)}`}
          >
            {log.level.toUpperCase()}
          </Badge>
        )}
      </div>
      <p className="text-sm font-mono text-foreground break-all">{log.message}</p>
      {log.error && (
        <p className="text-sm font-mono text-red-400 break-all">
          Error: {log.error}
        </p>
      )}
      {log.path && (
        <p className="text-xs text-muted-foreground">
          Path: {log.path}
        </p>
      )}
      {log.status && (
        <Badge variant="outline" className="text-xs">
          Status: {log.status}
        </Badge>
      )}
    </div>
  );

  return (
    <Card className="border-border/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Terminal className="h-5 w-5" />
          {logs.title}
        </CardTitle>
        <CardDescription>
          {logs.description}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Filters */}
        <div className="space-y-4 mb-4 p-4 rounded-lg bg-secondary/30 border border-border/50">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">{logs.filtersAndSearch}</span>
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="ml-auto h-7 gap-1 text-xs"
              >
                <X className="h-3 w-3" />
                {logs.reset}
              </Button>
            )}
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={logs.searchPlaceholder}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-background/50"
              />
            </div>

            {/* Level filter */}
            <Select value={levelFilter} onValueChange={setLevelFilter}>
              <SelectTrigger className="bg-background/50">
                <SelectValue placeholder={logs.level} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{logs.allLevels}</SelectItem>
                <SelectItem value="info">{logs.info}</SelectItem>
                <SelectItem value="warn">{logs.warning}</SelectItem>
                <SelectItem value="error">{logs.error}</SelectItem>
              </SelectContent>
            </Select>

            {/* Time filter */}
            <Select value={timeFilter} onValueChange={setTimeFilter}>
              <SelectTrigger className="bg-background/50">
                <SelectValue placeholder={logs.time} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{logs.allTimes}</SelectItem>
                <SelectItem value="1h">{logs.lastHour}</SelectItem>
                <SelectItem value="24h">{logs.last24Hours}</SelectItem>
                <SelectItem value="7d">{logs.last7Days}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {hasActiveFilters && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>{logs.activeFilters}</span>
              {searchQuery && (
                <Badge variant="secondary" className="text-xs">
                  {logs.search}: {searchQuery}
                </Badge>
              )}
              {levelFilter !== "all" && (
                <Badge variant="secondary" className="text-xs">
                  {logs.level}: {levelFilter}
                </Badge>
              )}
              {timeFilter !== "all" && (
                <Badge variant="secondary" className="text-xs">
                  {logs.time}: {timeFilter === "1h" ? logs.lastHour : timeFilter === "24h" ? logs.last24Hours : logs.last7Days}
                </Badge>
              )}
            </div>
          )}
        </div>

        <Tabs defaultValue="jellyfin" className="w-full" onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="jellyfin" className="gap-2">
              <Film className="h-4 w-4" />
              Jellyfin
            </TabsTrigger>
            <TabsTrigger value="console" className="gap-2">
              <Terminal className="h-4 w-4" />
              Console
            </TabsTrigger>
            <TabsTrigger value="auth" className="gap-2">
              <Shield className="h-4 w-4" />
              Auth
            </TabsTrigger>
            <TabsTrigger value="database" className="gap-2">
              <Database className="h-4 w-4" />
              Database
            </TabsTrigger>
            <TabsTrigger value="edge" className="gap-2">
              <Globe className="h-4 w-4" />
              Edge
            </TabsTrigger>
          </TabsList>

          <TabsContent value="jellyfin" className="space-y-4 mt-4">
            <div className="flex items-center justify-between">
              <div className="p-4 rounded-lg bg-purple-500/10 border border-purple-500/20 flex-1">
                <p className="text-sm text-purple-400">
                  <strong>🎬 Jellyfin:</strong> Aktivitetslogger fra Jellyfin-serveren (innlogginger, avspillinger, etc.)
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={fetchJellyfinLogs}
                disabled={loadingJellyfin}
                className="ml-4 gap-2"
              >
                <RefreshCw className={`h-4 w-4 ${loadingJellyfin ? 'animate-spin' : ''}`} />
                Oppdater
              </Button>
            </div>
            
            <ScrollArea className="h-[500px] w-full rounded-lg border border-border/50 p-4">
              {loadingJellyfin ? (
                <div className="text-center py-12 space-y-4">
                  <RefreshCw className="h-8 w-8 animate-spin mx-auto text-primary" />
                  <p className="text-muted-foreground">Laster Jellyfin-logger...</p>
                </div>
              ) : filteredJellyfinLogs.length > 0 ? (
                <div className="space-y-2">
                  {filteredJellyfinLogs.map((log, i) => renderLogEntry(log, i))}
                </div>
              ) : jellyfinLogs.length > 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Ingen logger matcher filtrene dine
                </div>
              ) : (
                <div className="text-center py-12 space-y-4">
                  <p className="text-muted-foreground">
                    Ingen Jellyfin-logger funnet. Klikk "Oppdater" for å hente logger.
                  </p>
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="console" className="space-y-4 mt-4">
            <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
              <p className="text-sm text-blue-400">
                <strong>ℹ️ Merk:</strong> Console-logger vises kun under utvikling.
                For å se logger i produksjon, sjekk browser-konsollen (F12).
              </p>
            </div>
            
            <div className="p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
              <p className="text-sm text-yellow-400">
                <strong>⚠️ Viktig:</strong> System-logger i produksjon er tilgjengelige via Supabase Dashboard under "Logs & Analytics".
                Denne visningen er primært for utvikling og testing.
              </p>
            </div>
            
            <ScrollArea className="h-[500px] w-full rounded-lg border border-border/50 p-4">
              {filteredConsoleLogs.length > 0 ? (
                <div className="space-y-2">
                  {filteredConsoleLogs.map((log, i) => renderLogEntry(log, i))}
                </div>
              ) : consoleLogs.length > 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Ingen logger matcher filtrene dine
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  Console-logger er ikke tilgjengelige i produksjon. Bruk browser-konsollen (F12).
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="auth" className="space-y-4 mt-4">
            <div className="flex items-center justify-between">
              <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/20 flex-1">
                <p className="text-sm text-blue-400">
                  <strong>ℹ️ Info:</strong> Auth-logger viser innlogginger og token-fornyelser.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchLogs('auth')}
                disabled={loadingAuth}
                className="ml-4 gap-2"
              >
                <RefreshCw className={`h-4 w-4 ${loadingAuth ? 'animate-spin' : ''}`} />
                Oppdater
              </Button>
            </div>
            
            <ScrollArea className="h-[500px] w-full rounded-lg border border-border/50 p-4">
              {loadingAuth ? (
                <div className="text-center py-12 space-y-4">
                  <RefreshCw className="h-8 w-8 animate-spin mx-auto text-primary" />
                  <p className="text-muted-foreground">Laster auth-logger...</p>
                </div>
              ) : filteredAuthLogs.length > 0 ? (
                <div className="space-y-2">
                  {filteredAuthLogs.map((log, i) => renderLogEntry(log, i))}
                </div>
              ) : authLogs.length > 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Ingen logger matcher filtrene dine
                </div>
              ) : (
                <div className="text-center py-12 space-y-4">
                  <p className="text-muted-foreground">
                    Ingen auth-logger funnet. Klikk "Oppdater" for å hente logger.
                  </p>
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="database" className="space-y-4 mt-4">
            <div className="flex items-center justify-between">
              <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/20 flex-1">
                <p className="text-sm text-blue-400">
                  <strong>ℹ️ Info:</strong> Database-logger viser feil og advarsler.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchLogs('database')}
                disabled={loadingDb}
                className="ml-4 gap-2"
              >
                <RefreshCw className={`h-4 w-4 ${loadingDb ? 'animate-spin' : ''}`} />
                Oppdater
              </Button>
            </div>
            
            <ScrollArea className="h-[500px] w-full rounded-lg border border-border/50 p-4">
              {loadingDb ? (
                <div className="text-center py-12 space-y-4">
                  <RefreshCw className="h-8 w-8 animate-spin mx-auto text-primary" />
                  <p className="text-muted-foreground">Laster database-logger...</p>
                </div>
              ) : filteredDbLogs.length > 0 ? (
                <div className="space-y-2">
                  {filteredDbLogs.map((log, i) => renderLogEntry(log, i))}
                </div>
              ) : dbLogs.length > 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Ingen logger matcher filtrene dine
                </div>
              ) : (
                <div className="text-center py-12 space-y-4">
                  <p className="text-muted-foreground">
                    Ingen database-logger funnet. Klikk "Oppdater" for å hente logger.
                  </p>
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="edge" className="space-y-4 mt-4">
            <div className="flex items-center justify-between">
              <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/20 flex-1">
                <p className="text-sm text-blue-400">
                  <strong>ℹ️ Info:</strong> Edge function-logger viser HTTP-kall til backend-funksjoner.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchLogs('edge')}
                disabled={loadingEdge}
                className="ml-4 gap-2"
              >
                <RefreshCw className={`h-4 w-4 ${loadingEdge ? 'animate-spin' : ''}`} />
                Oppdater
              </Button>
            </div>
            
            <ScrollArea className="h-[500px] w-full rounded-lg border border-border/50 p-4">
              {loadingEdge ? (
                <div className="text-center py-12 space-y-4">
                  <RefreshCw className="h-8 w-8 animate-spin mx-auto text-primary" />
                  <p className="text-muted-foreground">Laster edge function-logger...</p>
                </div>
              ) : filteredEdgeLogs.length > 0 ? (
                <div className="space-y-2">
                  {filteredEdgeLogs.map((log, i) => renderLogEntry(log, i))}
                </div>
              ) : edgeLogs.length > 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Ingen logger matcher filtrene dine
                </div>
              ) : (
                <div className="text-center py-12 space-y-4">
                  <p className="text-muted-foreground">
                    Ingen edge function-logger funnet. Klikk "Oppdater" for å hente logger.
                  </p>
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};
