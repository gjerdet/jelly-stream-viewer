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

export interface ServiceLogsResult {
  success: boolean;
  service: string;
  logs: string;
  error: string | null;
  timestamp: string;
}

const getGitPullBaseUrl = async () => {
  const { data: settings } = await supabase
    .from("server_settings")
    .select("setting_key, setting_value")
    .in("setting_key", ["git_pull_server_url", "update_webhook_url", "update_webhook_secret"]);

  // Try git_pull_server_url first, fallback to update_webhook_url
  const gitPullUrl = settings?.find(s => s.setting_key === "git_pull_server_url")?.setting_value
    || settings?.find(s => s.setting_key === "update_webhook_url")?.setting_value;
  const secret = settings?.find(s => s.setting_key === "update_webhook_secret")?.setting_value;

  if (!gitPullUrl) {
    throw new Error("Git pull server URL ikke konfigurert");
  }

  let baseUrl = gitPullUrl.replace(/\/$/, '');
  if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
    baseUrl = `http://${baseUrl}`;
  }

  return { baseUrl, secret };
};

export const useServiceStatus = () => {
  const [status, setStatus] = useState<ServiceStatusResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<ServiceLogsResult | null>(null);
  const [logsLoading, setLogsLoading] = useState(false);

  const fetchStatus = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const { baseUrl } = await getGitPullBaseUrl();

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

  const fetchLogs = useCallback(async (serviceName: string, lines: number = 50) => {
    setLogsLoading(true);

    try {
      const { baseUrl } = await getGitPullBaseUrl();

      const response = await fetch(`${baseUrl}/service-logs?service=${serviceName}&lines=${lines}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(15000),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data: ServiceLogsResult = await response.json();
      setLogs(data);
      setLogsLoading(false);
      return data;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Ukjent feil";
      setLogs({ success: false, service: serviceName, logs: '', error: message, timestamp: new Date().toISOString() });
      setLogsLoading(false);
      return null;
    }
  }, []);

  const restartPreview = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const { baseUrl, secret } = await getGitPullBaseUrl();

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

  const clearLogs = useCallback(() => {
    setLogs(null);
  }, []);

  return {
    status,
    isLoading,
    error,
    logs,
    logsLoading,
    fetchStatus,
    fetchLogs,
    restartPreview,
    clearLogs,
  };
};
