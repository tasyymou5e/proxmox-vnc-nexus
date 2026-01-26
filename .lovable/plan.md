
# Comprehensive Tenant Settings, Audit Logging, VM Power Actions, and Advanced Connectivity Features

## Overview

This plan implements six interconnected features:

1. **Tenant Settings Page** - Manage branding (logo, colors), notification preferences, and default configurations
2. **Tenant-Level Audit Logging** - Track user actions for compliance (server additions, role changes, VM operations)
3. **VM Power Actions on Tenant Dashboard** - Role-based VM control (start/stop/restart) for managers
4. **Automatic Timeout Adjustment** - Learn optimal timeout values from historical connection success rates
5. **Server Connectivity Test** - Detailed latency and connection path debugging for Tailscale routes
6. **Connection Retry Logic** - Exponential backoff for intermittent Tailscale connectivity issues

---

## Part 1: Database Schema Updates

### 1.1 Tenant Settings Table

New table to store extended tenant configuration:

```sql
CREATE TABLE public.tenant_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE UNIQUE,
  
  -- Branding
  primary_color text DEFAULT '#3b82f6',
  secondary_color text DEFAULT '#1e40af',
  accent_color text DEFAULT '#f59e0b',
  
  -- Notifications
  notification_email text,
  notify_on_server_offline boolean DEFAULT true,
  notify_on_vm_action boolean DEFAULT false,
  notify_on_user_changes boolean DEFAULT true,
  
  -- Default Configurations
  default_connection_timeout integer DEFAULT 10000,
  default_verify_ssl boolean DEFAULT true,
  auto_health_check_interval integer DEFAULT 300000, -- 5 minutes
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.tenant_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their tenant settings"
  ON public.tenant_settings FOR SELECT
  USING (
    has_role(auth.uid(), 'admin') OR 
    user_has_tenant_access(auth.uid(), tenant_id)
  );

CREATE POLICY "Tenant admins can update settings"
  ON public.tenant_settings FOR UPDATE
  USING (
    has_role(auth.uid(), 'admin') OR 
    has_tenant_role(auth.uid(), tenant_id, ARRAY['admin']::tenant_role[])
  );
```

### 1.2 Audit Log Table

New table for compliance tracking:

```sql
CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  
  -- Action details
  action_type text NOT NULL, -- 'server_added', 'server_deleted', 'role_changed', 'vm_started', 'vm_stopped', 'user_invited', 'user_removed', 'settings_updated'
  resource_type text NOT NULL, -- 'server', 'vm', 'user', 'settings'
  resource_id text,
  resource_name text,
  
  -- Additional context
  details jsonb DEFAULT '{}',
  ip_address text,
  user_agent text,
  
  created_at timestamptz DEFAULT now()
);

-- Index for efficient queries
CREATE INDEX idx_audit_logs_tenant_created ON public.audit_logs(tenant_id, created_at DESC);
CREATE INDEX idx_audit_logs_action_type ON public.audit_logs(tenant_id, action_type, created_at DESC);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Only admins and tenant admins can view audit logs
CREATE POLICY "Tenant admins can view audit logs"
  ON public.audit_logs FOR SELECT
  USING (
    has_role(auth.uid(), 'admin') OR 
    has_tenant_role(auth.uid(), tenant_id, ARRAY['admin']::tenant_role[])
  );
```

### 1.3 Connection Metrics Table

For learning optimal timeout values:

```sql
CREATE TABLE public.connection_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id uuid NOT NULL REFERENCES public.proxmox_servers(id) ON DELETE CASCADE,
  
  -- Connection attempt details
  success boolean NOT NULL,
  response_time_ms integer, -- Only for successful connections
  error_message text,
  
  -- Connection context
  used_tailscale boolean DEFAULT false,
  timeout_used_ms integer,
  retry_count integer DEFAULT 0,
  
  created_at timestamptz DEFAULT now()
);

-- Keep only last 30 days of metrics
CREATE INDEX idx_connection_metrics_server_created ON public.connection_metrics(server_id, created_at DESC);

-- Add columns to proxmox_servers for learned timeout
ALTER TABLE public.proxmox_servers 
ADD COLUMN IF NOT EXISTS learned_timeout_ms integer,
ADD COLUMN IF NOT EXISTS avg_response_time_ms integer,
ADD COLUMN IF NOT EXISTS success_rate numeric(5,2);
```

---

## Part 2: Edge Function Updates

### 2.1 New Audit Logging Edge Function

**File: `supabase/functions/audit-log/index.ts`** (New)

