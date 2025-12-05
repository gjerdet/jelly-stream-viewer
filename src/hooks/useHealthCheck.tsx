import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";

export interface ServiceStatus {
  name: string;
  status: "healthy" | "degraded" | "down" | "checking";
  message: string;
  lastChecked: Date;
  responseTime?: number;
}

export interface HealthCheckResult {
  jellyfin: ServiceStatus;
  jellyseerr: ServiceStatus;
  database: ServiceStatus;
  netdata: ServiceStatus;
  overallStatus: "healthy" | "degraded" | "down";
}

export const useHealthCheck = (autoCheck: boolean = true, interval: number = 60000) => {
  const { t } = useLanguage();
  const health = t.health as any;
  
  const [healthStatus, setHealthStatus] = useState<HealthCheckResult>({
    jellyfin: { name: "Jellyfin", status: "checking", message: health.checking || "Checking...", lastChecked: new Date() },
    jellyseerr: { name: "Jellyseerr", status: "checking", message: health.checking || "Checking...", lastChecked: new Date() },
    database: { name: "Database", status: "checking", message: health.checking || "Checking...", lastChecked: new Date() },
    netdata: { name: "Netdata", status: "checking", message: health.checking || "Checking...", lastChecked: new Date() },
    overallStatus: "healthy",
  });
  const [isChecking, setIsChecking] = useState(false);
  const prevHealthStatusRef = useRef<HealthCheckResult | null>(null);

  const checkJellyfin = async (): Promise<ServiceStatus> => {
    const startTime = Date.now();
    try {
      const { data, error } = await supabase
        .from("server_settings")
        .select("setting_key, setting_value")
        .in("setting_key", ["jellyfin_server_url", "jellyfin_api_key"])
        .throwOnError();

      const serverUrl = data?.find(s => s.setting_key === "jellyfin_server_url")?.setting_value;
      const apiKey = data?.find(s => s.setting_key === "jellyfin_api_key")?.setting_value;

      if (!serverUrl || !apiKey) {
        return { 
          name: "Jellyfin", 
          status: "down", 
          message: health.notConfigured || "Not configured", 
          lastChecked: new Date() 
        };
      }

      let normalizedUrl = serverUrl;
      if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
        normalizedUrl = `http://${normalizedUrl}`;
      }

      const response = await fetch(`${normalizedUrl.replace(/\/$/, '')}/System/Info`, {
        headers: { "X-Emby-Token": apiKey },
        signal: AbortSignal.timeout(5000),
      });

      const responseTime = Date.now() - startTime;

      if (!response.ok) {
        return { 
          name: "Jellyfin", 
          status: "down", 
          message: `HTTP ${response.status}`, 
          lastChecked: new Date(),
          responseTime 
        };
      }

      const systemInfo = await response.json();
      return { 
        name: "Jellyfin", 
        status: "healthy", 
        message: `${systemInfo.ServerName} (${systemInfo.Version})`, 
        lastChecked: new Date(),
        responseTime 
      };
    } catch (error) {
      return { 
        name: "Jellyfin", 
        status: "down", 
        message: error instanceof Error ? error.message : (health.unknownError || "Unknown error"), 
        lastChecked: new Date() 
      };
    }
  };

  const checkJellyseerr = async (): Promise<ServiceStatus> => {
    const startTime = Date.now();
    try {
      const { data, error } = await supabase
        .from("server_settings")
        .select("setting_key, setting_value")
        .in("setting_key", ["jellyseerr_url", "jellyseerr_api_key"])
        .throwOnError();

      const jellyseerrUrl = data?.find(s => s.setting_key === "jellyseerr_url")?.setting_value;
      const apiKey = data?.find(s => s.setting_key === "jellyseerr_api_key")?.setting_value;

      if (!jellyseerrUrl || !apiKey) {
        return { 
          name: "Jellyseerr", 
          status: "down", 
          message: health.notConfigured || "Not configured", 
          lastChecked: new Date() 
        };
      }

      const { data: testData, error: testError } = await supabase.functions.invoke('jellyseerr-test', {
        body: { url: jellyseerrUrl, apiKey },
      });

      const responseTime = Date.now() - startTime;

      if (testError || !testData?.success) {
        return { 
          name: "Jellyseerr", 
          status: "down", 
          message: (testData as any)?.message || (testError as any)?.message || (health.connectionFailed || "Connection failed"), 
          lastChecked: new Date(),
          responseTime 
        };
      }

      return { 
        name: "Jellyseerr", 
        status: "healthy", 
        message: `v${testData.data?.version || (health.unknown || 'Unknown')}`, 
        lastChecked: new Date(),
        responseTime 
      };
    } catch (error) {
      return { 
        name: "Jellyseerr", 
        status: "down", 
        message: error instanceof Error ? error.message : (health.unknownError || "Unknown error"), 
        lastChecked: new Date() 
      };
    }
  };

  const checkDatabase = async (): Promise<ServiceStatus> => {
    const startTime = Date.now();
    try {
      const { error } = await supabase
        .from("server_settings")
        .select("setting_key")
        .limit(1);

      const responseTime = Date.now() - startTime;

      if (error) {
        return { 
          name: "Database", 
          status: "down", 
          message: error.message, 
          lastChecked: new Date(),
          responseTime 
        };
      }

      return { 
        name: "Database", 
        status: "healthy", 
        message: health.connected || "Connected", 
        lastChecked: new Date(),
        responseTime 
      };
    } catch (error) {
      return { 
        name: "Database", 
        status: "down", 
        message: error instanceof Error ? error.message : (health.unknownError || "Unknown error"), 
        lastChecked: new Date() 
      };
    }
  };

  const checkNetdata = async (): Promise<ServiceStatus> => {
    const startTime = Date.now();
    try {
      const { data, error } = await supabase
        .from("server_settings")
        .select("setting_value")
        .eq("setting_key", "monitoring_url")
        .maybeSingle()
        .throwOnError();

      const monitoringUrl = data?.setting_value;

      if (!monitoringUrl) {
        return { 
          name: "Netdata", 
          status: "down", 
          message: health.notConfigured || "Not configured", 
          lastChecked: new Date() 
        };
      }

      const { data: statsData, error: statsError } = await supabase.functions.invoke('server-stats');

      const responseTime = Date.now() - startTime;

      if (statsError || !statsData) {
        return { 
          name: "Netdata", 
          status: "down", 
          message: statsError?.message || (health.noData || "No data"), 
          lastChecked: new Date(),
          responseTime 
        };
      }

      return { 
        name: "Netdata", 
        status: "healthy", 
        message: `${statsData.system?.os || (health.unknown || 'Unknown')} (${statsData.system?.version || 'N/A'})`, 
        lastChecked: new Date(),
        responseTime 
      };
    } catch (error) {
      return { 
        name: "Netdata", 
        status: "down", 
        message: error instanceof Error ? error.message : (health.unknownError || "Unknown error"), 
        lastChecked: new Date() 
      };
    }
  };

  const performHealthCheck = useCallback(async () => {
    setIsChecking(true);
    
    const [jellyfinStatus, jellyseerrStatus, databaseStatus, netdataStatus] = await Promise.all([
      checkJellyfin(),
      checkJellyseerr(),
      checkDatabase(),
      checkNetdata(),
    ]);

    const statuses = [jellyfinStatus.status, jellyseerrStatus.status, databaseStatus.status, netdataStatus.status];
    const overallStatus = statuses.includes("down") 
      ? "down" 
      : statuses.includes("degraded") 
      ? "degraded" 
      : "healthy";

    const newHealthStatus: HealthCheckResult = {
      jellyfin: jellyfinStatus,
      jellyseerr: jellyseerrStatus,
      database: databaseStatus,
      netdata: netdataStatus,
      overallStatus,
    };

    setHealthStatus(newHealthStatus);
    setIsChecking(false);

    // Show toast notifications for services that went down (compare with previous status via ref)
    const prev = prevHealthStatusRef.current;
    if (prev) {
      if (jellyfinStatus.status === "down" && prev.jellyfin.status !== "down") {
        toast.error(`Jellyfin ${health.isDown || "is down"}: ${jellyfinStatus.message}`);
      }
      if (jellyseerrStatus.status === "down" && prev.jellyseerr.status !== "down") {
        toast.error(`Jellyseerr ${health.isDown || "is down"}: ${jellyseerrStatus.message}`);
      }
      if (databaseStatus.status === "down" && prev.database.status !== "down") {
        toast.error(`Database ${health.isDown || "is down"}: ${databaseStatus.message}`);
      }
      if (netdataStatus.status === "down" && prev.netdata.status !== "down") {
        toast.warning(`Netdata ${health.isDown || "is down"}: ${netdataStatus.message}`);
      }
    }
    
    // Update ref for next comparison
    prevHealthStatusRef.current = newHealthStatus;

    return newHealthStatus;
  }, [health.isDown]);

  useEffect(() => {
    if (!autoCheck) return;

    performHealthCheck();
    const intervalId = setInterval(performHealthCheck, interval);

    return () => clearInterval(intervalId);
  }, [autoCheck, interval, performHealthCheck]);

  return { 
    healthStatus, 
    isChecking, 
    performHealthCheck 
  };
};
