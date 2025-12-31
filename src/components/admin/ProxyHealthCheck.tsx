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
  ExternalLink,
  Shield,
  Server
} from "lucide-react";

interface ProxyCheckResult {
  url: string;
  success: boolean;
  status?: number;
  statusText?: string;
  responseTime?: number;
  headers?: Record<string, string>;
  error?: string;
  mixedContent?: boolean;
}

export const ProxyHealthCheck = () => {
  const [proxyUrl, setProxyUrl] = useState("https://update.gjerdet.casa");
  const [isChecking, setIsChecking] = useState(false);
  const [result, setResult] = useState<ProxyCheckResult | null>(null);

  const checkProxy = useCallback(async () => {
    setIsChecking(true);
    setResult(null);

    const startTime = Date.now();
    
    try {
      // Check for mixed content issues first
      const currentProtocol = window.location.protocol;
      const targetUrl = new URL(proxyUrl);
      const mixedContent = currentProtocol === 'https:' && targetUrl.protocol === 'http:';

      if (mixedContent) {
        setResult({
          url: proxyUrl,
          success: false,
          error: "Mixed Content: HTTPS-side kan ikke laste HTTP-ressurser",
          mixedContent: true,
        });
        setIsChecking(false);
        return;
      }

      // Try to fetch health endpoint
      const healthUrl = `${proxyUrl.replace(/\/$/, '')}/health`;
      
      const response = await fetch(healthUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(10000),
      });

      const responseTime = Date.now() - startTime;

      // Extract relevant headers
      const headers: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        if (['content-type', 'server', 'x-powered-by', 'access-control-allow-origin'].includes(key.toLowerCase())) {
          headers[key] = value;
        }
      });

      const data = await response.json().catch(() => null);

      setResult({
        url: proxyUrl,
        success: response.ok,
        status: response.status,
        statusText: response.statusText,
        responseTime,
        headers,
        error: response.ok ? undefined : `HTTP ${response.status}: ${response.statusText}`,
      });
    } catch (err) {
      const responseTime = Date.now() - startTime;
      
      let errorMessage = "Ukjent feil";
      let mixedContent = false;

      if (err instanceof Error) {
        if (err.name === 'TypeError' && err.message.includes('Failed to fetch')) {
          // Could be CORS, network error, or mixed content
          errorMessage = "Kunne ikke koble til serveren (CORS/Network error)";
        } else if (err.name === 'AbortError' || err.message.includes('timeout')) {
          errorMessage = "Timeout - serveren svarte ikke innen 10 sekunder";
        } else {
          errorMessage = err.message;
        }
      }

      setResult({
        url: proxyUrl,
        success: false,
        responseTime,
        error: errorMessage,
        mixedContent,
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
          Test tilgang til web-UI via ekstern proxy (update.gjerdet.casa)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <div className="flex-1">
            <Label htmlFor="proxy-url" className="sr-only">Proxy URL</Label>
            <Input
              id="proxy-url"
              value={proxyUrl}
              onChange={(e) => setProxyUrl(e.target.value)}
              placeholder="https://update.gjerdet.casa"
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
            {/* Status Badge */}
            <div className="flex items-center gap-3">
              {result.success ? (
                <CheckCircle2 className="h-6 w-6 text-green-500" />
              ) : (
                <XCircle className="h-6 w-6 text-red-500" />
              )}
              <div>
                <Badge variant={result.success ? "default" : "destructive"}>
                  {result.success ? "Tilgjengelig" : "Ikke tilgjengelig"}
                </Badge>
                {result.responseTime && (
                  <span className="ml-2 text-sm text-muted-foreground">
                    {result.responseTime}ms
                  </span>
                )}
              </div>
            </div>

            {/* Error Message */}
            {result.error && (
              <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-4">
                <div className="flex gap-2">
                  <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0" />
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-red-600 dark:text-red-400">
                      {result.error}
                    </p>
                    
                    {result.mixedContent && (
                      <div className="text-xs text-muted-foreground space-y-1">
                        <p className="flex items-center gap-1">
                          <Shield className="h-3 w-3" />
                          Mixed Content blokkert av nettleseren
                        </p>
                        <p>
                          <strong>Løsning:</strong> Bruk HTTPS for git-pull serveren, eller 
                          åpne admin-panelet via lokal IP (http://192.168.9.24:4173)
                        </p>
                      </div>
                    )}
                    
                    {!result.mixedContent && result.error.includes('CORS') && (
                      <div className="text-xs text-muted-foreground space-y-1">
                        <p>Mulige årsaker:</p>
                        <ul className="list-disc list-inside">
                          <li>Git-pull serveren kjører ikke</li>
                          <li>Proxy/tunnel er ikke aktiv</li>
                          <li>Feil port eller URL</li>
                          <li>Brannmur blokkerer tilgang</li>
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Success Details */}
            {result.success && (
              <div className="rounded-lg border border-green-500/20 bg-green-500/10 p-4">
                <div className="flex gap-2">
                  <Server className="h-5 w-5 text-green-500 flex-shrink-0" />
                  <div className="space-y-2 flex-1">
                    <p className="text-sm font-medium text-green-600 dark:text-green-400">
                      Proxy fungerer korrekt
                    </p>
                    {result.status && (
                      <p className="text-xs text-muted-foreground">
                        HTTP Status: {result.status} {result.statusText}
                      </p>
                    )}
                    {result.headers && Object.keys(result.headers).length > 0 && (
                      <div className="text-xs text-muted-foreground">
                        <p className="font-medium mb-1">Response Headers:</p>
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

            {/* Tips */}
            <div className="text-xs text-muted-foreground border-t pt-4 mt-4">
              <p className="font-medium mb-2">Feilsøkingstips:</p>
              <ul className="space-y-1">
                <li className="flex items-start gap-2">
                  <span>•</span>
                  <span>Sjekk at <code className="bg-muted px-1 rounded">jelly-git-pull</code> tjenesten kjører på port 3002</span>
                </li>
                <li className="flex items-start gap-2">
                  <span>•</span>
                  <span>Verifiser at Cloudflare tunnel / proxy ruter til riktig intern adresse</span>
                </li>
                <li className="flex items-start gap-2">
                  <span>•</span>
                  <span>For HTTPS-sider må proxy også bruke HTTPS for å unngå mixed content</span>
                </li>
              </ul>
            </div>
          </div>
        )}

        {!result && !isChecking && (
          <p className="text-sm text-muted-foreground text-center py-4">
            Klikk "Test" for å sjekke proxy-tilkobling
          </p>
        )}
      </CardContent>
    </Card>
  );
};
