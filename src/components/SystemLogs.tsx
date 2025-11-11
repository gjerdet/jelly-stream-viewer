import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Terminal, Database, Shield, Globe } from "lucide-react";
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
                {consoleLogs.length > 0 ? (
                  <div className="space-y-2">
                    {consoleLogs.map((log, i) => renderLogEntry(log, i))}
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
              {authLogs.length > 0 ? (
                <div className="space-y-2">
                  {authLogs.map((log, i) => renderLogEntry(log, i))}
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
              {dbLogs.length > 0 ? (
                <div className="space-y-2">
                  {dbLogs.map((log, i) => renderLogEntry(log, i))}
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
              {edgeLogs.length > 0 ? (
                <div className="space-y-2">
                  {edgeLogs.map((log, i) => renderLogEntry(log, i))}
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
