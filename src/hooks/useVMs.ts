import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listVMs, performVMAction, getVMConsole } from "@/lib/api";
import { INTERVALS } from "@/lib/constants";
import type { VM, VNCConnection } from "@/lib/types";

export function useVMs() {
  return useQuery({
    queryKey: ["vms"],
    queryFn: listVMs,
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
    mutationFn: ({
      node,
      vmid,
      vmType = "qemu",
    }: {
      node: string;
      vmid: number;
      vmType?: "qemu" | "lxc";
    }) => getVMConsole(node, vmid, vmType),
  });
}
