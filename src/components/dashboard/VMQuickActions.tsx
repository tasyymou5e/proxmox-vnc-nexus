import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Play, Square, RotateCcw, Loader2, Monitor, Link2, Terminal, BarChart2 } from "lucide-react";
import type { VM } from "@/lib/types";

interface VMQuickActionsProps {
  vm: VM;
  onAction: (action: "start" | "stop" | "reset") => Promise<void>;
  isPerformingAction: boolean;
  canManage: boolean;
  onClick?: () => void;
}

export function VMQuickActions({ vm, onAction, isPerformingAction, canManage, onClick }: VMQuickActionsProps) {
  const navigate = useNavigate();
  const [confirmAction, setConfirmAction] = useState<"stop" | "reset" | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  
  const isRunning = vm.status === "running";
  const isStopped = vm.status === "stopped";

  const handleOpenConsole = () => {
    navigate(`/console/${vm.node}/${vm.vmid}?type=${vm.type}${vm.serverId ? `&serverId=${vm.serverId}` : ''}`);
  };

  const handleOpenMonitoring = () => {
    if (vm.serverId) {
      navigate(`/vm/${vm.serverId}/${vm.node}/${vm.vmid}/monitoring?type=${vm.type}&name=${encodeURIComponent(vm.name || `VM ${vm.vmid}`)}`);
    }
  };
  
  const handleAction = async (action: "start" | "stop" | "reset") => {
    if (action === "stop" || action === "reset") {
      setConfirmAction(action);
    } else {
      setIsExecuting(true);
      try {
        await onAction(action);
      } finally {
        setIsExecuting(false);
      }
    }
  };

  const confirmAndExecute = async () => {
    if (confirmAction) {
      setIsExecuting(true);
      try {
        await onAction(confirmAction);
      } finally {
        setIsExecuting(false);
        setConfirmAction(null);
      }
    }
  };

  const isLoading = isPerformingAction || isExecuting;

  return (
    <>
      <div 
        className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-pointer"
        onClick={(e) => {
          // Only trigger onClick if the click wasn't on a button
          if ((e.target as HTMLElement).closest('button')) return;
          onClick?.();
        }}
      >
        <div className="flex items-center gap-3">
          <Monitor className="h-4 w-4 text-muted-foreground" />
          <div>
            <div className="flex items-center gap-2">
              <span className="font-medium">{vm.name || `VM ${vm.vmid}`}</span>
              <Badge variant={isRunning ? "default" : "secondary"} className="text-xs">
                {vm.status}
              </Badge>
              {vm.useTailscale && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <Link2 className="h-3 w-3 text-primary" />
                    </TooltipTrigger>
                    <TooltipContent>Tailscale: {vm.tailscaleHostname}</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {vm.node} • {vm.type.toUpperCase()} • ID: {vm.vmid}
            </p>
          </div>
        </div>
        
        {canManage && (
          <div className="flex items-center gap-1">
            {/* Monitoring button - always visible when serverId exists */}
            {vm.serverId && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleOpenMonitoring}
                      className="text-muted-foreground hover:text-foreground hover:bg-muted"
                    >
                      <BarChart2 className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>View Monitoring</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            
            {isStopped ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleAction("start")}
                disabled={isLoading}
                className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
                <span className="ml-1">Start</span>
              </Button>
            ) : isRunning ? (
              <>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleOpenConsole}
                        className="text-primary hover:text-primary hover:bg-primary/10"
                      >
                        <Terminal className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Open Console</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleAction("stop")}
                        disabled={isLoading}
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        {isLoading ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Square className="h-4 w-4" />
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Stop VM</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleAction("reset")}
                        disabled={isLoading}
                        className="text-amber-600 hover:text-amber-700 hover:bg-amber-500/10"
                      >
                        <RotateCcw className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Reset VM</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </>
            ) : null}
          </div>
        )}
      </div>

      {/* Confirmation Dialog */}
      <AlertDialog open={!!confirmAction} onOpenChange={() => setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction === "stop" ? "Stop" : "Reset"} {vm.name || `VM ${vm.vmid}`}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction === "stop"
                ? "This will gracefully stop the virtual machine. Any unsaved data may be lost."
                : "This will immediately reset the virtual machine. All unsaved data will be lost."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isExecuting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmAndExecute}
              disabled={isExecuting}
              className={confirmAction === "reset" ? "bg-orange-600 hover:bg-orange-700" : "bg-destructive hover:bg-destructive/90"}
            >
              {isExecuting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {confirmAction === "stop" ? "Stop VM" : "Reset VM"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
