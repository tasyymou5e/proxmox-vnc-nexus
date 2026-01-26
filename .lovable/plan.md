
# Tenant-Scoped Proxmox Management with Real-Time Stats

## Overview

This plan implements three major features to transform the application from user-scoped to tenant-scoped server management:

1. **Real-time VM Statistics on Tenant Dashboard** - Aggregate live data from all connected Proxmox servers
2. **Tenant-Scoped Server Management** - Servers belong to tenants instead of individual users
3. **Tenant User Management Page** - Assign users to tenants with admin/manager/viewer roles

---

## Current State Analysis

### What Already Exists
- Multi-tenancy schema: `tenants`, `user_tenant_assignments` tables with RLS
- `proxmox_servers` table has `tenant_id` column (nullable)
- Tenant edge function with user assignment actions
- TenantDashboard with basic stats (currently showing placeholder data)
- Helper functions: `has_tenant_role()`, `user_has_tenant_access()`

### What Needs to Change
- Servers are currently scoped by `user_id` - need to scope by `tenant_id`
- Dashboard stats are not real-time aggregated from Proxmox
- No dedicated tenant user management page exists
- Edge functions query by `user_id` instead of `tenant_id`

---

## Part 1: Database Schema Updates

### 1.1 Make tenant_id Required for Servers

```sql
-- First, update any orphaned servers (optional: assign to first admin's first tenant)
-- Then add NOT NULL constraint
ALTER TABLE public.proxmox_servers 
ALTER COLUMN tenant_id SET NOT NULL;

-- Add index for tenant queries
CREATE INDEX IF NOT EXISTS idx_proxmox_servers_tenant ON public.proxmox_servers(tenant_id);
```

### 1.2 Update RLS Policies for Tenant-Scoped Access

**proxmox_servers Table - New Policies:**

| Policy | Command | Logic |
|--------|---------|-------|
| "Users can view servers in their tenants" | SELECT | User has any role in the server's tenant |
| "Tenant admins/managers can insert servers" | INSERT | User has admin or manager role in the target tenant |
| "Tenant admins/managers can update servers" | UPDATE | User has admin or manager role in the server's tenant |
| "Tenant admins can delete servers" | DELETE | User has admin role in the server's tenant |
| "System admins can manage all servers" | ALL | User has system admin role |

```sql
-- Drop existing user-based policies
DROP POLICY IF EXISTS "Users can view their own servers" ON public.proxmox_servers;
DROP POLICY IF EXISTS "Users can insert their own servers" ON public.proxmox_servers;
-- ... etc

-- Create tenant-based policies
CREATE POLICY "Users can view tenant servers"
  ON public.proxmox_servers FOR SELECT
  USING (
    has_role(auth.uid(), 'admin') OR 
    user_has_tenant_access(auth.uid(), tenant_id)
  );

CREATE POLICY "Tenant admins/managers can insert servers"
  ON public.proxmox_servers FOR INSERT
  WITH CHECK (
    has_role(auth.uid(), 'admin') OR 
    has_tenant_role(auth.uid(), tenant_id, ARRAY['admin', 'manager']::tenant_role[])
  );

CREATE POLICY "Tenant admins/managers can update servers"
  ON public.proxmox_servers FOR UPDATE
  USING (
    has_role(auth.uid(), 'admin') OR 
    has_tenant_role(auth.uid(), tenant_id, ARRAY['admin', 'manager']::tenant_role[])
  );

CREATE POLICY "Tenant admins can delete servers"
  ON public.proxmox_servers FOR DELETE
  USING (
    has_role(auth.uid(), 'admin') OR 
    has_tenant_role(auth.uid(), tenant_id, ARRAY['admin']::tenant_role[])
  );
```

---

## Part 2: Edge Function Updates

### 2.1 Update proxmox-servers Edge Function

**File: `supabase/functions/proxmox-servers/index.ts`**

Change from user-scoped to tenant-scoped queries:

```typescript
// ADD: Accept tenantId parameter
interface ServerRequest {
  tenantId?: string;
  // ...existing fields
}

// CHANGE: All queries filter by tenant_id instead of user_id
// For GET (list servers):
const { data: servers } = await supabase
  .from("proxmox_servers")
  .select("*")
  .eq("tenant_id", tenantId)  // Changed from user_id
  .order("created_at", { ascending: false });

// For POST (create server):
const insertData = {
  tenant_id: tenantId,  // Changed from user_id
  // ...other fields
};

// VALIDATE: Check user has tenant access before operations
const hasAccess = await checkTenantAccess(supabase, userId, tenantId, ['admin', 'manager']);
if (!hasAccess) {
  return new Response(JSON.stringify({ error: "Access denied" }), { status: 403 });
}
```

