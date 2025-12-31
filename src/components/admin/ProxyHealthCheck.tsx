import { useState, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Globe,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  Shield,
  Server,
  FileText,
} from "lucide-react";

interface ProxyCheckResult {
  url: string;
  success: boolean;
  status?: number;
  statusText?: string;
  responseTime?: number;
  headers?: Record<string, string>;
  contentType?: string;
  bodySnippet?: string;
  error?: string;
  mixedContent?: boolean;
  viteBlockedHost?: boolean;
}

function normalizeUrl(input: string) {
  const trimmed = input.trim();
  if (!trimmed) return trimmed;
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;
  return `https://${trimmed}`;
}

export const ProxyHealthCheck = () => {
  const [proxyUrl, setProxyUrl] = useState("https://update.gjerdet.casa/");
  const [isChecking, setIsChecking] = useState(false);
  const [result, setResult] = useState<ProxyCheckResult | null>(null);

  const checkProxy = useCallback(async () => {
    setIsChecking(true);
    setResult(null);

    const startTime = Date.now();

    try {
      const normalized = normalizeUrl(proxyUrl);
      const target = new URL(normalized);
      if (!target.pathname) target.pathname = "/";

      // Mixed content detection (browser blocks HTTPS -> HTTP)
      const mixedContent = window.location.protocol === "https:" && target.protocol === "http:";
      if (mixedContent) {
        setResult({
          url: target.toString(),
          success: false,
          mixedContent: true,
          error: "Mixed Content: Du kan ikke teste en http:// URL fra en https:// side",
        });
        return;
      }

      const response = await fetch(target.toString(), {
        method: "GET",
        headers: {
          Accept: "text/html,application/json;q=0.9,*/*;q=0.8",
        },
        signal: AbortSignal.timeout(10000),
      });

      const responseTime = Date.now() - startTime;

      const headers: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        const k = key.toLowerCase();
        if (["content-type", "server", "via", "x-powered-by", "access-control-allow-origin"].includes(k)) {
          headers[key] = value;
        }
      });

      const contentType = response.headers.get("content-type") || undefined;
      const bodyText = await response.text().catch(() => "");
      const bodySnippet = bodyText ? bodyText.slice(0, 500) : undefined;

      const viteBlockedHost = bodyText.includes("Blocked request. This host is not allowed");

      const ok = response.ok && !viteBlockedHost;

      setResult({
        url: target.toString(),
        success: ok,
        status: response.status,
        statusText: response.statusText,
        responseTime,
        headers,
        contentType,
        bodySnippet,
        viteBlockedHost,
        error: ok
          ? undefined
          : viteBlockedHost
            ? "Vite blokkerer host-header (allowedHosts)"
            : `HTTP ${response.status}: ${response.statusText}`,
      });
    } catch (err) {
      const responseTime = Date.now() - startTime;

      let errorMessage = "Ukjent feil";
      if (err instanceof Error) {
        if (err.name === "TypeError" && err.message.includes("Failed to fetch")) {
          errorMessage = "Kunne ikke koble til (CORS/Network error)";
        } else if (err.name === "AbortError" || err.message.toLowerCase().includes("timeout")) {
          errorMessage = "Timeout (10s)";
        } else {
          errorMessage = err.message;
        }
      }

      setResult({
        url: proxyUrl,
        success: false,
        responseTime,
        error: errorMessage,
      });
    } finally {
      setIsChecking(false);
    }
  }, [proxyUrl]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Globe className="h-5 w-5" />
          <CardTitle>Proxy Health Check</CardTitle>
        </div>
        <CardDescription>
          Tester om domenet/proxyen faktisk når web-UI, og viser typiske Vite/Host-feil.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <div className="flex-1">
            <Label htmlFor="proxy-url" className="sr-only">
              Proxy URL
            </Label>
            <Input
              id="proxy-url"
              value={proxyUrl}
              onChange={(e) => setProxyUrl(e.target.value)}
              placeholder="https://update.gjerdet.casa/"
            />
          </div>
          <Button onClick={checkProxy} disabled={isChecking}>
            {isChecking ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            <span className="ml-2">Test</span>
          </Button>
        </div>

        {result && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              {result.success ? (
                <CheckCircle2 className="h-6 w-6 text-primary" />
              ) : (
                <XCircle className="h-6 w-6 text-destructive" />
              )}
              <div>
                <Badge variant={result.success ? "default" : "destructive"}>
                  {result.success ? "Tilgjengelig" : "Feil"}
                </Badge>
                {typeof result.responseTime === "number" && (
                  <span className="ml-2 text-sm text-muted-foreground">{result.responseTime}ms</span>
                )}
              </div>
            </div>

            {result.error && (
              <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-4">
                <div className="flex gap-2">
                  <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0" />
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-destructive">{result.error}</p>

                    {result.mixedContent && (
                      <div className="text-xs text-muted-foreground space-y-1">
                        <p className="flex items-center gap-1">
                          <Shield className="h-3 w-3" /> Mixed Content blokkert av nettleseren
                        </p>
                        <p>
                          Løsning: bruk HTTPS på proxyen (anbefalt) eller test fra en HTTP-side.
                        </p>
                      </div>
                    )}

                    {result.viteBlockedHost && (
                      <div className="text-xs text-muted-foreground space-y-1">
                        <p>
                          Dette betyr at Vite Preview har avvist domenet i <code className="bg-muted px-1 rounded">Host</code>-headeren.
                        </p>
                        <p>
                          Løsning: sett <code className="bg-muted px-1 rounded">allowedHosts: true</code> og restart web-UI.
                        </p>
                      </div>
                    )}

                    {!result.mixedContent && !result.viteBlockedHost && result.error.includes("CORS") && (
                      <div className="text-xs text-muted-foreground space-y-1">
                        <p>
                          Tips: denne testen fungerer best når du åpner admin via samme domene (ellers kan CORS stoppe fetch()).
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {result.success && (
              <div className="rounded-lg border border-primary/20 bg-primary/10 p-4">
                <div className="flex gap-2">
                  <Server className="h-5 w-5 text-primary flex-shrink-0" />
                  <div className="space-y-2 flex-1">
                    <p className="text-sm font-medium text-primary">Proxy ser OK ut</p>
                    <div className="text-xs text-muted-foreground space-y-1">
                      <p>
                        HTTP: {result.status} {result.statusText}
                      </p>
                      {result.contentType && <p>Content-Type: {result.contentType}</p>}
                    </div>

                    {result.headers && Object.keys(result.headers).length > 0 && (
                      <div className="text-xs text-muted-foreground">
                        <p className="font-medium mb-1">Headers (utvalg):</p>
                        <div className="font-mono bg-background/50 rounded p-2 space-y-0.5">
                          {Object.entries(result.headers).map(([key, value]) => (
                            <div key={key}>
                              <span className="text-primary">{key}:</span> {value}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {result.bodySnippet && (
              <div className="rounded-lg border bg-card p-4">
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <p className="text-sm font-medium">Respons (første 500 tegn)</p>
                </div>
                <pre className="text-xs text-muted-foreground whitespace-pre-wrap break-words font-mono bg-background/50 rounded p-2">
                  {result.bodySnippet}
                </pre>
              </div>
            )}
          </div>
        )}

        {!result && !isChecking && (
          <p className="text-sm text-muted-foreground text-center py-4">Klikk “Test” for å sjekke proxyen</p>
        )}
      </CardContent>
    </Card>
  );
};
