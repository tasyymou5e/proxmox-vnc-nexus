import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import type { TenantRole } from "@/lib/types";

interface TenantPermissions {
  role: TenantRole | null;
  isLoading: boolean;
  canManageServers: boolean; // admin or manager
  canManageUsers: boolean; // admin only
  canDeleteServers: boolean; // admin only
  canViewOnly: boolean; // viewer
  canManageVMs: boolean; // manager or admin
  canViewAuditLogs: boolean; // admin only
  canManageSettings: boolean; // admin only
  hasAccess: boolean;
}

export function useTenantPermissions(tenantId: string | undefined): TenantPermissions {
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["tenant-permission", tenantId, user?.id],
    queryFn: async () => {
      if (!tenantId || !user?.id) return null;

      // First check if user is system admin
      const { data: isAdmin } = await supabase.rpc("has_role", {
        _user_id: user.id,
        _role: "admin",
      });

      if (isAdmin) {
        return { role: "admin" as TenantRole, isSystemAdmin: true };
      }

      // Get user's role in this tenant
      const { data: assignment, error } = await supabase
        .from("user_tenant_assignments")
        .select("role")
        .eq("user_id", user.id)
        .eq("tenant_id", tenantId)
        .maybeSingle();

      if (error || !assignment) {
        return null;
      }

      return { role: assignment.role as TenantRole, isSystemAdmin: false };
    },
    enabled: !!tenantId && !!user?.id,
  });

  const role = data?.role ?? null;
  const hasAccess = role !== null;

  return {
    role,
    isLoading,
    canManageServers: role === "admin" || role === "manager",
    canManageUsers: role === "admin",
    canDeleteServers: role === "admin",
    canViewOnly: role === "viewer",
    canManageVMs: role === "admin" || role === "manager",
    canViewAuditLogs: role === "admin",
    canManageSettings: role === "admin",
    hasAccess,
  };
}
