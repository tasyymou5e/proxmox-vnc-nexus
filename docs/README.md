# Proxmox VNC Nexus - Documentation

A multi-tenant Proxmox VE connection broker enabling secure VM console access through a modern web interface.

## 📚 Documentation Index

| Document | Description |
|----------|-------------|
| [README.md](./README.md) | This file - Overview, architecture, and technical reference |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Detailed system architecture with Mermaid diagrams |
| [API.md](./API.md) | Edge Function API reference and examples |
| [DEPLOYMENT.md](./DEPLOYMENT.md) | Production deployment guide |
| [SECURITY.md](./SECURITY.md) | Security model, RLS policies, and best practices |
| [CONTRIBUTING.md](./CONTRIBUTING.md) | Contribution guidelines and development setup |
| [CHANGELOG.md](./CHANGELOG.md) | Version history and release notes |
| [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) | Common issues and solutions |

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Technology Stack](#technology-stack)
- [Database Schema](#database-schema)
- [Security Model](#security-model)
- [Features](#features)
- [Edge Functions](#edge-functions)
- [Component Structure](#component-structure)
- [Configuration](#configuration)

---

## Overview

Proxmox VNC Nexus is a web application that acts as a connection broker for Proxmox VE clusters. It allows authenticated users to:

- **List and manage VMs** from multiple Proxmox servers
- **Access VM consoles** via noVNC in the browser
- **Perform VM actions** (start, stop, reset, shutdown)
- **Monitor server health** with real-time status updates
- **Manage multi-tenant environments** with role-based access control

### Key Capabilities

| Feature | Description |
|---------|-------------|
| Multi-Server Support | Connect up to 50 Proxmox VE servers per tenant |
| Encrypted Credentials | API tokens encrypted server-side with XOR encryption |
| Real-Time Updates | Supabase Realtime for live server status changes |
| VNC Console | Browser-based console access via noVNC WebSocket relay |
| Multi-Tenancy | Isolated tenant environments with RBAC |
| Audit Logging | Track all user actions and system events |
| Connection Metrics | 24-hour history charts with success rates |

---

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (React)                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│  │   Auth UI   │  │  Dashboard  │  │    Console Viewer       │ │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Supabase Edge Functions                       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│  │  list-vms   │  │  vm-actions │  │      vnc-relay          │ │
│  │  vm-console │  │proxmox-api  │  │  connection-metrics     │ │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Proxmox VE Clusters                           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│  │   Node 1    │  │   Node 2    │  │        Node N           │ │
│  │  VMs/LXCs   │  │  VMs/LXCs   │  │       VMs/LXCs          │ │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### API Proxy Pattern

All Proxmox API calls are proxied through Supabase Edge Functions to:
- Bypass CORS restrictions (Proxmox doesn't support CORS)
- Validate JWT authentication
- Decrypt stored API tokens
- Enforce tenant/server access control
- Log connection metrics

```typescript
// Frontend → Edge Function → Proxmox API
const { data } = await supabase.functions.invoke("list-vms", {
  body: { serverId, tenantId },
});
```

### VNC Console Architecture

```
Browser (noVNC RFB) ←→ vnc-relay Edge Function ←→ Proxmox VNC WebSocket
         ↑                      ↑                        ↑
    Canvas/WebGL          Bidirectional            VNC Protocol
                          Message Relay            (Port 5900+)
```

---

## Technology Stack

### Frontend

| Technology | Version | Purpose |
|------------|---------|---------|
| React | 18.3.1 | UI Framework |
| TypeScript | 5.x | Type Safety |
| Vite | 5.x | Build Tool |
| Tailwind CSS | 3.x | Styling |
| shadcn/ui | Latest | Component Library |
| TanStack Query | 5.x | Server State Management |
| React Router | 6.x | Client-Side Routing |
| Recharts | 2.x | Data Visualization |
| @novnc/novnc | 1.6.0 | VNC Client |

### Backend

| Technology | Purpose |
|------------|---------|
| Supabase | Auth, Database, Edge Functions, Realtime |
| PostgreSQL | Data Storage with RLS |
| Deno | Edge Function Runtime |

### Design System

```css
/* Primary Proxmox-inspired colors */
--primary: 217 91% 60%;        /* Proxmox Blue */
--primary-foreground: 210 40% 98%;
--destructive: 0 84% 60%;      /* Error Red */
--success: 142 76% 36%;        /* Online Green */
--warning: 38 92% 50%;         /* Warning Orange */
```

---

## Database Schema

### Tables Overview

```
┌─────────────────┐     ┌─────────────────────┐
│     tenants     │────<│ user_tenant_assign- │
│                 │     │       ments         │
└─────────────────┘     └─────────────────────┘
        │                        │
        │                        │
        ▼                        ▼
┌─────────────────┐     ┌─────────────────────┐
│ proxmox_servers │     │      profiles       │
└─────────────────┘     └─────────────────────┘
        │                        │
        │                        │
        ▼                        ▼
┌─────────────────┐     ┌─────────────────────┐
│connection_metrics│    │     user_roles      │
└─────────────────┘     └─────────────────────┘
```

### Core Tables

#### `tenants`
Organizations/companies in the multi-tenant system.

```sql
CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  logo_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

#### `proxmox_servers`
Proxmox VE server connections with encrypted credentials.

```sql
CREATE TABLE proxmox_servers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  tenant_id UUID REFERENCES tenants(id),
  name TEXT NOT NULL,
  host TEXT NOT NULL,
  port INTEGER DEFAULT 8006,
  api_token_encrypted TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  connection_status TEXT DEFAULT 'unknown',
  use_tailscale BOOLEAN DEFAULT false,
  tailscale_hostname TEXT,
  connection_timeout INTEGER DEFAULT 10000,
  last_health_check_at TIMESTAMPTZ,
  health_check_error TEXT,
  avg_response_time_ms INTEGER,
  success_rate NUMERIC,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

#### `user_roles`
Global application roles (admin/user).

```sql
CREATE TYPE app_role AS ENUM ('admin', 'user');

CREATE TABLE user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  role app_role DEFAULT 'user',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id)
);
```

#### `user_tenant_assignments`
Tenant-specific roles (admin/manager/viewer).

```sql
CREATE TYPE tenant_role AS ENUM ('admin', 'manager', 'viewer');

CREATE TABLE user_tenant_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  tenant_id UUID REFERENCES tenants(id) NOT NULL,
  role tenant_role DEFAULT 'viewer',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, tenant_id)
);
```

### Database Functions

```sql
-- Check global app role
CREATE FUNCTION has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Check tenant-specific role
CREATE FUNCTION has_tenant_role(_user_id UUID, _tenant_id UUID, _roles tenant_role[])
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_tenant_assignments
    WHERE user_id = _user_id 
      AND tenant_id = _tenant_id 
      AND role = ANY(_roles)
  )
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Check any tenant access
CREATE FUNCTION user_has_tenant_access(_user_id UUID, _tenant_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_tenant_assignments
    WHERE user_id = _user_id AND tenant_id = _tenant_id
  )
$$ LANGUAGE sql STABLE SECURITY DEFINER;
```

---

## Security Model

### Authentication Flow

```
1. User submits credentials
        ↓
2. Supabase Auth validates
        ↓
3. JWT token issued
        ↓
4. AuthProvider stores session
        ↓
5. Role check via user_roles table
        ↓
6. Tenant access check via user_tenant_assignments
```

### Row-Level Security (RLS)

All tables use RLS policies with `SECURITY DEFINER` functions to prevent recursive policy evaluation.

#### Example: Server Access Policy

```sql
-- Users can only view servers in their tenant
CREATE POLICY "Users can view tenant servers"
ON proxmox_servers FOR SELECT
USING (
  has_role(auth.uid(), 'admin') 
  OR user_has_tenant_access(auth.uid(), tenant_id)
);

-- Only tenant admins/managers can create servers
CREATE POLICY "Tenant admins/managers can insert servers"
ON proxmox_servers FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'admin') 
  OR has_tenant_role(auth.uid(), tenant_id, ARRAY['admin', 'manager'])
);
```

### API Token Encryption

```typescript
// Server-side encryption in Edge Functions
function encryptToken(token: string, key: string): string {
  const keyBytes = new TextEncoder().encode(key);
  const tokenBytes = new TextEncoder().encode(token);
  const encrypted = new Uint8Array(tokenBytes.length);
  
  for (let i = 0; i < tokenBytes.length; i++) {
    encrypted[i] = tokenBytes[i] ^ keyBytes[i % keyBytes.length];
  }
  
  return btoa(String.fromCharCode(...encrypted));
}
```

### Role Hierarchy

```
Global Roles (app_role):
├── admin: Full system access, manage all tenants
└── user: Access assigned tenants only

Tenant Roles (tenant_role):
├── admin: Full tenant control, manage users/servers
├── manager: Manage servers and VMs, view users
└── viewer: Read-only access to assigned resources
```

---

## Features

### 1. Multi-Server Management

- Add/edit/delete Proxmox servers per tenant
- Encrypted API token storage
- Optional Tailscale integration for private networks
- Health check monitoring with learned timeouts
- CSV bulk import for server migration

### 2. VNC Console Access

```typescript
// Console connection flow
1. Request VNC ticket from Proxmox via vm-console function
2. Receive ticket, port, and WebSocket URL
3. Connect noVNC RFB client to vnc-relay function
4. Relay proxies bidirectional WebSocket traffic
5. Display VM console in browser canvas
```

Features:
- Fullscreen mode toggle
- Clipboard sharing (Ctrl+Shift+V)
- Send Ctrl+Alt+Del signal
- Auto-reconnect on disconnect
- Connection status indicators

### 3. Real-Time Updates

```typescript
// Supabase Realtime subscription
supabase.channel(`servers-${tenantId}`)
  .on('postgres_changes', {
    event: 'UPDATE',
    schema: 'public',
    table: 'proxmox_servers',
    filter: `tenant_id=eq.${tenantId}`,
  }, handleServerUpdate)
  .subscribe();
```

Updates include:
- Server connection status changes
- Health check results
- New connection metrics

### 4. Connection Metrics & History

24-hour time-series data with:
- Success rate percentage
- Average response times
- Hourly aggregation for charts
- Real-time chart updates via Realtime subscriptions

### 5. Audit Logging

All significant actions are logged:
- User authentication events
- VM power actions
- Server configuration changes
- Permission modifications

---

## Edge Functions

### Function Reference

| Function | Purpose | JWT Required |
|----------|---------|--------------|
| `list-vms` | Fetch VMs from Proxmox | Yes |
| `vm-console` | Get VNC ticket for console | Yes |
| `vm-actions` | Start/stop/reset VMs | Yes |
| `vnc-relay` | WebSocket proxy for VNC | Yes |
| `proxmox-api` | Generic Proxmox API proxy | Yes |
| `proxmox-servers` | CRUD for server configs | Yes |
| `connection-metrics` | Record/query metrics | Yes |
| `connectivity-test` | Test server connectivity | Yes |
| `tenants` | Tenant management | Yes |
| `tenant-settings` | Tenant configuration | Yes |
| `tenant-stats` | Dashboard statistics | Yes |
| `audit-log` | Query audit logs | Yes |
| `delete-user` | Admin user deletion | Yes |

### Shared Utilities

```typescript
// supabase/functions/_shared/proxmox-utils.ts

export async function getProxmoxCredentials(
  supabase: SupabaseClient,
  userId: string,
  serverId?: string
): Promise<ProxmoxCredentials> {
  // Fetches and decrypts credentials from database
  // Falls back to environment variables if no serverId
}

export function decryptToken(encrypted: string, key: string): string {
  // XOR decryption for API tokens
}
```

---

## Component Structure

### Directory Layout

```
src/
├── components/
│   ├── auth/           # Login, Signup, AuthProvider
│   ├── console/        # ConsoleViewer (noVNC)
│   ├── dashboard/      # VMCard, VMTable, ResourceMeter
│   ├── layout/         # DashboardLayout, TenantLayout
│   ├── proxmox/        # ApiTreeNav, ApiContentPanel
│   ├── servers/        # Server management components
│   ├── theme/          # ThemeProvider, ThemeToggle
│   └── ui/             # shadcn/ui components
├── hooks/
│   ├── useVMs.ts              # VM operations
│   ├── useProxmoxServers.ts   # Server CRUD
│   ├── useTenants.ts          # Tenant operations
│   ├── useConnectionHistory.ts # Metrics queries
│   └── useServerRealtimeUpdates.ts # Realtime subscriptions
├── pages/
│   ├── Index.tsx              # Landing/redirect
│   ├── Login.tsx              # Authentication
│   ├── Dashboard.tsx          # Admin dashboard
│   ├── TenantDashboard.tsx    # Tenant home
│   ├── Console.tsx            # VNC viewer
│   └── ProxmoxServers.tsx     # Server management
└── lib/
    ├── types.ts         # TypeScript interfaces
    ├── utils.ts         # Utility functions
    ├── constants.ts     # App constants
    └── api.ts           # API helpers
```

### Key Components

#### ConsoleViewer
```typescript
// Renders noVNC canvas with controls
<ConsoleViewer
  websocketUrl={connection.websocketUrl}
  ticket={connection.ticket}
  onDisconnect={handleDisconnect}
/>
```

#### VMQuickActions
```typescript
// VM power controls + console button
<VMQuickActions
  vm={vm}
  onAction={handleAction}
  isLoading={isPending}
/>
```

#### ConnectionHistoryChart
```typescript
// 24-hour metrics visualization
<ConnectionHistoryChart
  serverId={server.id}
  serverName={server.name}
/>
```

---

## Configuration

### Environment Variables

#### Supabase Secrets (Edge Functions)

| Secret | Description |
|--------|-------------|
| `PROXMOX_HOST` | Default Proxmox host |
| `PROXMOX_PORT` | Default Proxmox port (8006) |
| `PROXMOX_API_TOKEN` | Default API token |
| `PROXMOX_ENCRYPTION_KEY` | Key for token encryption |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_ANON_KEY` | Supabase anonymous key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key |

### Supabase Configuration

```toml
# supabase/config.toml
project_id = "lbfabewnshfjdjfosqxl"

[functions.proxmox-api]
verify_jwt = false  # JWT validated in code

[functions.list-vms]
verify_jwt = false

[functions.vm-console]
verify_jwt = false

[functions.vnc-relay]
verify_jwt = false
```

### Realtime Configuration

```sql
-- Enable Realtime for live updates
ALTER PUBLICATION supabase_realtime ADD TABLE proxmox_servers;
ALTER PUBLICATION supabase_realtime ADD TABLE connection_metrics;
```

---

## Development

### Getting Started

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

### Testing Edge Functions

```bash
# Deploy function
supabase functions deploy list-vms

# View logs
supabase functions logs list-vms --follow
```

### Browser Requirements

- Chrome 89+ (top-level await)
- Firefox 89+
- Safari 15+
- Edge 89+

---

## API Reference

See [API.md](./API.md) for detailed endpoint documentation.

## Troubleshooting

See [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) for common issues and solutions.
