import { useState, useMemo } from "react";
import { DashboardLayout } from "@/components/layout";
import { VMCard, VMTable } from "@/components/dashboard";
import { useVMs } from "@/hooks/useVMs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  LayoutGrid,
  List,
  Search,
  RefreshCcw,
  Server,
  AlertCircle,
} from "lucide-react";
import type { VM } from "@/lib/types";

type ViewMode = "grid" | "table";
type StatusFilter = "all" | "running" | "stopped" | "paused";

export default function Dashboard() {
  const { data, isLoading, error, refetch, isRefetching } = useVMs();
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const filteredVMs = useMemo(() => {
    if (!data?.vms) return [];

    return data.vms.filter((vm) => {
      // Search filter
      const matchesSearch =
        searchQuery === "" ||
        vm.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        vm.vmid.toString().includes(searchQuery) ||
        vm.node.toLowerCase().includes(searchQuery.toLowerCase());

      // Status filter
      const matchesStatus =
        statusFilter === "all" || vm.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [data?.vms, searchQuery, statusFilter]);

  const stats = useMemo(() => {
    if (!data?.vms) return { total: 0, running: 0, stopped: 0, paused: 0 };

    return {
      total: data.vms.length,
      running: data.vms.filter((vm) => vm.status === "running").length,
      stopped: data.vms.filter((vm) => vm.status === "stopped").length,
      paused: data.vms.filter(
        (vm) => vm.status === "paused" || vm.status === "suspended"
      ).length,
    };
  }, [data?.vms]);

  return (
    <DashboardLayout>
      <div className="p-6 lg:p-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Virtual Machines</h1>
            <p className="text-muted-foreground">
              Manage and access your virtual machines
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="font-normal">
              <Server className="h-3 w-3 mr-1" />
              {stats.total} VMs
            </Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isRefetching}
            >
              <RefreshCcw
                className={`h-4 w-4 mr-1 ${isRefetching ? "animate-spin" : ""}`}
              />
              Refresh
            </Button>
          </div>
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 rounded-lg border bg-card">
            <p className="text-sm text-muted-foreground">Total VMs</p>
            <p className="text-2xl font-bold">{stats.total}</p>
          </div>
          <div className="p-4 rounded-lg border bg-card">
            <p className="text-sm text-muted-foreground">Running</p>
            <p className="text-2xl font-bold text-success">{stats.running}</p>
          </div>
          <div className="p-4 rounded-lg border bg-card">
            <p className="text-sm text-muted-foreground">Stopped</p>
            <p className="text-2xl font-bold text-destructive">{stats.stopped}</p>
          </div>
          <div className="p-4 rounded-lg border bg-card">
            <p className="text-sm text-muted-foreground">Paused</p>
            <p className="text-2xl font-bold text-warning">{stats.paused}</p>
          </div>
        </div>

        {/* Filters and view toggle */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search VMs by name, ID, or node..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v as StatusFilter)}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="running">Running</SelectItem>
              <SelectItem value="stopped">Stopped</SelectItem>
              <SelectItem value="paused">Paused</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex items-center border rounded-lg p-1">
            <Button
              variant={viewMode === "grid" ? "secondary" : "ghost"}
              size="icon"
              className="h-8 w-8"
              onClick={() => setViewMode("grid")}
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === "table" ? "secondary" : "ghost"}
              size="icon"
              className="h-8 w-8"
              onClick={() => setViewMode("table")}
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="p-6 rounded-lg border bg-card space-y-4">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-10 w-10 rounded-lg" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
                <Skeleton className="h-2 w-full" />
                <Skeleton className="h-2 w-full" />
                <Skeleton className="h-2 w-full" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-12">
            <AlertCircle className="h-12 w-12 text-destructive mb-4" />
            <h2 className="text-lg font-semibold mb-2">Failed to load VMs</h2>
            <p className="text-muted-foreground text-center mb-4">
              {error instanceof Error ? error.message : "An error occurred"}
            </p>
            <Button onClick={() => refetch()}>
              <RefreshCcw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </div>
        ) : filteredVMs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Server className="h-12 w-12 text-muted-foreground mb-4" />
            <h2 className="text-lg font-semibold mb-2">No VMs found</h2>
            <p className="text-muted-foreground text-center">
              {data?.vms?.length === 0
                ? "No virtual machines are assigned to your account."
                : "No VMs match your search criteria."}
            </p>
          </div>
        ) : viewMode === "grid" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredVMs.map((vm) => (
              <VMCard key={`${vm.node}-${vm.vmid}`} vm={vm} />
            ))}
          </div>
        ) : (
          <VMTable vms={filteredVMs} />
        )}
      </div>
    </DashboardLayout>
  );
}
