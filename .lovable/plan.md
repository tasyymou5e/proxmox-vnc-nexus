

# Fix Build Errors Across Edge Functions

All build errors fall into two categories that need a consistent fix across all edge function files.

## Error Category 1: Schema Type Mismatch (`'api'` is not assignable to `'never'`)

The Supabase client doesn't have type definitions for the `api` schema, so TypeScript rejects `schema('api')` and function parameters typed as `ReturnType<typeof createClient>`. The fix is to use `as any` type assertions where needed.

**Affected files and fixes:**
- `_shared/proxmox-utils.ts` (line 33): Remove `.schema('api')` call since the client is already configured with `db: { schema: 'api' }` by callers. Also change the `supabase` parameter type to `any` to avoid type conflicts when passed from other functions.
- `list-vms/index.ts` (lines 168, 217, 232): Change `filterAndEnrichVMs` parameter type from `ReturnType<typeof createClient>` to `any`.
- `connection-metrics/index.ts` (lines 88, 104, 235): Change `updateServerStats` parameter type to `any`.
- `proxmox-servers/index.ts` (lines 126, 133, 140, 361, 546, 563, 635): Change `checkTenantAccess` parameter type to `any`, and add `!` non-null assertions on `testResponse`.

## Error Category 2: `'error' is of type 'unknown'`

All `catch(error)` blocks need `(error as Error).message` instead of `error.message`.

**Affected files:**
- `admin-actions/index.ts` (line 162)
- `audit-log/index.ts` (line 223)
- `connection-metrics/index.ts` (line 229)
- `connectivity-test/index.ts` (lines 207, 210, 212, 214, 243)
- `delete-user/index.ts` (line 103)
- `list-vms/index.ts` (lines 212, 226)
- `proxmox-api/index.ts` (line 95)
- `proxmox-servers/index.ts` (lines 599, 607, 812)
- `tenant-stats/index.ts` (lines 73, 283)
- `vm-actions/index.ts` (lines 161, 222)
- `vm-console/index.ts` (lines 99, 155)
- `vm-rrd-data/index.ts` (line 130)
- `tenant-settings/index.ts` (line 41 - audit_logs insert type issue)
- `vnc-relay/index.ts` (line 228)

## Technical Details

### Fix pattern for schema types
Change helper function signatures from:
```typescript
async function myHelper(supabase: ReturnType<typeof createClient>, ...) {
```
To:
```typescript
async function myHelper(supabase: any, ...) {
```

### Fix pattern for proxmox-utils.ts
Remove the `.schema('api')` call on line 33 since the supabase client already has the schema configured:
```typescript
const { data: server, error } = await supabase
  .from("proxmox_servers")
  .select(...)
```

### Fix pattern for unknown errors
Change all `catch (error)` to use casting:
```typescript
} catch (error) {
  return jsonResponse({ error: (error as Error).message || "Internal server error" }, 500);
}
```

### Fix for tenant-settings audit_logs insert
Cast the insert payload with `as any` to bypass the schema type mismatch.

### Fix for proxmox-servers testResponse null check
Add non-null assertion or guard on `testResponse` at lines 546 and 563.

## Files to Modify (14 total)
1. `supabase/functions/_shared/proxmox-utils.ts`
2. `supabase/functions/list-vms/index.ts`
3. `supabase/functions/connection-metrics/index.ts`
4. `supabase/functions/connectivity-test/index.ts`
5. `supabase/functions/proxmox-api/index.ts`
6. `supabase/functions/proxmox-servers/index.ts`
7. `supabase/functions/vnc-relay/index.ts`
8. `supabase/functions/admin-actions/index.ts`
9. `supabase/functions/audit-log/index.ts`
10. `supabase/functions/delete-user/index.ts`
11. `supabase/functions/tenant-settings/index.ts`
12. `supabase/functions/tenant-stats/index.ts`
13. `supabase/functions/vm-actions/index.ts`
14. `supabase/functions/vm-console/index.ts`
15. `supabase/functions/vm-rrd-data/index.ts`

