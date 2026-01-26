export interface VM {
  vmid: number;
  name: string;
  node: string;
  status: "running" | "stopped" | "paused" | "suspended" | "unknown";
  type: "qemu" | "lxc";
  cpu?: number;
  maxcpu?: number;
  mem?: number;
  maxmem?: number;
  disk?: number;
  maxdisk?: number;
  uptime?: number;
  template?: boolean;
  permissions?: string[];
  serverId?: string;
  serverName?: string;
}

export interface VNCConnection {
  ticket: string;
  port: number;
  user: string;
  upid: string;
  websocketUrl: string;
  proxmoxHost: string;
  proxmoxPort: string;
  node: string;
  vmid: number;
  vmType: "qemu" | "lxc";
  relayUrl?: string; // WebSocket URL to the edge function relay
}

export interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  username: string | null;
  company_name: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserRole {
  id: string;
  user_id: string;
  role: "admin" | "user";
  created_at: string;
}

export interface VMAssignment {
  id: string;
  user_id: string;
  vm_id: number;
  node_name: string;
  vm_name: string | null;
  permissions: string[];
  created_at: string;
  created_by: string | null;
}

export interface ConnectionSession {
  id: string;
  user_id: string;
  vm_id: number;
  node_name: string;
  started_at: string;
  ended_at: string | null;
  status: string;
}

export type ConnectionStatus = 'online' | 'offline' | 'unknown' | 'checking';

export interface ProxmoxServer {
  id: string;
  user_id: string;
  name: string;
  host: string;
  port: number;
  verify_ssl: boolean;
  is_active: boolean;
  last_connected_at: string | null;
  created_at: string;
  updated_at: string;
  connection_status: ConnectionStatus;
  last_health_check_at: string | null;
  health_check_error: string | null;
  use_tailscale: boolean;
  tailscale_hostname: string | null;
  tailscale_port: number;
}

export interface ProxmoxServerInput {
  name: string;
  host: string;
  port: number;
  api_token: string;
  verify_ssl?: boolean;
  use_tailscale?: boolean;
  tailscale_hostname?: string;
  tailscale_port?: number;
}

export interface HealthCheckResult {
  serverId: string;
  serverName: string;
  status: 'online' | 'offline';
  error?: string;
  nodes?: number;
}

export interface ImportError {
  index: number;
  name: string;
  error: string;
}

export interface BulkImportResult {
  success: number;
  failed: ImportError[];
  message: string;
}