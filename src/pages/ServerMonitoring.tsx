import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { TenantLayout } from "@/components/layout/TenantLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  ArrowLeft, 
  Server, 
  Activity, 
  Clock, 
  TrendingUp, 
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Wifi,
  WifiOff,
  RefreshCw,
  BarChart3
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ConnectionHistoryChart } from "@/components/servers/ConnectionHistoryChart";
import { ServerComparisonView } from "@/components/servers/ServerComparisonView";
import { ConnectionHealthAlerts } from "@/components/servers/ConnectionHealthAlerts";
import { format, formatDistanceToNow } from "date-fns";
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend
} from "recharts";

interface ServerMetrics {
  id: string;
  name: string;
  host: string;
  port: number;
  connection_status: string | null;
  success_rate: number | null;
  avg_response_time_ms: number | null;
  last_connected_at: string | null;
  last_health_check_at: string | null;
  health_check_error: string | null;
  use_tailscale: boolean | null;
  tailscale_hostname: string | null;
  learned_timeout_ms: number | null;
  connection_timeout: number | null;
}

function ServerMonitoringContent() {
  const { tenantId } = useParams<{ tenantId: string }>();
  const navigate = useNavigate();

  // Fetch all servers for this tenant with their metrics
  const { data: servers, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["server-monitoring", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("proxmox_servers")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      return data as ServerMetrics[];
    },
    enabled: !!tenantId,
    refetchInterval: 30000,
  });

  // Calculate aggregated metrics
  const aggregatedMetrics = servers ? {
    totalServers: servers.length,
    onlineServers: servers.filter(s => s.connection_status === "connected").length,
    offlineServers: servers.filter(s => s.connection_status === "error" || s.connection_status === "disconnected").length,
    averageSuccessRate: servers.reduce((acc, s) => acc + (s.success_rate ?? 100), 0) / (servers.length || 1),
    averageResponseTime: servers.reduce((acc, s) => acc + (s.avg_response_time_ms ?? 0), 0) / (servers.length || 1),
    tailscaleServers: servers.filter(s => s.use_tailscale).length,
  } : null;

  // Status distribution for pie chart
  const statusDistribution = servers ? [
    { name: "Online", value: servers.filter(s => s.connection_status === "connected").length, color: "hsl(var(--success))" },
    { name: "Connecting", value: servers.filter(s => s.connection_status === "connecting").length, color: "hsl(var(--warning))" },
    { name: "Offline", value: servers.filter(s => s.connection_status === "error" || s.connection_status === "disconnected").length, color: "hsl(var(--destructive))" },
    { name: "Unknown", value: servers.filter(s => !s.connection_status || s.connection_status === "unknown").length, color: "hsl(var(--muted-foreground))" },
  ].filter(item => item.value > 0) : [];

  // Response time distribution for bar chart
  const responseTimeData = servers?.map(s => ({
    name: s.name.length > 15 ? s.name.substring(0, 15) + "..." : s.name,
    fullName: s.name,
    responseTime: s.avg_response_time_ms ?? 0,
    successRate: s.success_rate ?? 100,
  })) ?? [];

  const getStatusIcon = (status: string | null) => {
    switch (status) {
      case "connected":
        return <CheckCircle2 className="h-5 w-5 text-success" />;
      case "connecting":
        return <RefreshCw className="h-5 w-5 text-warning animate-spin" />;
      case "error":
      case "disconnected":
        return <XCircle className="h-5 w-5 text-destructive" />;
      default:
        return <AlertTriangle className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case "connected":
        return <Badge className="bg-success/10 text-success border-success/20">Online</Badge>;
      case "connecting":
        return <Badge className="bg-warning/10 text-warning border-warning/20">Connecting</Badge>;
      case "error":
      case "disconnected":
        return <Badge className="bg-destructive/10 text-destructive border-destructive/20">Offline</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  if (isLoading) {
    return (
      <TenantLayout>
        <div className="space-y-6">
          <Skeleton className="h-10 w-64" />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
          <Skeleton className="h-96" />
        </div>
      </TenantLayout>
    );
  }

  return (
    <TenantLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <BarChart3 className="h-6 w-6" />
                Server Monitoring
              </h1>
              <p className="text-muted-foreground">
                Real-time metrics and historical trends for all connected servers
              </p>
            </div>
          </div>
          <Button 
            variant="outline" 
            onClick={() => refetch()} 
            disabled={isRefetching}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isRefetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        {/* Health Alerts */}
        {tenantId && <ConnectionHealthAlerts tenantId={tenantId} />}

        {/* Aggregated Stats */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Server className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{aggregatedMetrics?.totalServers ?? 0}</p>
                  <p className="text-xs text-muted-foreground">Total Servers</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-success/10">
                  <CheckCircle2 className="h-5 w-5 text-success" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{aggregatedMetrics?.onlineServers ?? 0}</p>
                  <p className="text-xs text-muted-foreground">Online</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-destructive/10">
                  <XCircle className="h-5 w-5 text-destructive" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{aggregatedMetrics?.offlineServers ?? 0}</p>
                  <p className="text-xs text-muted-foreground">Offline</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  {(aggregatedMetrics?.averageSuccessRate ?? 100) >= 95 ? (
                    <TrendingUp className="h-5 w-5 text-success" />
                  ) : (
                    <TrendingDown className="h-5 w-5 text-destructive" />
                  )}
                </div>
                <div>
                  <p className="text-2xl font-bold">{Math.round(aggregatedMetrics?.averageSuccessRate ?? 100)}%</p>
                  <p className="text-xs text-muted-foreground">Avg Success Rate</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Clock className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{Math.round(aggregatedMetrics?.averageResponseTime ?? 0)}ms</p>
                  <p className="text-xs text-muted-foreground">Avg Latency</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-accent">
                  <Wifi className="h-5 w-5 text-accent-foreground" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{aggregatedMetrics?.tailscaleServers ?? 0}</p>
                  <p className="text-xs text-muted-foreground">Tailscale</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="comparison">Comparison</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
            <TabsTrigger value="details">Server Details</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Status Distribution Pie Chart */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5" />
                    Server Status Distribution
                  </CardTitle>
                  <CardDescription>Current connection status across all servers</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={statusDistribution}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="value"
                          label={({ name, value }) => `${name}: ${value}`}
                        >
                          {statusDistribution.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Legend />
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* Response Time Bar Chart */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    Response Time by Server
                  </CardTitle>
                  <CardDescription>Average response time in milliseconds</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={responseTimeData} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis 
                          type="number" 
                          tick={{ fill: 'hsl(var(--muted-foreground))' }}
                        />
                        <YAxis 
                          dataKey="name" 
                          type="category" 
                          width={100}
                          tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                        />
                        <Tooltip 
                          content={({ active, payload }) => {
                            if (active && payload?.[0]) {
                              const data = payload[0].payload;
                              return (
                                <div className="bg-popover border rounded-lg shadow-lg p-3 text-sm">
                                  <p className="font-medium">{data.fullName}</p>
                                  <p className="text-primary">Response: {data.responseTime}ms</p>
                                  <p className="text-success">Success: {data.successRate}%</p>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <Bar 
                          dataKey="responseTime" 
                          fill="hsl(var(--primary))" 
                          radius={[0, 4, 4, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Comparison Tab */}
          <TabsContent value="comparison">
            <ServerComparisonView tenantId={tenantId} />
          </TabsContent>

          {/* History Tab */}
          <TabsContent value="history" className="space-y-6">
            {servers?.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="flex items-center justify-center py-12 text-muted-foreground">
                  No servers configured
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {servers?.map((server) => (
                  <ConnectionHistoryChart 
                    key={server.id} 
                    serverId={server.id} 
                    serverName={server.name} 
                  />
                ))}
              </div>
            )}
          </TabsContent>

          {/* Details Tab */}
          <TabsContent value="details" className="space-y-4">
            {servers?.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="flex items-center justify-center py-12 text-muted-foreground">
                  No servers configured
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {servers?.map((server) => (
                  <Card key={server.id}>
                    <CardContent className="pt-6">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-4">
                          {getStatusIcon(server.connection_status)}
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold">{server.name}</h3>
                              {getStatusBadge(server.connection_status)}
                              {server.use_tailscale && (
                                <Badge variant="outline" className="text-accent-foreground border-accent">
                                  <Wifi className="h-3 w-3 mr-1" />
                                  Tailscale
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {server.host}:{server.port}
                              {server.use_tailscale && server.tailscale_hostname && (
                                <span className="ml-2">• {server.tailscale_hostname}</span>
                              )}
                            </p>
                            {server.health_check_error && (
                              <p className="text-sm text-destructive">{server.health_check_error}</p>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-4 gap-6 text-right">
                          <div>
                            <p className="text-lg font-bold">
                              {server.success_rate !== null ? `${Math.round(server.success_rate)}%` : "N/A"}
                            </p>
                            <p className="text-xs text-muted-foreground">Success Rate</p>
                          </div>
                          <div>
                            <p className="text-lg font-bold">
                              {server.avg_response_time_ms !== null ? `${server.avg_response_time_ms}ms` : "N/A"}
                            </p>
                            <p className="text-xs text-muted-foreground">Avg Response</p>
                          </div>
                          <div>
                            <p className="text-lg font-bold">
                              {server.learned_timeout_ms !== null ? `${server.learned_timeout_ms}ms` : `${server.connection_timeout ?? 10000}ms`}
                            </p>
                            <p className="text-xs text-muted-foreground">Timeout</p>
                          </div>
                          <div>
                            <p className="text-sm font-medium">
                              {server.last_connected_at 
                                ? formatDistanceToNow(new Date(server.last_connected_at), { addSuffix: true })
                                : "Never"
                              }
                            </p>
                            <p className="text-xs text-muted-foreground">Last Connected</p>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </TenantLayout>
  );
}

export default function ServerMonitoring() {
  return <ServerMonitoringContent />;
}
