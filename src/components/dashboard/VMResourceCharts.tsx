import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useVMResourceData } from "@/hooks/useVMResourceData";
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Area,
  AreaChart
} from "recharts";
import { Cpu, HardDrive, MemoryStick, Activity, Clock } from "lucide-react";
import { format } from "date-fns";

interface VMResourceChartsProps {
  serverId: string;
  node: string;
  vmid: number;
  vmtype: "qemu" | "lxc";
  vmName?: string;
}

type Timeframe = "hour" | "day" | "week" | "month" | "year";

const TIMEFRAME_OPTIONS: { value: Timeframe; label: string }[] = [
  { value: "hour", label: "Last Hour" },
  { value: "day", label: "Last 24 Hours" },
  { value: "week", label: "Last Week" },
  { value: "month", label: "Last Month" },
  { value: "year", label: "Last Year" },
];

export function VMResourceCharts({ 
  serverId, 
  node, 
  vmid, 
  vmtype,
  vmName 
}: VMResourceChartsProps) {
  const [timeframe, setTimeframe] = useState<Timeframe>("hour");
  
  const { data, isLoading, error } = useVMResourceData({
    serverId,
    node,
    vmid,
    vmtype,
    timeframe,
  });

  const formatTime = (time: string) => {
    const date = new Date(time);
    if (timeframe === "hour") {
      return format(date, "HH:mm");
    } else if (timeframe === "day") {
      return format(date, "HH:mm");
    } else if (timeframe === "week") {
      return format(date, "EEE HH:mm");
    } else {
      return format(date, "MMM dd");
    }
  };

  const formatBytes = (bytes: number | null) => {
    if (bytes === null) return "N/A";
    const units = ["B", "KB", "MB", "GB", "TB"];
    let unitIndex = 0;
    let value = bytes;
    while (value >= 1024 && unitIndex < units.length - 1) {
      value /= 1024;
      unitIndex++;
    }
    return `${value.toFixed(1)} ${units[unitIndex]}`;
  };

  // Calculate current/average stats
  const currentData = data?.data?.[data.data.length - 1];
  const avgCpu = data?.data?.reduce((acc, p) => acc + (p.cpu || 0), 0) / (data?.data?.length || 1);
  const avgMem = data?.data?.reduce((acc, p) => acc + (p.memory || 0), 0) / (data?.data?.length || 1);

  if (error) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Failed to load resource data. The VM may be offline or RRD data unavailable.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">
              Resource Usage {vmName && <span className="text-muted-foreground font-normal">- {vmName}</span>}
            </CardTitle>
          </div>
          <Select value={timeframe} onValueChange={(v) => setTimeframe(v as Timeframe)}>
            <SelectTrigger className="w-[150px]">
              <Clock className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-popover border border-border">
              {TIMEFRAME_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-[200px] w-full" />
            <Skeleton className="h-[200px] w-full" />
          </div>
        ) : (
          <>
            {/* Stats Summary */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <Cpu className="h-8 w-8 text-blue-500" />
                <div>
                  <div className="text-sm text-muted-foreground">CPU</div>
                  <div className="text-xl font-semibold">{currentData?.cpu ?? 0}%</div>
                  <div className="text-xs text-muted-foreground">Avg: {avgCpu.toFixed(1)}%</div>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <MemoryStick className="h-8 w-8 text-purple-500" />
                <div>
                  <div className="text-sm text-muted-foreground">Memory</div>
                  <div className="text-xl font-semibold">{currentData?.memory ?? 0}%</div>
                  <div className="text-xs text-muted-foreground">Avg: {avgMem.toFixed(1)}%</div>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <HardDrive className="h-8 w-8 text-amber-500" />
                <div>
                  <div className="text-sm text-muted-foreground">Disk</div>
                  <div className="text-xl font-semibold">{currentData?.disk ?? 0}%</div>
                  <div className="text-xs text-muted-foreground">
                    {formatBytes(currentData?.diskRead || 0)}/s read
                  </div>
                </div>
              </div>
            </div>

            {/* Charts */}
            <Tabs defaultValue="cpu" className="w-full">
              <TabsList className="mb-4">
                <TabsTrigger value="cpu" className="flex items-center gap-1">
                  <Cpu className="h-4 w-4" />
                  CPU
                </TabsTrigger>
                <TabsTrigger value="memory" className="flex items-center gap-1">
                  <MemoryStick className="h-4 w-4" />
                  Memory
                </TabsTrigger>
                <TabsTrigger value="disk" className="flex items-center gap-1">
                  <HardDrive className="h-4 w-4" />
                  Disk I/O
                </TabsTrigger>
                <TabsTrigger value="network" className="flex items-center gap-1">
                  <Activity className="h-4 w-4" />
                  Network
                </TabsTrigger>
              </TabsList>

              <TabsContent value="cpu">
                <div className="h-[250px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data?.data || []}>
                      <defs>
                        <linearGradient id="cpuGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(217, 91%, 60%)" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="hsl(217, 91%, 60%)" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis 
                        dataKey="time" 
                        tickFormatter={formatTime}
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={12}
                      />
                      <YAxis 
                        domain={[0, 100]} 
                        tickFormatter={(v) => `${v}%`}
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={12}
                      />
                      <Tooltip
                        contentStyle={{ 
                          backgroundColor: "hsl(var(--popover))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px"
                        }}
                        labelFormatter={(label) => format(new Date(label), "PPpp")}
                        formatter={(value: number) => [`${value}%`, "CPU Usage"]}
                      />
                      <Area 
                        type="monotone" 
                        dataKey="cpu" 
                        stroke="hsl(217, 91%, 60%)" 
                        fill="url(#cpuGradient)"
                        strokeWidth={2}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </TabsContent>

              <TabsContent value="memory">
                <div className="h-[250px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data?.data || []}>
                      <defs>
                        <linearGradient id="memGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(280, 100%, 70%)" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="hsl(280, 100%, 70%)" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis 
                        dataKey="time" 
                        tickFormatter={formatTime}
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={12}
                      />
                      <YAxis 
                        domain={[0, 100]} 
                        tickFormatter={(v) => `${v}%`}
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={12}
                      />
                      <Tooltip
                        contentStyle={{ 
                          backgroundColor: "hsl(var(--popover))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px"
                        }}
                        labelFormatter={(label) => format(new Date(label), "PPpp")}
                        formatter={(value: number) => [`${value}%`, "Memory Usage"]}
                      />
                      <Area 
                        type="monotone" 
                        dataKey="memory" 
                        stroke="hsl(280, 100%, 70%)" 
                        fill="url(#memGradient)"
                        strokeWidth={2}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </TabsContent>

              <TabsContent value="disk">
                <div className="h-[250px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data?.data || []}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis 
                        dataKey="time" 
                        tickFormatter={formatTime}
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={12}
                      />
                      <YAxis 
                        tickFormatter={(v) => formatBytes(v)}
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={12}
                      />
                      <Tooltip
                        contentStyle={{ 
                          backgroundColor: "hsl(var(--popover))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px"
                        }}
                        labelFormatter={(label) => format(new Date(label), "PPpp")}
                        formatter={(value: number, name: string) => [
                          formatBytes(value),
                          name === "diskRead" ? "Read" : "Write"
                        ]}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="diskRead" 
                        stroke="hsl(142, 76%, 50%)" 
                        strokeWidth={2}
                        dot={false}
                        name="diskRead"
                      />
                      <Line 
                        type="monotone" 
                        dataKey="diskWrite" 
                        stroke="hsl(0, 84%, 60%)" 
                        strokeWidth={2}
                        dot={false}
                        name="diskWrite"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex justify-center gap-6 mt-2">
                  <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500">
                    ● Read
                  </Badge>
                  <Badge variant="outline" className="bg-red-500/10 text-red-500">
                    ● Write
                  </Badge>
                </div>
              </TabsContent>

              <TabsContent value="network">
                <div className="h-[250px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data?.data || []}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis 
                        dataKey="time" 
                        tickFormatter={formatTime}
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={12}
                      />
                      <YAxis 
                        tickFormatter={(v) => formatBytes(v)}
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={12}
                      />
                      <Tooltip
                        contentStyle={{ 
                          backgroundColor: "hsl(var(--popover))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px"
                        }}
                        labelFormatter={(label) => format(new Date(label), "PPpp")}
                        formatter={(value: number, name: string) => [
                          formatBytes(value),
                          name === "netIn" ? "Inbound" : "Outbound"
                        ]}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="netIn" 
                        stroke="hsl(217, 91%, 60%)" 
                        strokeWidth={2}
                        dot={false}
                        name="netIn"
                      />
                      <Line 
                        type="monotone" 
                        dataKey="netOut" 
                        stroke="hsl(38, 92%, 50%)" 
                        strokeWidth={2}
                        dot={false}
                        name="netOut"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex justify-center gap-6 mt-2">
                  <Badge variant="outline" className="bg-blue-500/10 text-blue-500">
                    ● Inbound
                  </Badge>
                  <Badge variant="outline" className="bg-amber-500/10 text-amber-500">
                    ● Outbound
                  </Badge>
                </div>
              </TabsContent>
            </Tabs>
          </>
        )}
      </CardContent>
    </Card>
  );
}