```typescript
interface AuditLogRequest {
  tenantId: string;
  actionType: string;
  resourceType: string;
  resourceId?: string;
  resourceName?: string;
  details?: Record<string, unknown>;
}

// Actions:
// - 'log': Create a new audit log entry
// - 'list': Get audit logs with pagination and filters
// - 'export': Export audit logs as CSV

// Example entry:
{
  action_type: 'vm_started',
  resource_type: 'vm',
  resource_id: '101',
  resource_name: 'Web Server',
  details: { node: 'pve1', vmType: 'qemu', initiatedBy: 'user@email.com' }
}
```

### 2.2 Enhanced VM Actions with Audit Logging

**File: `supabase/functions/vm-actions/index.ts`** (Update)

Add tenant context and audit logging:

```typescript
// After successful VM action:
if (tenantId) {
  await supabase.from("audit_logs").insert({
    tenant_id: tenantId,
    user_id: userId,
    action_type: `vm_${action}`,
    resource_type: 'vm',
    resource_id: String(vmid),
    resource_name: vmName || `VM ${vmid}`,
    details: { node, vmType, serverId, serverName },
    ip_address: req.headers.get('x-forwarded-for'),
    user_agent: req.headers.get('user-agent'),
  });
}
```

### 2.3 Tenant Settings Edge Function

**File: `supabase/functions/tenant-settings/index.ts`** (New)

Actions:
- `get`: Retrieve tenant settings (creates default if not exists)
- `update`: Update tenant settings with audit logging

### 2.4 Enhanced Connectivity Test Edge Function

**File: `supabase/functions/connectivity-test/index.ts`** (New)

Returns detailed connection diagnostics:

```typescript
interface ConnectivityTestResult {
  success: boolean;
  
  // Timing breakdown
  dnsResolutionMs: number;
  tcpConnectionMs: number;
  tlsHandshakeMs: number;
  apiResponseMs: number;
  totalLatencyMs: number;
  
  // Connection path
  resolvedIp: string;
  connectionType: 'direct' | 'tailscale' | 'funnel';
  
  // Tailscale-specific info (if applicable)
  tailscaleInfo?: {
    derp: string;       // DERP relay server used
    path: string;       // 'direct' or 'relayed'
    latencyMeasurements: number[];
  };
  
  // Server info
  proxmoxVersion?: string;
  nodeCount?: number;
  
  // Errors
  error?: string;
  errorStage?: 'dns' | 'tcp' | 'tls' | 'api';
}
```

### 2.5 Connection Metrics Learning Edge Function

**File: `supabase/functions/connection-metrics/index.ts`** (New)

Actions:
- `record`: Record a connection attempt (success/failure)
- `calculate-optimal`: Calculate optimal timeout based on historical data
- `cleanup`: Remove metrics older than 30 days

Algorithm for optimal timeout:
```typescript
// Calculate optimal timeout: p95 response time + 50% buffer, min 5s, max 120s
const p95ResponseTime = calculatePercentile(responseTimes, 95);
const optimalTimeout = Math.max(5000, Math.min(120000, p95ResponseTime * 1.5));
```

### 2.6 Enhanced proxmox-servers with Retry Logic

**File: `supabase/functions/proxmox-servers/index.ts`** (Update)

Add exponential backoff retry:

```typescript
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries: number = 3,
  baseDelayMs: number = 1000
): Promise<Response> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);
      
      // Record success metric
      await recordConnectionMetric(serverId, true, responseTime);
      
      return response;
    } catch (error) {
      lastError = error;
      
      // Record failure metric
      await recordConnectionMetric(serverId, false, null, error.message);
      
      if (attempt < maxRetries) {
        // Exponential backoff: 1s, 2s, 4s...
        const delay = baseDelayMs * Math.pow(2, attempt);
        const jitter = delay * 0.2 * Math.random();
        await new Promise(r => setTimeout(r, delay + jitter));
      }
    }
  }
  
  throw lastError;
}
```

---

## Part 3: Frontend Components

### 3.1 Tenant Settings Page

**File: `src/pages/TenantSettings.tsx`** (New)

```text
+------------------------------------------------------------------+
| Settings - ACME Corp                               [Save Changes] |
+------------------------------------------------------------------+
|                                                                   |
|  ===== Branding =====                                            |
|  Logo: [Upload Logo] or [Current: logo.png]                      |
|  Primary Color:   [#3b82f6] [Color Picker]                       |
|  Secondary Color: [#1e40af] [Color Picker]                       |
|  Accent Color:    [#f59e0b] [Color Picker]                       |
|                                                                   |
|  ===== Notifications =====                                       |
|  Notification Email: [admin@company.com]                         |
|  [x] Server goes offline                                         |
|  [ ] VM power actions                                            |
|  [x] User role changes                                           |
|                                                                   |
|  ===== Default Configurations =====                              |
|  Default Connection Timeout: [30] seconds                        |
|  Default SSL Verification: [x] Enabled                           |
|  Health Check Interval: [5] minutes                              |
|                                                                   |
+------------------------------------------------------------------+
```