### 2.2 Update list-vms Edge Function

**File: `supabase/functions/list-vms/index.ts`**

Add tenant filtering:

```typescript
interface ListVMsRequest {
  tenantId?: string;
  serverId?: string;
}

// Query servers by tenant
const { data: servers } = await supabase
  .from("proxmox_servers")
  .select("*")
  .eq("tenant_id", tenantId)
  .eq("is_active", true);
```

### 2.3 Create Real-Time Stats Edge Function

**File: `supabase/functions/tenant-stats/index.ts`** (New)

Aggregate live statistics from all tenant servers:

```typescript
// Actions: 'get-live-stats', 'get-resource-usage', 'get-node-status'

// Fetch data from all active servers in parallel
const servers = await getTenantServers(tenantId);
const results = await Promise.all(servers.map(async (server) => {
  // Call Proxmox API for each server
  const [resources, nodes] = await Promise.all([
    fetchProxmoxApi(server, '/cluster/resources'),
    fetchProxmoxApi(server, '/nodes'),
  ]);
  return { serverId: server.id, resources, nodes };
}));

// Aggregate stats
const stats = {
  totalVMs: 0,
  runningVMs: 0,
  totalContainers: 0,
  runningContainers: 0,
  cpuUsage: { used: 0, total: 0 },
  memoryUsage: { used: 0, total: 0 },
  storageUsage: { used: 0, total: 0 },
  nodes: { online: 0, offline: 0 },
};

// Process each server's data...
```

---

## Part 3: Frontend Hook Updates

### 3.1 Update useProxmoxServers Hook

**File: `src/hooks/useProxmoxServers.ts`**

Add tenantId parameter to all operations:

```typescript
export function useProxmoxServers(tenantId?: string) {
  // Pass tenantId to all API calls
  const fetchServers = useCallback(async () => {
    const response = await fetch(
      `${API_CONFIG.SUPABASE_URL}${API_CONFIG.FUNCTIONS_PATH}/proxmox-servers`,
      {
        method: "GET",
        headers,
        body: tenantId ? JSON.stringify({ tenantId }) : undefined,
      }
    );
  }, [tenantId]);
  
  // ... similar changes for create, update, delete
}
```

### 3.2 Create useTenantStats Hook

**File: `src/hooks/useTenantStats.ts`** (Enhanced)

Real-time statistics with auto-refresh:

```typescript
export function useLiveTenantStats(tenantId: string) {
  return useQuery({
    queryKey: ["tenant-live-stats", tenantId],
    queryFn: async () => {
      const response = await supabase.functions.invoke("tenant-stats", {
        body: { action: "get-live-stats", tenantId },
      });
      return response.data.stats;
    },
    refetchInterval: 10000, // Refresh every 10 seconds
    enabled: !!tenantId,
  });
}
```

---

## Part 4: Tenant User Management Page

### 4.1 New Page Component

**File: `src/pages/TenantUsers.tsx`** (New)

A dedicated page to manage tenant user assignments:

```text
+------------------------------------------------------------------+
| Tenant Users - ACME Corp                    [Back] [Add User]    |
+------------------------------------------------------------------+
| Search users...                                                   |
+------------------------------------------------------------------+
| User                  | Email                | Role    | Actions  |
|----------------------|---------------------|---------|----------|
| John Doe             | john@example.com    | Admin   | [▼]      |
| Jane Smith           | jane@example.com    | Manager | [▼]      |
| Bob Wilson           | bob@example.com     | Viewer  | [▼]      |
+------------------------------------------------------------------+
```

**Features:**
- List all users assigned to the tenant with their roles
- Add new user by email with role selection
- Change user role (Admin → Manager → Viewer)
- Remove user from tenant
- Role badges with colors (Admin: Red, Manager: Orange, Viewer: Blue)

### 4.2 Component Structure

```tsx
export default function TenantUsers() {
  const { tenantId } = useParams();
  const { users, isLoading, assignUser, removeUser } = useTenantUsers(tenantId);
  
  return (
    <TenantLayout>
      <div className="p-6 space-y-6">
        {/* Header with Add User button */}
        <div className="flex items-center justify-between">
          <h1>Manage Users</h1>
          <AddUserDialog tenantId={tenantId} />
        </div>
        
        {/* Users Table */}
        <Table>
          <TableHeader>...</TableHeader>
          <TableBody>
            {users.map(user => (
              <TableRow key={user.id}>
                <TableCell>{user.profiles.full_name || user.profiles.email}</TableCell>
                <TableCell>{user.profiles.email}</TableCell>
                <TableCell><RoleBadge role={user.role} /></TableCell>
                <TableCell>
                  <UserActionsMenu 
                    user={user} 
                    onChangeRole={...} 
                    onRemove={...} 
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </TenantLayout>
  );
}
```

