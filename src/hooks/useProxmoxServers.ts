import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { API_CONFIG } from "@/lib/constants";
import type { ProxmoxServer, ProxmoxServerInput } from "@/lib/types";

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

export function useProxmoxServers() {
  const [servers, setServers] = useState<ProxmoxServer[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    updates: Partial<ProxmoxServerInput> & { is_active?: boolean }
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
      // Update local state with new last_connected_at
      setServers((prev) =>
        prev.map((s) =>
          s.id === input.server_id
            ? { ...s, last_connected_at: new Date().toISOString() }
            : s
        )
      );
    }
    return data;
  }, []);

  return {
    servers,
    loading,
    error,
    fetchServers,
    createServer,
    updateServer,
    deleteServer,
    testConnection,
  };
}
