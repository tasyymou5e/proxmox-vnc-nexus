import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listVMs, performVMAction, getVMConsole } from "@/lib/api";
import type { VM, VNCConnection } from "@/lib/types";

export function useVMs() {
  return useQuery({
    queryKey: ["vms"],
    queryFn: listVMs,
    refetchInterval: 10000, // Refresh every 10 seconds
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
    onSuccess: () => {
      // Refetch VMs after action
      queryClient.invalidateQueries({ queryKey: ["vms"] });
    },
  });
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