### 4.3 Add User Dialog

```tsx
function AddUserDialog({ tenantId }: { tenantId: string }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<TenantRole>("viewer");
  const { assignUser } = useTenantUsers(tenantId);
  const { data: allUsers } = useAllProfiles(); // For autocomplete
  
  return (
    <Dialog>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add User to Tenant</DialogTitle>
        </DialogHeader>
        
        {/* Email/User search with autocomplete */}
        <Combobox 
          options={allUsers} 
          onSelect={setEmail}
          placeholder="Search by email..."
        />
        
        {/* Role selector */}
        <Select value={role} onValueChange={setRole}>
          <SelectItem value="admin">Admin - Full access</SelectItem>
          <SelectItem value="manager">Manager - Can manage servers</SelectItem>
          <SelectItem value="viewer">Viewer - Read-only access</SelectItem>
        </Select>
        
        <Button onClick={() => assignUser({ userId, role })}>
          Add User
        </Button>
      </DialogContent>
    </Dialog>
  );
}
```

---

## Part 5: Update TenantDashboard with Real-Time Stats

### 5.1 Enhanced Dashboard Layout

**File: `src/pages/TenantDashboard.tsx`**

```text
+------------------------------------------------------------------+
| ACME Corp Environment                   [Refresh] [Servers]      |
+------------------------------------------------------------------+
| Stats Grid (Auto-updating every 10s)                              |
| +--------+  +--------+  +--------+  +--------+                   |
| | Nodes  |  | VMs    |  | LXC    |  | Servers|                   |
| | 3 🟢   |  | 24▶ 5■ |  | 8▶ 2■  |  | 4 🟢   |                   |
| +--------+  +--------+  +--------+  +--------+                   |
|                                                                   |
| Resource Usage (Live)                                             |
| +------------------+  +------------------+  +------------------+ |
| | CPU: 45%         |  | Memory: 78%      |  | Storage: 24%     | |
| | [========     ]  |  | [===========  ]  |  | [====          ] | |
| | 14.4 / 32 cores  |  | 62.4 / 80 GB     |  | 2.4 / 10 TB      | |
| +------------------+  +------------------+  +------------------+ |
|                                                                   |
| Node Status                                                       |
| +------------------+  +------------------+  +------------------+ |
| | pve1.local  🟢   |  | pve2.local  🟢   |  | pve3.local  🟢   | |
| | CPU: 32% Mem:65% |  | CPU: 45% Mem:82% |  | CPU: 58% Mem:71% | |
| +------------------+  +------------------+  +------------------+ |
+------------------------------------------------------------------+
```

### 5.2 Real-Time Data Integration

```tsx
export default function TenantDashboard() {
  const { tenantId } = useParams();
  
  // Real-time stats with 10s refresh
  const { data: liveStats, isLoading: isStatsLoading } = useLiveTenantStats(tenantId);
  
  // Cluster resources with 15s refresh  
  const { data: resources, refetch } = useClusterResources(tenantId);
  
  // Nodes with 30s refresh
  const { data: nodes } = useNodes(tenantId);
  
  return (
    <TenantLayout>
      {/* Auto-refresh indicator */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Activity className="h-3 w-3 animate-pulse text-green-500" />
        Live updates enabled
      </div>
      
      {/* Stats using liveStats data */}
      <StatCard
        title="Virtual Machines"
        value={liveStats?.totalVMs || 0}
        subValue={`${liveStats?.runningVMs || 0} running`}
        icon={Server}
      />
      
      {/* Resource bars using real-time data */}
      <ResourceCard
        title="CPU Usage"
        used={liveStats?.cpuUsage.used || 0}
        total={liveStats?.cpuUsage.total || 1}
        unit="cores"
        icon={Cpu}
      />
    </TenantLayout>
  );
}
```

---

## Part 6: Update ProxmoxServers Page for Tenant Context

### 6.1 Accept Tenant Parameter

**File: `src/pages/ProxmoxServers.tsx`**

