// API Configuration
export const API_CONFIG = {
  SUPABASE_URL: "https://lbfabewnshfjdjfosqxl.supabase.co",
  FUNCTIONS_PATH: "/functions/v1",
} as const;

// VM Status
export const VM_STATUS = {
  RUNNING: "running",
  STOPPED: "stopped",
  PAUSED: "paused",
  SUSPENDED: "suspended",
  UNKNOWN: "unknown",
} as const;

// Refetch Intervals (milliseconds)
export const INTERVALS = {
  VM_LIST: 30000,
  STALE_TIME: 15000,
  GC_TIME: 5 * 60 * 1000,
  CONSOLE_HEALTH_CHECK: 5000,
} as const;

// VM Types
export const VM_TYPES = {
  QEMU: "qemu",
  LXC: "lxc",
} as const;

// Console connection timeout limits (edge function limits)
export const CONSOLE_LIMITS = {
  FREE_TIMEOUT_MS: 150 * 1000, // 2.5 minutes
  PAID_TIMEOUT_MS: 400 * 1000, // ~6.7 minutes
} as const;
