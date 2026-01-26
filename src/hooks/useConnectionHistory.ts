import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface HourlyMetric {
  time: string;
  successRate: number;
  avgResponseTime: number | null;
  attempts: number;
}

export interface ConnectionHistorySummary {
  totalAttempts: number;
  successCount: number;
  avgResponseTime: number | null;
}

export interface ConnectionHistory {
  hourly: HourlyMetric[];
  summary: ConnectionHistorySummary;
}

export function useConnectionHistory(serverId: string | undefined) {
  return useQuery({
    queryKey: ["connection-history", serverId],
    queryFn: async (): Promise<ConnectionHistory> => {
      if (!serverId) throw new Error("Server ID required");

      const { data, error } = await supabase.functions.invoke("connection-metrics", {
        body: { action: "get-history", serverId },
      });

      if (error) throw error;
      return data.history;
    },
    enabled: !!serverId,
    refetchInterval: 60000, // Refresh every minute
    staleTime: 30000,
  });
}
