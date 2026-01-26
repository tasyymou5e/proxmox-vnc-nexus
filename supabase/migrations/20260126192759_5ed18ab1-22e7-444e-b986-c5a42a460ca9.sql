-- Add connection_timeout column to proxmox_servers table
-- Default is 10000ms (10 seconds), Tailscale connections may need 30000-60000ms
ALTER TABLE public.proxmox_servers 
ADD COLUMN IF NOT EXISTS connection_timeout integer DEFAULT 10000;

-- Add comment explaining the column
COMMENT ON COLUMN public.proxmox_servers.connection_timeout IS 'Connection timeout in milliseconds. Default 10000 (10s). Tailscale connections may need 30000-60000ms.';