Features:
- Color picker components for branding
- Logo upload with storage integration
- Notification preferences toggle
- Default timeout/SSL settings
- Auto-save with toast notifications

### 3.2 Audit Log Viewer

**File: `src/pages/TenantAuditLog.tsx`** (New)

```text
+------------------------------------------------------------------+
| Audit Log - ACME Corp                         [Export CSV]       |
+------------------------------------------------------------------+
| Filters: [Action Type ▼] [Resource ▼] [Date Range]  [Search...] |
+------------------------------------------------------------------+
| Time          | User         | Action       | Resource    | Details|
|---------------|--------------|--------------|-------------|--------|
| 10:32 AM      | john@...     | VM Started   | Web Server  | [View] |
| 10:15 AM      | jane@...     | Role Changed | bob@...     | [View] |
| 09:45 AM      | john@...     | Server Added | Production  | [View] |
| 09:30 AM      | admin@...    | Settings     | Branding    | [View] |
+------------------------------------------------------------------+
| [< Previous]                Page 1 of 12            [Next >]     |
+------------------------------------------------------------------+
```

Features:
- Filterable by action type, resource, date range
- Search by user or resource name
- Expandable details view
- CSV export functionality
- Pagination (50 items per page)

### 3.3 Enhanced Tenant Dashboard with VM Actions

**File: `src/pages/TenantDashboard.tsx`** (Update)

Add a new VM Quick Actions section:

```text
| Recent VMs                                      |
| +---------------------------------------------+ |
| | Web Server (101)  [Running]  [■Stop] [↺]   | |
| | Database (102)    [Running]  [■Stop] [↺]   | |
| | Dev Server (103)  [Stopped]  [▶Start]      | |
| +---------------------------------------------+ |
| [View All VMs →]                                |
```

Components to add:
- `VMQuickActions` - Inline VM power controls
- Permission-based button visibility (managers+)
- Optimistic updates with status indicators
- Confirmation dialog for stop/restart

### 3.4 Server Connectivity Test Dialog

**File: `src/components/servers/ConnectivityTestDialog.tsx`** (New)

```text
+--------------------------------------------------+
|  Connection Test - Production Server             |
+--------------------------------------------------+
|  Status: ✓ Connected                             |
|                                                  |
|  Timing Breakdown:                               |
|  ├─ DNS Resolution:     12ms                     |
|  ├─ TCP Connection:     45ms                     |
|  ├─ TLS Handshake:      89ms                     |
|  └─ API Response:       156ms                    |
|  ─────────────────────────────                   |
|  Total Latency:         302ms                    |
|                                                  |
|  Connection Path:                                |
|  └─ Type: Tailscale (relayed via fra-1)         |
|     IP: 100.64.x.x                              |
|     DERP: Frankfurt (30ms)                      |
|                                                  |
|  Recommended Timeout: 35 seconds                 |
|  [Apply Recommendation] [Run Again] [Close]     |
+--------------------------------------------------+
```

Features:
- Step-by-step timing breakdown
- Tailscale path detection
- Recommended timeout based on measurements
- "Apply Recommendation" button to update server config

### 3.5 Connection Retry Status Indicator

**File: `src/components/servers/ConnectionStatus.tsx`** (Update)

Add retry indicator:

```tsx
{isRetrying && (
  <div className="flex items-center gap-2 text-amber-500">
    <RefreshCw className="h-4 w-4 animate-spin" />
    <span className="text-xs">Retry {currentRetry}/3...</span>
  </div>
)}
```

---

## Part 4: New Hooks

### 4.1 useTenantSettings Hook

**File: `src/hooks/useTenantSettings.ts`** (New)

```typescript
export function useTenantSettings(tenantId: string | undefined) {
  const query = useQuery({
    queryKey: ["tenant-settings", tenantId],
    queryFn: async () => fetchTenantSettings(tenantId),
    enabled: !!tenantId,
  });

  const mutation = useMutation({
    mutationFn: updateTenantSettings,
    onSuccess: () => {
      queryClient.invalidateQueries(["tenant-settings", tenantId]);
      toast({ title: "Settings saved" });
    },
  });

  return { settings: query.data, isLoading: query.isLoading, updateSettings: mutation };
}
```

