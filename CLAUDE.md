# CLAUDE.md - Proxmox VNC Nexus

## Project Overview

Multi-tenant web application that acts as a secure connection broker for Proxmox VE clusters. Provides browser-based VNC console access via noVNC WebSocket relay, multi-server management (up to 50 servers per tenant), RBAC, real-time status updates, connection metrics, and audit logging.

## Tech Stack

- **Frontend**: React 18 + TypeScript + Vite (port 8080) + Tailwind CSS + shadcn/ui
- **Backend**: Supabase (Auth, PostgreSQL with RLS, Edge Functions on Deno, Realtime)
- **State**: TanStack Query for server state, React context for auth/theme
- **VNC**: @novnc/novnc for browser-based console access
- **Routing**: React Router v6 with lazy-loaded routes

## Quick Commands

```bash
npm install          # Install dependencies
npm run dev          # Start dev server on port 8080
npm run build        # Production build
npm run build:dev    # Development build
npm run lint         # ESLint
npm run preview      # Preview production build
```

## Project Structure

```
src/
  components/
    auth/           # Login/Signup, AuthProvider
    console/        # VNC ConsoleViewer (noVNC)
    dashboard/      # VM cards, tables, metrics charts
    layout/         # DashboardLayout, TenantLayout
    proxmox/        # API tree navigator, content panels
    servers/        # Server management UI
    theme/          # ThemeProvider, ThemeToggle
    ui/             # shadcn/ui library (51 components)
  pages/            # Route-based pages (20 files, lazy-loaded)
  hooks/            # Custom React hooks (20 files, prefixed with use)
  lib/
    types.ts        # All TypeScript interfaces (~350 lines)
    api.ts          # Edge Function API helpers + APIException
    constants.ts    # App config constants (intervals, limits, URLs)
    utils.ts        # Utility functions (cn, etc.)
  integrations/supabase/
    client.ts       # Supabase client singleton
    types.ts        # Auto-generated database types
  config/
    proxmoxApiTree.ts  # Proxmox API endpoint tree structure
  App.tsx           # Root component with providers and routes
  main.tsx          # React DOM entry point

supabase/
  config.toml       # Supabase project config
  migrations/       # 13 SQL schema migrations
  functions/        # 13+ Edge Functions (Deno runtime)
    _shared/        # Shared utilities (proxmox-utils.ts)
    list-vms/       # Fetch VM list from Proxmox
    vm-console/     # Get VNC console ticket
    vm-actions/     # Power control operations
    vnc-relay/      # WebSocket proxy for VNC
    proxmox-api/    # Generic Proxmox API proxy
    proxmox-servers/  # Server CRUD
    connection-metrics/  # Metrics logging/retrieval
    connectivity-test/   # Server connectivity testing
    tenants/        # Tenant management
    tenant-settings/  # Tenant configuration
    tenant-stats/   # Dashboard statistics
    audit-log/      # Query audit logs
    delete-user/    # Admin user deletion
    vm-rrd-data/    # Performance data

docs/               # Comprehensive documentation (README, ARCHITECTURE, API, SECURITY, etc.)
```

## Key Architecture Patterns

### Path Alias
`@/` maps to `./src/` — always use absolute imports.

### Component Hierarchy
App > ThemeProvider > QueryClientProvider > BrowserRouter > AuthProvider > Routes

### API Calls
All Proxmox API calls are proxied through Supabase Edge Functions. Never call Proxmox directly from the frontend.

```typescript
// Pattern: POST to Edge Function with auth header
const response = await fetch(`${SUPABASE_URL}/functions/v1/<function-name>`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ ... })
});
```

API helpers are in `src/lib/api.ts`. Use `APIException` for error handling.

### State Management
- **Auth state**: `useAuth()` hook via AuthProvider context
- **Server data**: TanStack Query hooks (`useVMs`, `useProxmoxServers`, `useTenants`, etc.)
- **Real-time**: Supabase Realtime subscriptions in `useServerRealtimeUpdates`
- **Theme**: next-themes via ThemeProvider

### Database Security
PostgreSQL Row-Level Security (RLS) enforced on all tables. Key helper functions:
- `has_role(user_id, role)` — check global app role
- `has_tenant_role(user_id, tenant_id, roles[])` — check tenant-specific role
- `user_has_tenant_access(user_id, tenant_id)` — check any tenant access

### Multi-Tenancy
Users belong to tenants via `user_tenant_assignments` with roles: admin, manager, viewer. Tenant context flows through routes (`/tenants/:tenantId/*`) and is enforced in both frontend guards and RLS policies.

## Coding Conventions

- **Components**: Functional components with hooks, PascalCase filenames
- **Hooks**: One per file, `use` prefix, camelCase filenames
- **Types**: Centralized in `src/lib/types.ts`, interface-based
- **Styling**: Tailwind utility classes, HSL CSS variables for theming, dark mode via `class` strategy
- **UI components**: shadcn/ui in `src/components/ui/`, configured via `components.json`
- **Error feedback**: Toast notifications via Sonner
- **Icons**: Lucide React exclusively

## TypeScript Configuration

- `strict: false`, `noImplicitAny: false`, `strictNullChecks: false`
- ES2020 target, ESNext modules
- Path alias: `@/*` -> `./src/*`

## Environment Variables

Frontend (`.env`, prefixed with `VITE_`):
- `VITE_SUPABASE_URL` — Supabase project URL
- `VITE_SUPABASE_PUBLISHABLE_KEY` — Supabase anon key (safe for client)
- `VITE_SUPABASE_PROJECT_ID` — Supabase project ID

Edge Functions (set in Supabase Dashboard):
- `PROXMOX_ENCRYPTION_KEY` — Token encryption key
- `SUPABASE_SERVICE_ROLE_KEY` — Admin operations

## Database Schema (Key Tables)

| Table | Purpose |
|-------|---------|
| `tenants` | Multi-tenant organizations |
| `proxmox_servers` | Proxmox cluster connections (encrypted tokens) |
| `profiles` | User profiles (linked to auth.users) |
| `user_roles` | Global roles (admin, user) |
| `user_tenant_assignments` | Tenant roles (admin, manager, viewer) |
| `user_vm_assignments` | Per-VM access control |
| `connection_sessions` | VNC session tracking |
| `connection_metrics` | Performance metrics (24h history) |
| `audit_logs` | Action audit trail |
| `tenant_settings` | Tenant customization and alert thresholds |

## Testing

No test framework configured yet. When adding tests:
- Use Vitest (compatible with Vite) for unit/component tests
- React Testing Library for component testing
- Edge Functions can be tested via Supabase CLI

## Important Notes

- **No Prettier**: Only ESLint is configured for linting
- **Bun lockfile**: `bun.lockb` exists but `npm` is the primary package manager
- **Deployment**: Via Lovable platform (managed Vite deployment)
- **Supabase Project ID**: `lbfabewnshfjdjfosqxl`
- **Build versioning**: `BUILD_VERSION` constant in `main.tsx` for cache invalidation
- **JWT verification**: Disabled in `config.toml`; validated in Edge Function code instead
- **Token encryption**: XOR cipher used for Proxmox API tokens (see `_shared/proxmox-utils.ts`)
