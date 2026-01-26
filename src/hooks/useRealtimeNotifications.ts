import { useEffect, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface NotificationEvent {
  id: string;
  action_type: string;
  resource_type: string;
  resource_id: string | null;
  resource_name: string | null;
  details: Record<string, unknown>;
  created_at: string;
}

const ALERT_ACTION_TYPES = [
  "server_alert",
  "server_offline",
  "server_degraded",
  "health_check_failed",
  "server_recovered",
  "health_check_passed",
  "settings_updated",
];

const notificationLabels: Record<string, string> = {
  server_alert: "Server Alert",
  server_offline: "Server Offline",
  server_recovered: "Server Recovered",
  server_degraded: "Performance Degraded",
  settings_updated: "Settings Updated",
  health_check_failed: "Health Check Failed",
  health_check_passed: "Health Check Passed",
};

export function useRealtimeNotifications(tenantId: string | undefined) {
  const queryClient = useQueryClient();

  const handleNewNotification = useCallback(
    (payload: { new: NotificationEvent }) => {
      const event = payload.new;
      
      // Only process notification-related action types
      if (!ALERT_ACTION_TYPES.includes(event.action_type)) {
        return;
      }

      // Invalidate the notifications query to refresh the list
      queryClient.invalidateQueries({ queryKey: ["notifications", tenantId] });

      // Show a toast for important alerts
      const isAlert = ["server_alert", "server_offline", "server_degraded", "health_check_failed"].includes(event.action_type);
      const isRecovered = ["server_recovered", "health_check_passed"].includes(event.action_type);
      
      const label = notificationLabels[event.action_type] || event.action_type;
      const resourceName = event.resource_name || event.resource_id || "System";

      if (isAlert) {
        toast.error(`${label}: ${resourceName}`, {
          description: "A new alert has been triggered",
          duration: 5000,
        });
      } else if (isRecovered) {
        toast.success(`${label}: ${resourceName}`, {
          description: "System has recovered",
          duration: 5000,
        });
      }
    },
    [queryClient, tenantId]
  );

  useEffect(() => {
    if (!tenantId) return;

    const channel = supabase
      .channel(`audit-logs-${tenantId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "audit_logs",
          filter: `tenant_id=eq.${tenantId}`,
        },
        handleNewNotification
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          console.log("Subscribed to real-time notifications");
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tenantId, handleNewNotification]);
}
