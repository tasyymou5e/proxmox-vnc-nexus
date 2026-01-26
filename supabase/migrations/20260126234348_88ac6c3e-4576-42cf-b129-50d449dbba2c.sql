-- Create api schema if not exists
CREATE SCHEMA IF NOT EXISTS api;

-- Grant usage on api schema
GRANT USAGE ON SCHEMA api TO anon, authenticated, service_role;

-- ============================================
-- Create views for each table with security_invoker
-- ============================================

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
GRANT INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA api TO authenticated;

-- ============================================
-- INSTEAD OF triggers for profiles
-- ============================================
CREATE OR REPLACE FUNCTION api.profiles_insert()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, username, company_name, avatar_url, created_at, updated_at)
  VALUES (NEW.id, NEW.email, NEW.full_name, NEW.username, NEW.company_name, NEW.avatar_url, COALESCE(NEW.created_at, now()), COALESCE(NEW.updated_at, now()));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION api.profiles_update()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.profiles SET
    full_name = NEW.full_name,
    username = NEW.username,
    company_name = NEW.company_name,
    avatar_url = NEW.avatar_url,
    email = NEW.email,
    updated_at = COALESCE(NEW.updated_at, now())
  WHERE id = OLD.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION api.profiles_delete()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM public.profiles WHERE id = OLD.id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS profiles_insert_trigger ON api.profiles;
CREATE TRIGGER profiles_insert_trigger
  INSTEAD OF INSERT ON api.profiles
  FOR EACH ROW EXECUTE FUNCTION api.profiles_insert();

DROP TRIGGER IF EXISTS profiles_update_trigger ON api.profiles;
CREATE TRIGGER profiles_update_trigger
  INSTEAD OF UPDATE ON api.profiles
  FOR EACH ROW EXECUTE FUNCTION api.profiles_update();

DROP TRIGGER IF EXISTS profiles_delete_trigger ON api.profiles;
CREATE TRIGGER profiles_delete_trigger
  INSTEAD OF DELETE ON api.profiles
  FOR EACH ROW EXECUTE FUNCTION api.profiles_delete();

-- ============================================
-- INSTEAD OF triggers for user_roles
-- ============================================
CREATE OR REPLACE FUNCTION api.user_roles_insert()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_roles (id, user_id, role, created_at)
  VALUES (COALESCE(NEW.id, gen_random_uuid()), NEW.user_id, NEW.role, COALESCE(NEW.created_at, now()));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION api.user_roles_update()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.user_roles SET role = NEW.role WHERE id = OLD.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION api.user_roles_delete()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM public.user_roles WHERE id = OLD.id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS user_roles_insert_trigger ON api.user_roles;
CREATE TRIGGER user_roles_insert_trigger
  INSTEAD OF INSERT ON api.user_roles
  FOR EACH ROW EXECUTE FUNCTION api.user_roles_insert();

DROP TRIGGER IF EXISTS user_roles_update_trigger ON api.user_roles;
CREATE TRIGGER user_roles_update_trigger
  INSTEAD OF UPDATE ON api.user_roles
  FOR EACH ROW EXECUTE FUNCTION api.user_roles_update();

DROP TRIGGER IF EXISTS user_roles_delete_trigger ON api.user_roles;
CREATE TRIGGER user_roles_delete_trigger
  INSTEAD OF DELETE ON api.user_roles
  FOR EACH ROW EXECUTE FUNCTION api.user_roles_delete();

-- ============================================
-- INSTEAD OF triggers for tenants
-- ============================================
CREATE OR REPLACE FUNCTION api.tenants_insert()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.tenants (id, name, slug, description, logo_url, is_active, created_by, created_at, updated_at)
  VALUES (COALESCE(NEW.id, gen_random_uuid()), NEW.name, NEW.slug, NEW.description, NEW.logo_url, COALESCE(NEW.is_active, true), NEW.created_by, COALESCE(NEW.created_at, now()), COALESCE(NEW.updated_at, now()));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION api.tenants_update()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.tenants SET
    name = NEW.name,
    slug = NEW.slug,
    description = NEW.description,
    logo_url = NEW.logo_url,
    is_active = NEW.is_active,
    updated_at = COALESCE(NEW.updated_at, now())
  WHERE id = OLD.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION api.tenants_delete()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM public.tenants WHERE id = OLD.id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS tenants_insert_trigger ON api.tenants;
