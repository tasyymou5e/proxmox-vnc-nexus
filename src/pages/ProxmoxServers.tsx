import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useProxmoxServers } from "@/hooks/useProxmoxServers";
import { CSVImportDialog, TailscaleFunnelHelp, ConnectionHistoryChart, LiveStatusIndicator } from "@/components/servers";
import { Slider } from "@/components/ui/slider";
import type { ProxmoxServer, ProxmoxServerInput, ConnectionStatus } from "@/lib/types";
import {
  Plus,
  Server,
  Trash2,
  Pencil,
  CheckCircle2,
  XCircle,
  Loader2,
  RefreshCw,
  Search,
  Upload,
  Circle,
  AlertCircle,
  Link2,
  ExternalLink,
  ChevronDown,
  Activity,
} from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { formatDistanceToNow } from "date-fns";

function ConnectionStatusBadge({ status, error }: { status: ConnectionStatus; error?: string | null }) {
  const getStatusConfig = () => {
    switch (status) {
      case "online":
        return { 
          icon: <Circle className="h-2 w-2 fill-current" />,
          label: "Online",
          className: "text-success border-success"
        };
      case "offline":
        return { 
          icon: <Circle className="h-2 w-2 fill-current" />,
          label: "Offline",
          className: "text-destructive border-destructive"
        };
      case "checking":
        return { 
          icon: <Loader2 className="h-2 w-2 animate-spin" />,
          label: "Checking",
          className: "text-primary border-primary"
        };
      default:
        return { 
          icon: <Circle className="h-2 w-2" />,
          label: "Unknown",
          className: "text-muted-foreground border-muted-foreground"
        };
    }
  };

  const config = getStatusConfig();

  if (error && status === "offline") {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="outline" className={`${config.className} cursor-help`}>
              {config.icon}
              <span className="ml-1">{config.label}</span>
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p className="max-w-xs">{error}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <Badge variant="outline" className={config.className}>
      {config.icon}
      <span className="ml-1">{config.label}</span>
    </Badge>
  );
}

interface ProxmoxServersProps {
  tenantId?: string;
  hideLayout?: boolean;
}

