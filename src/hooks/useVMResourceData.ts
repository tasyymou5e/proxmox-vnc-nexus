import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface RrdDataPoint {
  time: string;
  cpu: number | null;
  memory: number | null;
  memoryUsed: number | null;
  memoryMax: number | null;
  disk: number | null;
  diskRead: number | null;
  diskWrite: number | null;
  netIn: number | null;
  netOut: number | null;
}

interface UseVMResourceDataProps {
  serverId: string;
  node: string;
  vmid: number;
  vmtype: "qemu" | "lxc";
  timeframe?: "hour" | "day" | "week" | "month" | "year";
  enabled?: boolean;
}

export function useVMResourceData({
  serverId,
  node,
  vmid,
  vmtype,
  timeframe = "hour",
  enabled = true,
}: UseVMResourceDataProps) {
  return useQuery({
    queryKey: ["vm-rrd-data", serverId, node, vmid, timeframe],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("vm-rrd-data", {
        body: { serverId, node, vmid, vmtype, timeframe },
      });

      if (error) throw error;
      return data as { data: RrdDataPoint[]; timeframe: string };
    },
    enabled: enabled && !!serverId && !!node && !!vmid,
    refetchInterval: timeframe === "hour" ? 60000 : 300000, // 1 min for hour view, 5 min for others
    staleTime: 30000,
  });
}