### 4.2 useAuditLogs Hook

**File: `src/hooks/useAuditLogs.ts`** (New)

```typescript
export function useAuditLogs(tenantId: string | undefined, filters: AuditLogFilters) {
  return useQuery({
    queryKey: ["audit-logs", tenantId, filters],
    queryFn: () => fetchAuditLogs(tenantId, filters),
    enabled: !!tenantId,
    keepPreviousData: true, // For pagination
  });
}
```

### 4.3 useTenantVMs Hook

**File: `src/hooks/useTenantVMs.ts`** (New)

For tenant-scoped VM listing and actions:

```typescript
export function useTenantVMs(tenantId: string | undefined) {
  const vmsQuery = useQuery({
    queryKey: ["tenant-vms", tenantId],
    queryFn: () => listVMs({ tenantId }),
    refetchInterval: 10000,
    enabled: !!tenantId,
  });

  const vmActionMutation = useMutation({
    mutationFn: ({ vmid, node, action, tenantId }) => 
      performVMAction(node, vmid, action, "qemu", tenantId),
    onSuccess: () => {
      queryClient.invalidateQueries(["tenant-vms", tenantId]);
    },
  });

  return { vms: vmsQuery.data, vmAction: vmActionMutation };
}
```

### 4.4 useConnectivityTest Hook

**File: `src/hooks/useConnectivityTest.ts`** (New)

```typescript
export function useConnectivityTest() {
  return useMutation({
    mutationFn: (serverId: string) => runConnectivityTest(serverId),
  });
}
```

---

## Part 5: Type Updates

**File: `src/lib/types.ts`**

```typescript
// Tenant Settings
export interface TenantSettings {
  id: string;
  tenant_id: string;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  notification_email: string | null;
  notify_on_server_offline: boolean;
  notify_on_vm_action: boolean;
  notify_on_user_changes: boolean;
  default_connection_timeout: number;
  default_verify_ssl: boolean;
  auto_health_check_interval: number;
  created_at: string;
  updated_at: string;
}

// Audit Logs
export interface AuditLog {
  id: string;
  tenant_id: string;
  user_id: string;
  action_type: AuditActionType;
  resource_type: 'server' | 'vm' | 'user' | 'settings';
  resource_id: string | null;
  resource_name: string | null;
  details: Record<string, unknown>;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
  user?: {
    email: string;
    full_name: string | null;
  };
}

export type AuditActionType = 
  | 'server_added' | 'server_deleted' | 'server_updated'
  | 'vm_started' | 'vm_stopped' | 'vm_restarted' | 'vm_shutdown'
  | 'user_invited' | 'user_removed' | 'role_changed'
  | 'settings_updated';

// Connectivity Test
export interface ConnectivityTestResult {
  success: boolean;
  dnsResolutionMs: number;
  tcpConnectionMs: number;
  tlsHandshakeMs: number;
  apiResponseMs: number;
  totalLatencyMs: number;
  resolvedIp: string;
  connectionType: 'direct' | 'tailscale' | 'funnel';
  tailscaleInfo?: {
    derp: string;
    path: string;
    latencyMeasurements: number[];
  };
  proxmoxVersion?: string;
  nodeCount?: number;
  error?: string;
  errorStage?: 'dns' | 'tcp' | 'tls' | 'api';
  recommendedTimeoutMs: number;
}

// Connection Metrics
export interface ConnectionMetric {
  id: string;
  server_id: string;
  success: boolean;
  response_time_ms: number | null;
  error_message: string | null;
  used_tailscale: boolean;
  timeout_used_ms: number;
  retry_count: number;
  created_at: string;
}

// Extended ProxmoxServer
export interface ProxmoxServer {
  // ...existing fields
  learned_timeout_ms: number | null;
  avg_response_time_ms: number | null;
  success_rate: number | null;
}
```

---

## Part 6: Routes Update

**File: `src/App.tsx`**

Add new routes:

```tsx
// Tenant Settings
<Route
  path="/tenants/:tenantId/settings"
  element={
    <ProtectedRoute>
      <Suspense fallback={<PageLoader />}>
        <TenantSettings />
      </Suspense>
    </ProtectedRoute>
  }
/>

// Audit Logs
<Route
  path="/tenants/:tenantId/audit-log"
  element={
    <ProtectedRoute>
      <Suspense fallback={<PageLoader />}>
        <TenantAuditLog />
      </Suspense>
    </ProtectedRoute>
  }
/>
```

---

## Part 7: Update useTenantPermissions

**File: `src/hooks/useTenantPermissions.ts`** (Update)

Add new permission flags:

