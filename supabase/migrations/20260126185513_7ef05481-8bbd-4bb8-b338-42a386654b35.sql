-- Add Tailscale configuration columns to proxmox_servers table
ALTER TABLE public.proxmox_servers 
ADD COLUMN IF NOT EXISTS use_tailscale boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS tailscale_hostname text,
ADD COLUMN IF NOT EXISTS tailscale_port integer DEFAULT 8006;