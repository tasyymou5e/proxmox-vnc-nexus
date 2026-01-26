import { useState, useCallback, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { API_CONFIG } from "@/lib/constants";
import type { 
  ProxmoxServer, 
  ProxmoxServerInput, 
  HealthCheckResult, 
  BulkImportResult 
} from "@/lib/types";

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error("Not authenticated");
  }
  return {
    Authorization: `Bearer ${session.access_token}`,
    "Content-Type": "application/json",
  };
}

const HEALTH_CHECK_INTERVAL = 120000; // 2 minutes

export function useProxmoxServers() {
  const [servers, setServers] = useState<ProxmoxServer[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [healthCheckLoading, setHealthCheckLoading] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchServers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(
        `${API_CONFIG.SUPABASE_URL}${API_CONFIG.FUNCTIONS_PATH}/proxmox-servers`,
        { method: "GET", headers }
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch servers");
      }
      setServers(data.servers || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch servers");
    } finally {
      setLoading(false);
    }
  }, []);

  const createServer = useCallback(async (input: ProxmoxServerInput): Promise<ProxmoxServer> => {
    const headers = await getAuthHeaders();
    const response = await fetch(
      `${API_CONFIG.SUPABASE_URL}${API_CONFIG.FUNCTIONS_PATH}/proxmox-servers`,
      {
        method: "POST",
        headers,
        body: JSON.stringify(input),
      }
    );
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "Failed to create server");
    }
    setServers((prev) => [data.server, ...prev]);
    return data.server;
  }, []);

  const updateServer = useCallback(async (
    id: string,
    updates: Partial<ProxmoxServerInput> & { 
      is_active?: boolean;
      use_tailscale?: boolean;
      tailscale_hostname?: string;
      tailscale_port?: number;
    }
  ): Promise<ProxmoxServer> => {
    const headers = await getAuthHeaders();
    const response = await fetch(
      `${API_CONFIG.SUPABASE_URL}${API_CONFIG.FUNCTIONS_PATH}/proxmox-servers`,
      {
        method: "PUT",
        headers,
        body: JSON.stringify({ id, ...updates }),
      }
    );
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "Failed to update server");
    }
    setServers((prev) =>
      prev.map((s) => (s.id === id ? data.server : s))
    );
    return data.server;
  }, []);

  const deleteServer = useCallback(async (id: string): Promise<void> => {
    const headers = await getAuthHeaders();
    const response = await fetch(
      `${API_CONFIG.SUPABASE_URL}${API_CONFIG.FUNCTIONS_PATH}/proxmox-servers`,
      {
        method: "DELETE",
        headers,
        body: JSON.stringify({ id }),
      }
    );
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "Failed to delete server");
    }
    setServers((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const testConnection = useCallback(async (
    input: { host: string; port: number; api_token: string } | { server_id: string }
  ): Promise<{ success: boolean; message?: string; error?: string; nodes?: number }> => {
    const headers = await getAuthHeaders();
    const response = await fetch(
      `${API_CONFIG.SUPABASE_URL}${API_CONFIG.FUNCTIONS_PATH}/proxmox-servers`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({ action: "test", ...input }),
      }
    );
    const data = await response.json();
    if (data.success && "server_id" in input) {
      // Update local state with new connection info
      setServers((prev) =>
        prev.map((s) =>
          s.id === input.server_id
            ? { 
                ...s, 
                last_connected_at: new Date().toISOString(),
                connection_status: 'online' as const,
                last_health_check_at: new Date().toISOString(),
                health_check_error: null,
              }
            : s
        )
      );
    } else if (!data.success && "server_id" in input) {
      // Update local state with error
      setServers((prev) =>
        prev.map((s) =>
          s.id === input.server_id
            ? { 
                ...s, 
                connection_status: 'offline' as const,
                last_health_check_at: new Date().toISOString(),
                health_check_error: data.error || "Connection failed",
              }
            : s
        )
      );
    }
    return data;
  }, []);

  const runHealthChecks = useCallback(async (): Promise<HealthCheckResult[]> => {
    setHealthCheckLoading(true);
    
    // Set all active servers to 'checking' status
    setServers((prev) =>
      prev.map((s) =>
        s.is_active ? { ...s, connection_status: 'checking' as const } : s
      )
    );

    try {
      const headers = await getAuthHeaders();
      const response = await fetch(
        `${API_CONFIG.SUPABASE_URL}${API_CONFIG.FUNCTIONS_PATH}/proxmox-servers`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({ action: "health-check-all" }),
        }
      );
      const data = await response.json();
      
      if (data.results) {
        // Update local state with health check results
        setServers((prev) =>
          prev.map((s) => {
            const result = data.results.find((r: HealthCheckResult) => r.serverId === s.id);
            if (result) {
              return {
                ...s,
                connection_status: result.status,
                last_health_check_at: new Date().toISOString(),
                health_check_error: result.error || null,
                ...(result.status === 'online' ? { last_connected_at: new Date().toISOString() } : {}),
              };
            }
            return s;
          })
        );
        return data.results;
      }
      return [];
    } catch (err) {
      console.error("Health check failed:", err);
      // Reset status on error
      setServers((prev) =>
        prev.map((s) =>
          s.connection_status === 'checking' 
            ? { ...s, connection_status: 'unknown' as const } 
            : s
        )
      );
      return [];
    } finally {
      setHealthCheckLoading(false);
    }
  }, []);

  const bulkImportServers = useCallback(async (
    serversToImport: ProxmoxServerInput[]
  ): Promise<BulkImportResult> => {
    const headers = await getAuthHeaders();
    const response = await fetch(
      `${API_CONFIG.SUPABASE_URL}${API_CONFIG.FUNCTIONS_PATH}/proxmox-servers`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({ action: "bulk-import", servers: serversToImport }),
      }
    );
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "Failed to import servers");
    }
    
    // Refresh the server list after import
    await fetchServers();
    
    return data;
  }, [fetchServers]);

  // Auto-refresh health checks every 2 minutes when page is visible
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && servers.length > 0) {
        // Run health check when page becomes visible
        runHealthChecks();
      }
    };

    // Set up interval for periodic health checks
    if (servers.length > 0) {
      intervalRef.current = setInterval(() => {
        if (document.visibilityState === 'visible') {
          runHealthChecks();
        }
      }, HEALTH_CHECK_INTERVAL);
    }

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [servers.length, runHealthChecks]);

  return {
    servers,
    loading,
    error,
    healthCheckLoading,
    fetchServers,
    createServer,
    updateServer,
    deleteServer,
    testConnection,
    runHealthChecks,
    bulkImportServers,
  };
}