```typescript
interface TenantPermissions {
  // ...existing
  canManageVMs: boolean;        // manager or admin
  canViewAuditLogs: boolean;    // admin only
  canManageSettings: boolean;   // admin only
}

return {
  // ...existing
  canManageVMs: role === "admin" || role === "manager",
  canViewAuditLogs: role === "admin",
  canManageSettings: role === "admin",
};
```

---

## Implementation Order

| Step | Task | Files |
|------|------|-------|
| 1 | Database migration for settings, audit, metrics | SQL migration |
| 2 | Update types | `src/lib/types.ts` |
| 3 | Create audit-log edge function | `supabase/functions/audit-log/index.ts` |
| 4 | Create tenant-settings edge function | `supabase/functions/tenant-settings/index.ts` |
| 5 | Create connectivity-test edge function | `supabase/functions/connectivity-test/index.ts` |
| 6 | Create connection-metrics edge function | `supabase/functions/connection-metrics/index.ts` |
| 7 | Update vm-actions with audit logging | `supabase/functions/vm-actions/index.ts` |
| 8 | Update proxmox-servers with retry logic | `supabase/functions/proxmox-servers/index.ts` |
| 9 | Create useTenantSettings hook | `src/hooks/useTenantSettings.ts` |
| 10 | Create useAuditLogs hook | `src/hooks/useAuditLogs.ts` |
| 11 | Create useTenantVMs hook | `src/hooks/useTenantVMs.ts` |
| 12 | Create useConnectivityTest hook | `src/hooks/useConnectivityTest.ts` |
| 13 | Update useTenantPermissions | `src/hooks/useTenantPermissions.ts` |
| 14 | Create TenantSettings page | `src/pages/TenantSettings.tsx` |
| 15 | Create TenantAuditLog page | `src/pages/TenantAuditLog.tsx` |
| 16 | Create ConnectivityTestDialog | `src/components/servers/ConnectivityTestDialog.tsx` |
| 17 | Update TenantDashboard with VM actions | `src/pages/TenantDashboard.tsx` |
| 18 | Add new routes | `src/App.tsx` |
| 19 | Update navigation links | `src/components/layout/TenantLayout.tsx` |
| 20 | Deploy edge functions | Deployment |

---

## Security Considerations

1. **Audit Log Immutability**: Audit logs are INSERT-only with no UPDATE/DELETE policies
2. **Role-Based Access**: 
   - Settings: Admin only
   - Audit logs: Admin only (for compliance)
   - VM actions: Manager and Admin
3. **Connection Metrics Privacy**: Metrics tied to server, not exposed to non-tenant users
4. **Timeout Limits**: Max 120 seconds to prevent abuse

---

## Retry Logic Algorithm

```text
Attempt 1: Immediate
  ↓ fail
Wait: 1000ms + random(0-200ms)
Attempt 2:
  ↓ fail
Wait: 2000ms + random(0-400ms)
Attempt 3:
  ↓ fail
Wait: 4000ms + random(0-800ms)
Attempt 4 (final):
  ↓ fail
Return error with all attempt details
```

---

## Timeout Learning Algorithm

```text
For each server:
1. Collect last 100 successful connections
2. Calculate P95 response time
3. Add 50% buffer
4. Clamp between 5s and 120s
5. Store as learned_timeout_ms
6. Use learned timeout if:
   - At least 10 successful connections
   - Success rate > 80%
   Otherwise, use configured timeout
```

---

## Summary of Changes

| Component | Changes |
|-----------|---------|
| **Database** | Add `tenant_settings`, `audit_logs`, `connection_metrics` tables |
| **proxmox_servers** | Add `learned_timeout_ms`, `avg_response_time_ms`, `success_rate` columns |
| **audit-log** | New edge function for compliance logging |
| **tenant-settings** | New edge function for settings CRUD |
| **connectivity-test** | New edge function with detailed diagnostics |
| **connection-metrics** | New edge function for timeout learning |
| **vm-actions** | Add tenant context and audit logging |
| **proxmox-servers** | Add exponential backoff retry logic |
| **TenantSettings** | New page for branding/notifications/defaults |
| **TenantAuditLog** | New page for viewing/exporting audit logs |
| **TenantDashboard** | Add VM quick actions section |
| **ConnectivityTestDialog** | New component for detailed connection diagnostics |
| **Types** | Add TenantSettings, AuditLog, ConnectivityTestResult interfaces |
| **Routes** | Add /tenants/:tenantId/settings and /tenants/:tenantId/audit-log |
| **Permissions** | Add canManageVMs, canViewAuditLogs, canManageSettings flags |
