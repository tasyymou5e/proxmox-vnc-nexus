import { useState } from "react";
import { useParams } from "react-router-dom";
import { TenantLayout } from "@/components/layout/TenantLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useAuditLogs, useExportAuditLogs, type AuditLogFilters } from "@/hooks/useAuditLogs";
import { useTenantPermissions } from "@/hooks/useTenantPermissions";
import { format } from "date-fns";
import {
  FileText,
  Download,
  Search,
  ChevronLeft,
  ChevronRight,
  Server,
  Monitor,
  User,
  Settings,
  Loader2,
  Eye,
} from "lucide-react";
import type { AuditLog } from "@/lib/types";

const actionTypeLabels: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  server_added: { label: "Server Added", variant: "default" },
  server_deleted: { label: "Server Deleted", variant: "destructive" },
  server_updated: { label: "Server Updated", variant: "secondary" },
  vm_started: { label: "VM Started", variant: "default" },
  vm_stopped: { label: "VM Stopped", variant: "secondary" },
  vm_restarted: { label: "VM Restarted", variant: "secondary" },
  vm_shutdown: { label: "VM Shutdown", variant: "secondary" },
  vm_reset: { label: "VM Reset", variant: "secondary" },
  user_invited: { label: "User Invited", variant: "default" },
  user_removed: { label: "User Removed", variant: "destructive" },
  role_changed: { label: "Role Changed", variant: "secondary" },
  settings_updated: { label: "Settings Updated", variant: "secondary" },
};

const resourceTypeIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  server: Server,
  vm: Monitor,
  user: User,
  settings: Settings,
};

function AuditLogDetailsDialog({ log }: { log: AuditLog }) {
  const Icon = resourceTypeIcons[log.resource_type] || FileText;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          <Eye className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon className="h-5 w-5" />
            {actionTypeLabels[log.action_type]?.label || log.action_type}
          </DialogTitle>
          <DialogDescription>
            {format(new Date(log.created_at), "PPpp")}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">User</p>
              <p className="font-medium">{log.profiles?.email || log.user_id}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Resource</p>
              <p className="font-medium">{log.resource_name || log.resource_id || "-"}</p>
            </div>
            {log.ip_address && (
              <div>
                <p className="text-muted-foreground">IP Address</p>
                <p className="font-medium font-mono">{log.ip_address}</p>
              </div>
            )}
          </div>
          {Object.keys(log.details || {}).length > 0 && (
            <div>
              <p className="text-muted-foreground text-sm mb-2">Details</p>
              <pre className="text-xs bg-muted p-3 rounded-md overflow-auto max-h-48">
                {JSON.stringify(log.details, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function TenantAuditLog() {
  const { tenantId } = useParams<{ tenantId: string }>();
  const { canViewAuditLogs } = useTenantPermissions(tenantId);
  const exportLogs = useExportAuditLogs(tenantId);

  const [filters, setFilters] = useState<AuditLogFilters>({
    page: 1,
    limit: 50,
  });
  const [searchQuery, setSearchQuery] = useState("");

  const { data, isLoading } = useAuditLogs(tenantId, {
    ...filters,
    search: searchQuery || undefined,
  });

  const handleFilterChange = (key: keyof AuditLogFilters, value: string | number | undefined) => {
    setFilters(prev => ({
      ...prev,
      [key]: value === "all" ? undefined : value,
      page: 1, // Reset to first page on filter change
    }));
  };

  const handlePageChange = (newPage: number) => {
    setFilters(prev => ({ ...prev, page: newPage }));
  };

  if (!canViewAuditLogs) {
    return (
      <TenantLayout>
        <div className="p-6">
          <Card>
            <CardContent className="p-12 text-center">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h2 className="text-lg font-semibold mb-2">Access Denied</h2>
              <p className="text-muted-foreground">
                You need admin access to view audit logs.
              </p>
            </CardContent>
          </Card>
        </div>
      </TenantLayout>
    );
  }

  return (
    <TenantLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Audit Log</h1>
            <p className="text-muted-foreground">
              Track all user actions for compliance and security
            </p>
          </div>
          <Button
            onClick={() => exportLogs.mutate(filters)}
            disabled={exportLogs.isPending}
          >
            {exportLogs.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Download className="h-4 w-4 mr-2" />
            )}
            Export CSV
          </Button>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-4">
              <div className="flex-1 min-w-[200px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by resource name..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <Select
                value={filters.actionType || "all"}
                onValueChange={(value) => handleFilterChange("actionType", value)}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Action Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Actions</SelectItem>
                  <SelectItem value="server_added">Server Added</SelectItem>
                  <SelectItem value="server_deleted">Server Deleted</SelectItem>
                  <SelectItem value="vm_started">VM Started</SelectItem>
                  <SelectItem value="vm_stopped">VM Stopped</SelectItem>
                  <SelectItem value="user_invited">User Invited</SelectItem>
                  <SelectItem value="user_removed">User Removed</SelectItem>
                  <SelectItem value="role_changed">Role Changed</SelectItem>
                  <SelectItem value="settings_updated">Settings Updated</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={filters.resourceType || "all"}
                onValueChange={(value) => handleFilterChange("resourceType", value)}
              >
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Resource" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Resources</SelectItem>
                  <SelectItem value="server">Server</SelectItem>
                  <SelectItem value="vm">VM</SelectItem>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="settings">Settings</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Logs Table */}
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6 space-y-4">
                {Array.from({ length: 10 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : data?.logs && data.logs.length > 0 ? (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Timestamp</TableHead>
                      <TableHead>User</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Resource</TableHead>
                      <TableHead className="text-right">Details</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.logs.map((log) => {
                      const Icon = resourceTypeIcons[log.resource_type] || FileText;
                      const actionInfo = actionTypeLabels[log.action_type] || {
                        label: log.action_type,
                        variant: "secondary" as const,
                      };

                      return (
                        <TableRow key={log.id}>
                          <TableCell className="text-muted-foreground">
                            {format(new Date(log.created_at), "MMM d, HH:mm")}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4 text-muted-foreground" />
                              <span className="truncate max-w-[150px]">
                                {log.profiles?.email?.split("@")[0] || "Unknown"}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={actionInfo.variant}>
                              {actionInfo.label}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Icon className="h-4 w-4 text-muted-foreground" />
                              <span className="truncate max-w-[200px]">
                                {log.resource_name || log.resource_id || "-"}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <AuditLogDetailsDialog log={log} />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>

                {/* Pagination */}
                <div className="flex items-center justify-between p-4 border-t">
                  <p className="text-sm text-muted-foreground">
                    Showing {((data.page - 1) * data.limit) + 1} to{" "}
                    {Math.min(data.page * data.limit, data.total)} of {data.total} entries
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(data.page - 1)}
                      disabled={data.page <= 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Previous
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      Page {data.page} of {data.totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(data.page + 1)}
                      disabled={data.page >= data.totalPages}
                    >
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <div className="p-12 text-center">
                <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No audit logs found</h3>
                <p className="text-muted-foreground">
                  Actions will be recorded here as users interact with the system.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </TenantLayout>
  );
}
