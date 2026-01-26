-- Add health check tracking columns to proxmox_servers table
ALTER TABLE public.proxmox_servers 
ADD COLUMN IF NOT EXISTS connection_status text DEFAULT 'unknown',
ADD COLUMN IF NOT EXISTS last_health_check_at timestamptz,
ADD COLUMN IF NOT EXISTS health_check_error text;

-- Add comment for documentation
COMMENT ON COLUMN public.proxmox_servers.connection_status IS 'Health check status: online, offline, unknown, checking';
COMMENT ON COLUMN public.proxmox_servers.last_health_check_at IS 'Timestamp of last health check';
COMMENT ON COLUMN public.proxmox_servers.health_check_error IS 'Error message from last failed health check';