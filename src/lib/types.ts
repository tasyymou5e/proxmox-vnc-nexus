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
  useTailscale?: boolean;
  tailscaleHostname?: string;
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
  wsAuthToken?: string; // JWT for WebSocket sub-protocol auth (not sent in URL)
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
  connection_timeout: number;
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
  connection_timeout?: number;
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

// Multi-tenancy types
export interface Tenant {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logo_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface TenantInput {
  name: string;
  slug: string;
  description?: string;
  logo_url?: string;
  is_active?: boolean;
}

export interface TenantStats {
  servers: number;
  activeServers: number;
  totalVMs: number;
  runningVMs: number;
  totalStorage: number;
  usedStorage: number;
}

// Enhanced tenant stats with live data from Proxmox
export interface LiveTenantStats {
  totalVMs: number;
  runningVMs: number;
  stoppedVMs: number;
  totalContainers: number;
  runningContainers: number;
  stoppedContainers: number;
  nodes: {
    total: number;
    online: number;
    offline: number;
  };
  cpuUsage: {
    used: number;
    total: number;
    percentage: number;
  };
  memoryUsage: {
    used: number;
    total: number;
    percentage: number;
  };
  storageUsage: {
    used: number;
    total: number;
    percentage: number;
  };
  servers: {
    total: number;
    online: number;
    offline: number;
  };
  lastUpdated: string;
}

// Tenant user with profile info
export interface TenantUserAssignment {
  id: string;
  user_id: string;
  tenant_id: string;
  role: TenantRole;
  created_at: string;
  profiles: {
    id: string;
    email: string;
    full_name: string | null;
    username: string | null;
    avatar_url: string | null;
  };
}

export type TenantRole = 'admin' | 'manager' | 'viewer';

export interface UserTenantAssignment {
  id: string;
  user_id: string;
  tenant_id: string;
  role: TenantRole;
  created_at: string;
}

export interface ProxmoxApiConfig {
  id: string;
  tenant_id: string;
  server_id: string;
  config_path: string;
  config_data: Record<string, unknown>;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
}

// API Tree types
export interface ApiParameter {
  name: string;
  type: 'string' | 'integer' | 'boolean' | 'enum' | 'object' | 'array';
  required: boolean;
  description?: string;
  enumValues?: string[];
  default?: unknown;
}

export interface ApiEndpoint {
  path: string;
  label: string;
  description?: string;
  methods: ('GET' | 'POST' | 'PUT' | 'DELETE')[];
  isConfig: boolean;
  icon?: string;
  children?: ApiEndpoint[];
  parameters?: ApiParameter[];
}

export interface ApiTreeNode {
  path: string;
  label: string;
  isConfig: boolean;
  isExpanded?: boolean;
  isLoading?: boolean;
  children?: ApiTreeNode[];
  data?: unknown;
}

// Tenant Settings
export interface TenantSettings {
  id: string;
  tenant_id: string;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  logo_url: string | null;
  notification_email: string | null;
  notify_on_server_offline: boolean;
  notify_on_vm_action: boolean;
  notify_on_user_changes: boolean;
  default_connection_timeout: number;
  default_verify_ssl: boolean;
  auto_health_check_interval: number;
  // Alert thresholds
  alert_success_rate_threshold: number;
  alert_latency_threshold_ms: number;
  alert_offline_duration_seconds: number;
  created_at: string;
  updated_at: string;
}

// Audit Logs
export interface AuditLog {
  id: string;
  tenant_id: string;
  user_id: string;
  action_type: AuditActionType;
  resource_type: 'server' | 'vm' | 'user' | 'settings';
  resource_id: string | null;
  resource_name: string | null;
  details: Record<string, unknown>;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
  profiles?: {
    email: string;
    full_name: string | null;
  };
}

export type AuditActionType = 
  | 'server_added' | 'server_deleted' | 'server_updated'
  | 'vm_started' | 'vm_stopped' | 'vm_restarted' | 'vm_shutdown' | 'vm_reset' | 'vm_suspend' | 'vm_resume'
  | 'user_invited' | 'user_removed' | 'role_changed'
  | 'settings_updated';

// Connectivity Test
export interface ConnectivityTestResult {
  success: boolean;
  timing: {
    dnsResolutionMs: number;
    tcpConnectionMs: number;
    tlsHandshakeMs: number;
    apiResponseMs: number;
    totalLatencyMs: number;
  };
  resolvedIp: string;
  connectionType: 'direct' | 'tailscale';
  tailscaleInfo?: {
    hostname: string;
    port: number;
  };
  proxmoxVersion?: string;
  nodeCount?: number;
  error?: string;
  errorStage?: 'dns' | 'tcp' | 'tls' | 'api';
  recommendedTimeoutMs: number;
  currentTimeoutMs: number;
}

// Connection Metrics
export interface ConnectionMetric {
  id: string;
  server_id: string;
  success: boolean;
  response_time_ms: number | null;
  error_message: string | null;
  used_tailscale: boolean;
  timeout_used_ms: number | null;
  retry_count: number;
  created_at: string;
}