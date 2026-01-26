import { useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import type { ProxmoxServer, ConnectionStatus } from "@/lib/types";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";

type ServerRecord = {
  id: string;
  connection_status: string;
  last_health_check_at: string | null;
  health_check_error: string | null;
  last_connected_at: string | null;
  learned_timeout_ms: number | null;
  avg_response_time_ms: number | null;
  success_rate: number | null;
};

type ServerUpdatePayload = RealtimePostgresChangesPayload<ServerRecord>;

export function useServerRealtimeUpdates(tenantId: string | undefined) {
  const queryClient = useQueryClient();

  const handleServerUpdate = useCallback(
    (payload: ServerUpdatePayload) => {
      if (payload.eventType === "UPDATE" && payload.new) {
        const newData = payload.new;
        const oldData = payload.old as ServerRecord | undefined;
        
        // Update the server in the cache
        queryClient.setQueryData<ProxmoxServer[]>(
          ["proxmox-servers", tenantId],
          (oldServers) => {
            if (!oldServers) return oldServers;
            return oldServers.map((server) =>
              server.id === newData.id
                ? {
                    ...server,
                    connection_status: newData.connection_status as ConnectionStatus,
                    last_health_check_at: newData.last_health_check_at,
                    health_check_error: newData.health_check_error,
                    last_connected_at: newData.last_connected_at,
                    learned_timeout_ms: newData.learned_timeout_ms,
                    avg_response_time_ms: newData.avg_response_time_ms,
                    success_rate: newData.success_rate,
                  }
                : server
            );
          }
        );

        // Invalidate tenant stats if a server status changed
        if (oldData?.connection_status !== newData.connection_status) {
          queryClient.invalidateQueries({ queryKey: ["tenant-live-stats", tenantId] });
        }
      }
    },
    [queryClient, tenantId]
  );

  useEffect(() => {
    if (!tenantId) return;

    // Subscribe to proxmox_servers changes for this tenant
    const channel = supabase
      .channel(`servers-${tenantId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "api",
          table: "proxmox_servers",
          filter: `tenant_id=eq.${tenantId}`,
        },
        handleServerUpdate
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          console.log("[Realtime] Server updates subscription active");
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tenantId, handleServerUpdate]);
}
