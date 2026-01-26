import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface ProxmoxApiRequest {
  tenantId?: string;
  serverId?: string;
  path: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: Record<string, unknown>;
}

async function callProxmoxApi(request: ProxmoxApiRequest) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Not authenticated");

  const response = await supabase.functions.invoke("proxmox-api", {
    body: {
      path: request.path,
      method: request.method || 'GET',
      body: request.body,
      tenantId: request.tenantId,
      serverId: request.serverId,
    },
  });

  if (response.error) throw response.error;
  return response.data;
}

export function useProxmoxApiQuery(
  path: string,
  options?: {
    tenantId?: string;
    serverId?: string;
    enabled?: boolean;
    refetchInterval?: number;
  }
) {
  return useQuery({
    queryKey: ["proxmox-api", path, options?.tenantId, options?.serverId],
    queryFn: () => callProxmoxApi({
      path,
      tenantId: options?.tenantId,
      serverId: options?.serverId,
    }),
    enabled: options?.enabled !== false,
    refetchInterval: options?.refetchInterval,
  });
}

export function useProxmoxApiMutation() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (request: ProxmoxApiRequest) => {
      return callProxmoxApi(request);
    },
    onSuccess: (_, variables) => {
      // Invalidate related queries
      queryClient.invalidateQueries({ 
        queryKey: ["proxmox-api", variables.path] 
      });
      toast({ title: "Operation completed successfully" });
    },
    onError: (error: Error) => {
      toast({ 
        title: "API operation failed", 
        description: error.message, 
        variant: "destructive" 
      });
    },
  });
}

// Specific hooks for common operations
export function useClusterStatus(tenantId?: string, serverId?: string) {
  return useProxmoxApiQuery("/cluster/status", {
    tenantId,
    serverId,
    refetchInterval: 30000,
  });
}

export function useClusterResources(tenantId?: string, serverId?: string) {
  return useProxmoxApiQuery("/cluster/resources", {
    tenantId,
    serverId,
    refetchInterval: 15000,
  });
}

export function useNodes(tenantId?: string, serverId?: string) {
  return useProxmoxApiQuery("/nodes", {
    tenantId,
    serverId,
    refetchInterval: 30000,
  });
}

export function useNodeStatus(node: string, tenantId?: string, serverId?: string) {
  return useProxmoxApiQuery(`/nodes/${node}/status`, {
    tenantId,
    serverId,
    enabled: !!node,
    refetchInterval: 30000,
  });
}

export function useAccessUsers(tenantId?: string, serverId?: string) {
  return useProxmoxApiQuery("/access/users", {
    tenantId,
    serverId,
  });
}

export function useStorageList(tenantId?: string, serverId?: string) {
  return useProxmoxApiQuery("/storage", {
    tenantId,
    serverId,
  });
}

export function usePools(tenantId?: string, serverId?: string) {
  return useProxmoxApiQuery("/pools", {
    tenantId,
    serverId,
  });
}

export function useVersion(tenantId?: string, serverId?: string) {
  return useProxmoxApiQuery("/version", {
    tenantId,
    serverId,
  });
}
