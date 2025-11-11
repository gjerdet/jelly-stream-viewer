import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Terminal, Database, Shield, Globe, Search, X, Filter } from "lucide-react";
import { format } from "date-fns";
import { nb } from "date-fns/locale";

interface LogEntry {
  timestamp: number;
  level?: string;
  message: string;
  error?: string;
  path?: string;
  status?: string;
}

export const SystemLogs = () => {
  const [consoleError, setConsoleError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [levelFilter, setLevelFilter] = useState<string>("all");
  const [timeFilter, setTimeFilter] = useState<string>("all");

  // Simulated logs - in production, these would come from actual API calls
  const consoleLogs: LogEntry[] = [
    {
      timestamp: Date.now(),
      level: "info",
      message: "Applikasjon startet",
    },
  ];

  const authLogs: LogEntry[] = [];
  const dbLogs: LogEntry[] = [];
  const edgeLogs: LogEntry[] = [];

  const formatTimestamp = (timestamp: number) => {
    try {
      return format(new Date(timestamp / 1000), "dd.MM.yyyy HH:mm:ss", { locale: nb });
    } catch {
      return "Ugyldig tid";
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
          System-logger
        </CardTitle>
        <CardDescription>
          Vis logger fra forskjellige deler av systemet for feilsøking
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Filters */}
        <div className="space-y-4 mb-4 p-4 rounded-lg bg-secondary/30 border border-border/50">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Filtre og søk</span>
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="ml-auto h-7 gap-1 text-xs"
              >
                <X className="h-3 w-3" />
                Nullstill
              </Button>
            )}
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Søk i logger..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-background/50"
              />
            </div>

            {/* Level filter */}
            <Select value={levelFilter} onValueChange={setLevelFilter}>
              <SelectTrigger className="bg-background/50">
                <SelectValue placeholder="Velg nivå" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle nivåer</SelectItem>
                <SelectItem value="info">Info</SelectItem>
                <SelectItem value="warn">Warning</SelectItem>
                <SelectItem value="error">Error</SelectItem>
              </SelectContent>
            </Select>

            {/* Time filter */}
            <Select value={timeFilter} onValueChange={setTimeFilter}>
              <SelectTrigger className="bg-background/50">
                <SelectValue placeholder="Velg tidsperiode" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle tidspunkter</SelectItem>
                <SelectItem value="1h">Siste time</SelectItem>
                <SelectItem value="24h">Siste 24 timer</SelectItem>
                <SelectItem value="7d">Siste 7 dager</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {hasActiveFilters && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>Aktive filtre:</span>
              {searchQuery && (
                <Badge variant="secondary" className="text-xs">
                  Søk: {searchQuery}
                </Badge>
              )}
              {levelFilter !== "all" && (
                <Badge variant="secondary" className="text-xs">
                  Nivå: {levelFilter}
                </Badge>
              )}
              {timeFilter !== "all" && (
                <Badge variant="secondary" className="text-xs">
                  Tid: {timeFilter === "1h" ? "Siste time" : timeFilter === "24h" ? "Siste 24t" : "Siste 7d"}
                </Badge>
              )}
            </div>
          )}
        </div>

        <Tabs defaultValue="console" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
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
              Edge Functions
            </TabsTrigger>
          </TabsList>

          <TabsContent value="console" className="space-y-4 mt-4">
            <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
              <p className="text-sm text-blue-400">
                <strong>ℹ️ Merk:</strong> Console-logger vises kun under utvikling.
                For å se logger i produksjon, sjekk browser-konsollen (F12).
              </p>
            </div>
            
            {consoleError ? (
              <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20">
                <p className="text-sm text-red-400">{consoleError}</p>
              </div>
            ) : (
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
                  Ingen console-logger tilgjengelig
                </div>
              )}
            </ScrollArea>
            )}
          </TabsContent>

          <TabsContent value="auth" className="space-y-4 mt-4">
            <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
              <p className="text-sm text-blue-400">
                <strong>ℹ️ Info:</strong> Auth-logger viser innlogginger og token-fornyelser.
              </p>
            </div>
            
            <ScrollArea className="h-[500px] w-full rounded-lg border border-border/50 p-4">
              {filteredAuthLogs.length > 0 ? (
                <div className="space-y-2">
                  {filteredAuthLogs.map((log, i) => renderLogEntry(log, i))}
                </div>
              ) : authLogs.length > 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Ingen logger matcher filtrene dine
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  Ingen auth-logger tilgjengelig
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="database" className="space-y-4 mt-4">
            <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
              <p className="text-sm text-blue-400">
                <strong>ℹ️ Info:</strong> Database-logger viser tilkoblinger og spørringer.
              </p>
            </div>
            
            <ScrollArea className="h-[500px] w-full rounded-lg border border-border/50 p-4">
              {filteredDbLogs.length > 0 ? (
                <div className="space-y-2">
                  {filteredDbLogs.map((log, i) => renderLogEntry(log, i))}
                </div>
              ) : dbLogs.length > 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Ingen logger matcher filtrene dine
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  Ingen database-logger tilgjengelig
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="edge" className="space-y-4 mt-4">
            <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
              <p className="text-sm text-blue-400">
                <strong>ℹ️ Info:</strong> Edge function-logger viser HTTP-kall til backend-funksjoner.
              </p>
            </div>
            
            <ScrollArea className="h-[500px] w-full rounded-lg border border-border/50 p-4">
              {filteredEdgeLogs.length > 0 ? (
                <div className="space-y-2">
                  {filteredEdgeLogs.map((log, i) => renderLogEntry(log, i))}
                </div>
              ) : edgeLogs.length > 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Ingen logger matcher filtrene dine
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  Ingen edge function-logger tilgjengelig
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};
