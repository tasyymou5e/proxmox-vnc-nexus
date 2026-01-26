-- Add alert threshold columns to tenant_settings
ALTER TABLE public.tenant_settings 
ADD COLUMN IF NOT EXISTS alert_success_rate_threshold numeric DEFAULT 80,
ADD COLUMN IF NOT EXISTS alert_latency_threshold_ms integer DEFAULT 500,
ADD COLUMN IF NOT EXISTS alert_offline_duration_seconds integer DEFAULT 60;

-- Add comments for documentation
COMMENT ON COLUMN public.tenant_settings.alert_success_rate_threshold IS 'Minimum success rate percentage before alerting (default 80%)';
COMMENT ON COLUMN public.tenant_settings.alert_latency_threshold_ms IS 'Maximum latency in ms before alerting (default 500ms)';
COMMENT ON COLUMN public.tenant_settings.alert_offline_duration_seconds IS 'Seconds a server must be offline before alerting (default 60s)';