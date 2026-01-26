import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { VMStatusBadge } from "./VMStatusBadge";
import { useVMAction } from "@/hooks/useVMs";
import { toast } from "@/hooks/use-toast";
import type { VM } from "@/lib/types";
import { Monitor, Play, Square, RotateCcw, Loader2, Link2 } from "lucide-react";

interface VMTableProps {
  vms: VM[];
}

export function VMTable({ vms }: VMTableProps) {
  const navigate = useNavigate();
  const vmAction = useVMAction();
  const [actionInProgress, setActionInProgress] = useState<Record<number, string>>({});

  const handleAction = async (
    vm: VM,
    action: "start" | "stop" | "shutdown" | "reset"
  ) => {
    setActionInProgress((prev) => ({ ...prev, [vm.vmid]: action }));
    try {
      await vmAction.mutateAsync({
        node: vm.node,
        vmid: vm.vmid,
        action,
        vmType: vm.type,
      });
      toast({
        title: "Action initiated",
        description: `${action.charAt(0).toUpperCase() + action.slice(1)} command sent to ${vm.name || `VM ${vm.vmid}`}`,
      });
    } catch (error) {
      toast({
        title: "Action failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setActionInProgress((prev) => {
        const newState = { ...prev };
        delete newState[vm.vmid];
        return newState;
      });
    }
  };

  const handleConsole = (vm: VM) => {
    navigate(`/console/${vm.node}/${vm.vmid}?type=${vm.type}`);
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  return (
    <div className="rounded-lg border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[60px]">ID</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Server</TableHead>
            <TableHead>Node</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">CPU</TableHead>
            <TableHead className="text-right">Memory</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {vms.map((vm) => {
            const isActionInProgress = !!actionInProgress[vm.vmid];
            const canStart = vm.status === "stopped";
            const canStop = vm.status === "running";
            const canConsole = vm.status === "running" && vm.permissions?.includes("console");

              return (
                <TableRow key={`${vm.serverId || 'default'}-${vm.node}-${vm.vmid}`}>
                  <TableCell className="font-mono text-sm">{vm.vmid}</TableCell>
                  <TableCell className="font-medium">{vm.name || "-"}</TableCell>
                  <TableCell className="text-muted-foreground">
                    <div className="flex items-center gap-1">
                      {vm.serverName || "-"}
                      {vm.useTailscale && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger>
                              <Link2 className="h-3 w-3 text-primary" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Tailscale: {vm.tailscaleHostname || "Enabled"}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{vm.node}</TableCell>
                  <TableCell className="uppercase text-xs">{vm.type}</TableCell>
                <TableCell>
                  <VMStatusBadge status={vm.status} />
                </TableCell>
                <TableCell className="text-right">
                  {vm.status === "running" && vm.cpu !== undefined
                    ? `${(vm.cpu * 100).toFixed(0)}%`
                    : "-"}
                </TableCell>
                <TableCell className="text-right">
                  {vm.status === "running" && vm.mem
                    ? `${formatBytes(vm.mem)} / ${formatBytes(vm.maxmem || 0)}`
                    : vm.maxmem
                    ? formatBytes(vm.maxmem)
                    : "-"}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleConsole(vm)}
                      disabled={!canConsole}
                      title="Open Console"
                    >
                      <Monitor className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleAction(vm, "start")}
                      disabled={!canStart || isActionInProgress}
                      title="Start"
                    >
                      {actionInProgress[vm.vmid] === "start" ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Play className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleAction(vm, "shutdown")}
                      disabled={!canStop || isActionInProgress}
                      title="Shutdown"
                    >
                      {actionInProgress[vm.vmid] === "shutdown" ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Square className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleAction(vm, "reset")}
                      disabled={!canStop || isActionInProgress}
                      title="Reset"
                    >
                      {actionInProgress[vm.vmid] === "reset" ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <RotateCcw className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
