-- Update RLS policies for proxmox_servers to use tenant-scoped access instead of user-scoped

-- First, add an index for tenant queries
CREATE INDEX IF NOT EXISTS idx_proxmox_servers_tenant ON public.proxmox_servers(tenant_id);

-- Drop existing user-based policies
DROP POLICY IF EXISTS "Users can view their own servers" ON public.proxmox_servers;
DROP POLICY IF EXISTS "Users can insert their own servers" ON public.proxmox_servers;
DROP POLICY IF EXISTS "Users can update their own servers" ON public.proxmox_servers;
DROP POLICY IF EXISTS "Users can delete their own servers" ON public.proxmox_servers;
DROP POLICY IF EXISTS "Admins can view all servers" ON public.proxmox_servers;

-- Create new tenant-based policies

-- SELECT: Users can view servers in their assigned tenants, or system admins can view all
CREATE POLICY "Users can view tenant servers"
  ON public.proxmox_servers FOR SELECT
  USING (
    has_role(auth.uid(), 'admin') OR 
    user_has_tenant_access(auth.uid(), tenant_id)
  );

-- INSERT: Tenant admins/managers can add servers to their tenants
CREATE POLICY "Tenant admins/managers can insert servers"
  ON public.proxmox_servers FOR INSERT
  WITH CHECK (
    has_role(auth.uid(), 'admin') OR 
    has_tenant_role(auth.uid(), tenant_id, ARRAY['admin', 'manager']::tenant_role[])
  );

-- UPDATE: Tenant admins/managers can update servers in their tenants
CREATE POLICY "Tenant admins/managers can update servers"
  ON public.proxmox_servers FOR UPDATE
  USING (
    has_role(auth.uid(), 'admin') OR 
    has_tenant_role(auth.uid(), tenant_id, ARRAY['admin', 'manager']::tenant_role[])
  );

-- DELETE: Only tenant admins can delete servers
CREATE POLICY "Tenant admins can delete servers"
  ON public.proxmox_servers FOR DELETE
  USING (
    has_role(auth.uid(), 'admin') OR 
    has_tenant_role(auth.uid(), tenant_id, ARRAY['admin']::tenant_role[])
  );

-- Also update user_tenant_assignments to allow tenant admins to manage users
DROP POLICY IF EXISTS "Admins can delete tenant assignments" ON public.user_tenant_assignments;
DROP POLICY IF EXISTS "Admins can insert tenant assignments" ON public.user_tenant_assignments;
DROP POLICY IF EXISTS "Admins can update tenant assignments" ON public.user_tenant_assignments;

-- INSERT: System admins or tenant admins can add users to tenants
CREATE POLICY "Admins can insert tenant assignments"
  ON public.user_tenant_assignments FOR INSERT
  WITH CHECK (
    has_role(auth.uid(), 'admin') OR 
    has_tenant_role(auth.uid(), tenant_id, ARRAY['admin']::tenant_role[])
  );

-- UPDATE: System admins or tenant admins can update user roles in tenants
CREATE POLICY "Admins can update tenant assignments"
  ON public.user_tenant_assignments FOR UPDATE
  USING (
    has_role(auth.uid(), 'admin') OR 
    has_tenant_role(auth.uid(), tenant_id, ARRAY['admin']::tenant_role[])
  );

-- DELETE: System admins or tenant admins can remove users from tenants
CREATE POLICY "Admins can delete tenant assignments"
  ON public.user_tenant_assignments FOR DELETE
  USING (
    has_role(auth.uid(), 'admin') OR 
    has_tenant_role(auth.uid(), tenant_id, ARRAY['admin']::tenant_role[])
  );