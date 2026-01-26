import { useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

export function useConnectionMetricsRealtime(serverId: string | undefined) {
  const queryClient = useQueryClient();

  const handleNewMetric = useCallback(() => {
    // Invalidate the connection history query to refetch
    queryClient.invalidateQueries({ queryKey: ["connection-history", serverId] });
  }, [queryClient, serverId]);

  useEffect(() => {
    if (!serverId) return;

    const channel = supabase
      .channel(`metrics-${serverId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "connection_metrics",
          filter: `server_id=eq.${serverId}`,
        },
        handleNewMetric
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          console.log("[Realtime] Connection metrics subscription active");
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [serverId, handleNewMetric]);
}
