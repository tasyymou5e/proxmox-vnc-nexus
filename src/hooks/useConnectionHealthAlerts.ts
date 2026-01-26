import { useEffect, useCallback, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface HealthAlert {
  serverId: string;
  serverName: string;
  alertType: "offline" | "degraded" | "recovered";
  successRate: number;
  threshold: number;
  timestamp: Date;
}

interface UseConnectionHealthAlertsProps {
  tenantId: string;
  enabled?: boolean;
  successRateThreshold?: number; // Default 80%
  checkIntervalMs?: number; // Default 60 seconds
}

export function useConnectionHealthAlerts({
  tenantId,
  enabled = true,
  successRateThreshold = 80,
  checkIntervalMs = 60000,
}: UseConnectionHealthAlertsProps) {
  const { toast } = useToast();
  const previousStates = useRef<Map<string, { status: string; successRate: number }>>(new Map());
  const alertsShown = useRef<Set<string>>(new Set());

  // Fetch tenant settings for notification preferences
  const { data: settings } = useQuery({
    queryKey: ["tenant-settings", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenant_settings")
        .select("notify_on_server_offline")
        .eq("tenant_id", tenantId)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: enabled && !!tenantId,
  });

  // Fetch server health data
  const { data: servers, refetch } = useQuery({
    queryKey: ["server-health", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("proxmox_servers")
        .select("id, name, connection_status, success_rate, last_health_check_at")
        .eq("tenant_id", tenantId)
        .eq("is_active", true);
      
      if (error) throw error;
      return data || [];
    },
    enabled: enabled && !!tenantId,
    refetchInterval: checkIntervalMs,
  });

  // Log alert to audit log
  const logAlert = useCallback(async (alert: HealthAlert) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabase.from("audit_logs").insert({
        user_id: user.id,
        tenant_id: tenantId,
        action_type: alert.alertType === "recovered" ? "server_recovered" : "server_alert",
        resource_type: "proxmox_server",
        resource_id: alert.serverId,
        resource_name: alert.serverName,
        details: {
          alert_type: alert.alertType,
          success_rate: alert.successRate,
          threshold: alert.threshold,
          timestamp: alert.timestamp.toISOString(),
        },
      });
    } catch (err) {
      console.error("Failed to log alert:", err);
    }
  }, [tenantId]);

  // Check for health changes and trigger alerts
  useEffect(() => {
    if (!servers || !enabled || !settings?.notify_on_server_offline) return;

    servers.forEach(server => {
      const prevState = previousStates.current.get(server.id);
      const currentStatus = server.connection_status || "unknown";
      const currentSuccessRate = server.success_rate || 0;
      const alertKey = `${server.id}-${currentStatus}`;

      // Check for status changes
      if (prevState) {
        const wasOnline = prevState.status === "online";
        const isOnline = currentStatus === "online";
        const wasDegraded = prevState.successRate < successRateThreshold;
        const isDegraded = currentSuccessRate < successRateThreshold;

        // Server went offline
        if (wasOnline && !isOnline && !alertsShown.current.has(alertKey)) {
          const alert: HealthAlert = {
            serverId: server.id,
            serverName: server.name,
            alertType: "offline",
            successRate: currentSuccessRate,
            threshold: successRateThreshold,
            timestamp: new Date(),
          };

          toast({
            title: "Server Offline",
            description: `${server.name} is now offline`,
            variant: "destructive",
          });

          logAlert(alert);
          alertsShown.current.add(alertKey);
        }

        // Server success rate dropped below threshold
        if (!wasDegraded && isDegraded && isOnline && !alertsShown.current.has(`${server.id}-degraded`)) {
          const alert: HealthAlert = {
            serverId: server.id,
            serverName: server.name,
            alertType: "degraded",
            successRate: currentSuccessRate,
            threshold: successRateThreshold,
            timestamp: new Date(),
          };

          toast({
            title: "Server Degraded",
            description: `${server.name} success rate dropped to ${currentSuccessRate.toFixed(1)}%`,
            variant: "destructive",
          });

          logAlert(alert);
          alertsShown.current.add(`${server.id}-degraded`);
        }

        // Server recovered
        if (!wasOnline && isOnline) {
          const alert: HealthAlert = {
            serverId: server.id,
            serverName: server.name,
            alertType: "recovered",
            successRate: currentSuccessRate,
            threshold: successRateThreshold,
            timestamp: new Date(),
          };

          toast({
            title: "Server Recovered",
            description: `${server.name} is back online`,
          });

          logAlert(alert);
          
          // Clear offline alert
          alertsShown.current.delete(`${server.id}-offline`);
        }

        // Success rate recovered above threshold
        if (wasDegraded && !isDegraded && isOnline) {
          alertsShown.current.delete(`${server.id}-degraded`);
        }
      }

      // Update previous state
      previousStates.current.set(server.id, {
        status: currentStatus,
        successRate: currentSuccessRate,
      });
    });
  }, [servers, enabled, settings?.notify_on_server_offline, successRateThreshold, toast, logAlert]);

  // Get current alerts
  const currentAlerts = (servers || [])
    .filter(s => 
      s.connection_status !== "online" || 
      (s.success_rate !== null && s.success_rate < successRateThreshold)
    )
    .map(s => ({
      serverId: s.id,
      serverName: s.name,
      status: s.connection_status || "unknown",
      successRate: s.success_rate || 0,
      lastCheck: s.last_health_check_at,
    }));

  return {
    alerts: currentAlerts,
    refetch,
    isEnabled: settings?.notify_on_server_offline ?? true,
  };
}