export default function ProxmoxServers({ tenantId, hideLayout }: ProxmoxServersProps = {}) {
  const { toast } = useToast();
  const {
    servers,
    loading,
    error,
    healthCheckLoading,
    fetchServers,
    createServer,
    updateServer,
    deleteServer,
    testConnection,
    runHealthChecks,
    bulkImportServers,
  } = useProxmoxServers(tenantId);

  const [searchQuery, setSearchQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [editingServer, setEditingServer] = useState<ProxmoxServer | null>(null);
  const [deleteConfirmServer, setDeleteConfirmServer] = useState<ProxmoxServer | null>(null);
  const [testingServerId, setTestingServerId] = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState(false);

  // Form state
  const [formData, setFormData] = useState<ProxmoxServerInput & { 
    use_tailscale?: boolean;
    tailscale_hostname?: string;
    tailscale_port?: number;
    connection_timeout?: number;
  }>({
    name: "",
    host: "",
    port: 8006,
    api_token: "",
    verify_ssl: true,
    use_tailscale: false,
    tailscale_hostname: "",
    tailscale_port: 8006,
    connection_timeout: 10,
  });

  useEffect(() => {
    fetchServers();
  }, [fetchServers]);

  useEffect(() => {
    if (error) {
      toast({
        title: "Error",
        description: error,
        variant: "destructive",
      });
    }
  }, [error, toast]);

  const filteredServers = servers.filter(
    (server) =>
      server.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      server.host.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const resetForm = () => {
    setFormData({
      name: "",
      host: "",
      port: 8006,
      api_token: "",
      verify_ssl: true,
      use_tailscale: false,
      tailscale_hostname: "",
      tailscale_port: 8006,
      connection_timeout: 10,
    });
    setEditingServer(null);
  };

  const handleOpenDialog = (server?: ProxmoxServer) => {
    if (server) {
      setEditingServer(server);
      setFormData({
        name: server.name,
        host: server.host,
        port: server.port,
        api_token: "",
        verify_ssl: server.verify_ssl,
        use_tailscale: server.use_tailscale || false,
        tailscale_hostname: server.tailscale_hostname || "",
        tailscale_port: server.tailscale_port || 8006,
        connection_timeout: (server.connection_timeout || 10000) / 1000, // Convert ms to seconds for UI
      });
    } else {
      resetForm();
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    resetForm();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);

    try {
      // Validate form
      if (!formData.name.trim()) {
        throw new Error("Server name is required");
      }
      if (!formData.host.trim()) {
        throw new Error("Host is required");
      }
      if (!editingServer && !formData.api_token.trim()) {
        throw new Error("API token is required");
      }

      if (editingServer) {
        const updates: Partial<ProxmoxServerInput> & {
          use_tailscale?: boolean;
          tailscale_hostname?: string;
          tailscale_port?: number;
          connection_timeout?: number;
        } = {
          name: formData.name,
          host: formData.host,
          port: formData.port,
          verify_ssl: formData.verify_ssl,
          use_tailscale: formData.use_tailscale,
          tailscale_hostname: formData.tailscale_hostname,
          tailscale_port: formData.tailscale_port,
          connection_timeout: (formData.connection_timeout || 10) * 1000, // Convert seconds to ms
        };
        if (formData.api_token) {
          updates.api_token = formData.api_token;
        }
        await updateServer(editingServer.id, updates);
        toast({
          title: "Server updated",
          description: `${formData.name} has been updated successfully.`,
        });
      } else {
        await createServer({
          ...formData,
          connection_timeout: (formData.connection_timeout || 10) * 1000, // Convert seconds to ms
        });
        toast({
          title: "Server added",
          description: `${formData.name} has been added successfully.`,
        });
      }
      handleCloseDialog();
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "An error occurred",
        variant: "destructive",
      });
    } finally {
      setFormLoading(false);
    }
  };

  const handleTestConnection = async (server: ProxmoxServer) => {
    setTestingServerId(server.id);
    try {
      const result = await testConnection({ server_id: server.id });
      if (result.success) {
        toast({
          title: "Connection successful",
          description: `Connected to ${server.name}. Found ${result.nodes} node(s).`,
        });
      } else {
        toast({
          title: "Connection failed",
          description: result.error || "Could not connect to the server",
          variant: "destructive",
        });
      }
    } catch (err) {
      toast({
        title: "Connection failed",
        description: err instanceof Error ? err.message : "An error occurred",
        variant: "destructive",
      });
    } finally {
      setTestingServerId(null);
    }
  };

  const handleRefreshAll = async () => {
    toast({
      title: "Health check started",
      description: "Checking all server connections...",
    });
    const results = await runHealthChecks();
    const online = results.filter((r) => r.status === "online").length;
    const offline = results.filter((r) => r.status === "offline").length;
    toast({
      title: "Health check complete",
      description: `${online} online, ${offline} offline`,
    });
  };

  const handleDelete = async () => {
    if (!deleteConfirmServer) return;
    try {
      await deleteServer(deleteConfirmServer.id);
      toast({
        title: "Server deleted",
        description: `${deleteConfirmServer.name} has been removed.`,
      });
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to delete server",
        variant: "destructive",
      });
    } finally {
      setDeleteConfirmServer(null);
    }
  };

  const handleToggleActive = async (server: ProxmoxServer) => {
    try {
      await updateServer(server.id, { is_active: !server.is_active });
      toast({
        title: server.is_active ? "Server disabled" : "Server enabled",
        description: `${server.name} is now ${server.is_active ? "disabled" : "enabled"}.`,
      });
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to update server",
        variant: "destructive",
      });
    }
  };

  const handleImport = async (serversToImport: ProxmoxServerInput[]) => {
    const result = await bulkImportServers(serversToImport);
    if (result.success > 0) {
      toast({
        title: "Import complete",
        description: result.message,
      });
    }
    return result;
  };

  const Layout = hideLayout 
    ? ({ children }: { children: React.ReactNode }) => <>{children}</> 
    : DashboardLayout;

  return (
    <Layout>
      <div className="p-6 max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Proxmox Servers</h1>
            <p className="text-muted-foreground">
              Manage your Proxmox VE server connections
            </p>
            {tenantId && <LiveStatusIndicator tenantId={tenantId} />}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefreshAll}
              disabled={healthCheckLoading || servers.length === 0}
            >
              {healthCheckLoading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Refresh All
            </Button>
            <Button
              variant="outline"
              onClick={() => setImportDialogOpen(true)}
              disabled={!tenantId || servers.length >= 50}
              title={!tenantId ? "Select a tenant first to import servers" : undefined}
            >
              <Upload className="h-4 w-4 mr-2" />
              Import CSV
            </Button>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  onClick={() => handleOpenDialog()}
                  disabled={!tenantId || servers.length >= 50}
                  title={!tenantId ? "Select a tenant first to add servers" : undefined}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Server
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <form onSubmit={handleSubmit}>
                  <DialogHeader>
                    <DialogTitle>
                      {editingServer ? "Edit Server" : "Add Proxmox Server"}
                    </DialogTitle>
                    <DialogDescription>
                      {editingServer
                        ? "Update your server configuration"
                        : "Enter your Proxmox VE server details"}
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Server Name *</Label>
                      <Input
                        id="name"
                        placeholder="Production Cluster"
                        value={formData.name}
                        onChange={(e) =>
                          setFormData({ ...formData, name: e.target.value })
                        }
                        maxLength={100}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="host">Host/IP Address *</Label>
                      <Input
                        id="host"
                        placeholder="pve.example.com or 192.168.1.100"
                        value={formData.host}
                        onChange={(e) =>
                          setFormData({ ...formData, host: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="port">Port *</Label>
                      <Input
                        id="port"
                        type="number"
                        placeholder="8006"
                        value={formData.port}
                        onChange={(e) =>
                          setFormData({ ...formData, port: parseInt(e.target.value) || 8006 })
                        }
                        min={1}
                        max={65535}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="api_token">
                        API Token {editingServer ? "(leave blank to keep current)" : "*"}
                      </Label>
                      <Input
                        id="api_token"
                        type="password"
                        placeholder="user@realm!tokenid=uuid-token-here"
                        value={formData.api_token}
                        onChange={(e) =>
                          setFormData({ ...formData, api_token: e.target.value })
                        }
                      />
                      <p className="text-xs text-muted-foreground">
                        Format: USER@REALM!TOKENID=UUID
                      </p>
                    </div>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="verify_ssl">Verify SSL Certificate</Label>
                      <Switch
                        id="verify_ssl"
                        checked={formData.verify_ssl}
                        onCheckedChange={(checked) =>
                          setFormData({ ...formData, verify_ssl: checked })
                        }
                      />
                    </div>

                    {/* Tailscale Section */}
                    <Separator className="my-2" />
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                        <Link2 className="h-4 w-4" />
                        Tailscale (Optional)
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <Label htmlFor="use_tailscale">Connect via Tailscale</Label>
                        <Switch
                          id="use_tailscale"
                          checked={formData.use_tailscale || false}
                          onCheckedChange={(checked) =>
                            setFormData({ ...formData, use_tailscale: checked })
                          }
                        />
                      </div>

                      {formData.use_tailscale && (
                        <>
                          <div className="space-y-2">
                            <Label htmlFor="tailscale_hostname">Tailscale Hostname/IP</Label>
                            <Input
                              id="tailscale_hostname"
                              placeholder="pve.tailnet-name.ts.net or 100.x.x.x"
                              value={formData.tailscale_hostname || ""}
                              onChange={(e) =>
                                setFormData({ ...formData, tailscale_hostname: e.target.value })
                              }
                            />
                            <p className="text-xs text-muted-foreground">
                              MagicDNS hostname or Tailscale IP address
                            </p>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="tailscale_port">Tailscale Port</Label>
                            <Input
                              id="tailscale_port"
                              type="number"
                              placeholder="8006"
                              value={formData.tailscale_port || 8006}
                              onChange={(e) =>
                                setFormData({ ...formData, tailscale_port: parseInt(e.target.value) || 8006 })
                              }
                              min={1}
                              max={65535}
                            />
                          </div>
                          
                          {/* Tailscale Funnel Help */}
                          <TailscaleFunnelHelp />
                        </>
                      )}

                      {/* Connection Timeout - shown when Tailscale is enabled, or can be set anytime */}
                      <Separator className="my-2" />
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <Label htmlFor="connection_timeout">
                            Connection Timeout: {formData.connection_timeout || 10}s
                          </Label>
                        </div>
                        <Slider
                          id="connection_timeout"
                          value={[formData.connection_timeout || 10]}
                          onValueChange={(value) =>
                            setFormData({ ...formData, connection_timeout: value[0] })
                          }
                          min={5}
                          max={120}
                          step={5}
                          className="w-full"
                        />
                        <p className="text-xs text-muted-foreground">
                          {formData.use_tailscale 
                            ? "Tailscale connections may need 30-60 seconds due to relay latency"
                            : "Direct connections typically work with 10-15 seconds"}
                        </p>
                      </div>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={handleCloseDialog}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={formLoading}>
                      {formLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      {editingServer ? "Save Changes" : "Add Server"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search servers..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Server list */}
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <Skeleton className="h-10 w-10 rounded-lg" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-48" />
                      <Skeleton className="h-3 w-32" />
                    </div>
                    <Skeleton className="h-8 w-20" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredServers.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Server className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No servers configured</h3>
              <p className="text-muted-foreground mb-4">
                {tenantId
                  ? "Add your first Proxmox server to get started"
                  : "Navigate to a tenant to manage servers"}
              </p>
              <div className="flex items-center justify-center gap-2">
                <Button onClick={() => handleOpenDialog()} disabled={!tenantId}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Server
                </Button>
                <Button variant="outline" onClick={() => setImportDialogOpen(true)} disabled={!tenantId}>
                  <Upload className="h-4 w-4 mr-2" />
                  Import CSV
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredServers.map((server) => (
              <Collapsible key={server.id}>
                <Card>
                  <CardContent className="p-6">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                      {/* Server icon and info */}
                      <div className="flex items-start gap-4 flex-1">
                        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                          <Server className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-medium truncate">{server.name}</h3>
                            {server.is_active ? (
                              <Badge variant="outline" className="text-success border-success">
                                Active
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-muted-foreground">
                                Disabled
                              </Badge>
                            )}
                            <ConnectionStatusBadge 
                              status={server.connection_status} 
                              error={server.health_check_error} 
                            />
                            {server.use_tailscale && server.tailscale_hostname?.includes('.ts.net') && (
                              <Badge variant="outline" className="text-xs text-accent-foreground border-accent">
                                <ExternalLink className="h-3 w-3 mr-1" />
                                Funnel
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {server.host}:{server.port}
                          </p>
                          {server.use_tailscale && server.tailscale_hostname && (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <div className="flex items-center gap-1">
                                <Link2 className="h-3 w-3" />
                                <span className="text-primary">
                                  {server.tailscale_hostname}:{server.tailscale_port || 8006}
                                </span>
                              </div>
                              <span className="text-xs">
                                ({(server.connection_timeout || 10000) / 1000}s timeout)
                              </span>
                            </div>
                          )}
                          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                            {server.last_health_check_at ? (
                              <>
                                Checked{" "}
                                {formatDistanceToNow(new Date(server.last_health_check_at), {
                                  addSuffix: true,
                                })}
                              </>
                            ) : server.last_connected_at ? (
                              <>
                                <CheckCircle2 className="h-3 w-3 text-success" />
                                Last connected{" "}
                                {formatDistanceToNow(new Date(server.last_connected_at), {
                                  addSuffix: true,
                                })}
                              </>
                            ) : (
                              <>
                                <XCircle className="h-3 w-3 text-muted-foreground" />
                                Not tested
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 sm:shrink-0">
                        <CollapsibleTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <Activity className="h-4 w-4 mr-1" />
                            <span className="hidden sm:inline">History</span>
                            <ChevronDown className="h-3 w-3 ml-1 transition-transform group-data-[state=open]:rotate-180" />
                          </Button>
                        </CollapsibleTrigger>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleTestConnection(server)}
                          disabled={testingServerId === server.id}
                        >
                          {testingServerId === server.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <RefreshCw className="h-4 w-4" />
                          )}
                          <span className="ml-2 hidden sm:inline">Test</span>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenDialog(server)}
                        >
                          <Pencil className="h-4 w-4" />
                          <span className="ml-2 hidden sm:inline">Edit</span>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setDeleteConfirmServer(server)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                          <span className="ml-2 hidden sm:inline">Delete</span>
                        </Button>
                      </div>
                    </div>
                    
                    {/* Collapsible Connection History Chart */}
                    <CollapsibleContent className="mt-4 pt-4 border-t">
                      <ConnectionHistoryChart serverId={server.id} serverName={server.name} />
                    </CollapsibleContent>
                  </CardContent>
                </Card>
              </Collapsible>
            ))}
          </div>
        )}

        {/* Server count */}
        <p className="text-sm text-muted-foreground text-center">
          {servers.length} of 50 server slots used
        </p>

        {/* Delete confirmation dialog */}
        <AlertDialog
          open={!!deleteConfirmServer}
          onOpenChange={(open) => !open && setDeleteConfirmServer(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Server</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete "{deleteConfirmServer?.name}"? This action
                cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* CSV Import Dialog */}
        <CSVImportDialog
          open={importDialogOpen}
          onOpenChange={setImportDialogOpen}
          onImport={handleImport}
          remainingSlots={50 - servers.length}
        />
      </div>
    </Layout>
  );
}