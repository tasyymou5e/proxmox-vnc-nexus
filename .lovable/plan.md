
## Multi-Feature Enhancement: Health Checks, CSV Import, and Server Filtering

### Overview
This plan implements three interconnected features for managing multiple Proxmox servers:

1. **Connection Status Monitoring with Automatic Health Checks** - Periodic background health checks for all configured servers
2. **Bulk Import via CSV Upload** - Import multiple servers from a CSV file
3. **Server Filtering on Dashboard** - Filter VMs by specific Proxmox server

---

## Feature 1: Connection Status Monitoring with Automatic Health Checks

### 1.1 Database Schema Update

Add a `connection_status` column to track health check results:

```sql
-- Add health check tracking columns
ALTER TABLE public.proxmox_servers 
ADD COLUMN IF NOT EXISTS connection_status text DEFAULT 'unknown',
ADD COLUMN IF NOT EXISTS last_health_check_at timestamptz,
ADD COLUMN IF NOT EXISTS health_check_error text;

-- connection_status values: 'online', 'offline', 'unknown', 'checking'
```

### 1.2 Edge Function Update

**File: `supabase/functions/proxmox-servers/index.ts`**

Add a new `health-check-all` action:

```typescript
// POST with action: "health-check-all"
// Tests connection to all active servers for the user
// Updates connection_status, last_health_check_at, health_check_error in database
// Returns array of { serverId, status, error? }
```

### 1.3 Frontend Hook Update

**File: `src/hooks/useProxmoxServers.ts`**

Add health check functionality:

```typescript
const runHealthChecks = useCallback(async (): Promise<HealthCheckResult[]>
// Calls the edge function to check all servers
// Updates local state with new connection statuses

// Auto-refresh every 2 minutes when page is focused
useEffect(() => {
  const interval = setInterval(runHealthChecks, 120000);
  return () => clearInterval(interval);
}, []);
```

### 1.4 UI Updates

**File: `src/pages/ProxmoxServers.tsx`**

Update server cards to show live status:

```
+-------------------------------------------+
| Server Name: Production Cluster           |
| Host: pve1.company.com:8006              |
| Status: ● Online (checked 2m ago)         |  <- NEW status indicator
|         └─ 3 nodes available              |
| [Refresh All] [Test] [Edit] [Delete]      |  <- NEW "Refresh All" button
+-------------------------------------------+
```

Status indicators:
- 🟢 Online - Connection successful
- 🔴 Offline - Connection failed (show error tooltip)
- ⚪ Unknown - Not yet checked
- 🔵 Checking - Health check in progress

---

## Feature 2: Bulk Import via CSV Upload

### 2.1 CSV Format Specification

```csv
name,host,port,api_token,verify_ssl
Production Cluster,pve1.company.com,8006,user@realm!tokenid=uuid,true
Development,192.168.1.100,8006,dev@pam!token=uuid,false
```

Required columns: `name`, `host`, `api_token`
Optional columns: `port` (default: 8006), `verify_ssl` (default: true)

### 2.2 Edge Function Update

**File: `supabase/functions/proxmox-servers/index.ts`**

Add bulk import action:

```typescript
// POST with action: "bulk-import"
// body: { servers: ServerInput[] }
// Validates each server, encrypts tokens, inserts in batch
// Returns { success: number, failed: { index, name, error }[] }
```

### 2.3 Frontend Components

**File: `src/components/servers/CSVImportDialog.tsx`** (New)

```
+------------------------------------------------+
|  Import Proxmox Servers from CSV               |
+------------------------------------------------+
|  Upload a CSV file with your server details.   |
|                                                |
|  [Choose File] servers.csv                     |
|                                                |
|  Preview:                                      |
|  +------------------------------------------+ |
|  | Name       | Host              | Port    | |
|  |------------|-------------------|---------|  |
|  | Prod       | pve1.company.com  | 8006    | |
|  | Dev        | 192.168.1.100     | 8006    | |
|  +------------------------------------------+ |
|                                                |
|  ℹ️ 2 servers will be imported                 |
|                                                |
|  [Download Template]  [Cancel]  [Import]       |
+------------------------------------------------+
```

**File: `src/hooks/useProxmoxServers.ts`**

Add bulk import function:

```typescript
const bulkImportServers = useCallback(async (
  servers: ProxmoxServerInput[]
): Promise<{ success: number; failed: ImportError[] }>
```

### 2.4 UI Integration

**File: `src/pages/ProxmoxServers.tsx`**

Add import button next to Add Server:

```tsx
<Button variant="outline" onClick={() => setImportDialogOpen(true)}>
  <Upload className="h-4 w-4 mr-2" />
  Import CSV
</Button>
```

---

## Feature 3: Server Filtering on Dashboard

### 3.1 Type Updates

**File: `src/lib/types.ts`**

Extend VM interface:

