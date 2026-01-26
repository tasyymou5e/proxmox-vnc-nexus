import { useParams, Link, useNavigate } from "react-router-dom";
import { TenantLayout } from "@/components/layout/TenantLayout";
import { useTenant } from "@/hooks/useTenants";
import { useLiveTenantStats } from "@/hooks/useLiveTenantStats";
import { useTenantPermissions } from "@/hooks/useTenantPermissions";
import { useTenantVMs } from "@/hooks/useTenantVMs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { VMQuickActions } from "@/components/dashboard/VMQuickActions";
import { ServerComparisonView, ConnectionHealthAlerts } from "@/components/servers";
import { useNodes } from "@/hooks/useProxmoxApi";
import { 
  Server, 
  Monitor, 
  HardDrive, 
  Cpu, 
  MemoryStick, 
  Database,
  Activity,
  Users,
  RefreshCcw,
  Plus,
  PlayCircle,
  StopCircle,
  ArrowLeft,
  Settings,
  MonitorPlay,
  BarChart3
} from "lucide-react";

function StatCard({ 
  title, 
  value, 
  subValue, 
  icon: Icon, 
  loading,
  status
}: { 
  title: string; 
  value: number | string; 
  subValue?: string; 
  icon: typeof Server; 
  loading?: boolean;
  status?: "success" | "warning" | "error";
}) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            {loading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <p className="text-2xl font-bold">{value}</p>
            )}
            {subValue && (
              <p className="text-xs text-muted-foreground">{subValue}</p>
            )}
          </div>
          <div className={`p-2 rounded-lg ${
            status === "success" ? "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400" :
            status === "warning" ? "bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400" :
            status === "error" ? "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400" :
            "bg-muted text-muted-foreground"
          }`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ResourceCard({
  title,
  used,
  total,
  unit,
  icon: Icon,
  loading,
}: {
  title: string;
  used: number;
  total: number;
  unit: string;
  icon: typeof Cpu;
  loading?: boolean;
}) {
  const percentage = total > 0 ? Math.round((used / total) * 100) : 0;
  
  const formatValue = (val: number, u: string) => {
    if (u === "GB") return (val / 1024 / 1024 / 1024).toFixed(1);
    if (u === "TB") return (val / 1024 / 1024 / 1024 / 1024).toFixed(2);
    if (u === "cores") return val.toFixed(1);
    return val.toFixed(1);
  };

  const getProgressColor = (pct: number) => {
    if (pct >= 90) return "bg-destructive";
    if (pct >= 70) return "bg-orange-500";
    return "bg-primary";
  };

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-lg bg-muted">
            <Icon className="h-5 w-5 text-muted-foreground" />
          </div>
          <div>
            <p className="font-medium">{title}</p>
            {loading ? (
              <Skeleton className="h-4 w-24 mt-1" />
            ) : (
              <p className="text-sm text-muted-foreground">
                {formatValue(used, unit)} / {formatValue(total, unit)} {unit}
              </p>
            )}
          </div>
        </div>
        {loading ? (
          <Skeleton className="h-2 w-full" />
        ) : (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Usage</span>
              <span className="font-medium">{percentage}%</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${getProgressColor(percentage)}`}
                style={{ width: `${Math.min(percentage, 100)}%` }}
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function TenantDashboard() {
  const { tenantId } = useParams<{ tenantId: string }>();
  const navigate = useNavigate();
  const { data: tenant, isLoading: isTenantLoading } = useTenant(tenantId);
  const { data: liveStats, isLoading: isStatsLoading, refetch, dataUpdatedAt } = useLiveTenantStats(tenantId);
  const { canManageServers, canManageUsers, canManageVMs } = useTenantPermissions(tenantId);
  const { data: nodes, isLoading: isNodesLoading } = useNodes(tenantId);
  const { vms, isLoading: isVMsLoading, performAction, isPerformingAction } = useTenantVMs(tenantId);

  const nodesData = nodes?.data || [];
  const lastUpdated = dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString() : null;

  // Get first 5 running/stopped VMs (not templates)
  const recentVMs = vms
    .filter(vm => !vm.template && (vm.status === 'running' || vm.status === 'stopped'))
    .slice(0, 5);

  return (
    <TenantLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/tenants')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              {isTenantLoading ? (
                <>
                  <Skeleton className="h-8 w-48 mb-2" />
                  <Skeleton className="h-4 w-32" />
                </>
              ) : (
                <>
                  <h1 className="text-2xl font-bold">{tenant?.name}</h1>
                  <p className="text-muted-foreground">
                    {tenant?.description || "Environment Overview"}
                  </p>
                </>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Live indicator */}
            <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground">
              <Activity className="h-3 w-3 animate-pulse text-green-500" />
              <span>Live</span>
              {lastUpdated && <span>• {lastUpdated}</span>}
            </div>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCcw className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate(`/tenants/${tenantId}/servers`)}>
              <Settings className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Servers</span>
            </Button>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Nodes"
            value={liveStats?.nodes.online ?? 0}
            subValue={liveStats ? `${liveStats.nodes.offline} offline` : undefined}
            icon={Server}
            loading={isStatsLoading}
            status={liveStats?.nodes.offline === 0 && liveStats?.nodes.online > 0 ? "success" : liveStats?.nodes.online === 0 ? "error" : "warning"}
          />
          <StatCard
            title="Virtual Machines"
            value={liveStats?.totalVMs ?? 0}
            subValue={liveStats ? `${liveStats.runningVMs} running` : undefined}
            icon={Monitor}
            loading={isStatsLoading}
          />
          <StatCard
            title="Containers"
            value={liveStats?.totalContainers ?? 0}
            subValue={liveStats ? `${liveStats.runningContainers} running` : undefined}
            icon={HardDrive}
            loading={isStatsLoading}
          />
          <StatCard
            title="Servers"
            value={liveStats?.servers.total ?? 0}
            subValue={liveStats ? `${liveStats.servers.online} online` : undefined}
            icon={Database}
            loading={isStatsLoading}
            status={liveStats?.servers.offline === 0 && liveStats?.servers.online > 0 ? "success" : liveStats?.servers.online === 0 ? "error" : "warning"}
          />
        </div>

        {/* VM Status Summary */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Virtual Machines Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <PlayCircle className="h-4 w-4 text-green-500" />
                  <span className="text-sm font-medium">{liveStats?.runningVMs ?? 0} Running</span>
                </div>
                <div className="flex items-center gap-2">
                  <StopCircle className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{liveStats?.stoppedVMs ?? 0} Stopped</span>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Containers Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <PlayCircle className="h-4 w-4 text-green-500" />
                  <span className="text-sm font-medium">{liveStats?.runningContainers ?? 0} Running</span>
                </div>
                <div className="flex items-center gap-2">
                  <StopCircle className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{liveStats?.stoppedContainers ?? 0} Stopped</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* VM Quick Actions - visible to managers+ */}
        {canManageVMs && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <MonitorPlay className="h-5 w-5" />
                VM Quick Actions
              </h2>
              <Button variant="ghost" size="sm" asChild>
                <Link to={`/tenants/${tenantId}/servers`}>
                  View All VMs
                </Link>
              </Button>
            </div>
            
            {isVMsLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map(i => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : recentVMs.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="flex items-center justify-center py-8 text-muted-foreground">
                  No virtual machines found
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {recentVMs.map(vm => (
                  <VMQuickActions
                    key={`${vm.serverId}-${vm.node}-${vm.vmid}`}
                    vm={vm}
                    onAction={async (action) => {
                      performAction({
                        vmid: vm.vmid,
                        node: vm.node,
                        action,
                        vmType: vm.type,
                        vmName: vm.name,
                        serverId: vm.serverId,
                        serverName: vm.serverName,
                      });
                    }}
                    isPerformingAction={isPerformingAction}
                    canManage={canManageVMs}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Resource Usage */}
        <div>
          <h2 className="text-lg font-semibold mb-4">Resource Usage</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <ResourceCard
              title="CPU"
              used={liveStats?.cpuUsage.used ?? 0}
              total={liveStats?.cpuUsage.total ?? 1}
              unit="cores"
              icon={Cpu}
              loading={isStatsLoading}
            />
            <ResourceCard
              title="Memory"
              used={liveStats?.memoryUsage.used ?? 0}
              total={liveStats?.memoryUsage.total ?? 1}
              unit="GB"
              icon={MemoryStick}
              loading={isStatsLoading}
            />
            <ResourceCard
              title="Storage"
              used={liveStats?.storageUsage.used ?? 0}
              total={liveStats?.storageUsage.total ?? 1}
              unit="TB"
              icon={Database}
              loading={isStatsLoading}
            />
          </div>
        </div>

        {/* Nodes Overview */}
        <div>
          <h2 className="text-lg font-semibold mb-4">Node Status</h2>
          {isNodesLoading ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map(i => (
                <Card key={i}>
                  <CardContent className="p-4">
                    <Skeleton className="h-20 w-full" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : nodesData.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Server className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No servers configured</h3>
                <p className="text-muted-foreground text-center mb-4">
                  Add your first Proxmox server to start monitoring your infrastructure.
                </p>
                {canManageServers && (
                  <Button asChild>
                    <Link to={`/tenants/${tenantId}/servers`}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Server
                    </Link>
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {nodesData.map((node: {
                node: string;
                status?: string;
                cpu?: number;
                mem?: number;
                maxmem?: number;
                uptime?: number;
              }) => (
                <Card
                  key={node.node}
                  className="cursor-pointer hover:border-primary/50 transition-colors"
                  onClick={() => navigate(`/tenants/${tenantId}/nodes/${node.node}`)}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">{node.node}</CardTitle>
                      <Badge variant={node.status === 'online' ? 'default' : 'destructive'}>
                        {node.status || 'unknown'}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">CPU</span>
                        <span>{((node.cpu || 0) * 100).toFixed(1)}%</span>
                      </div>
                      <Progress value={(node.cpu || 0) * 100} className="h-1" />
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Memory</span>
                        <span>
                          {node.maxmem ? (((node.mem || 0) / node.maxmem) * 100).toFixed(1) : 0}%
                        </span>
                      </div>
                      <Progress
                        value={node.maxmem ? ((node.mem || 0) / node.maxmem) * 100 : 0}
                        className="h-1"
                      />
                    </div>
                    {node.uptime && (
                      <p className="text-xs text-muted-foreground">
                        Uptime: {Math.floor(node.uptime / 86400)}d {Math.floor((node.uptime % 86400) / 3600)}h
                      </p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Connection Health Alerts */}
        {tenantId && (
          <ConnectionHealthAlerts tenantId={tenantId} />
        )}

        {/* Server Comparison */}
        {tenantId && (
          <div>
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Server Comparison
            </h2>
            <ServerComparisonView tenantId={tenantId} />
          </div>
        )}

        {/* Quick Actions */}
        <div>
          <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" asChild>
              <Link to={`/tenants/${tenantId}/servers`}>
                <Server className="h-4 w-4 mr-2" />
                Manage Servers
              </Link>
            </Button>
            {canManageUsers && (
              <Button variant="outline" asChild>
                <Link to={`/tenants/${tenantId}/users`}>
                  <Users className="h-4 w-4 mr-2" />
                  Manage Team
                </Link>
              </Button>
            )}
            <Button variant="outline" asChild>
              <Link to={`/tenants/${tenantId}/cluster/status`}>
                <Activity className="h-4 w-4 mr-2" />
                Cluster Status
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </TenantLayout>
  );
}