```tsx
interface ProxmoxServersProps {
  tenantId?: string;
  hideLayout?: boolean;
}

export default function ProxmoxServers({ tenantId, hideLayout }: ProxmoxServersProps) {
  // Use tenant-scoped hook
  const { servers, createServer, ... } = useProxmoxServers(tenantId);
  
  // Validate user has permission to add servers
  const { canManageServers } = useTenantPermissions(tenantId);
  
  // Hide Add Server button if user doesn't have manager+ role
  {canManageServers && (
    <Button onClick={() => handleOpenDialog()}>
      <Plus className="h-4 w-4 mr-2" />
      Add Server
    </Button>
  )}
}
```

---

## Part 7: New Routes

### 7.1 Add Tenant Users Route

**File: `src/App.tsx`**

```tsx
// Add new route for tenant user management
<Route
  path="/tenants/:tenantId/users"
  element={
    <ProtectedRoute>
      <Suspense fallback={<PageLoader />}>
        <TenantUsers />
      </Suspense>
    </ProtectedRoute>
  }
/>
```

---

## Part 8: Type Updates

### 8.1 Extended Types

**File: `src/lib/types.ts`**

```typescript
// Enhanced tenant stats with live data
export interface LiveTenantStats {
  totalVMs: number;
  runningVMs: number;
  stoppedVMs: number;
  totalContainers: number;
  runningContainers: number;
  nodes: {
    total: number;
    online: number;
    offline: number;
  };
  cpuUsage: {
    used: number;
    total: number;
    percentage: number;
  };
  memoryUsage: {
    used: number;
    total: number;
    percentage: number;
  };
  storageUsage: {
    used: number;
    total: number;
    percentage: number;
  };
  servers: {
    total: number;
    online: number;
    offline: number;
  };
  lastUpdated: string;
}

// Tenant user with profile info
export interface TenantUserAssignment {
  id: string;
  user_id: string;
  tenant_id: string;
  role: TenantRole;
  created_at: string;
  profile: {
    id: string;
    email: string;
    full_name: string | null;
    username: string | null;
    avatar_url: string | null;
  };
}
```

---

## Implementation Order

| Step | Task | Files |
|------|------|-------|
| 1 | Database migration for tenant-scoped RLS | SQL migration |
| 2 | Update types with LiveTenantStats | `src/lib/types.ts` |
| 3 | Create tenant-stats edge function | `supabase/functions/tenant-stats/index.ts` |
| 4 | Update proxmox-servers edge function | `supabase/functions/proxmox-servers/index.ts` |
| 5 | Update list-vms edge function | `supabase/functions/list-vms/index.ts` |
| 6 | Update tenants edge function for user lookups | `supabase/functions/tenants/index.ts` |
| 7 | Update useProxmoxServers hook | `src/hooks/useProxmoxServers.ts` |
| 8 | Create useTenantPermissions hook | `src/hooks/useTenantPermissions.ts` |
| 9 | Enhance useTenants hook | `src/hooks/useTenants.ts` |
| 10 | Create TenantUsers page | `src/pages/TenantUsers.tsx` |
| 11 | Update TenantDashboard with live stats | `src/pages/TenantDashboard.tsx` |
| 12 | Update ProxmoxServers for tenant context | `src/pages/ProxmoxServers.tsx` |
| 13 | Add route for tenant users | `src/App.tsx` |
| 14 | Deploy edge functions | Deployment |

---

## Security Considerations

1. **Role-Based Access Control**
   - Viewers: Read-only access to servers and VMs
   - Managers: Can add/edit servers, start/stop VMs
   - Admins: Full control including user management and server deletion

2. **Tenant Isolation**
   - RLS policies ensure users only see servers in their assigned tenants
   - Edge functions validate tenant access before all operations
   - No cross-tenant data leakage possible

3. **System Admin Override**
   - System admins (from `user_roles` table) can access all tenants
   - Used for support and troubleshooting

---

## Summary of Changes

| Component | Changes |
|-----------|---------|
| **Database** | Update RLS policies from user-scoped to tenant-scoped |
| **tenant-stats** | New edge function for real-time aggregated stats |
| **proxmox-servers** | Accept tenantId, query by tenant instead of user |
| **list-vms** | Filter VMs by tenant's servers |
| **tenants** | Add user lookup action for autocomplete |
| **TenantUsers** | New page for managing tenant user assignments |
| **TenantDashboard** | Real-time stats with 10s auto-refresh |
| **ProxmoxServers** | Accept tenantId prop, permission-based UI |
| **Types** | LiveTenantStats, TenantUserAssignment interfaces |
| **Routes** | Add /tenants/:tenantId/users route |
