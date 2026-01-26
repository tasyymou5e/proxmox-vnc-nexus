import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { listVMs, performVMAction } from "@/lib/api";
import { INTERVALS } from "@/lib/constants";
import type { VM, VNCConnection } from "@/lib/types";

export function useVMs(serverId?: string) {
  return useQuery({
    queryKey: ["vms", serverId],
    queryFn: () => listVMs(serverId === "all" ? undefined : serverId),
    refetchInterval: INTERVALS.VM_LIST,
    staleTime: INTERVALS.STALE_TIME,
    gcTime: INTERVALS.GC_TIME,
    retry: 2,
  });
}

export function useVMAction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      node,
      vmid,
      action,
      vmType = "qemu",
    }: {
      node: string;
      vmid: number;
      action: "start" | "stop" | "shutdown" | "reset" | "suspend" | "resume";
      vmType?: "qemu" | "lxc";
    }) => performVMAction(node, vmid, action, vmType),

    // Optimistic update
    onMutate: async ({ node, vmid, action }) => {
      await queryClient.cancelQueries({ queryKey: ["vms"] });
      const previousVMs = queryClient.getQueryData<{ vms: VM[]; isAdmin: boolean }>(["vms"]);

      if (previousVMs) {
        const newStatus = getOptimisticStatus(action);
        queryClient.setQueryData<{ vms: VM[]; isAdmin: boolean }>(["vms"], {
          ...previousVMs,
          vms: previousVMs.vms.map((vm) =>
            vm.vmid === vmid && vm.node === node
              ? { ...vm, status: newStatus }
              : vm
          ),
        });
      }

      return { previousVMs };
    },

    onError: (_err, _variables, context) => {
      if (context?.previousVMs) {
        queryClient.setQueryData(["vms"], context.previousVMs);
      }
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["vms"] });
    },
  });
}

function getOptimisticStatus(
  action: "start" | "stop" | "shutdown" | "reset" | "suspend" | "resume"
): VM["status"] {
  switch (action) {
    case "start":
    case "resume":
      return "running";
    case "stop":
    case "shutdown":
      return "stopped";
    case "suspend":
      return "suspended";
    case "reset":
      return "running";
    default:
      return "unknown";
  }
}

export function useVMConsole() {
  return useMutation({
    mutationFn: async ({
      node,
      vmid,
      vmType = "qemu",
      serverId,
    }: {
      node: string;
      vmid: number;
      vmType?: "qemu" | "lxc";
      serverId?: string;
    }): Promise<VNCConnection> => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error("Not authenticated");
      }

      const { data, error } = await supabase.functions.invoke("vm-console", {
        body: { node, vmid, vmType, serverId },
      });

      if (error) throw error;
      if (!data) throw new Error("No connection data received");
      
      // Build relay URL with JWT for WebSocket connection
      const jwt = session.access_token;
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://lbfabewnshfjdjfosqxl.supabase.co";
      const relayUrl = `wss://${supabaseUrl.replace("https://", "")}/functions/v1/vnc-relay?jwt=${jwt}&node=${node}&vmid=${vmid}&type=${vmType}${serverId ? `&serverId=${serverId}` : ''}`;

      return {
        ...data,
        relayUrl,
      };
    },
  });
}
