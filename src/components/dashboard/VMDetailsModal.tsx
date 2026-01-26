import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { VMResourceCharts } from "./VMResourceCharts";
import type { VM } from "@/lib/types";
import { 
  Monitor, 
  Cpu, 
  MemoryStick, 
  HardDrive, 
  Clock, 
  Server,
  Terminal,
  ExternalLink,
  Play,
  Square,
  RotateCcw,
  Loader2,
  Activity,
  Link2
} from "lucide-react";

interface VMDetailsModalProps {
  vm: VM | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAction?: (action: "start" | "stop" | "reset") => Promise<void>;
  isPerformingAction?: boolean;
  canManage?: boolean;
}

export function VMDetailsModal({ 
  vm, 
  open, 
  onOpenChange,
  onAction,
  isPerformingAction = false,
  canManage = false
}: VMDetailsModalProps) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("overview");

  if (!vm) return null;

  const isRunning = vm.status === "running";
  const isStopped = vm.status === "stopped";

  const formatBytes = (bytes: number) => {
    if (!bytes) return "0 B";
    const units = ["B", "KB", "MB", "GB", "TB"];
    let unitIndex = 0;
    let value = bytes;
    while (value >= 1024 && unitIndex < units.length - 1) {
      value /= 1024;
      unitIndex++;
    }
    return `${value.toFixed(1)} ${units[unitIndex]}`;
  };

  const formatUptime = (seconds?: number) => {
    if (!seconds) return "N/A";
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (days > 0) return `${days}d ${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const handleOpenConsole = () => {
    onOpenChange(false);
    navigate(`/console/${vm.node}/${vm.vmid}?type=${vm.type}${vm.serverId ? `&serverId=${vm.serverId}` : ''}`);
  };

  const handleOpenMonitoring = () => {
    onOpenChange(false);
    navigate(`/vm/${vm.serverId}/${vm.node}/${vm.vmid}/monitoring?type=${vm.type}&name=${encodeURIComponent(vm.name || `VM ${vm.vmid}`)}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Monitor className="h-6 w-6 text-primary" />
              <div>
                <DialogTitle className="text-xl">
                  {vm.name || `VM ${vm.vmid}`}
                </DialogTitle>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant={isRunning ? "default" : "secondary"}>
                    {vm.status}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    {vm.type.toUpperCase()} • ID: {vm.vmid}
                  </span>
                  {vm.useTailscale && (
                    <Badge variant="outline" className="text-xs">
                      <Link2 className="h-3 w-3 mr-1" />
                      Tailscale
                    </Badge>
                  )}
                </div>
              </div>
            </div>
            
            {/* Quick Actions */}
            <div className="flex items-center gap-2">
              {isRunning && (
                <Button size="sm" onClick={handleOpenConsole}>
                  <Terminal className="h-4 w-4 mr-2" />
                  Console
                </Button>
              )}
              {vm.serverId && (
                <Button size="sm" variant="outline" onClick={handleOpenMonitoring}>
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Full Monitoring
                </Button>
              )}
            </div>
          </div>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
          <TabsList>
            <TabsTrigger value="overview" className="flex items-center gap-1">
              <Server className="h-4 w-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="resources" className="flex items-center gap-1">
              <Activity className="h-4 w-4" />
              Resources
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-4 space-y-4">
            {/* VM Info Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <Server className="h-4 w-4" />
                    <span className="text-sm">Node</span>
                  </div>
                  <p className="font-medium">{vm.node}</p>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <Clock className="h-4 w-4" />
                    <span className="text-sm">Uptime</span>
                  </div>
                  <p className="font-medium">{formatUptime(vm.uptime)}</p>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <Cpu className="h-4 w-4" />
                    <span className="text-sm">CPU</span>
                  </div>
                  <p className="font-medium">
                    {vm.maxcpu ? `${vm.maxcpu} cores` : "N/A"}
                    {vm.cpu !== undefined && (
                      <span className="text-muted-foreground text-sm ml-1">
                        ({(vm.cpu * 100).toFixed(1)}%)
                      </span>
                    )}
                  </p>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <MemoryStick className="h-4 w-4" />
                    <span className="text-sm">Memory</span>
                  </div>
                  <p className="font-medium">
                    {vm.maxmem ? formatBytes(vm.maxmem) : "N/A"}
                    {vm.mem !== undefined && vm.maxmem && (
                      <span className="text-muted-foreground text-sm ml-1">
                        ({((vm.mem / vm.maxmem) * 100).toFixed(1)}%)
                      </span>
                    )}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Storage Info */}
            {(vm.disk !== undefined || vm.maxdisk !== undefined) && (
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2 text-muted-foreground mb-2">
                    <HardDrive className="h-4 w-4" />
                    <span className="text-sm">Storage</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <p className="font-medium">
                      {vm.disk !== undefined ? formatBytes(vm.disk) : "0"} / {vm.maxdisk !== undefined ? formatBytes(vm.maxdisk) : "N/A"}
                    </p>
                    {vm.disk !== undefined && vm.maxdisk !== undefined && vm.maxdisk > 0 && (
                      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-primary rounded-full"
                          style={{ width: `${Math.min((vm.disk / vm.maxdisk) * 100, 100)}%` }}
                        />
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Server Info */}
            {vm.serverName && (
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <Server className="h-4 w-4" />
                    <span className="text-sm">Proxmox Server</span>
                  </div>
                  <p className="font-medium">{vm.serverName}</p>
                  {vm.useTailscale && vm.tailscaleHostname && (
                    <p className="text-sm text-muted-foreground mt-1">
                      Tailscale: {vm.tailscaleHostname}
                    </p>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Power Actions */}
            {canManage && onAction && (
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Power Actions</p>
                      <p className="text-sm text-muted-foreground">
                        Control the virtual machine power state
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {isStopped && (
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => onAction("start")}
                          disabled={isPerformingAction}
                          className="text-emerald-600 hover:text-emerald-700"
                        >
                          {isPerformingAction ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <Play className="h-4 w-4 mr-2" />
                          )}
                          Start
                        </Button>
                      )}
                      {isRunning && (
                        <>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => onAction("stop")}
                            disabled={isPerformingAction}
                            className="text-destructive hover:text-destructive"
                          >
                            {isPerformingAction ? (
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                              <Square className="h-4 w-4 mr-2" />
                            )}
                            Stop
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => onAction("reset")}
                            disabled={isPerformingAction}
                            className="text-amber-600 hover:text-amber-700"
                          >
                            <RotateCcw className="h-4 w-4 mr-2" />
                            Reset
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="resources" className="mt-4">
            {vm.serverId ? (
              <VMResourceCharts
                serverId={vm.serverId}
                node={vm.node}
                vmid={vm.vmid}
                vmtype={vm.type}
                vmName={vm.name}
              />
            ) : (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Resource charts require a server connection.</p>
                  <p className="text-sm mt-1">Server ID is not available for this VM.</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
