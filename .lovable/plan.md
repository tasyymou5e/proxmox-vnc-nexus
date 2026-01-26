
# Connection History Chart, Real-Time Updates, and VM Console Button

## Overview

This plan implements three interconnected features to enhance server monitoring and VM management:

1. **Connection History Chart** - Visualize success rates and response times from `connection_metrics` table over the last 24 hours
2. **Real-Time Connection Status Updates** - Use Supabase Realtime subscriptions for live server health changes
3. **VM Console Connection Button** - Add console access directly from VMQuickActions on the dashboard

---

## Part 1: Connection History Chart

### 1.1 Update connection-metrics Edge Function

**File: `supabase/functions/connection-metrics/index.ts`** (Update)

Add a new action `get-history` to fetch time-series data:

```typescript
case 'get-history': {
  if (!serverId) {
    return new Response(
      JSON.stringify({ error: "Server ID required" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Get metrics from last 24 hours
  const twentyFourHoursAgo = new Date();
  twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

  const { data: metrics, error } = await supabase
    .from("connection_metrics")
    .select("success, response_time_ms, created_at, used_tailscale, error_message")
    .eq("server_id", serverId)
    .gte("created_at", twentyFourHoursAgo.toISOString())
    .order("created_at", { ascending: true });

  if (error) throw error;

  // Group by hour for chart display
  const hourlyData = groupByHour(metrics || []);

  return new Response(
    JSON.stringify({
      history: {
        raw: metrics,
        hourly: hourlyData,
        summary: {
          totalAttempts: metrics?.length || 0,
          successCount: (metrics || []).filter(m => m.success).length,
          avgResponseTime: calculateAvg((metrics || []).filter(m => m.success && m.response_time_ms).map(m => m.response_time_ms!)),
        }
      }
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

function groupByHour(metrics: any[]) {
  const hourlyMap = new Map<string, { success: number; failed: number; avgResponseTime: number; responseTimes: number[] }>();
  
  metrics.forEach(m => {
    const hour = new Date(m.created_at).toISOString().slice(0, 13) + ":00:00Z";
    if (!hourlyMap.has(hour)) {
      hourlyMap.set(hour, { success: 0, failed: 0, avgResponseTime: 0, responseTimes: [] });
    }
    const data = hourlyMap.get(hour)!;
    if (m.success) {
      data.success++;
      if (m.response_time_ms) data.responseTimes.push(m.response_time_ms);
    } else {
      data.failed++;
    }
  });

  // Calculate averages and format for chart
  return Array.from(hourlyMap.entries()).map(([hour, data]) => ({
    time: hour,
    successRate: data.success + data.failed > 0 
      ? Math.round((data.success / (data.success + data.failed)) * 100) 
      : 100,
    avgResponseTime: data.responseTimes.length > 0
      ? Math.round(data.responseTimes.reduce((a, b) => a + b, 0) / data.responseTimes.length)
      : null,
    attempts: data.success + data.failed,
  }));
}
```

### 1.2 Create useConnectionHistory Hook

**File: `src/hooks/useConnectionHistory.ts`** (New)

```typescript
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface HourlyMetric {
  time: string;
  successRate: number;
  avgResponseTime: number | null;
  attempts: number;
}

export interface ConnectionHistory {
  hourly: HourlyMetric[];
  summary: {
    totalAttempts: number;
    successCount: number;
    avgResponseTime: number | null;
  };
}

export function useConnectionHistory(serverId: string | undefined) {
  return useQuery({
    queryKey: ["connection-history", serverId],
    queryFn: async (): Promise<ConnectionHistory> => {
      if (!serverId) throw new Error("Server ID required");

      const { data, error } = await supabase.functions.invoke("connection-metrics", {
        body: { action: "get-history", serverId },
      });

      if (error) throw error;
      return data.history;
    },
    enabled: !!serverId,
    refetchInterval: 60000, // Refresh every minute
  });
}
```

### 1.3 Create ConnectionHistoryChart Component

**File: `src/components/servers/ConnectionHistoryChart.tsx`** (New)

Using the existing `recharts` library already installed in the project:

