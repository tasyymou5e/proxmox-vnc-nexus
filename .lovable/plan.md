
# Comprehensive Proxmox API Explorer with Multi-Tenancy

## Overview

This plan implements a complete Proxmox API management interface that mirrors the official Proxmox API structure, adding multi-tenancy (company/tenant) support, and a hierarchical tree navigation menu. The system will allow admins to manage multiple tenants, each with their own Proxmox servers and configurations.

---

## Architecture Overview

```text
+-------------------------------------------------------------+
|                     Admin Login                              |
+-------------------------------------------------------------+
                           |
                           v
+-------------------------------------------------------------+
|              Tenant/Company Selector                        |
|  +------------------+  +------------------+                 |
|  | ACME Corp        |  | TechStart Inc   |                 |
|  | 5 servers, 24 VMs|  | 2 servers, 8 VMs|                 |
|  +------------------+  +------------------+                 |
+-------------------------------------------------------------+
                           |
                           v
+-------------------------------------------------------------+
|                   Tenant Dashboard                           |
+------------------+------------------------------------------+
|  Tree Menu       |  Main Content Area                       |
|  +-----------+   |  +------------------------------------+  |
|  | Cluster   |   |  | Environment Overview               |  |
|  |  +--Config|   |  | - Nodes: 3                         |  |
|  |  +--Status|   |  | - VMs: 24 running, 5 stopped       |  |
|  |  +--Tasks |   |  | - Storage: 2.4TB / 10TB            |  |
|  | Nodes     |   |  | - CPU: 45% avg                     |  |
|  |  +--pve1  |   |  +------------------------------------+  |
|  |  +--pve2  |   |                                          |
|  | Access    |   |                                          |
|  | Storage   |   |                                          |
|  | Pools     |   |                                          |
|  +-----------+   |                                          |
+------------------+------------------------------------------+
```

---

## Part 1: Database Schema - Multi-Tenancy Support

### New Tables

#### 1.1 Tenants Table
```sql
CREATE TABLE public.tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  description text,
  logo_url text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
```

#### 1.2 User-Tenant Assignments
```sql
CREATE TABLE public.user_tenant_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'viewer', -- admin, manager, viewer
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, tenant_id)
);

-- Enable RLS
ALTER TABLE public.user_tenant_assignments ENABLE ROW LEVEL SECURITY;
```

#### 1.3 Update proxmox_servers to Link to Tenants
```sql
ALTER TABLE public.proxmox_servers 
ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE;

-- Create index for tenant queries
CREATE INDEX IF NOT EXISTS idx_proxmox_servers_tenant ON public.proxmox_servers(tenant_id);
```

#### 1.4 Proxmox API Config Storage
```sql
CREATE TABLE public.proxmox_api_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  server_id uuid NOT NULL REFERENCES public.proxmox_servers(id) ON DELETE CASCADE,
  config_path text NOT NULL, -- e.g., "/cluster/options", "/access/domains"
  config_data jsonb NOT NULL DEFAULT '{}',
  last_synced_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(server_id, config_path)
);

-- Enable RLS
ALTER TABLE public.proxmox_api_configs ENABLE ROW LEVEL SECURITY;
```

---

## Part 2: Proxmox API Tree Structure Definition

### 2.1 API Menu Configuration

**File: `src/config/proxmoxApiTree.ts`**

