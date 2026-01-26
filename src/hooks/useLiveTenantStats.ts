import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { LiveTenantStats } from "@/lib/types";

export function useLiveTenantStats(tenantId: string | undefined) {
  return useQuery({
    queryKey: ["tenant-live-stats", tenantId],
    queryFn: async () => {
      if (!tenantId) return null;

      const { data, error } = await supabase.functions.invoke("tenant-stats", {
        body: { action: "get-live-stats", tenantId },
      });

      if (error) {
        console.error("Failed to fetch live stats:", error);
        throw error;
      }

      return data.stats as LiveTenantStats;
    },
    enabled: !!tenantId,
    refetchInterval: 10000, // Refresh every 10 seconds
    staleTime: 5000, // Consider data stale after 5 seconds
  });
}
