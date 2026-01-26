import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { VMResourceCharts } from "@/components/dashboard/VMResourceCharts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { 
  ArrowLeft, 
  Monitor, 
  Terminal, 
  Server,
  RefreshCcw,
  Cpu,
  MemoryStick,
  HardDrive
} from "lucide-react";

export default function VMMonitoring() {
  const { serverId, node, vmid } = useParams<{ serverId: string; node: string; vmid: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const vmType = (searchParams.get("type") as "qemu" | "lxc") || "qemu";
  const vmName = searchParams.get("name") || `VM ${vmid}`;

  // Fetch server info
  const { data: server, isLoading: isServerLoading } = useQuery({
    queryKey: ["server", serverId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("proxmox_servers")
        .select("id, name, host, tenant_id")
        .eq("id", serverId!)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!serverId,
  });

  // Fetch current VM status
  const { data: vmStatus, isLoading: isVMLoading, refetch } = useQuery({
    queryKey: ["vm-status", serverId, node, vmid],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const response = await supabase.functions.invoke("list-vms", {
        body: { serverId },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (response.error) throw response.error;
      
      // Find the specific VM
      const vms = response.data?.data || [];
      return vms.find((vm: { vmid: number; node: string }) => 
        vm.vmid === parseInt(vmid!) && vm.node === node
      );
    },
    enabled: !!serverId && !!node && !!vmid,
    refetchInterval: 30000,
  });

  const handleOpenConsole = () => {
    navigate(`/console/${node}/${vmid}?type=${vmType}${serverId ? `&serverId=${serverId}` : ''}`);
  };

  const handleBack = () => {
    if (server?.tenant_id) {
      navigate(`/tenants/${server.tenant_id}`);
    } else {
      navigate(-1);
    }
  };

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

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={handleBack}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-3">
              <Monitor className="h-6 w-6 text-primary" />
              <div>
                <h1 className="text-2xl font-bold">{vmName}</h1>
                <div className="flex items-center gap-2 mt-1">
                  {vmStatus ? (
                    <Badge variant={vmStatus.status === "running" ? "default" : "secondary"}>
                      {vmStatus.status}
                    </Badge>
                  ) : (
                    <Skeleton className="h-5 w-16" />
                  )}
                  <span className="text-muted-foreground">
                    {vmType.toUpperCase()} • ID: {vmid} • Node: {node}
                  </span>
                </div>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCcw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            {vmStatus?.status === "running" && (
              <Button size="sm" onClick={handleOpenConsole}>
                <Terminal className="h-4 w-4 mr-2" />
                Open Console
              </Button>
            )}
          </div>
        </div>

        {/* Server Info */}
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Server className="h-4 w-4" />
              <span className="text-sm">Connected to:</span>
              {isServerLoading ? (
                <Skeleton className="h-4 w-32" />
              ) : (
                <span className="font-medium text-foreground">{server?.name}</span>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Current Stats */}
        {vmStatus && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-500/10">
                    <Cpu className="h-5 w-5 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">CPU Cores</p>
                    <p className="text-xl font-semibold">{vmStatus.maxcpu || "N/A"}</p>
                    {vmStatus.cpu !== undefined && (
                      <p className="text-xs text-muted-foreground">
                        Usage: {(vmStatus.cpu * 100).toFixed(1)}%
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-purple-500/10">
                    <MemoryStick className="h-5 w-5 text-purple-500" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Memory</p>
                    <p className="text-xl font-semibold">
                      {vmStatus.maxmem ? formatBytes(vmStatus.maxmem) : "N/A"}
                    </p>
                    {vmStatus.mem !== undefined && vmStatus.maxmem && (
                      <p className="text-xs text-muted-foreground">
                        Used: {formatBytes(vmStatus.mem)} ({((vmStatus.mem / vmStatus.maxmem) * 100).toFixed(1)}%)
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-amber-500/10">
                    <HardDrive className="h-5 w-5 text-amber-500" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Storage</p>
                    <p className="text-xl font-semibold">
                      {vmStatus.maxdisk ? formatBytes(vmStatus.maxdisk) : "N/A"}
                    </p>
                    {vmStatus.disk !== undefined && vmStatus.maxdisk && (
                      <p className="text-xs text-muted-foreground">
                        Used: {formatBytes(vmStatus.disk)}
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-emerald-500/10">
                    <Monitor className="h-5 w-5 text-emerald-500" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Uptime</p>
                    <p className="text-xl font-semibold">{formatUptime(vmStatus.uptime)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Resource Charts */}
        {serverId && node && vmid && (
          <VMResourceCharts
            serverId={serverId}
            node={node}
            vmid={parseInt(vmid)}
            vmtype={vmType}
            vmName={vmName}
          />
        )}
      </div>
    </DashboardLayout>
  );
}