```typescript
export interface ApiEndpoint {
  path: string;
  label: string;
  description?: string;
  methods: ('GET' | 'POST' | 'PUT' | 'DELETE')[];
  isConfig: boolean; // true = can edit, false = view only
  icon?: string;
  children?: ApiEndpoint[];
  parameters?: ApiParameter[];
}

export interface ApiParameter {
  name: string;
  type: 'string' | 'integer' | 'boolean' | 'enum' | 'object';
  required: boolean;
  description?: string;
  enumValues?: string[];
  default?: unknown;
}

export const PROXMOX_API_TREE: ApiEndpoint[] = [
  {
    path: '/cluster',
    label: 'Cluster',
    description: 'Cluster-wide configuration and status',
    methods: ['GET'],
    isConfig: false,
    children: [
      {
        path: '/cluster/config',
        label: 'Config',
        methods: ['GET', 'POST'],
        isConfig: true,
        children: [
          { path: '/cluster/config/nodes', label: 'Nodes', methods: ['GET'], isConfig: false },
          { path: '/cluster/config/join', label: 'Join', methods: ['GET', 'POST'], isConfig: true },
          { path: '/cluster/config/totem', label: 'Totem', methods: ['GET'], isConfig: false },
          { path: '/cluster/config/qdevice', label: 'QDevice', methods: ['GET'], isConfig: false },
        ]
      },
      {
        path: '/cluster/firewall',
        label: 'Firewall',
        methods: ['GET'],
        isConfig: false,
        children: [
          { path: '/cluster/firewall/groups', label: 'Security Groups', methods: ['GET', 'POST'], isConfig: true },
          { path: '/cluster/firewall/rules', label: 'Rules', methods: ['GET', 'POST'], isConfig: true },
          { path: '/cluster/firewall/aliases', label: 'Aliases', methods: ['GET', 'POST'], isConfig: true },
          { path: '/cluster/firewall/ipset', label: 'IP Sets', methods: ['GET', 'POST'], isConfig: true },
          { path: '/cluster/firewall/options', label: 'Options', methods: ['GET', 'PUT'], isConfig: true },
          { path: '/cluster/firewall/macros', label: 'Macros', methods: ['GET'], isConfig: false },
          { path: '/cluster/firewall/refs', label: 'References', methods: ['GET'], isConfig: false },
        ]
      },
      {
        path: '/cluster/ha',
        label: 'HA',
        methods: ['GET'],
        isConfig: false,
        children: [
          { path: '/cluster/ha/resources', label: 'Resources', methods: ['GET', 'POST'], isConfig: true },
          { path: '/cluster/ha/groups', label: 'Groups', methods: ['GET', 'POST'], isConfig: true },
          { path: '/cluster/ha/status', label: 'Status', methods: ['GET'], isConfig: false },
        ]
      },
      { path: '/cluster/backup', label: 'Backup', methods: ['GET', 'POST'], isConfig: true },
      { path: '/cluster/backup-info', label: 'Backup Info', methods: ['GET'], isConfig: false },
      { path: '/cluster/replication', label: 'Replication', methods: ['GET', 'POST'], isConfig: true },
      { path: '/cluster/acme', label: 'ACME', methods: ['GET'], isConfig: false },
      { path: '/cluster/ceph', label: 'Ceph', methods: ['GET'], isConfig: false },
      { path: '/cluster/jobs', label: 'Jobs', methods: ['GET'], isConfig: false },
      { path: '/cluster/mapping', label: 'Mapping', methods: ['GET'], isConfig: false },
      { path: '/cluster/metrics', label: 'Metrics', methods: ['GET'], isConfig: false },
      { path: '/cluster/notifications', label: 'Notifications', methods: ['GET'], isConfig: false },
      { path: '/cluster/options', label: 'Options', methods: ['GET', 'PUT'], isConfig: true },
      { path: '/cluster/sdn', label: 'SDN', methods: ['GET'], isConfig: false },
      { path: '/cluster/resources', label: 'Resources', methods: ['GET'], isConfig: false },
      { path: '/cluster/status', label: 'Status', methods: ['GET'], isConfig: false },
      { path: '/cluster/tasks', label: 'Tasks', methods: ['GET'], isConfig: false },
      { path: '/cluster/log', label: 'Log', methods: ['GET'], isConfig: false },
      { path: '/cluster/nextid', label: 'Next ID', methods: ['GET'], isConfig: false },
    ]
  },
  {
    path: '/nodes',
    label: 'Nodes',
    methods: ['GET'],
    isConfig: false,
    // Children are dynamic based on available nodes
  },
  {
    path: '/access',
    label: 'Access Control',
    methods: ['GET'],
    isConfig: false,
    children: [
      { path: '/access/users', label: 'Users', methods: ['GET', 'POST'], isConfig: true },
      { path: '/access/groups', label: 'Groups', methods: ['GET', 'POST'], isConfig: true },
      { path: '/access/roles', label: 'Roles', methods: ['GET', 'POST'], isConfig: true },
      { path: '/access/acl', label: 'ACL', methods: ['GET', 'PUT'], isConfig: true },
      { path: '/access/domains', label: 'Authentication Domains', methods: ['GET', 'POST'], isConfig: true },
      { path: '/access/tfa', label: 'Two-Factor Auth', methods: ['GET', 'POST'], isConfig: true },
      { path: '/access/openid', label: 'OpenID', methods: ['GET', 'POST'], isConfig: true },
      { path: '/access/permissions', label: 'Permissions', methods: ['GET'], isConfig: false },
    ]
  },
  {
    path: '/pools',
    label: 'Pools',
    methods: ['GET', 'POST'],
    isConfig: true,
  },
  {
    path: '/storage',
    label: 'Storage',
    methods: ['GET', 'POST'],
    isConfig: true,
  },
  {
    path: '/version',
    label: 'Version',
    methods: ['GET'],
    isConfig: false,
  },
];
```

