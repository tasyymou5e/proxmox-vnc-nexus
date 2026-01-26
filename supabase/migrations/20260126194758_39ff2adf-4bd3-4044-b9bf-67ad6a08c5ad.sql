-- Fix the overly permissive INSERT policies by restricting them to authenticated users only
-- These policies are used by edge functions with service role, but we'll make them more explicit

-- Drop the permissive policies
DROP POLICY IF EXISTS "Service can insert audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Service can insert metrics" ON public.connection_metrics;
DROP POLICY IF EXISTS "Service can delete old metrics" ON public.connection_metrics;

-- Recreate with proper restrictions - audit logs can only be inserted by authenticated users
-- The edge functions use service role which bypasses RLS anyway
CREATE POLICY "Authenticated users can insert audit logs"
  ON public.audit_logs FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Connection metrics - only users with access to the server's tenant can insert
CREATE POLICY "Users can insert metrics for accessible servers"
  ON public.connection_metrics FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.proxmox_servers ps
      WHERE ps.id = server_id
      AND (
        has_role(auth.uid(), 'admin'::app_role) OR 
        user_has_tenant_access(auth.uid(), ps.tenant_id)
      )
    )
  );

-- Only admins can delete old metrics (for cleanup)
CREATE POLICY "Admins can delete metrics"
  ON public.connection_metrics FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));