```typescript
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Area, ComposedChart } from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useConnectionHistory } from "@/hooks/useConnectionHistory";
import { format } from "date-fns";
import { TrendingUp, TrendingDown, Activity, Clock } from "lucide-react";

interface ConnectionHistoryChartProps {
  serverId: string;
  serverName?: string;
}

export function ConnectionHistoryChart({ serverId, serverName }: ConnectionHistoryChartProps) {
  const { data, isLoading, error } = useConnectionHistory(serverId);

  // Format time for x-axis
  const formatXAxis = (time: string) => {
    return format(new Date(time), "HH:mm");
  };

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-popover border rounded-lg shadow-lg p-3 text-sm">
          <p className="font-medium">{format(new Date(label), "MMM d, HH:mm")}</p>
          <p className="text-green-600">Success Rate: {payload[0]?.value}%</p>
          <p className="text-blue-600">Avg Response: {payload[1]?.value ?? "N/A"}ms</p>
          <p className="text-muted-foreground">Attempts: {payload[0]?.payload.attempts}</p>
        </div>
      );
    }
    return null;
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

  if (error || !data) {
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
            <CardDescription>Last 24 hours • {serverName}</CardDescription>
          </div>
          <div className="flex gap-3">
            <div className="text-right">
              <div className="flex items-center gap-1">
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
              <div className="flex items-center gap-1">
                <Clock className="h-4 w-4 text-blue-500" />
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
                label={{ value: 'Success %', angle: -90, position: 'insideLeft' }}
              />
              <YAxis 
                yAxisId="right"
                orientation="right"
                className="text-xs"
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
                label={{ value: 'Response (ms)', angle: 90, position: 'insideRight' }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
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
```

### 1.4 Add Chart to Server Details in ProxmoxServers Page

**File: `src/pages/ProxmoxServers.tsx`** (Update)

Add a collapsible details section for each server showing the connection history chart:

```tsx
// Add import
import { ConnectionHistoryChart } from "@/components/servers/ConnectionHistoryChart";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

// In server card/row, add expandable section:
<Collapsible>
  <CollapsibleTrigger asChild>
    <Button variant="ghost" size="sm">
      <ChevronDown className="h-4 w-4 mr-1" />
      Details
    </Button>
  </CollapsibleTrigger>
  <CollapsibleContent className="mt-4">
    <ConnectionHistoryChart serverId={server.id} serverName={server.name} />
  </CollapsibleContent>
</Collapsible>
```

---

## Part 2: Real-Time Connection Status Updates

### 2.1 Create useServerRealtimeUpdates Hook

**File: `src/hooks/useServerRealtimeUpdates.ts`** (New)

