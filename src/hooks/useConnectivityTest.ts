import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import type { ConnectivityTestResult } from "@/lib/types";

export function useConnectivityTest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (serverId: string): Promise<ConnectivityTestResult> => {
      const { data, error } = await supabase.functions.invoke("connectivity-test", {
        body: { serverId },
      });

      if (error) throw error;
      return data.result;
    },
    onSuccess: (result) => {
      if (result.success) {
        toast({
          title: "Connection test successful",
          description: `Latency: ${result.timing.totalLatencyMs}ms`,
        });
      } else {
        toast({
          title: "Connection test failed",
          description: result.error,
          variant: "destructive",
        });
      }
      // Refresh server list to show updated status
      queryClient.invalidateQueries({ queryKey: ["proxmox-servers"] });
    },
    onError: (error) => {
      toast({
        title: "Connection test failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useApplyRecommendedTimeout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      serverId,
      recommendedTimeoutMs,
    }: {
      serverId: string;
      recommendedTimeoutMs: number;
    }) => {
      const { error } = await supabase
        .from("proxmox_servers")
        .update({ connection_timeout: recommendedTimeoutMs })
        .eq("id", serverId);

      if (error) throw error;
      return { serverId, recommendedTimeoutMs };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["proxmox-servers"] });
      toast({
        title: "Timeout updated",
        description: `Server timeout set to ${Math.round(data.recommendedTimeoutMs / 1000)}s`,
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to update timeout",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}