---

## Part 3: Frontend Components

### 3.1 New Layout with Tree Navigation

**File: `src/components/layout/TenantLayout.tsx`**

A new layout component that includes:
- Tenant header with breadcrumb navigation
- Collapsible tree sidebar for Proxmox API navigation
- Main content area for viewing/editing

```text
+------------------------------------------------------------------+
| [Logo] Proxmox VNC Nexus | ACME Corp  | [User Menu] [Theme]      |
+------------------------------------------------------------------+
| Tree Menu (280px)          | Content Area                        |
|                            |                                      |
| v Cluster                  | +----------------------------------+ |
|   > Config                 | | Cluster Status                   | |
|   > Firewall               | |                                  | |
|   > HA                     | | Nodes: 3 online                  | |
|   > Backup                 | | Quorum: OK                       | |
|   > Options                | | Version: 8.1                     | |
|   > Status                 | |                                  | |
|   > Tasks                  | +----------------------------------+ |
|   > Log                    |                                      |
| v Nodes                    |                                      |
|   > pve1                   |                                      |
|     > QEMU                 |                                      |
|     > LXC                  |                                      |
|     > Storage              |                                      |
|   > pve2                   |                                      |
| > Access Control           |                                      |
| > Pools                    |                                      |
| > Storage                  |                                      |
+----------------------------+--------------------------------------+
```

### 3.2 API Tree Navigation Component

**File: `src/components/proxmox/ApiTreeNav.tsx`**

Features:
- Collapsible tree structure using Radix Collapsible
- Dynamic node loading for `/nodes` endpoint
- Visual indicators for config vs view-only endpoints
- Active state highlighting
- Search/filter capability

### 3.3 API Content Viewer/Editor

**File: `src/components/proxmox/ApiContentPanel.tsx`**

Two modes:
1. **View Mode** (isConfig: false)
   - Read-only display of API data
   - Refresh button to reload
   - JSON/Table toggle for data display
   
2. **Config Mode** (isConfig: true)
   - Form-based editor with validation
   - Parameter inputs based on API schema
   - Save/Cancel buttons
   - Diff view for changes

### 3.4 Tenant Selector Page

**File: `src/pages/TenantSelector.tsx`**

For admins to select which tenant to manage:
- Grid of tenant cards with status indicators
- Quick stats (servers, VMs, storage)
- Create new tenant button
- Search/filter tenants

### 3.5 Tenant Dashboard

**File: `src/pages/TenantDashboard.tsx`**

Overview page showing:
- Environment summary (nodes, VMs, storage, network)
- Server health status
- Recent activity/tasks
- Quick actions

---

## Part 4: New Pages and Routes

### 4.1 Route Structure

