import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Globe, RefreshCw, Loader2, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";

interface ProxyCheckResult {
  success: boolean;
  status?: number;
  statusText?: string;
  contentType?: string;
  responseTime?: number;
  headers?: Record<string, string>;
  bodySnippet?: string;
  error?: string;
  errorType?: "mixed-content" | "network" | "timeout" | "vite-blocked" | "unknown";
}

const normalizeUrl = (url: string): string => {
  let normalized = url.trim();
  if (!normalized.startsWith("http://") && !normalized.startsWith("https://")) {
    normalized = `https://${normalized}`;
  }
  return normalized;
};

export const ProxyHealthCheck = () => {
  const [proxyUrl, setProxyUrl] = useState("");
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<ProxyCheckResult | null>(null);

  const checkProxy = async () => {
    if (!proxyUrl.trim()) return;

    setChecking(true);
    setResult(null);

    const url = normalizeUrl(proxyUrl);
    const startTime = performance.now();

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(url, {
        method: "GET",
        signal: controller.signal,
        mode: "cors",
      });

      clearTimeout(timeoutId);
      const responseTime = Math.round(performance.now() - startTime);

      const headers: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        headers[key] = value;
      });

      let bodySnippet = "";
      try {
        const text = await response.text();
        bodySnippet = text.slice(0, 500);
      } catch {
        bodySnippet = "(kunne ikke lese body)";
      }

      setResult({
        success: response.ok,
        status: response.status,
        statusText: response.statusText,
        contentType: headers["content-type"] || "ukjent",
        responseTime,
        headers,
        bodySnippet,
      });
    } catch (err) {
      const responseTime = Math.round(performance.now() - startTime);
      const error = err instanceof Error ? err.message : "Ukjent feil";

      let errorType: ProxyCheckResult["errorType"] = "unknown";
      if (error.includes("Failed to fetch") || error.includes("NetworkError")) {
        if (window.location.protocol === "https:" && url.startsWith("http://")) {
          errorType = "mixed-content";
        } else {
          errorType = "network";
        }
      } else if (error.includes("aborted") || error.includes("timeout")) {
        errorType = "timeout";
      } else if (error.includes("Vite") || error.includes("blocked host")) {
        errorType = "vite-blocked";
      }

      setResult({
        success: false,
        error,
        errorType,
        responseTime,
      });
    } finally {
      setChecking(false);
    }
  };

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
          <Input
            placeholder="https://update.gjerdet.casa/"
            value={proxyUrl}
            onChange={(e) => setProxyUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && checkProxy()}
          />
          <Button onClick={checkProxy} disabled={checking || !proxyUrl.trim()}>
            {checking ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            <span className="ml-2">Test</span>
          </Button>
        </div>

        {result && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              {result.success ? (
                <>
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                  <Badge variant="default">Tilgjengelig</Badge>
                </>
              ) : (
                <>
                  <XCircle className="h-5 w-5 text-destructive" />
                  <Badge variant="destructive">Feil</Badge>
                </>
              )}
              {result.responseTime && (
                <span className="text-sm text-muted-foreground">{result.responseTime}ms</span>
              )}
            </div>

            {result.success && (
              <div className="rounded-lg border bg-card p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <span className="font-medium text-green-600">Proxy ser OK ut</span>
                </div>
                <div className="text-sm text-muted-foreground space-y-1">
                  <p>HTTP: {result.status}</p>
                  <p>Content-Type: {result.contentType}</p>
                </div>
                {result.headers && Object.keys(result.headers).length > 0 && (
                  <div>
                    <p className="text-sm font-medium mb-1">Headers (utvalg):</p>
                    <pre className="text-xs bg-muted p-2 rounded overflow-x-auto">
                      {Object.entries(result.headers)
                        .filter(([k]) => ["content-type", "server", "x-powered-by"].includes(k.toLowerCase()))
                        .map(([k, v]) => `${k}: ${v}`)
                        .join("\n")}
                    </pre>
                  </div>
                )}
                {result.bodySnippet && (
                  <div>
                    <p className="text-sm font-medium mb-1">Respons (første 500 tegn):</p>
                    <pre className="text-xs bg-muted p-2 rounded overflow-x-auto max-h-40">
                      {result.bodySnippet}
                    </pre>
                  </div>
                )}
              </div>
            )}

            {!result.success && result.error && (
              <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-4 space-y-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-destructive flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-destructive">{result.error}</p>
                    {result.errorType === "mixed-content" && (
                      <p className="text-sm text-muted-foreground mt-2">
                        <strong>Mixed Content:</strong> Siden kjører på HTTPS, men du forsøker å nå en HTTP-URL.
                        Bruk HTTPS i proxyen eller kjør appen lokalt over HTTP.
                      </p>
                    )}
                    {result.errorType === "network" && (
                      <p className="text-sm text-muted-foreground mt-2">
                        <strong>Network Error:</strong> Kunne ikke koble til. Sjekk at serveren kjører og at proxyen er riktig konfigurert.
                      </p>
                    )}
                    {result.errorType === "timeout" && (
                      <p className="text-sm text-muted-foreground mt-2">
                        <strong>Timeout:</strong> Serveren svarte ikke innen 10 sekunder.
                      </p>
                    )}
                    {result.errorType === "vite-blocked" && (
                      <p className="text-sm text-muted-foreground mt-2">
                        <strong>Vite Host Block:</strong> Utviklingsserveren blokkerer denne hosten.
                        Legg til hosten i vite.config.ts under server.allowedHosts.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
