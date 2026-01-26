import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import type { VM } from "@/lib/types";

type VMAction = "start" | "stop" | "shutdown" | "reset" | "suspend" | "resume";

export function useTenantVMs(tenantId: string | undefined) {
  const queryClient = useQueryClient();

  const vmsQuery = useQuery({
    queryKey: ["tenant-vms", tenantId],
    queryFn: async (): Promise<VM[]> => {
      if (!tenantId) return [];

      const { data, error } = await supabase.functions.invoke("list-vms", {
        body: { tenantId },
      });

      if (error) throw error;
      return data.vms || [];
    },
    refetchInterval: 15000, // Refresh every 15 seconds
    enabled: !!tenantId,
  });

  const vmActionMutation = useMutation({
    mutationFn: async ({
      vmid,
      node,
      action,
      vmType = "qemu",
      vmName,
      serverId,
      serverName,
    }: {
      vmid: number;
      node: string;
      action: VMAction;
      vmType?: "qemu" | "lxc";
      vmName?: string;
      serverId?: string;
      serverName?: string;
    }) => {
      const { data, error } = await supabase.functions.invoke("vm-actions", {
        body: {
          node,
          vmid,
          action,
          vmType,
          serverId,
          tenantId,
          vmName,
          serverName,
        },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error || `Failed to ${action} VM`);
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["tenant-vms", tenantId] });
      queryClient.invalidateQueries({ queryKey: ["tenant-live-stats", tenantId] });
      toast({
        title: `VM ${variables.action} initiated`,
        description: `${variables.vmName || `VM ${variables.vmid}`} is being ${variables.action === 'start' ? 'started' : variables.action === 'stop' ? 'stopped' : variables.action + 'ed'}`,
      });
    },
    onError: (error, variables) => {
      toast({
        title: `Failed to ${variables.action} VM`,
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return {
    vms: vmsQuery.data || [],
    isLoading: vmsQuery.isLoading,
    error: vmsQuery.error,
    refetch: vmsQuery.refetch,
    performAction: vmActionMutation.mutate,
    isPerformingAction: vmActionMutation.isPending,
  };
}
