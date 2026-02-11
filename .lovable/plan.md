
# Switch from Public Schema to API Schema

## Overview
This plan migrates the application from using the `public` schema to the `api` schema for all database operations. Since the Supabase project is configured to only expose the `api` schema via the REST API, all database access must go through views and functions in the `api` schema.

## Current State Analysis

### Tables in Public Schema (11 tables)
| Table | Purpose |
|-------|---------|
| `profiles` | User profile information |
| `user_roles` | System-level user roles (admin/user) |
| `tenants` | Multi-tenant organizations |
| `user_tenant_assignments` | User-to-tenant role mappings |
| `tenant_settings` | Per-tenant configuration |
| `proxmox_servers` | Proxmox server connections |
| `proxmox_api_configs` | Proxmox API configurations |
| `connection_metrics` | Server connection history |
| `connection_sessions` | VNC console sessions |
| `audit_logs` | Activity audit trail |
| `user_vm_assignments` | User-to-VM permissions |

### Components Affected

**Frontend Files (10 files):**
- `src/pages/Admin.tsx` - Queries profiles, user_roles, user_vm_assignments
- `src/pages/Profile.tsx` - Queries/updates profiles
- `src/pages/ServerMonitoring.tsx` - Queries proxmox_servers
- `src/pages/NotificationsCenter.tsx` - Queries audit_logs
- `src/pages/VMMonitoring.tsx` - Queries proxmox_servers
- `src/components/auth/AuthProvider.tsx` - Queries user_roles
- `src/components/servers/ServerComparisonView.tsx` - Queries proxmox_servers
- `src/hooks/useConnectionHealthAlerts.ts` - Queries tenant_settings, proxmox_servers, audit_logs
- `src/hooks/useTenantPermissions.ts` - Queries user_tenant_assignments
- `src/hooks/useConnectivityTest.ts` - Updates proxmox_servers

**Realtime Subscriptions (3 files):**
- `src/hooks/useServerRealtimeUpdates.ts` - Subscribes to proxmox_servers
- `src/hooks/useRealtimeNotifications.ts` - Subscribes to audit_logs
- `src/hooks/useConnectionMetricsRealtime.ts` - Subscribes to connection_metrics

**Edge Functions (12 functions):**
- `list-vms` - Queries user_roles, proxmox_servers, user_vm_assignments
- `tenants` - Queries user_roles, tenants, user_tenant_assignments, profiles
- `tenant-stats` - Queries proxmox_servers
- `tenant-settings` - Queries tenant_settings, audit_logs
- `audit-log` - Queries audit_logs
- `proxmox-servers` - CRUD on proxmox_servers
- `vm-console` - Queries user_roles, user_vm_assignments, connection_sessions
- `vm-actions` - Queries user_roles, user_vm_assignments, audit_logs
- `delete-user` - Cleanup across multiple tables
- `connectivity-test` - Queries proxmox_servers, connection_metrics
- `connection-metrics` - Queries connection_metrics, proxmox_servers
- `_shared/proxmox-utils.ts` - Queries proxmox_servers

---

## Implementation Strategy

### Phase 1: Database Migration (SQL)
Create views in the `api` schema that expose data from `public` schema tables with proper security.

```sql
-- Create api schema if not exists
CREATE SCHEMA IF NOT EXISTS api;

-- Grant usage on api schema
GRANT USAGE ON SCHEMA api TO anon, authenticated, service_role;

-- Create views for each table with security_invoker
-- This ensures RLS policies from public schema are respected

CREATE OR REPLACE VIEW api.profiles
WITH (security_invoker=on) AS
SELECT * FROM public.profiles;

CREATE OR REPLACE VIEW api.user_roles
WITH (security_invoker=on) AS
SELECT * FROM public.user_roles;

CREATE OR REPLACE VIEW api.tenants
WITH (security_invoker=on) AS
SELECT * FROM public.tenants;

CREATE OR REPLACE VIEW api.user_tenant_assignments
WITH (security_invoker=on) AS
SELECT * FROM public.user_tenant_assignments;

CREATE OR REPLACE VIEW api.tenant_settings
WITH (security_invoker=on) AS
SELECT * FROM public.tenant_settings;

CREATE OR REPLACE VIEW api.proxmox_servers
WITH (security_invoker=on) AS
SELECT * FROM public.proxmox_servers;

CREATE OR REPLACE VIEW api.proxmox_api_configs
WITH (security_invoker=on) AS
SELECT * FROM public.proxmox_api_configs;

CREATE OR REPLACE VIEW api.connection_metrics
WITH (security_invoker=on) AS
SELECT * FROM public.connection_metrics;

CREATE OR REPLACE VIEW api.connection_sessions
WITH (security_invoker=on) AS
SELECT * FROM public.connection_sessions;

CREATE OR REPLACE VIEW api.audit_logs
WITH (security_invoker=on) AS
SELECT * FROM public.audit_logs;

CREATE OR REPLACE VIEW api.user_vm_assignments
WITH (security_invoker=on) AS
SELECT * FROM public.user_vm_assignments;

-- Grant SELECT on all views
GRANT SELECT ON ALL TABLES IN SCHEMA api TO anon, authenticated;

-- Grant INSERT, UPDATE, DELETE on views (requires rules or instead-of triggers)
-- For each view, create INSTEAD OF triggers to handle mutations

-- Example for profiles:
CREATE OR REPLACE FUNCTION api.profiles_insert()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles VALUES (NEW.*);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION api.profiles_update()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.profiles SET
    full_name = NEW.full_name,
    username = NEW.username,
    company_name = NEW.company_name,
    avatar_url = NEW.avatar_url,
    email = NEW.email,
    updated_at = NEW.updated_at
  WHERE id = OLD.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION api.profiles_delete()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM public.profiles WHERE id = OLD.id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER profiles_insert_trigger
  INSTEAD OF INSERT ON api.profiles
  FOR EACH ROW EXECUTE FUNCTION api.profiles_insert();

CREATE TRIGGER profiles_update_trigger
  INSTEAD OF UPDATE ON api.profiles
  FOR EACH ROW EXECUTE FUNCTION api.profiles_update();

CREATE TRIGGER profiles_delete_trigger
  INSTEAD OF DELETE ON api.profiles
  FOR EACH ROW EXECUTE FUNCTION api.profiles_delete();

-- Similar triggers needed for all other views that require mutations
```