CREATE TRIGGER tenants_insert_trigger
  INSTEAD OF INSERT ON api.tenants
  FOR EACH ROW EXECUTE FUNCTION api.tenants_insert();

DROP TRIGGER IF EXISTS tenants_update_trigger ON api.tenants;
CREATE TRIGGER tenants_update_trigger
  INSTEAD OF UPDATE ON api.tenants
  FOR EACH ROW EXECUTE FUNCTION api.tenants_update();

DROP TRIGGER IF EXISTS tenants_delete_trigger ON api.tenants;
CREATE TRIGGER tenants_delete_trigger
  INSTEAD OF DELETE ON api.tenants
  FOR EACH ROW EXECUTE FUNCTION api.tenants_delete();

-- ============================================
-- INSTEAD OF triggers for user_tenant_assignments
-- ============================================
CREATE OR REPLACE FUNCTION api.user_tenant_assignments_insert()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_tenant_assignments (id, user_id, tenant_id, role, created_at)
  VALUES (COALESCE(NEW.id, gen_random_uuid()), NEW.user_id, NEW.tenant_id, COALESCE(NEW.role, 'viewer'), COALESCE(NEW.created_at, now()));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION api.user_tenant_assignments_update()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.user_tenant_assignments SET role = NEW.role WHERE id = OLD.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION api.user_tenant_assignments_delete()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM public.user_tenant_assignments WHERE id = OLD.id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS user_tenant_assignments_insert_trigger ON api.user_tenant_assignments;
CREATE TRIGGER user_tenant_assignments_insert_trigger
  INSTEAD OF INSERT ON api.user_tenant_assignments
  FOR EACH ROW EXECUTE FUNCTION api.user_tenant_assignments_insert();

DROP TRIGGER IF EXISTS user_tenant_assignments_update_trigger ON api.user_tenant_assignments;
CREATE TRIGGER user_tenant_assignments_update_trigger
  INSTEAD OF UPDATE ON api.user_tenant_assignments
  FOR EACH ROW EXECUTE FUNCTION api.user_tenant_assignments_update();

DROP TRIGGER IF EXISTS user_tenant_assignments_delete_trigger ON api.user_tenant_assignments;
CREATE TRIGGER user_tenant_assignments_delete_trigger
  INSTEAD OF DELETE ON api.user_tenant_assignments
  FOR EACH ROW EXECUTE FUNCTION api.user_tenant_assignments_delete();

-- ============================================
-- INSTEAD OF triggers for tenant_settings
-- ============================================
CREATE OR REPLACE FUNCTION api.tenant_settings_insert()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.tenant_settings (id, tenant_id, primary_color, secondary_color, accent_color, logo_url, notification_email, notify_on_server_offline, notify_on_vm_action, notify_on_user_changes, default_connection_timeout, default_verify_ssl, auto_health_check_interval, alert_success_rate_threshold, alert_latency_threshold_ms, alert_offline_duration_seconds, created_at, updated_at)
  VALUES (COALESCE(NEW.id, gen_random_uuid()), NEW.tenant_id, NEW.primary_color, NEW.secondary_color, NEW.accent_color, NEW.logo_url, NEW.notification_email, NEW.notify_on_server_offline, NEW.notify_on_vm_action, NEW.notify_on_user_changes, NEW.default_connection_timeout, NEW.default_verify_ssl, NEW.auto_health_check_interval, NEW.alert_success_rate_threshold, NEW.alert_latency_threshold_ms, NEW.alert_offline_duration_seconds, COALESCE(NEW.created_at, now()), COALESCE(NEW.updated_at, now()));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION api.tenant_settings_update()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.tenant_settings SET
    primary_color = NEW.primary_color,
    secondary_color = NEW.secondary_color,
    accent_color = NEW.accent_color,
    logo_url = NEW.logo_url,
    notification_email = NEW.notification_email,
    notify_on_server_offline = NEW.notify_on_server_offline,
    notify_on_vm_action = NEW.notify_on_vm_action,
    notify_on_user_changes = NEW.notify_on_user_changes,
    default_connection_timeout = NEW.default_connection_timeout,
    default_verify_ssl = NEW.default_verify_ssl,
    auto_health_check_interval = NEW.auto_health_check_interval,
    alert_success_rate_threshold = NEW.alert_success_rate_threshold,
    alert_latency_threshold_ms = NEW.alert_latency_threshold_ms,
    alert_offline_duration_seconds = NEW.alert_offline_duration_seconds,
    updated_at = COALESCE(NEW.updated_at, now())
  WHERE id = OLD.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION api.tenant_settings_delete()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM public.tenant_settings WHERE id = OLD.id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS tenant_settings_insert_trigger ON api.tenant_settings;