```typescript
// New routes to add to App.tsx
const routes = [
  // Existing routes...
  
  // Tenant management (admin only)
  { path: "/tenants", element: <TenantSelector /> },
  { path: "/tenants/new", element: <TenantCreate /> },
  { path: "/tenants/:tenantId", element: <TenantDashboard /> },
  
  // Proxmox API Explorer (within tenant context)
  { path: "/tenants/:tenantId/cluster/*", element: <ProxmoxApiExplorer section="cluster" /> },
  { path: "/tenants/:tenantId/nodes/*", element: <ProxmoxApiExplorer section="nodes" /> },
  { path: "/tenants/:tenantId/access/*", element: <ProxmoxApiExplorer section="access" /> },
  { path: "/tenants/:tenantId/pools/*", element: <ProxmoxApiExplorer section="pools" /> },
  { path: "/tenants/:tenantId/storage/*", element: <ProxmoxApiExplorer section="storage" /> },
  
  // Config settings pages
  { path: "/tenants/:tenantId/config/:configPath", element: <ProxmoxConfigEditor /> },
];
```

---

## Part 5: Edge Function Updates

### 5.1 Enhanced Proxmox API Proxy

**File: `supabase/functions/proxmox-api/index.ts`**

Update to support:
- Tenant-aware server selection
- Multiple server aggregation for cluster-level data
- Caching of configuration data
- Write operations with validation

```typescript
interface ProxmoxApiRequest {
  tenantId: string;
  serverId?: string; // Optional, auto-select if not provided
  path: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: Record<string, unknown>;
  aggregateFromAll?: boolean; // For cluster resources
}
```

### 5.2 New Tenant Management Edge Function

**File: `supabase/functions/tenants/index.ts`**

Actions:
- `list`: Get all tenants user has access to
- `create`: Create new tenant (admin only)
- `update`: Update tenant details
- `delete`: Delete tenant and all associated data
- `get-stats`: Get tenant statistics (servers, VMs, etc.)

---

## Part 6: Type Updates

**File: `src/lib/types.ts`**

```typescript
// Add new types
export interface Tenant {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logo_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface TenantStats {
  servers: number;
  activeServers: number;
  totalVMs: number;
  runningVMs: number;
  totalStorage: number;
  usedStorage: number;
}

export interface UserTenantAssignment {
  id: string;
  user_id: string;
  tenant_id: string;
  role: 'admin' | 'manager' | 'viewer';
  created_at: string;
}

export interface ProxmoxApiConfig {
  id: string;
  tenant_id: string;
  server_id: string;
  config_path: string;
  config_data: Record<string, unknown>;
  last_synced_at: string | null;
}

export interface ApiTreeNode {
  path: string;
  label: string;
  isConfig: boolean;
  isExpanded?: boolean;
  isLoading?: boolean;
  children?: ApiTreeNode[];
  data?: unknown;
}
```

---

## Part 7: Navigation Updates

### 7.1 Updated Dashboard Layout

**File: `src/components/layout/DashboardLayout.tsx`**

Add tenant context and navigation:
- Tenant switcher in header (for users with multi-tenant access)
- Update sidebar to show Proxmox API tree when in tenant context
- Breadcrumb navigation

### 7.2 New Navigation Items

```typescript
// When in tenant context, show these nav items
const tenantNavItems = [
  { label: "Overview", href: `/tenants/${tenantId}`, icon: LayoutDashboard },
  { label: "Cluster", href: `/tenants/${tenantId}/cluster`, icon: Server },
  { label: "Nodes", href: `/tenants/${tenantId}/nodes`, icon: HardDrive },
  { label: "Access", href: `/tenants/${tenantId}/access`, icon: Shield },
  { label: "Pools", href: `/tenants/${tenantId}/pools`, icon: Layers },
  { label: "Storage", href: `/tenants/${tenantId}/storage`, icon: Database },
  { label: "Servers", href: `/tenants/${tenantId}/servers`, icon: Server },
];
```

---

## Part 8: Implementation Order

