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
  const previousStates = useRef<Map<string, { status: string; successRate: number; latency: number }>>(new Map());
  const alertsShown = useRef<Set<string>>(new Set());

  // Fetch tenant settings for notification preferences and thresholds
  const { data: settings } = useQuery({
    queryKey: ["tenant-settings", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenant_settings")
        .select("notify_on_server_offline, alert_success_rate_threshold, alert_latency_threshold_ms, alert_offline_duration_seconds")
        .eq("tenant_id", tenantId)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: enabled && !!tenantId,
  });

  // Use tenant settings thresholds or fall back to defaults/props
  const effectiveSuccessThreshold = settings?.alert_success_rate_threshold ?? successRateThreshold;
  const effectiveLatencyThreshold = settings?.alert_latency_threshold_ms ?? 500;

  // Fetch server health data
  const { data: servers, refetch } = useQuery({
    queryKey: ["server-health", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("proxmox_servers")
        .select("id, name, connection_status, success_rate, avg_response_time_ms, last_health_check_at")
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
      const avgResponseTime = server.avg_response_time_ms || 0;
      const currentStatus = server.connection_status || "unknown";
      const currentSuccessRate = server.success_rate || 0;
      const alertKey = `${server.id}-${currentStatus}`;

      // Check for status changes
      if (prevState) {
        const wasOnline = prevState.status === "online";
        const isOnline = currentStatus === "online";
        const wasDegraded = prevState.successRate < effectiveSuccessThreshold || prevState.latency > effectiveLatencyThreshold;
        const isDegraded = currentSuccessRate < effectiveSuccessThreshold || avgResponseTime > effectiveLatencyThreshold;

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

        // Server success rate dropped below threshold or latency exceeded
        if (!wasDegraded && isDegraded && isOnline && !alertsShown.current.has(`${server.id}-degraded`)) {
          const degradeReason = currentSuccessRate < effectiveSuccessThreshold 
            ? `success rate dropped to ${currentSuccessRate.toFixed(1)}%`
            : `latency increased to ${avgResponseTime}ms`;
          
          const alert: HealthAlert = {
            serverId: server.id,
            serverName: server.name,
            alertType: "degraded",
            successRate: currentSuccessRate,
            threshold: effectiveSuccessThreshold,
            timestamp: new Date(),
          };

          toast({
            title: "Server Degraded",
            description: `${server.name} ${degradeReason}`,
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
        latency: avgResponseTime,
      });
    });
  }, [servers, enabled, settings?.notify_on_server_offline, effectiveSuccessThreshold, effectiveLatencyThreshold, toast, logAlert]);

  // Get current alerts - include latency-based degradation
  const currentAlerts = (servers || [])
    .filter(s => 
      s.connection_status !== "online" || 
      (s.success_rate !== null && s.success_rate < effectiveSuccessThreshold) ||
      (s.avg_response_time_ms !== null && s.avg_response_time_ms > effectiveLatencyThreshold)
    )
    .map(s => ({
      serverId: s.id,
      serverName: s.name,
      status: s.connection_status || "unknown",
      successRate: s.success_rate || 0,
      avgLatency: s.avg_response_time_ms || 0,
      lastCheck: s.last_health_check_at,
    }));

  return {
    alerts: currentAlerts,
    refetch,
    isEnabled: settings?.notify_on_server_offline ?? true,
    thresholds: {
      successRate: effectiveSuccessThreshold,
      latencyMs: effectiveLatencyThreshold,
    },
  };
}