CREATE TRIGGER tenant_settings_insert_trigger
  INSTEAD OF INSERT ON api.tenant_settings
  FOR EACH ROW EXECUTE FUNCTION api.tenant_settings_insert();

DROP TRIGGER IF EXISTS tenant_settings_update_trigger ON api.tenant_settings;
CREATE TRIGGER tenant_settings_update_trigger
  INSTEAD OF UPDATE ON api.tenant_settings
  FOR EACH ROW EXECUTE FUNCTION api.tenant_settings_update();

DROP TRIGGER IF EXISTS tenant_settings_delete_trigger ON api.tenant_settings;
CREATE TRIGGER tenant_settings_delete_trigger
  INSTEAD OF DELETE ON api.tenant_settings
  FOR EACH ROW EXECUTE FUNCTION api.tenant_settings_delete();

-- ============================================
-- INSTEAD OF triggers for proxmox_servers
-- ============================================
CREATE OR REPLACE FUNCTION api.proxmox_servers_insert()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.proxmox_servers (id, user_id, tenant_id, name, host, port, api_token_encrypted, verify_ssl, is_active, use_tailscale, tailscale_hostname, tailscale_port, connection_timeout, connection_status, last_connected_at, last_health_check_at, health_check_error, learned_timeout_ms, avg_response_time_ms, success_rate, created_at, updated_at)
  VALUES (COALESCE(NEW.id, gen_random_uuid()), NEW.user_id, NEW.tenant_id, NEW.name, NEW.host, COALESCE(NEW.port, 8006), NEW.api_token_encrypted, COALESCE(NEW.verify_ssl, true), COALESCE(NEW.is_active, true), COALESCE(NEW.use_tailscale, false), NEW.tailscale_hostname, NEW.tailscale_port, NEW.connection_timeout, COALESCE(NEW.connection_status, 'unknown'), NEW.last_connected_at, NEW.last_health_check_at, NEW.health_check_error, NEW.learned_timeout_ms, NEW.avg_response_time_ms, NEW.success_rate, COALESCE(NEW.created_at, now()), COALESCE(NEW.updated_at, now()));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION api.proxmox_servers_update()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.proxmox_servers SET
    name = NEW.name,
    host = NEW.host,
    port = NEW.port,
    api_token_encrypted = NEW.api_token_encrypted,
    verify_ssl = NEW.verify_ssl,
    is_active = NEW.is_active,
    use_tailscale = NEW.use_tailscale,
    tailscale_hostname = NEW.tailscale_hostname,
    tailscale_port = NEW.tailscale_port,
    connection_timeout = NEW.connection_timeout,
    connection_status = NEW.connection_status,
    last_connected_at = NEW.last_connected_at,
    last_health_check_at = NEW.last_health_check_at,
    health_check_error = NEW.health_check_error,
    learned_timeout_ms = NEW.learned_timeout_ms,
    avg_response_time_ms = NEW.avg_response_time_ms,
    success_rate = NEW.success_rate,
    updated_at = COALESCE(NEW.updated_at, now())
  WHERE id = OLD.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION api.proxmox_servers_delete()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM public.proxmox_servers WHERE id = OLD.id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS proxmox_servers_insert_trigger ON api.proxmox_servers;
CREATE TRIGGER proxmox_servers_insert_trigger
  INSTEAD OF INSERT ON api.proxmox_servers
  FOR EACH ROW EXECUTE FUNCTION api.proxmox_servers_insert();

DROP TRIGGER IF EXISTS proxmox_servers_update_trigger ON api.proxmox_servers;
CREATE TRIGGER proxmox_servers_update_trigger
  INSTEAD OF UPDATE ON api.proxmox_servers
  FOR EACH ROW EXECUTE FUNCTION api.proxmox_servers_update();

DROP TRIGGER IF EXISTS proxmox_servers_delete_trigger ON api.proxmox_servers;
CREATE TRIGGER proxmox_servers_delete_trigger
  INSTEAD OF DELETE ON api.proxmox_servers
  FOR EACH ROW EXECUTE FUNCTION api.proxmox_servers_delete();

