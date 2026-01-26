import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { Tenant, TenantInput, TenantStats, TenantRole } from "@/lib/types";

interface TenantWithRole extends Tenant {
  userRole?: TenantRole;
}

interface UserAssignment {
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

async function callTenantsFunction(action: string, data?: Record<string, unknown>) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Not authenticated");

  const response = await supabase.functions.invoke("tenants", {
    body: { action, ...data },
  });

  if (response.error) throw response.error;
  return response.data;
}

export function useTenants() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const tenantsQuery = useQuery({
    queryKey: ["tenants"],
    queryFn: async () => {
      const result = await callTenantsFunction("list");
      return result.tenants as TenantWithRole[];
    },
  });

  const createTenant = useMutation({
    mutationFn: async (input: TenantInput) => {
      const result = await callTenantsFunction("create", { data: input });
      return result.tenant as Tenant;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tenants"] });
      toast({ title: "Tenant created successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to create tenant", description: error.message, variant: "destructive" });
    },
  });

  const updateTenant = useMutation({
    mutationFn: async ({ id, ...data }: Partial<TenantInput> & { id: string }) => {
      const result = await callTenantsFunction("update", { tenantId: id, data });
      return result.tenant as Tenant;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tenants"] });
      toast({ title: "Tenant updated successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to update tenant", description: error.message, variant: "destructive" });
    },
  });

  const deleteTenant = useMutation({
    mutationFn: async (id: string) => {
      await callTenantsFunction("delete", { tenantId: id });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tenants"] });
      toast({ title: "Tenant deleted successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to delete tenant", description: error.message, variant: "destructive" });
    },
  });

  return {
    tenants: tenantsQuery.data ?? [],
    isLoading: tenantsQuery.isLoading,
    error: tenantsQuery.error,
    refetch: tenantsQuery.refetch,
    createTenant,
    updateTenant,
    deleteTenant,
  };
}

export function useTenant(tenantId: string | undefined) {
  return useQuery({
    queryKey: ["tenant", tenantId],
    queryFn: async () => {
      if (!tenantId) return null;
      const result = await callTenantsFunction("get", { tenantId });
      return result.tenant as Tenant;
    },
    enabled: !!tenantId,
  });
}

export function useTenantStats(tenantId: string | undefined) {
  return useQuery({
    queryKey: ["tenant-stats", tenantId],
    queryFn: async () => {
      if (!tenantId) return null;
      const result = await callTenantsFunction("get-stats", { tenantId });
      return result.stats as TenantStats;
    },
    enabled: !!tenantId,
    refetchInterval: 30000,
  });
}

export function useTenantUsers(tenantId: string | undefined) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const usersQuery = useQuery({
    queryKey: ["tenant-users", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const result = await callTenantsFunction("list-users", { tenantId });
      return result.users as UserAssignment[];
    },
    enabled: !!tenantId,
  });

  const assignUser = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: TenantRole }) => {
      await callTenantsFunction("assign-user", { tenantId, data: { user_id: userId, role } });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tenant-users", tenantId] });
      toast({ title: "User assigned to tenant" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to assign user", description: error.message, variant: "destructive" });
    },
  });

  const removeUser = useMutation({
    mutationFn: async (userId: string) => {
      await callTenantsFunction("remove-user", { tenantId, data: { user_id: userId } });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tenant-users", tenantId] });
      toast({ title: "User removed from tenant" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to remove user", description: error.message, variant: "destructive" });
    },
  });

  return {
    users: usersQuery.data ?? [],
    isLoading: usersQuery.isLoading,
    assignUser,
    removeUser,
  };
}
