import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { useConnectionHistory } from "@/hooks/useConnectionHistory";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell
} from "recharts";
import { 
  Server, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Activity,
  TrendingUp,
  TrendingDown
} from "lucide-react";

interface ServerData {
  id: string;
  name: string;
  connection_status: string | null;
  success_rate: number | null;
  avg_response_time_ms: number | null;
  last_health_check_at: string | null;
}

interface ServerComparisonViewProps {
  servers: ServerData[];
  isLoading?: boolean;
}

export function ServerComparisonView({ servers, isLoading }: ServerComparisonViewProps) {
  const [selectedServers, setSelectedServers] = useState<string[]>([]);
  
  // Auto-select first 4 servers if none selected
  const displayServers = useMemo(() => {
    if (selectedServers.length > 0) {
      return servers.filter(s => selectedServers.includes(s.id));
    }
    return servers.slice(0, 4);
  }, [servers, selectedServers]);

  const toggleServer = (serverId: string) => {
    setSelectedServers(prev => 
      prev.includes(serverId) 
        ? prev.filter(id => id !== serverId)
        : [...prev, serverId]
    );
  };

  // Calculate aggregated metrics
  const aggregatedMetrics = useMemo(() => {
    const activeServers = displayServers.filter(s => s.success_rate !== null);
    if (activeServers.length === 0) return null;
    
    const avgSuccessRate = activeServers.reduce((acc, s) => acc + (s.success_rate || 0), 0) / activeServers.length;
    const avgResponseTime = activeServers.reduce((acc, s) => acc + (s.avg_response_time_ms || 0), 0) / activeServers.length;
    const onlineCount = displayServers.filter(s => s.connection_status === "online").length;
    
    return {
      avgSuccessRate: Math.round(avgSuccessRate * 10) / 10,
      avgResponseTime: Math.round(avgResponseTime),
      onlineCount,
      totalCount: displayServers.length,
    };
  }, [displayServers]);

  // Prepare chart data
  const successRateData = displayServers.map(s => ({
    name: s.name.length > 15 ? s.name.substring(0, 15) + "..." : s.name,
    fullName: s.name,
    successRate: s.success_rate || 0,
    status: s.connection_status,
  }));

  const responseTimeData = displayServers.map(s => ({
    name: s.name.length > 15 ? s.name.substring(0, 15) + "..." : s.name,
    fullName: s.name,
    responseTime: s.avg_response_time_ms || 0,
    status: s.connection_status,
  }));

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-[200px] w-full" />
          <Skeleton className="h-[200px] w-full" />
        </CardContent>
      </Card>
    );
  }

  if (servers.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Server className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No servers configured for comparison</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Server Selection */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Server className="h-5 w-5" />
            Select Servers to Compare
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="max-h-[120px]">
            <div className="flex flex-wrap gap-3">
              {servers.map(server => (
                <label
                  key={server.id}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer hover:bg-muted transition-colors"
                >
                  <Checkbox
                    checked={selectedServers.includes(server.id) || (selectedServers.length === 0 && servers.slice(0, 4).includes(server))}
                    onCheckedChange={() => toggleServer(server.id)}
                  />
                  <span className="text-sm font-medium">{server.name}</span>
                  <Badge 
                    variant="outline" 
                    className={server.connection_status === "online" 
                      ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" 
                      : "bg-red-500/10 text-red-500 border-red-500/20"
                    }
                  >
                    {server.connection_status || "unknown"}
                  </Badge>
                </label>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Aggregated Summary */}
      {aggregatedMetrics && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Servers Online</p>
                  <p className="text-2xl font-bold">
                    {aggregatedMetrics.onlineCount}/{aggregatedMetrics.totalCount}
                  </p>
                </div>
                <div className={`p-3 rounded-full ${
                  aggregatedMetrics.onlineCount === aggregatedMetrics.totalCount 
                    ? "bg-emerald-500/10" 
                    : "bg-amber-500/10"
                }`}>
                  {aggregatedMetrics.onlineCount === aggregatedMetrics.totalCount ? (
                    <CheckCircle2 className="h-6 w-6 text-emerald-500" />
                  ) : (
                    <XCircle className="h-6 w-6 text-amber-500" />
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Avg Success Rate</p>
                  <p className="text-2xl font-bold">{aggregatedMetrics.avgSuccessRate}%</p>
                </div>
                <div className={`p-3 rounded-full ${
                  aggregatedMetrics.avgSuccessRate >= 95 
                    ? "bg-emerald-500/10" 
                    : aggregatedMetrics.avgSuccessRate >= 80 
                    ? "bg-amber-500/10" 
                    : "bg-red-500/10"
                }`}>
                  {aggregatedMetrics.avgSuccessRate >= 95 ? (
                    <TrendingUp className="h-6 w-6 text-emerald-500" />
                  ) : (
                    <TrendingDown className="h-6 w-6 text-amber-500" />
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Avg Response Time</p>
                  <p className="text-2xl font-bold">{aggregatedMetrics.avgResponseTime}ms</p>
                </div>
                <div className="p-3 rounded-full bg-blue-500/10">
                  <Clock className="h-6 w-6 text-blue-500" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Comparing</p>
                  <p className="text-2xl font-bold">{displayServers.length} Servers</p>
                </div>
                <div className="p-3 rounded-full bg-purple-500/10">
                  <Activity className="h-6 w-6 text-purple-500" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Success Rate Chart */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Success Rate Comparison</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={successRateData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis 
                    type="number" 
                    domain={[0, 100]} 
                    tickFormatter={(v) => `${v}%`}
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                  />
                  <YAxis 
                    type="category" 
                    dataKey="name" 
                    width={100}
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                  />
                  <Tooltip
                    contentStyle={{ 
                      backgroundColor: "hsl(var(--popover))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px"
                    }}
                    formatter={(value: number, name: string, props: { payload: { fullName: string } }) => [
                      `${value.toFixed(1)}%`,
                      props.payload.fullName
                    ]}
                  />
                  <Bar dataKey="successRate" radius={[0, 4, 4, 0]}>
                    {successRateData.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`}
                        fill={
                          entry.successRate >= 95 
                            ? "hsl(142, 76%, 50%)" 
                            : entry.successRate >= 80 
                            ? "hsl(38, 92%, 50%)" 
                            : "hsl(0, 84%, 60%)"
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Response Time Chart */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Response Time Comparison</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={responseTimeData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis 
                    type="number" 
                    tickFormatter={(v) => `${v}ms`}
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                  />
                  <YAxis 
                    type="category" 
                    dataKey="name" 
                    width={100}
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                  />
                  <Tooltip
                    contentStyle={{ 
                      backgroundColor: "hsl(var(--popover))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px"
                    }}
                    formatter={(value: number, name: string, props: { payload: { fullName: string } }) => [
                      `${value}ms`,
                      props.payload.fullName
                    ]}
                  />
                  <Bar dataKey="responseTime" radius={[0, 4, 4, 0]}>
                    {responseTimeData.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`}
                        fill={
                          entry.responseTime <= 500 
                            ? "hsl(142, 76%, 50%)" 
                            : entry.responseTime <= 1500 
                            ? "hsl(38, 92%, 50%)" 
                            : "hsl(0, 84%, 60%)"
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Server Comparison Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Detailed Metrics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-2 font-medium text-muted-foreground">Server</th>
                  <th className="text-left py-3 px-2 font-medium text-muted-foreground">Status</th>
                  <th className="text-left py-3 px-2 font-medium text-muted-foreground">Success Rate</th>
                  <th className="text-left py-3 px-2 font-medium text-muted-foreground">Avg Response</th>
                  <th className="text-left py-3 px-2 font-medium text-muted-foreground">Last Check</th>
                </tr>
              </thead>
              <tbody>
                {displayServers.map(server => (
                  <tr key={server.id} className="border-b last:border-0">
                    <td className="py-3 px-2 font-medium">{server.name}</td>
                    <td className="py-3 px-2">
                      <Badge 
                        variant="outline"
                        className={server.connection_status === "online" 
                          ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" 
                          : "bg-red-500/10 text-red-500 border-red-500/20"
                        }
                      >
                        {server.connection_status === "online" ? (
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                        ) : (
                          <XCircle className="h-3 w-3 mr-1" />
                        )}
                        {server.connection_status || "unknown"}
                      </Badge>
                    </td>
                    <td className="py-3 px-2">
                      <div className="flex items-center gap-2">
                        <Progress 
                          value={server.success_rate || 0} 
                          className="w-20 h-2"
                        />
                        <span className="text-sm">{server.success_rate?.toFixed(1) || 0}%</span>
                      </div>
                    </td>
                    <td className="py-3 px-2">
                      <span className={
                        (server.avg_response_time_ms || 0) <= 500 
                          ? "text-emerald-500" 
                          : (server.avg_response_time_ms || 0) <= 1500 
                          ? "text-amber-500" 
                          : "text-red-500"
                      }>
                        {server.avg_response_time_ms || 0}ms
                      </span>
                    </td>
                    <td className="py-3 px-2 text-muted-foreground text-sm">
                      {server.last_health_check_at 
                        ? new Date(server.last_health_check_at).toLocaleString()
                        : "Never"
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