### Phase 2: Update Supabase Client Configuration
Modify the Supabase client to use the `api` schema by default.

**File: `src/integrations/supabase/client.ts`**
```typescript
export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  },
  db: {
    schema: 'api'  // Add this to use api schema
  }
});
```

### Phase 3: Update Edge Functions
All edge functions need to specify the `api` schema when creating the Supabase client.

**Example change for each edge function:**
```typescript
const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_ANON_KEY")!,
  { 
    global: { headers: { Authorization: authHeader } },
    db: { schema: 'api' }  // Add this
  }
);
```

### Phase 4: Update Realtime Subscriptions
Change schema references in realtime subscriptions from `public` to `api`.

**Files to update:**
- `src/hooks/useServerRealtimeUpdates.ts`: Line 70 - change `schema: "public"` to `schema: "api"`
- `src/hooks/useRealtimeNotifications.ts`: Line 82 - change `schema: "public"` to `schema: "api"`  
- `src/hooks/useConnectionMetricsRealtime.ts`: Line 22 - change `schema: "public"` to `schema: "api"`

---

## Files to Modify

### Database Migration
| Change | Description |
|--------|-------------|
| SQL Migration | Create 11 views in `api` schema with INSTEAD OF triggers for mutations |

### Frontend Code (1 file)
| File | Change |
|------|--------|
| `src/integrations/supabase/client.ts` | Add `db: { schema: 'api' }` to client config |

### Realtime Hooks (3 files)
| File | Change |
|------|--------|
| `src/hooks/useServerRealtimeUpdates.ts` | Change schema from `public` to `api` |
| `src/hooks/useRealtimeNotifications.ts` | Change schema from `public` to `api` |
| `src/hooks/useConnectionMetricsRealtime.ts` | Change schema from `public` to `api` |

### Edge Functions (13 files)
| File | Change |
|------|--------|
| `supabase/functions/list-vms/index.ts` | Add schema config to Supabase client |
| `supabase/functions/tenants/index.ts` | Add schema config to Supabase client |
| `supabase/functions/tenant-stats/index.ts` | Add schema config to Supabase client |
| `supabase/functions/tenant-settings/index.ts` | Add schema config to Supabase client |
| `supabase/functions/audit-log/index.ts` | Add schema config to Supabase client |
| `supabase/functions/proxmox-servers/index.ts` | Add schema config to Supabase client |
| `supabase/functions/vm-console/index.ts` | Add schema config to Supabase client |
| `supabase/functions/vm-actions/index.ts` | Add schema config to Supabase client |
| `supabase/functions/delete-user/index.ts` | Add schema config to Supabase client |
| `supabase/functions/connectivity-test/index.ts` | Add schema config to Supabase client |
| `supabase/functions/connection-metrics/index.ts` | Add schema config to Supabase client |
| `supabase/functions/vm-rrd-data/index.ts` | Add schema config to Supabase client |
| `supabase/functions/_shared/proxmox-utils.ts` | Add schema config to Supabase client |

---

## Technical Considerations

### Views with security_invoker
Using `security_invoker=on` ensures that RLS policies from the underlying `public` schema tables are respected. The view executes with the permissions of the calling user, not the view owner.

### INSTEAD OF Triggers
Views don't support INSERT/UPDATE/DELETE directly. INSTEAD OF triggers intercept these operations and redirect them to the underlying tables. Each table requiring mutations needs:
- Insert trigger function
- Update trigger function  
- Delete trigger function

### Realtime Subscriptions
Supabase Realtime can listen to changes on views in the `api` schema, but the underlying table must have replication enabled. Since the base tables are in `public`, realtime should continue to work.

### RPC Functions
The existing RPC functions (`has_role`, `has_tenant_role`, `user_has_tenant_access`) are defined in `public` schema and should continue to work when called from the `api` schema context.

---

## Implementation Order

1. **Database Migration First** - Create all views and triggers in `api` schema
2. **Test Views** - Verify SELECT/INSERT/UPDATE/DELETE work through views
3. **Update Frontend Client** - Change schema in Supabase client config
4. **Update Realtime Hooks** - Change schema references
5. **Update Edge Functions** - Add schema config to all functions
6. **Deploy and Test** - Verify all functionality works

---

## Rollback Plan
If issues arise, the changes can be rolled back by:
1. Removing `db: { schema: 'api' }` from client configurations
2. Reverting realtime schema references to `public`
3. Re-exposing `public` schema in Supabase API settings

The views in `api` schema can remain - they don't affect the `public` schema and can be used later.