-- ============================================
-- INSTEAD OF triggers for proxmox_api_configs
-- ============================================
CREATE OR REPLACE FUNCTION api.proxmox_api_configs_insert()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.proxmox_api_configs (id, tenant_id, server_id, config_path, config_data, last_synced_at, created_at, updated_at)
  VALUES (COALESCE(NEW.id, gen_random_uuid()), NEW.tenant_id, NEW.server_id, NEW.config_path, COALESCE(NEW.config_data, '{}'), NEW.last_synced_at, COALESCE(NEW.created_at, now()), COALESCE(NEW.updated_at, now()));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION api.proxmox_api_configs_update()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.proxmox_api_configs SET
    config_path = NEW.config_path,
    config_data = NEW.config_data,
    last_synced_at = NEW.last_synced_at,
    updated_at = COALESCE(NEW.updated_at, now())
  WHERE id = OLD.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION api.proxmox_api_configs_delete()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM public.proxmox_api_configs WHERE id = OLD.id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS proxmox_api_configs_insert_trigger ON api.proxmox_api_configs;
CREATE TRIGGER proxmox_api_configs_insert_trigger
  INSTEAD OF INSERT ON api.proxmox_api_configs
  FOR EACH ROW EXECUTE FUNCTION api.proxmox_api_configs_insert();

DROP TRIGGER IF EXISTS proxmox_api_configs_update_trigger ON api.proxmox_api_configs;
CREATE TRIGGER proxmox_api_configs_update_trigger
  INSTEAD OF UPDATE ON api.proxmox_api_configs
  FOR EACH ROW EXECUTE FUNCTION api.proxmox_api_configs_update();

DROP TRIGGER IF EXISTS proxmox_api_configs_delete_trigger ON api.proxmox_api_configs;
CREATE TRIGGER proxmox_api_configs_delete_trigger
  INSTEAD OF DELETE ON api.proxmox_api_configs
  FOR EACH ROW EXECUTE FUNCTION api.proxmox_api_configs_delete();

-- ============================================
-- INSTEAD OF triggers for connection_metrics
-- ============================================
CREATE OR REPLACE FUNCTION api.connection_metrics_insert()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.connection_metrics (id, server_id, success, response_time_ms, error_message, used_tailscale, timeout_used_ms, retry_count, created_at)
  VALUES (COALESCE(NEW.id, gen_random_uuid()), NEW.server_id, NEW.success, NEW.response_time_ms, NEW.error_message, COALESCE(NEW.used_tailscale, false), NEW.timeout_used_ms, COALESCE(NEW.retry_count, 0), COALESCE(NEW.created_at, now()));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION api.connection_metrics_update()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.connection_metrics SET
    success = NEW.success,
    response_time_ms = NEW.response_time_ms,
    error_message = NEW.error_message,
    used_tailscale = NEW.used_tailscale,
    timeout_used_ms = NEW.timeout_used_ms,
    retry_count = NEW.retry_count
  WHERE id = OLD.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION api.connection_metrics_delete()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM public.connection_metrics WHERE id = OLD.id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS connection_metrics_insert_trigger ON api.connection_metrics;
CREATE TRIGGER connection_metrics_insert_trigger
  INSTEAD OF INSERT ON api.connection_metrics
  FOR EACH ROW EXECUTE FUNCTION api.connection_metrics_insert();

DROP TRIGGER IF EXISTS connection_metrics_update_trigger ON api.connection_metrics;
CREATE TRIGGER connection_metrics_update_trigger
  INSTEAD OF UPDATE ON api.connection_metrics
  FOR EACH ROW EXECUTE FUNCTION api.connection_metrics_update();

DROP TRIGGER IF EXISTS connection_metrics_delete_trigger ON api.connection_metrics;
CREATE TRIGGER connection_metrics_delete_trigger
  INSTEAD OF DELETE ON api.connection_metrics
  FOR EACH ROW EXECUTE FUNCTION api.connection_metrics_delete();

-- ============================================
-- INSTEAD OF triggers for connection_sessions
-- ============================================
CREATE OR REPLACE FUNCTION api.connection_sessions_insert()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.connection_sessions (id, user_id, vm_id, node_name, status, started_at, ended_at)
  VALUES (COALESCE(NEW.id, gen_random_uuid()), NEW.user_id, NEW.vm_id, NEW.node_name, COALESCE(NEW.status, 'active'), COALESCE(NEW.started_at, now()), NEW.ended_at);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION api.connection_sessions_update()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.connection_sessions SET
    status = NEW.status,
    ended_at = NEW.ended_at
  WHERE id = OLD.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION api.connection_sessions_delete()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM public.connection_sessions WHERE id = OLD.id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS connection_sessions_insert_trigger ON api.connection_sessions;
