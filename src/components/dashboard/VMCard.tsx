import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { VMStatusBadge } from "./VMStatusBadge";
import { ResourceMeter } from "./ResourceMeter";
import { useVMAction } from "@/hooks/useVMs";
import { toast } from "@/hooks/use-toast";
import type { VM } from "@/lib/types";
import { 
  Monitor, 
  Play, 
  Square, 
  RotateCcw, 
  MoreVertical, 
  Loader2,
  Server,
  Link2
} from "lucide-react";

interface VMCardProps {
  vm: VM;
}

export function VMCard({ vm }: VMCardProps) {
  const navigate = useNavigate();
  const vmAction = useVMAction();
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  const handleAction = async (action: "start" | "stop" | "shutdown" | "reset") => {
    setActionInProgress(action);
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
      setActionInProgress(null);
    }
  };

  const handleConsole = () => {
    navigate(`/console/${vm.node}/${vm.vmid}?type=${vm.type}`);
  };

  const canStart = vm.status === "stopped";
  const canStop = vm.status === "running";
  const canConsole = vm.status === "running" && vm.permissions?.includes("console");

  return (
    <Card className="group hover:shadow-md transition-shadow">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Server className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg font-semibold">
                {vm.name || `VM ${vm.vmid}`}
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                {vm.type.toUpperCase()} • Node: {vm.node} • ID: {vm.vmid}
              </p>
              {vm.serverName && (
                <div className="flex items-center gap-1 mt-1 flex-wrap">
                  <Badge variant="secondary" className="text-xs">
                    {vm.serverName}
                  </Badge>
                  {vm.useTailscale && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Badge variant="outline" className="text-xs text-primary border-primary">
                            <Link2 className="h-3 w-3 mr-1" />
                            Tailscale
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Connected via Tailscale</p>
                          {vm.tailscaleHostname && (
                            <p className="text-xs text-muted-foreground">{vm.tailscaleHostname}</p>
                          )}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                </div>
              )}
            </div>
          </div>
          <VMStatusBadge status={vm.status} />
        </div>
      </CardHeader>
      <CardContent className="pb-3 space-y-3">
        {vm.status === "running" && (
          <>
            <ResourceMeter
              value={vm.cpu || 0}
              max={1}
              label="CPU"
              unit="%"
            />
            <ResourceMeter
              value={vm.mem || 0}
              max={vm.maxmem || 1}
              label="Memory"
              unit="GB"
            />
            <ResourceMeter
              value={vm.disk || 0}
              max={vm.maxdisk || 1}
              label="Disk"
              unit="GB"
            />
          </>
        )}
        {vm.status !== "running" && (
          <div className="py-4 text-center text-sm text-muted-foreground">
            <p>VM is {vm.status}</p>
            {vm.maxmem && (
              <p className="text-xs mt-1">
                {(vm.maxmem / 1024 / 1024 / 1024).toFixed(1)} GB RAM •{" "}
                {vm.maxcpu} vCPUs
              </p>
            )}
          </div>
        )}
      </CardContent>
      <CardFooter className="pt-0 gap-2">
        <Button
          variant="default"
          size="sm"
          className="flex-1"
          onClick={handleConsole}
          disabled={!canConsole}
        >
          <Monitor className="h-4 w-4 mr-1" />
          Console
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon" className="h-8 w-8">
              {actionInProgress ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <MoreVertical className="h-4 w-4" />
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={() => handleAction("start")}
              disabled={!canStart || !!actionInProgress}
            >
              <Play className="h-4 w-4 mr-2" />
              Start
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => handleAction("shutdown")}
              disabled={!canStop || !!actionInProgress}
            >
              <Square className="h-4 w-4 mr-2" />
              Shutdown
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => handleAction("stop")}
              disabled={!canStop || !!actionInProgress}
              className="text-destructive"
            >
              <Square className="h-4 w-4 mr-2" />
              Force Stop
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => handleAction("reset")}
              disabled={!canStop || !!actionInProgress}
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Reset
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardFooter>
    </Card>
  );
}
