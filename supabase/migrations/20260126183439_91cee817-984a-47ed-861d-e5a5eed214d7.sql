-- Enable pgcrypto for encryption
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Create the proxmox_servers table
CREATE TABLE public.proxmox_servers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    name text NOT NULL,
    host text NOT NULL,
    port integer NOT NULL DEFAULT 8006,
    api_token_encrypted text NOT NULL,
    verify_ssl boolean DEFAULT true,
    is_active boolean DEFAULT true,
    last_connected_at timestamptz,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    CONSTRAINT proxmox_servers_port_check CHECK (port > 0 AND port < 65536)
);

-- Create unique constraint on user_id + host + port
CREATE UNIQUE INDEX proxmox_servers_user_host_port_idx 
ON public.proxmox_servers(user_id, host, port);

-- Enable RLS
ALTER TABLE public.proxmox_servers ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own servers"
ON public.proxmox_servers FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own servers"
ON public.proxmox_servers FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own servers"
ON public.proxmox_servers FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own servers"
ON public.proxmox_servers FOR DELETE
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all servers"
ON public.proxmox_servers FOR SELECT
USING (has_role(auth.uid(), 'admin'));

-- Updated_at trigger
CREATE TRIGGER update_proxmox_servers_updated_at
    BEFORE UPDATE ON public.proxmox_servers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();