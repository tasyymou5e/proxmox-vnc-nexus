-- Tenant Settings Table
CREATE TABLE public.tenant_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE UNIQUE,
  
  -- Branding
  primary_color text DEFAULT '#3b82f6',
  secondary_color text DEFAULT '#1e40af',
  accent_color text DEFAULT '#f59e0b',
  logo_url text,
  
  -- Notifications
  notification_email text,
  notify_on_server_offline boolean DEFAULT true,
  notify_on_vm_action boolean DEFAULT false,
  notify_on_user_changes boolean DEFAULT true,
  
  -- Default Configurations
  default_connection_timeout integer DEFAULT 10000,
  default_verify_ssl boolean DEFAULT true,
  auto_health_check_interval integer DEFAULT 300000,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.tenant_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for tenant_settings
CREATE POLICY "Users can view their tenant settings"
  ON public.tenant_settings FOR SELECT
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR 
    user_has_tenant_access(auth.uid(), tenant_id)
  );

CREATE POLICY "Tenant admins can insert settings"
  ON public.tenant_settings FOR INSERT
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_tenant_role(auth.uid(), tenant_id, ARRAY['admin']::tenant_role[])
  );

CREATE POLICY "Tenant admins can update settings"
  ON public.tenant_settings FOR UPDATE
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_tenant_role(auth.uid(), tenant_id, ARRAY['admin']::tenant_role[])
  );

CREATE POLICY "Tenant admins can delete settings"
  ON public.tenant_settings FOR DELETE
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_tenant_role(auth.uid(), tenant_id, ARRAY['admin']::tenant_role[])
  );

-- Trigger for updated_at
CREATE TRIGGER update_tenant_settings_updated_at
BEFORE UPDATE ON public.tenant_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Audit Logs Table
CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  
  action_type text NOT NULL,
  resource_type text NOT NULL,
  resource_id text,
  resource_name text,
  
  details jsonb DEFAULT '{}',
  ip_address text,
  user_agent text,
  
  created_at timestamptz DEFAULT now()
);

-- Indexes for efficient queries
CREATE INDEX idx_audit_logs_tenant_created ON public.audit_logs(tenant_id, created_at DESC);
CREATE INDEX idx_audit_logs_action_type ON public.audit_logs(tenant_id, action_type, created_at DESC);
CREATE INDEX idx_audit_logs_user_id ON public.audit_logs(user_id, created_at DESC);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Only admins and tenant admins can view audit logs (SELECT only - immutable)
CREATE POLICY "Tenant admins can view audit logs"
  ON public.audit_logs FOR SELECT
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_tenant_role(auth.uid(), tenant_id, ARRAY['admin']::tenant_role[])
  );

-- System can insert audit logs (via service role)
CREATE POLICY "Service can insert audit logs"
  ON public.audit_logs FOR INSERT
  WITH CHECK (true);

-- Connection Metrics Table
CREATE TABLE public.connection_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id uuid NOT NULL REFERENCES public.proxmox_servers(id) ON DELETE CASCADE,
  
  success boolean NOT NULL,
  response_time_ms integer,
  error_message text,
  
  used_tailscale boolean DEFAULT false,
  timeout_used_ms integer,
  retry_count integer DEFAULT 0,
  
  created_at timestamptz DEFAULT now()
);

-- Index for efficient queries
CREATE INDEX idx_connection_metrics_server_created ON public.connection_metrics(server_id, created_at DESC);

ALTER TABLE public.connection_metrics ENABLE ROW LEVEL SECURITY;

-- Metrics inherit server access
CREATE POLICY "Users can view metrics for their servers"
  ON public.connection_metrics FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.proxmox_servers ps
      WHERE ps.id = server_id
      AND (
        has_role(auth.uid(), 'admin'::app_role) OR 
        user_has_tenant_access(auth.uid(), ps.tenant_id)
      )
    )
  );

CREATE POLICY "Service can insert metrics"
  ON public.connection_metrics FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Service can delete old metrics"
  ON public.connection_metrics FOR DELETE
  USING (true);

-- Add learned timeout columns to proxmox_servers
ALTER TABLE public.proxmox_servers 
ADD COLUMN IF NOT EXISTS learned_timeout_ms integer,
ADD COLUMN IF NOT EXISTS avg_response_time_ms integer,
ADD COLUMN IF NOT EXISTS success_rate numeric(5,2);