CREATE TRIGGER connection_sessions_insert_trigger
  INSTEAD OF INSERT ON api.connection_sessions
  FOR EACH ROW EXECUTE FUNCTION api.connection_sessions_insert();

DROP TRIGGER IF EXISTS connection_sessions_update_trigger ON api.connection_sessions;
CREATE TRIGGER connection_sessions_update_trigger
  INSTEAD OF UPDATE ON api.connection_sessions
  FOR EACH ROW EXECUTE FUNCTION api.connection_sessions_update();

DROP TRIGGER IF EXISTS connection_sessions_delete_trigger ON api.connection_sessions;
CREATE TRIGGER connection_sessions_delete_trigger
  INSTEAD OF DELETE ON api.connection_sessions
  FOR EACH ROW EXECUTE FUNCTION api.connection_sessions_delete();

-- ============================================
-- INSTEAD OF triggers for audit_logs
-- ============================================
CREATE OR REPLACE FUNCTION api.audit_logs_insert()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.audit_logs (id, tenant_id, user_id, action_type, resource_type, resource_id, resource_name, details, ip_address, user_agent, created_at)
  VALUES (COALESCE(NEW.id, gen_random_uuid()), NEW.tenant_id, NEW.user_id, NEW.action_type, NEW.resource_type, NEW.resource_id, NEW.resource_name, COALESCE(NEW.details, '{}'), NEW.ip_address, NEW.user_agent, COALESCE(NEW.created_at, now()));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION api.audit_logs_update()
RETURNS TRIGGER AS $$
BEGIN
  -- Audit logs should not be updated, but provide a no-op
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION api.audit_logs_delete()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM public.audit_logs WHERE id = OLD.id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS audit_logs_insert_trigger ON api.audit_logs;
CREATE TRIGGER audit_logs_insert_trigger
  INSTEAD OF INSERT ON api.audit_logs
  FOR EACH ROW EXECUTE FUNCTION api.audit_logs_insert();

DROP TRIGGER IF EXISTS audit_logs_update_trigger ON api.audit_logs;
CREATE TRIGGER audit_logs_update_trigger
  INSTEAD OF UPDATE ON api.audit_logs
  FOR EACH ROW EXECUTE FUNCTION api.audit_logs_update();

DROP TRIGGER IF EXISTS audit_logs_delete_trigger ON api.audit_logs;
CREATE TRIGGER audit_logs_delete_trigger
  INSTEAD OF DELETE ON api.audit_logs
  FOR EACH ROW EXECUTE FUNCTION api.audit_logs_delete();

-- ============================================
-- INSTEAD OF triggers for user_vm_assignments
-- ============================================
CREATE OR REPLACE FUNCTION api.user_vm_assignments_insert()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_vm_assignments (id, user_id, vm_id, node_name, vm_name, permissions, created_by, created_at)
  VALUES (COALESCE(NEW.id, gen_random_uuid()), NEW.user_id, NEW.vm_id, NEW.node_name, NEW.vm_name, COALESCE(NEW.permissions, ARRAY['view', 'console']), NEW.created_by, COALESCE(NEW.created_at, now()));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION api.user_vm_assignments_update()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.user_vm_assignments SET
    vm_name = NEW.vm_name,
    permissions = NEW.permissions
  WHERE id = OLD.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION api.user_vm_assignments_delete()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM public.user_vm_assignments WHERE id = OLD.id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS user_vm_assignments_insert_trigger ON api.user_vm_assignments;
CREATE TRIGGER user_vm_assignments_insert_trigger
  INSTEAD OF INSERT ON api.user_vm_assignments
  FOR EACH ROW EXECUTE FUNCTION api.user_vm_assignments_insert();

DROP TRIGGER IF EXISTS user_vm_assignments_update_trigger ON api.user_vm_assignments;
CREATE TRIGGER user_vm_assignments_update_trigger
  INSTEAD OF UPDATE ON api.user_vm_assignments
  FOR EACH ROW EXECUTE FUNCTION api.user_vm_assignments_update();

DROP TRIGGER IF EXISTS user_vm_assignments_delete_trigger ON api.user_vm_assignments;
CREATE TRIGGER user_vm_assignments_delete_trigger
  INSTEAD OF DELETE ON api.user_vm_assignments
  FOR EACH ROW EXECUTE FUNCTION api.user_vm_assignments_delete();