```typescript
export interface VM {
  // ...existing fields
  serverId?: string;      // ID of the Proxmox server
  serverName?: string;    // Display name of the server
}
```

### 3.2 API Updates

**File: `src/lib/api.ts`**

Update `listVMs` to support aggregating from multiple servers:

```typescript
export async function listVMs(serverId?: string): Promise<{ 
  vms: VM[]; 
  isAdmin: boolean;
  servers: { id: string; name: string }[];  // Available servers
}>
```

### 3.3 Edge Function Update

**File: `supabase/functions/list-vms/index.ts`**

Modify to aggregate VMs from all user servers when no serverId specified:

```typescript
// If no serverId:
//   1. Get all active servers for user
//   2. Fetch VMs from each server in parallel
//   3. Combine results with serverId/serverName tags
//   4. Return aggregated list + available servers for filter dropdown
```

### 3.4 Hook Updates

**File: `src/hooks/useVMs.ts`**

Add server filter support:

```typescript
export function useVMs(serverId?: string) {
  return useQuery({
    queryKey: ["vms", serverId],  // Cache per server
    queryFn: () => listVMs(serverId),
    // ...existing options
  });
}
```

### 3.5 Dashboard UI Updates

**File: `src/pages/Dashboard.tsx`**

Add server filter dropdown:

```tsx
// New state
const [selectedServerId, setSelectedServerId] = useState<string>("all");
const { data: serversData } = useProxmoxServers();

// Filter dropdown (next to status filter)
<Select value={selectedServerId} onValueChange={setSelectedServerId}>
  <SelectTrigger className="w-[180px]">
    <SelectValue placeholder="All Servers" />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="all">All Servers</SelectItem>
    {servers.map((s) => (
      <SelectItem key={s.id} value={s.id}>
        {s.name}
      </SelectItem>
    ))}
  </SelectContent>
</Select>
```

### 3.6 VM Card/Table Updates

**File: `src/components/dashboard/VMCard.tsx`**

Display server name on VM cards:

```tsx
// In card header, add server badge
{vm.serverName && (
  <Badge variant="secondary" className="text-xs">
    {vm.serverName}
  </Badge>
)}
```

**File: `src/components/dashboard/VMTable.tsx`**

Add Server column to table:

```tsx
<TableHead>Server</TableHead>
// ...
<TableCell>{vm.serverName || "-"}</TableCell>
```

---

## Implementation Order

| Step | Task | Files |
|------|------|-------|
| 1 | Database migration for health check columns | SQL migration |
| 2 | Update edge function with health-check-all and bulk-import | `proxmox-servers/index.ts` |
| 3 | Update types for VM server fields | `src/lib/types.ts` |
| 4 | Update useProxmoxServers hook with health checks | `src/hooks/useProxmoxServers.ts` |
| 5 | Create CSV import dialog component | `src/components/servers/CSVImportDialog.tsx` |
| 6 | Update ProxmoxServers page with status + import | `src/pages/ProxmoxServers.tsx` |
| 7 | Update list-vms edge function for aggregation | `supabase/functions/list-vms/index.ts` |
| 8 | Update listVMs API function | `src/lib/api.ts` |
| 9 | Update useVMs hook with server filter | `src/hooks/useVMs.ts` |
| 10 | Update Dashboard with server filter | `src/pages/Dashboard.tsx` |
| 11 | Update VMCard with server badge | `src/components/dashboard/VMCard.tsx` |
| 12 | Update VMTable with server column | `src/components/dashboard/VMTable.tsx` |

---

## Summary of Changes

| Component | Changes |
|-----------|---------|
| **Database** | Add `connection_status`, `last_health_check_at`, `health_check_error` columns |
| **Edge Function: proxmox-servers** | Add `health-check-all` and `bulk-import` actions |
| **Edge Function: list-vms** | Aggregate VMs from multiple servers |
| **Frontend Types** | Add `serverId`, `serverName` to VM interface |
| **useProxmoxServers** | Add `runHealthChecks`, `bulkImportServers`, auto-refresh |
| **useVMs** | Add `serverId` parameter for filtering |
| **ProxmoxServers page** | Add status indicators, "Refresh All" button, CSV import dialog |
| **Dashboard** | Add server filter dropdown |
| **VMCard** | Add server name badge |
| **VMTable** | Add Server column |

---

## Security Considerations

1. **CSV Import Validation**: Validate all imported data server-side before insertion
2. **Token Format**: Verify API token format for each imported server
3. **Rate Limiting**: Health checks limited to user's own servers via RLS
4. **Batch Limits**: Maximum 50 servers per import (remaining capacity check)

---

## User Experience Enhancements

1. **Auto-refresh**: Health checks run automatically every 2 minutes when page is visible
2. **Visual Feedback**: Clear status indicators with timestamps
3. **Error Details**: Tooltip/expandable section showing connection errors
4. **Import Preview**: Show parsed CSV data before importing
5. **Template Download**: Provide sample CSV template for users
