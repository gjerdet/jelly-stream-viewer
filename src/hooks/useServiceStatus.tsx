import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface ServiceInfo {
  name: string;
  active: boolean;
  state: string;
  loadState: string;
  activeState: string;
  subState: string;
  pid: string | null;
  startedAt: string | null;
}

export interface ServiceStatusResult {
  success: boolean;
  services: {
    'jelly-stream-preview'?: ServiceInfo;
    'jelly-git-pull'?: ServiceInfo;
  };
  timestamp: string;
  error?: string;
}

export const useServiceStatus = () => {
  const [status, setStatus] = useState<ServiceStatusResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Get git_pull_server_url from database
      const { data: settings } = await supabase
        .from("server_settings")
        .select("setting_value")
        .eq("setting_key", "git_pull_server_url")
        .maybeSingle();

      const gitPullUrl = settings?.setting_value;
      
      if (!gitPullUrl) {
        setError("Git pull server URL ikke konfigurert");
        setIsLoading(false);
        return null;
      }

      // Normalize URL
      let baseUrl = gitPullUrl.replace(/\/$/, '');
      if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
        baseUrl = `http://${baseUrl}`;
      }

      const response = await fetch(`${baseUrl}/service-status`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data: ServiceStatusResult = await response.json();
      setStatus(data);
      setIsLoading(false);
      return data;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Ukjent feil";
      setError(message);
      setIsLoading(false);
      return null;
    }
  }, []);

  const restartPreview = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const { data: settings } = await supabase
        .from("server_settings")
        .select("setting_key, setting_value")
        .in("setting_key", ["git_pull_server_url", "update_webhook_secret"]);

      const gitPullUrl = settings?.find(s => s.setting_key === "git_pull_server_url")?.setting_value;
      const secret = settings?.find(s => s.setting_key === "update_webhook_secret")?.setting_value;

      if (!gitPullUrl) {
        setError("Git pull server URL ikke konfigurert");
        setIsLoading(false);
        return false;
      }

      let baseUrl = gitPullUrl.replace(/\/$/, '');
      if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
        baseUrl = `http://${baseUrl}`;
      }

      const response = await fetch(`${baseUrl}/restart-preview`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(secret ? { 'X-Update-Signature': secret } : {}),
        },
        signal: AbortSignal.timeout(30000),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${response.status}`);
      }

      // Refresh status after restart
      await new Promise(resolve => setTimeout(resolve, 2000));
      await fetchStatus();
      
      setIsLoading(false);
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Ukjent feil";
      setError(message);
      setIsLoading(false);
      return false;
    }
  }, [fetchStatus]);

  return {
    status,
    isLoading,
    error,
    fetchStatus,
    restartPreview,
  };
};