| Step | Task | Files |
|------|------|-------|
| 1 | Database migration for tenants and configs | SQL migration |
| 2 | Create tenant types | `src/lib/types.ts` |
| 3 | Create API tree configuration | `src/config/proxmoxApiTree.ts` |
| 4 | Create tenants edge function | `supabase/functions/tenants/index.ts` |
| 5 | Update proxmox-api edge function | `supabase/functions/proxmox-api/index.ts` |
| 6 | Create TenantLayout component | `src/components/layout/TenantLayout.tsx` |
| 7 | Create ApiTreeNav component | `src/components/proxmox/ApiTreeNav.tsx` |
| 8 | Create ApiContentPanel component | `src/components/proxmox/ApiContentPanel.tsx` |
| 9 | Create TenantSelector page | `src/pages/TenantSelector.tsx` |
| 10 | Create TenantDashboard page | `src/pages/TenantDashboard.tsx` |
| 11 | Create ProxmoxApiExplorer page | `src/pages/ProxmoxApiExplorer.tsx` |
| 12 | Create ProxmoxConfigEditor page | `src/pages/ProxmoxConfigEditor.tsx` |
| 13 | Update App.tsx with new routes | `src/App.tsx` |
| 14 | Update DashboardLayout for tenant context | `src/components/layout/DashboardLayout.tsx` |
| 15 | Create useTenants hook | `src/hooks/useTenants.ts` |
| 16 | Create useProxmoxApi hook | `src/hooks/useProxmoxApi.ts` |
| 17 | Deploy edge functions | Deployment |

---

## Summary of New Components

| Component | Purpose |
|-----------|---------|
| **TenantLayout** | Layout wrapper with tree navigation for tenant context |
| **ApiTreeNav** | Collapsible tree menu mirroring Proxmox API structure |
| **ApiContentPanel** | View/edit panel for API data |
| **TenantSelector** | Grid of tenant cards for admin selection |
| **TenantDashboard** | Overview dashboard for selected tenant |
| **ProxmoxApiExplorer** | Main page for browsing API endpoints |
| **ProxmoxConfigEditor** | Form-based editor for config endpoints |

---

## UI/UX Features

### Tree Navigation
- Expand/collapse with chevron icons
- Visual distinction between config (wrench icon) and view-only (eye icon) endpoints
- Loading states for async data
- Active state highlighting with blue accent
- Keyboard navigation support

### Config Editor
- Dynamic form generation based on API parameters
- Field validation with error messages
- Preview changes before saving
- Undo/redo support
- Auto-save draft to localStorage

### View Panel
- Table view for lists (users, VMs, etc.)
- JSON view with syntax highlighting
- Export to CSV/JSON
- Refresh with loading indicator
- Pagination for large datasets

---

## Security Considerations

1. **Tenant Isolation**: RLS policies ensure users only see tenants they're assigned to
2. **Role-Based Access**: Tenant roles (admin/manager/viewer) control write permissions
3. **API Token Scope**: Each server's token is only used for that server's requests
4. **Audit Logging**: Track config changes with user and timestamp
5. **Config Validation**: Server-side validation before applying changes

---

## Dashboard Environment Display

The tenant dashboard will show a comprehensive environment overview:

```text
+------------------------------------------------------------------+
|                    Environment Overview                           |
+------------------------------------------------------------------+
|  +----------------+  +----------------+  +----------------+       |
|  | Nodes          |  | Virtual Machines|  | Containers    |       |
|  | 3 online       |  | 24 running      |  | 8 running     |       |
|  | 0 offline      |  | 5 stopped       |  | 2 stopped     |       |
|  +----------------+  +----------------+  +----------------+       |
|                                                                   |
|  +----------------+  +----------------+  +----------------+       |
|  | CPU Usage      |  | Memory Usage   |  | Storage        |       |
|  | [======  ] 45% |  | [========] 78% |  | 2.4TB / 10TB  |       |
|  | avg across 3   |  | avg across 3   |  | 24% used      |       |
|  +----------------+  +----------------+  +----------------+       |
|                                                                   |
|  +---------------------------------------------------------------+|
|  | Server Health                                                  ||
|  | +------------------+------------------+------------------+     ||
|  | | pve1.local       | pve2.local       | pve3.local       |     ||
|  | | * Online         | * Online         | * Online         |     ||
|  | | CPU: 32% Mem: 65%| CPU: 45% Mem: 82%| CPU: 58% Mem: 71%|     ||
|  | +------------------+------------------+------------------+     ||
|  +---------------------------------------------------------------+|
+------------------------------------------------------------------+
```

This provides a complete at-a-glance view of the entire Proxmox environment for the selected tenant.
