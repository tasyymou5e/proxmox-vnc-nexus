import { Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Line, ComposedChart } from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useConnectionHistory, type HourlyMetric } from "@/hooks/useConnectionHistory";
import { useConnectionMetricsRealtime } from "@/hooks/useConnectionMetricsRealtime";
import { format } from "date-fns";
import { TrendingUp, TrendingDown, Activity, Clock } from "lucide-react";

interface ConnectionHistoryChartProps {
  serverId: string;
  serverName?: string;
}

// Custom tooltip component
function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; payload: HourlyMetric }>; label?: string }) {
  if (active && payload && payload.length && label) {
    return (
      <div className="bg-popover border rounded-lg shadow-lg p-3 text-sm">
        <p className="font-medium">{format(new Date(label), "MMM d, HH:mm")}</p>
        <p className="text-green-600 dark:text-green-400">Success Rate: {payload[0]?.value}%</p>
        <p className="text-primary">Avg Response: {payload[1]?.value ?? "N/A"}ms</p>
        <p className="text-muted-foreground">Attempts: {payload[0]?.payload?.attempts}</p>
      </div>
    );
  }
  return null;
}

export function ConnectionHistoryChart({ serverId, serverName }: ConnectionHistoryChartProps) {
  const { data, isLoading, error } = useConnectionHistory(serverId);
  
  // Subscribe to real-time updates
  useConnectionMetricsRealtime(serverId);

  // Format time for x-axis
  const formatXAxis = (time: string) => {
    return format(new Date(time), "HH:mm");
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-32 mt-1" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error || !data || data.hourly.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex items-center justify-center py-12 text-muted-foreground">
          No connection history available
        </CardContent>
      </Card>
    );
  }

  const successRate = data.summary.totalAttempts > 0 
    ? Math.round((data.summary.successCount / data.summary.totalAttempts) * 100) 
    : 100;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Connection History
            </CardTitle>
            <CardDescription>Last 24 hours{serverName ? ` • ${serverName}` : ""}</CardDescription>
          </div>
          <div className="flex gap-4">
            <div className="text-right">
              <div className="flex items-center gap-1 justify-end">
                {successRate >= 95 ? (
                  <TrendingUp className="h-4 w-4 text-green-500" />
                ) : successRate >= 80 ? (
                  <Activity className="h-4 w-4 text-orange-500" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-red-500" />
                )}
                <span className="font-bold text-lg">{successRate}%</span>
              </div>
              <span className="text-xs text-muted-foreground">Success Rate</span>
            </div>
            <div className="text-right">
              <div className="flex items-center gap-1 justify-end">
                <Clock className="h-4 w-4 text-primary" />
                <span className="font-bold text-lg">
                  {data.summary.avgResponseTime ?? "N/A"}
                  {data.summary.avgResponseTime && <span className="text-sm font-normal">ms</span>}
                </span>
              </div>
              <span className="text-xs text-muted-foreground">Avg Response</span>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data.hourly}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey="time" 
                tickFormatter={formatXAxis}
                className="text-xs"
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
              />
              <YAxis 
                yAxisId="left"
                domain={[0, 100]}
                className="text-xs"
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
                width={40}
              />
              <YAxis 
                yAxisId="right"
                orientation="right"
                className="text-xs"
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
                width={50}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                yAxisId="left"
                type="monotone"
                dataKey="successRate"
                name="Success Rate"
                stroke="hsl(var(--success))"
                fill="hsl(var(--success))"
                fillOpacity={0.2}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="avgResponseTime"
                name="Avg Response (ms)"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                dot={false}
                connectNulls
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <p className="text-xs text-muted-foreground mt-2 text-center">
          {data.summary.totalAttempts} connection attempts in the last 24 hours
        </p>
      </CardContent>
    </Card>
  );
}
