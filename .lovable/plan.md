
# Fix Profile Loading and Update - Supabase Schema Configuration Issue

## Problem Identified
The profile page fails to load and updates fail because the **PostgREST API is configured to only expose the `api` schema**, but all application tables (profiles, tenants, user_roles, etc.) are in the `public` schema.

### Error Evidence
```
PGRST106: The schema must be one of the following: api
```

This error occurs when:
- The frontend client queries the `profiles` table
- Edge functions query any table (`profiles`, `user_roles`, `tenants`, `user_tenant_assignments`)

## Root Cause
In the Supabase Dashboard, under **Settings > API > Exposed schemas**, only the `api` schema is configured. The `public` schema needs to be added for the application to work.

## Solution

### Step 1: Update Supabase Dashboard Configuration (Manual Step Required)
You need to update the PostgREST configuration in the Supabase Dashboard:

1. Go to [Supabase Dashboard](https://supabase.com/dashboard/project/lbfabewnshfjdjfosqxl/settings/api)
2. Navigate to **Settings > API**
3. Scroll to **Exposed schemas** section
4. Add `public` to the list of exposed schemas (it should read: `api, public` or just `public`)
5. Click **Save**

This change will allow the REST API to access tables in the `public` schema.

### Step 2: Verify Configuration (After Manual Step)
After updating the exposed schemas, the following will work:
- Profile loading on `/profile` page
- Profile updates (full_name, username, company_name)
- Tenant listing and management
- User role checks
- All other database operations

## Why This Happened
This is an external Supabase project (not Lovable Cloud). The project was configured with restricted API schema exposure - likely for security or migration purposes. However, since all application tables are in the `public` schema, this restriction breaks all functionality.

## Technical Details

| Component | Issue |
|-----------|-------|
| Profile.tsx line 43-47 | Queries `profiles` table - fails with PGRST106 |
| Profile.tsx line 113-121 | Updates `profiles` table - fails with PGRST106 |
| tenants edge function | Queries `user_roles`, `tenants`, `profiles` - fails with PGRST106 |
| list-vms edge function | Queries tenant/server data - likely affected |

## Alternative Solution (If Schema Change Not Possible)
If the `api` schema restriction is intentional and cannot be changed, an alternative would be to:
1. Create views in the `api` schema that expose needed data from `public` schema
2. Update all code to reference the `api` schema views

However, this is significantly more work and the simpler solution is to add `public` to the exposed schemas.

## Files That Will Work After Fix
No code changes needed - once the Supabase configuration is updated:
- `src/pages/Profile.tsx` - Profile loading and saving
- `supabase/functions/tenants/index.ts` - Tenant operations
- `supabase/functions/list-vms/index.ts` - VM listing
- All other edge functions querying public schema tables
