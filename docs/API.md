# API Reference

## Edge Functions

All Edge Functions require a valid JWT token in the Authorization header unless otherwise noted.

```typescript
const { data, error } = await supabase.functions.invoke("function-name", {
  body: { /* request body */ },
});
```

---

## VM Operations

### list-vms

Fetch VMs from a Proxmox server.

**Request:**
```typescript
{
  serverId?: string;  // Specific server ID (optional)
  tenantId?: string;  // Filter by tenant
}
```

**Response:**
```typescript
{
  vms: Array<{
    vmid: number;
    name: string;
    status: "running" | "stopped" | "paused";
    type: "qemu" | "lxc";
    node: string;
    cpu: number;
    maxcpu: number;
    mem: number;
    maxmem: number;
    disk: number;
    maxdisk: number;
    uptime: number;
    template: boolean;
  }>;
}
```

---

### vm-actions

Perform power actions on VMs.

**Request:**
```typescript
{
  node: string;
  vmid: number;
  action: "start" | "stop" | "reset" | "shutdown" | "suspend" | "resume";
  vmType?: "qemu" | "lxc";  // Default: "qemu"
  serverId?: string;
}
```

**Response:**
```typescript
{
  success: boolean;
  upid?: string;  // Proxmox task ID
  message?: string;
}
```

---

### vm-console

Get VNC connection details for console access.

**Request:**
```typescript
{
  node: string;
  vmid: number;
  vmType?: "qemu" | "lxc";
  serverId?: string;
}
```

**Response:**
```typescript
{
  ticket: string;
  port: number;
  user: string;
  upid: string;
  websocketUrl: string;
  proxmoxHost: string;
  proxmoxPort: string;
  node: string;
  vmid: number;
  vmType: string;
}
```

---

### vnc-relay

WebSocket relay for VNC traffic. Connect via WebSocket upgrade.

**Query Parameters:**
```
?node=<node>&vmid=<vmid>&vmType=<qemu|lxc>&serverId=<uuid>
```

---

## Server Management

### proxmox-servers

CRUD operations for Proxmox server configurations.

#### List Servers
**Request:**
```typescript
{
  action: "list";
  tenantId?: string;
}
```

#### Create Server
**Request:**
```typescript
{
  action: "create";
  tenantId: string;
  name: string;
  host: string;
  port: number;
  apiToken: string;  // Plain text, encrypted server-side
  useTailscale?: boolean;
  tailscaleHostname?: string;
  connectionTimeout?: number;
}
```

#### Update Server
**Request:**
```typescript
{
  action: "update";
  serverId: string;
  name?: string;
  host?: string;
  port?: number;
  apiToken?: string;
  isActive?: boolean;
  useTailscale?: boolean;
  tailscaleHostname?: string;
}
```

#### Delete Server
**Request:**
```typescript
{
  action: "delete";
  serverId: string;
}
```

#### Health Check
**Request:**
```typescript
{
  action: "health-check";
  serverId: string;
}
```

---

### connectivity-test

Test connectivity to a Proxmox server.

**Request:**
```typescript
{
  host: string;
  port: number;
  apiToken: string;
  useTailscale?: boolean;
  tailscaleHostname?: string;
}
```

**Response:**
```typescript
{
  success: boolean;
  responseTime?: number;
  version?: string;
  error?: string;
}
```

---

## Connection Metrics

### connection-metrics

Record and query connection metrics.

#### Record Metric
**Request:**
```typescript
{
  action: "record";
  serverId: string;
  success: boolean;
  responseTimeMs?: number;
  errorMessage?: string;
  usedTailscale?: boolean;
  retryCount?: number;
}
```

#### Get Summary
**Request:**
```typescript
{
  action: "get-summary";
  serverId: string;
}
```

**Response:**
```typescript
{
  summary: {
    totalAttempts: number;
    successCount: number;
    failureCount: number;
    successRate: number;
    avgResponseTime: number;
  };
}
```

#### Get History (24h)
**Request:**
```typescript
{
  action: "get-history";
  serverId: string;
}
```

**Response:**
```typescript
{
  history: {
    hourly: Array<{
      time: string;  // ISO timestamp
      successRate: number;
      avgResponseTime: number | null;
      attempts: number;
    }>;
    summary: {
      totalAttempts: number;
      successCount: number;
      avgResponseTime: number | null;
    };
  };
}
```

---

## Tenant Management

### tenants

Manage tenant organizations.

#### List Tenants
**Request:**
```typescript
{
  action: "list";
}
```

#### Create Tenant
**Request:**
```typescript
{
  action: "create";
  name: string;
  slug: string;
  description?: string;
}
```

#### Update Tenant
**Request:**
```typescript
{
  action: "update";
  tenantId: string;
  name?: string;
  description?: string;
  isActive?: boolean;
}
```

---

### tenant-settings

Manage tenant configuration.

**Request:**
```typescript
{
  action: "get" | "update";
  tenantId: string;
  settings?: {
    primaryColor?: string;
    secondaryColor?: string;
    accentColor?: string;
    logoUrl?: string;
    notificationEmail?: string;
    defaultConnectionTimeout?: number;
    autoHealthCheckInterval?: number;
  };
}
```

---

### tenant-stats

Get dashboard statistics for a tenant.

**Request:**
```typescript
{
  tenantId: string;
}
```

**Response:**
```typescript
{
  stats: {
    totalServers: number;
    onlineServers: number;
    offlineServers: number;
    totalVMs: number;
    runningVMs: number;
    totalUsers: number;
    recentConnections: number;
  };
}
```

---

## Audit & Users

### audit-log

Query audit logs with filtering.

**Request:**
```typescript
{
  tenantId: string;
  limit?: number;
  offset?: number;
  actionType?: string;
  resourceType?: string;
  userId?: string;
  startDate?: string;
  endDate?: string;
}
```

---

### delete-user

Admin-only endpoint to delete users.

**Request:**
```typescript
{
  userId: string;
}
```

---

## Proxmox API Proxy

### proxmox-api

Generic proxy to Proxmox API endpoints.

**Request:**
```typescript
{
  path: string;      // e.g., "/cluster/resources"
  method?: string;   // GET, POST, PUT, DELETE
  body?: object;     // Request body for POST/PUT
  serverId?: string; // Optional server ID
}
```

**Response:**
Direct pass-through of Proxmox API response.

---

## Error Responses

All endpoints return errors in this format:

```typescript
{
  error: string;
  details?: any;
}
```

Common HTTP status codes:
- `400` - Bad Request (missing/invalid parameters)
- `401` - Unauthorized (invalid/missing JWT)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `500` - Internal Server Error
