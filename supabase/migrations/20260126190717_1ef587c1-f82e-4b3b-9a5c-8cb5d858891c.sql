-- Create tenant role enum
CREATE TYPE public.tenant_role AS ENUM ('admin', 'manager', 'viewer');

-- Create tenants table
CREATE TABLE public.tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  description text,
  logo_url text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid
);

-- Enable RLS on tenants
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

-- Create user_tenant_assignments table
CREATE TABLE public.user_tenant_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  role tenant_role NOT NULL DEFAULT 'viewer',
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, tenant_id)
);

-- Enable RLS on user_tenant_assignments
ALTER TABLE public.user_tenant_assignments ENABLE ROW LEVEL SECURITY;

-- Add tenant_id to proxmox_servers
ALTER TABLE public.proxmox_servers 
ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id) ON DELETE SET NULL;

-- Create index for tenant queries
CREATE INDEX IF NOT EXISTS idx_proxmox_servers_tenant ON public.proxmox_servers(tenant_id);

-- Create proxmox_api_configs table for storing config data
CREATE TABLE public.proxmox_api_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  server_id uuid NOT NULL REFERENCES public.proxmox_servers(id) ON DELETE CASCADE,
  config_path text NOT NULL,
  config_data jsonb NOT NULL DEFAULT '{}',
  last_synced_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(server_id, config_path)
);

-- Enable RLS on proxmox_api_configs
ALTER TABLE public.proxmox_api_configs ENABLE ROW LEVEL SECURITY;

-- Create security definer function for tenant role checking
CREATE OR REPLACE FUNCTION public.has_tenant_role(_user_id uuid, _tenant_id uuid, _roles tenant_role[])
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_tenant_assignments
    WHERE user_id = _user_id
      AND tenant_id = _tenant_id
      AND role = ANY(_roles)
  )
$$;

-- Create function to check if user has access to any tenant
CREATE OR REPLACE FUNCTION public.user_has_tenant_access(_user_id uuid, _tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_tenant_assignments
    WHERE user_id = _user_id
      AND tenant_id = _tenant_id
  )
$$;

-- RLS Policies for tenants table
CREATE POLICY "Users can view tenants they belong to"
ON public.tenants FOR SELECT
USING (
  public.has_role(auth.uid(), 'admin'::app_role) OR
  public.user_has_tenant_access(auth.uid(), id)
);

CREATE POLICY "Admins can insert tenants"
ON public.tenants FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update tenants"
ON public.tenants FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete tenants"
ON public.tenants FOR DELETE
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for user_tenant_assignments table
CREATE POLICY "Users can view their own tenant assignments"
ON public.user_tenant_assignments FOR SELECT
USING (
  auth.uid() = user_id OR
  public.has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Admins can insert tenant assignments"
ON public.user_tenant_assignments FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update tenant assignments"
ON public.user_tenant_assignments FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete tenant assignments"
ON public.user_tenant_assignments FOR DELETE
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for proxmox_api_configs table
CREATE POLICY "Users can view configs for their tenants"
ON public.proxmox_api_configs FOR SELECT
USING (
  public.has_role(auth.uid(), 'admin'::app_role) OR
  public.user_has_tenant_access(auth.uid(), tenant_id)
);

CREATE POLICY "Tenant admins can insert configs"
ON public.proxmox_api_configs FOR INSERT
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role) OR
  public.has_tenant_role(auth.uid(), tenant_id, ARRAY['admin'::tenant_role, 'manager'::tenant_role])
);

CREATE POLICY "Tenant admins can update configs"
ON public.proxmox_api_configs FOR UPDATE
USING (
  public.has_role(auth.uid(), 'admin'::app_role) OR
  public.has_tenant_role(auth.uid(), tenant_id, ARRAY['admin'::tenant_role, 'manager'::tenant_role])
);

CREATE POLICY "Tenant admins can delete configs"
ON public.proxmox_api_configs FOR DELETE
USING (
  public.has_role(auth.uid(), 'admin'::app_role) OR
  public.has_tenant_role(auth.uid(), tenant_id, ARRAY['admin'::tenant_role])
);

-- Update trigger for updated_at
CREATE TRIGGER update_tenants_updated_at
BEFORE UPDATE ON public.tenants
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_proxmox_api_configs_updated_at
BEFORE UPDATE ON public.proxmox_api_configs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();