```typescript
import { useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import type { ProxmoxServer, ConnectionStatus } from "@/lib/types";
import { RealtimePostgresChangesPayload } from "@supabase/supabase-js";

type ServerUpdatePayload = RealtimePostgresChangesPayload<{
  [key: string]: any;
}>;

export function useServerRealtimeUpdates(tenantId: string | undefined) {
  const queryClient = useQueryClient();

  const handleServerUpdate = useCallback(
    (payload: ServerUpdatePayload) => {
      if (payload.eventType === "UPDATE" && payload.new) {
        // Update the server in the cache
        queryClient.setQueryData<ProxmoxServer[]>(
          ["proxmox-servers", tenantId],
          (oldData) => {
            if (!oldData) return oldData;
            return oldData.map((server) =>
              server.id === payload.new.id
                ? {
                    ...server,
                    connection_status: payload.new.connection_status as ConnectionStatus,
                    last_health_check_at: payload.new.last_health_check_at,
                    health_check_error: payload.new.health_check_error,
                    last_connected_at: payload.new.last_connected_at,
                    learned_timeout_ms: payload.new.learned_timeout_ms,
                    avg_response_time_ms: payload.new.avg_response_time_ms,
                    success_rate: payload.new.success_rate,
                  }
                : server
            );
          }
        );

        // Also invalidate tenant stats if a server status changed
        if (payload.old?.connection_status !== payload.new.connection_status) {
          queryClient.invalidateQueries({ queryKey: ["tenant-live-stats", tenantId] });
        }
      }
    },
    [queryClient, tenantId]
  );

  useEffect(() => {
    if (!tenantId) return;

    // Subscribe to proxmox_servers changes for this tenant
    const channel = supabase
      .channel(`servers-${tenantId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "proxmox_servers",
          filter: `tenant_id=eq.${tenantId}`,
        },
        handleServerUpdate
      )
      .subscribe((status) => {
        console.log(`Realtime subscription status: ${status}`);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tenantId, handleServerUpdate]);
}
```

### 2.2 Create useConnectionMetricsRealtime Hook

**File: `src/hooks/useConnectionMetricsRealtime.ts`** (New)

For real-time chart updates when new metrics are recorded:

```typescript
import { useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

export function useConnectionMetricsRealtime(serverId: string | undefined) {
  const queryClient = useQueryClient();

  const handleNewMetric = useCallback(() => {
    // Invalidate the connection history query to refetch
    queryClient.invalidateQueries({ queryKey: ["connection-history", serverId] });
  }, [queryClient, serverId]);

  useEffect(() => {
    if (!serverId) return;

    const channel = supabase
      .channel(`metrics-${serverId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "connection_metrics",
          filter: `server_id=eq.${serverId}`,
        },
        handleNewMetric
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [serverId, handleNewMetric]);
}
```

### 2.3 Integrate Realtime into useProxmoxServers Hook

**File: `src/hooks/useProxmoxServers.ts`** (Update)

Add Realtime subscription alongside existing polling:

```typescript
// Add import
import { useServerRealtimeUpdates } from "./useServerRealtimeUpdates";

export function useProxmoxServers(tenantId?: string) {
  // ... existing state ...

  // Subscribe to real-time updates for immediate status changes
  useServerRealtimeUpdates(tenantId);

  // ... rest of existing code ...
}
```

### 2.4 Add Visual Indicator for Live Updates

**File: `src/components/servers/LiveStatusIndicator.tsx`** (New)

```typescript
import { Activity, Wifi, WifiOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface LiveStatusIndicatorProps {
  tenantId?: string;
}

export function LiveStatusIndicator({ tenantId }: LiveStatusIndicatorProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  useEffect(() => {
    if (!tenantId) return;

    const channel = supabase.channel(`presence-${tenantId}`);
    
    channel
      .subscribe((status) => {
        setIsConnected(status === "SUBSCRIBED");
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tenantId]);

  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      {isConnected ? (
        <>
          <Activity className="h-3 w-3 animate-pulse text-green-500" />
          <span>Live updates active</span>
        </>
      ) : (
        <>
          <WifiOff className="h-3 w-3 text-muted-foreground" />
          <span>Connecting...</span>
        </>
      )}
    </div>
  );
}
```

---

## Part 3: VM Console Connection Button

### 3.1 Update VMQuickActions Component

**File: `src/components/dashboard/VMQuickActions.tsx`** (Update)

Add console button for running VMs:

```tsx
// Add imports
import { useNavigate } from "react-router-dom";
import { Terminal } from "lucide-react";

// Inside component, add navigate hook
const navigate = useNavigate();

// Add console handler
const handleOpenConsole = () => {
  navigate(`/console/${vm.node}/${vm.vmid}?type=${vm.type}${vm.serverId ? `&serverId=${vm.serverId}` : ''}`);
};

// In the actions section for running VMs, add console button:
{isRunning && (
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
    {/* Existing stop and reset buttons */}
    <TooltipProvider>
      <Tooltip>
        {/* ... stop button ... */}
      </Tooltip>
    </TooltipProvider>
    <TooltipProvider>
      <Tooltip>
        {/* ... reset button ... */}
      </Tooltip>
    </TooltipProvider>
  </>
)}
```

### 3.2 Update Console Page to Accept serverId

**File: `src/pages/Console.tsx`** (Update)

Handle serverId from URL params:

```tsx
export default function Console() {
  const { node, vmid } = useParams<{ node: string; vmid: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const vmType = (searchParams.get("type") as "qemu" | "lxc") || "qemu";
  const serverId = searchParams.get("serverId"); // Add this

  const vmConsole = useVMConsole();
  const [connection, setConnection] = useState<VNCConnection | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchConsole = async () => {
    if (!node || !vmid) return;

    setError(null);
    try {
      const data = await vmConsole.mutateAsync({
        node,
        vmid: parseInt(vmid),
        vmType,
        serverId: serverId || undefined, // Pass serverId to the mutation
      });
      setConnection(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to connect");
    }
  };

  // ... rest of component
}
```

### 3.3 Update useVMConsole Hook

**File: `src/hooks/useVMs.ts`** (Update)

Ensure serverId is passed to the edge function:

```typescript
export function useVMConsole() {
  return useMutation({
    mutationFn: async ({
      node,
      vmid,
      vmType = "qemu",
      serverId,
    }: {
      node: string;
      vmid: number;
      vmType?: "qemu" | "lxc";
      serverId?: string;
    }): Promise<VNCConnection> => {
      const { data, error } = await supabase.functions.invoke("vm-console", {
        body: { node, vmid, vmType, serverId },
      });

      if (error) throw error;
      if (!data) throw new Error("No connection data received");
      
      return data;
    },
  });
}
```

---

## Part 4: Type Updates

**File: `src/lib/types.ts`** (Update)

Add types for connection history:

```typescript
// Connection History Types
export interface HourlyConnectionMetric {
  time: string;
  successRate: number;
  avgResponseTime: number | null;
  attempts: number;
}

export interface ConnectionHistorySummary {
  totalAttempts: number;
  successCount: number;
  avgResponseTime: number | null;
}

export interface ConnectionHistory {
  hourly: HourlyConnectionMetric[];
  summary: ConnectionHistorySummary;
}
```

---

## Part 5: Update Exports

**File: `src/components/servers/index.ts`** (Update)

```typescript
export { ConnectionHistoryChart } from "./ConnectionHistoryChart";
export { LiveStatusIndicator } from "./LiveStatusIndicator";
```

---

## Implementation Order

| Step | Task | Files |
|------|------|-------|
| 1 | Update connection-metrics edge function with get-history action | `supabase/functions/connection-metrics/index.ts` |
| 2 | Update types | `src/lib/types.ts` |
| 3 | Create useConnectionHistory hook | `src/hooks/useConnectionHistory.ts` |
| 4 | Create ConnectionHistoryChart component | `src/components/servers/ConnectionHistoryChart.tsx` |
| 5 | Create useServerRealtimeUpdates hook | `src/hooks/useServerRealtimeUpdates.ts` |
| 6 | Create useConnectionMetricsRealtime hook | `src/hooks/useConnectionMetricsRealtime.ts` |
| 7 | Create LiveStatusIndicator component | `src/components/servers/LiveStatusIndicator.tsx` |
| 8 | Integrate realtime into useProxmoxServers | `src/hooks/useProxmoxServers.ts` |
| 9 | Update VMQuickActions with console button | `src/components/dashboard/VMQuickActions.tsx` |
| 10 | Update Console page for serverId | `src/pages/Console.tsx` |
| 11 | Update useVMConsole hook | `src/hooks/useVMs.ts` |
| 12 | Add chart to ProxmoxServers page | `src/pages/ProxmoxServers.tsx` |
| 13 | Update servers exports | `src/components/servers/index.ts` |
| 14 | Deploy edge function | Deployment |

---

## Supabase Realtime Configuration

Realtime is enabled by default on Supabase, but ensure the `proxmox_servers` and `connection_metrics` tables are included in the Realtime publication:

```sql
-- Enable Realtime for these tables (if not already enabled)
ALTER PUBLICATION supabase_realtime ADD TABLE proxmox_servers;
ALTER PUBLICATION supabase_realtime ADD TABLE connection_metrics;
```

---

## Summary of Changes

| Component | Changes |
|-----------|---------|
| **connection-metrics** | Add `get-history` action for 24-hour time-series data |
| **ConnectionHistoryChart** | New component using recharts for dual-axis chart |
| **useConnectionHistory** | New hook for fetching connection history |
| **useServerRealtimeUpdates** | New hook for Supabase Realtime on server status |
| **useConnectionMetricsRealtime** | New hook for Realtime on new metrics |
| **LiveStatusIndicator** | New component showing live connection status |
| **useProxmoxServers** | Integrate Realtime for instant status updates |
| **VMQuickActions** | Add Terminal button for console access on running VMs |
| **Console** | Accept serverId from URL for multi-server support |
| **useVMConsole** | Pass serverId to edge function |
| **ProxmoxServers** | Add collapsible details with connection history chart |
| **Types** | Add ConnectionHistory interfaces |

---

## Security Considerations

1. **RLS for Realtime**: Existing RLS policies on `proxmox_servers` and `connection_metrics` ensure users only receive updates for servers they have access to
2. **Console Access**: Existing permission checks in `vm-console` edge function validate user access before allowing connections
3. **Rate Limiting**: Realtime subscriptions are filtered by tenant_id to reduce unnecessary updates

---

## Visual Representation

**Connection History Chart:**
```text
+--------------------------------------------------+
|  Connection History           24h   ▼  97%  245ms|
+--------------------------------------------------+
| 100% |    ████████████████████████████           |
|  80% |                                           |
|  60% |                                           |
|  40% |                                           |
|  20% |                                           |
|   0% +-------------------------------------------+
|      00:00  04:00  08:00  12:00  16:00  20:00    |
|      ─── Success Rate   ─── Avg Response (ms)    |
+--------------------------------------------------+
```

**VM Quick Actions with Console:**
```text
+--------------------------------------------------+
| Web Server (101)  [Running]  [📟] [■] [↺]        |
| Database (102)    [Running]  [📟] [■] [↺]        |
| Dev Server (103)  [Stopped]       [▶ Start]      |
+--------------------------------------------------+
          Console^   Stop^ Reset^
```
