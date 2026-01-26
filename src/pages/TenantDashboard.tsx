import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Server, HardDrive, Cpu, MemoryStick, Database, Activity, RefreshCw, Loader2, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { TenantLayout } from "@/components/layout/TenantLayout";
import { useTenant, useTenantStats } from "@/hooks/useTenants";
import { useClusterResources, useNodes } from "@/hooks/useProxmoxApi";

function StatCard({ 
  title, 
  value, 
  subValue, 
  icon: Icon, 
  isLoading 
}: { 
  title: string; 
  value: string | number; 
  subValue?: string;
  icon: React.ElementType;
  isLoading?: boolean;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-8 w-24" />
        ) : (
          <>
            <div className="text-2xl font-bold">{value}</div>
            {subValue && (
              <p className="text-xs text-muted-foreground mt-1">{subValue}</p>
            )}
          </>
        )}
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
  isLoading,
}: {
  title: string;
  used: number;
  total: number;
  unit: string;
  icon: React.ElementType;
  isLoading?: boolean;
}) {
  const percentage = total > 0 ? Math.round((used / total) * 100) : 0;
  
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-2 w-full" />
          </div>
        ) : (
          <>
            <div className="text-2xl font-bold">{percentage}%</div>
            <Progress value={percentage} className="mt-2" />
            <p className="text-xs text-muted-foreground mt-2">
              {used.toFixed(1)} / {total.toFixed(1)} {unit}
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default function TenantDashboard() {
  const { tenantId } = useParams<{ tenantId: string }>();
  const navigate = useNavigate();
  
  const { data: tenant, isLoading: isTenantLoading } = useTenant(tenantId);
  const { data: stats, isLoading: isStatsLoading } = useTenantStats(tenantId);
  const { data: resources, isLoading: isResourcesLoading, refetch: refetchResources } = useClusterResources(tenantId);
  const { data: nodes, isLoading: isNodesLoading } = useNodes(tenantId);

  // Parse cluster resources
  const resourceData = resources?.data || [];
  const nodesData = nodes?.data || [];
  
  const vmCount = resourceData.filter((r: { type: string }) => r.type === 'qemu').length;
  const lxcCount = resourceData.filter((r: { type: string }) => r.type === 'lxc').length;
  const runningVMs = resourceData.filter((r: { type: string; status: string }) => 
    (r.type === 'qemu' || r.type === 'lxc') && r.status === 'running'
  ).length;
  const stoppedVMs = vmCount + lxcCount - runningVMs;

  // Calculate aggregate resources from nodes
  const totalCpu = nodesData.reduce((acc: number, n: { maxcpu?: number }) => acc + (n.maxcpu || 0), 0);
  const usedCpu = nodesData.reduce((acc: number, n: { cpu?: number; maxcpu?: number }) => 
    acc + ((n.cpu || 0) * (n.maxcpu || 0)), 0);
  
  const totalMem = nodesData.reduce((acc: number, n: { maxmem?: number }) => acc + (n.maxmem || 0), 0);
  const usedMem = nodesData.reduce((acc: number, n: { mem?: number }) => acc + (n.mem || 0), 0);

  // Storage from resources
  const storageResources = resourceData.filter((r: { type: string }) => r.type === 'storage');
  const totalStorage = storageResources.reduce((acc: number, s: { maxdisk?: number }) => 
    acc + (s.maxdisk || 0), 0) / (1024 ** 3); // Convert to GB
  const usedStorage = storageResources.reduce((acc: number, s: { disk?: number }) => 
    acc + (s.disk || 0), 0) / (1024 ** 3);

  const isLoading = isTenantLoading || isStatsLoading || isResourcesLoading || isNodesLoading;

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
              <h1 className="text-2xl font-bold">
                {isTenantLoading ? <Skeleton className="h-8 w-48" /> : tenant?.name}
              </h1>
              <p className="text-muted-foreground">
                Environment Overview
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetchResources()}
              disabled={isResourcesLoading}
            >
              {isResourcesLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              <span className="ml-2 hidden sm:inline">Refresh</span>
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate(`/tenants/${tenantId}/servers`)}>
              <Settings className="h-4 w-4 mr-2" />
              Servers
            </Button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Nodes"
            value={nodesData.length}
            subValue={`${nodesData.filter((n: { status?: string }) => n.status === 'online').length} online`}
            icon={HardDrive}
            isLoading={isNodesLoading}
          />
          <StatCard
            title="Virtual Machines"
            value={vmCount}
            subValue={`${runningVMs} running, ${stoppedVMs} stopped`}
            icon={Server}
            isLoading={isResourcesLoading}
          />
          <StatCard
            title="Containers"
            value={lxcCount}
            subValue="LXC containers"
            icon={Database}
            isLoading={isResourcesLoading}
          />
          <StatCard
            title="Servers Connected"
            value={stats?.servers || 0}
            subValue={`${stats?.activeServers || 0} online`}
            icon={Activity}
            isLoading={isStatsLoading}
          />
        </div>

        {/* Resource Usage */}
        <div>
          <h2 className="text-lg font-semibold mb-4">Resource Usage</h2>
          <div className="grid gap-4 md:grid-cols-3">
            <ResourceCard
              title="CPU Usage"
              used={usedCpu}
              total={totalCpu}
              unit="cores"
              icon={Cpu}
              isLoading={isNodesLoading}
            />
            <ResourceCard
              title="Memory Usage"
              used={usedMem / (1024 ** 3)}
              total={totalMem / (1024 ** 3)}
              unit="GB"
              icon={MemoryStick}
              isLoading={isNodesLoading}
            />
            <ResourceCard
              title="Storage Usage"
              used={usedStorage}
              total={totalStorage}
              unit="GB"
              icon={Database}
              isLoading={isResourcesLoading}
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
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <HardDrive className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="font-medium">No Nodes Connected</h3>
                <p className="text-muted-foreground text-sm mt-1">
                  Add a Proxmox server to see node information
                </p>
                <Button 
                  className="mt-4"
                  onClick={() => navigate(`/tenants/${tenantId}/servers`)}
                >
                  Add Server
                </Button>
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
      </div>
    </TenantLayout>
  );
}
