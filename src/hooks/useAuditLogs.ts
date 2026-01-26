import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import type { AuditLog } from "@/lib/types";

export interface AuditLogFilters {
  actionType?: string;
  resourceType?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
  page?: number;
  limit?: number;
}

interface AuditLogResponse {
  logs: AuditLog[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export function useAuditLogs(tenantId: string | undefined, filters: AuditLogFilters = {}) {
  return useQuery({
    queryKey: ["audit-logs", tenantId, filters],
    queryFn: async (): Promise<AuditLogResponse> => {
      if (!tenantId) {
        return { logs: [], total: 0, page: 1, limit: 50, totalPages: 0 };
      }

      const { data, error } = await supabase.functions.invoke("audit-log", {
        body: { action: "list", tenantId, filters },
      });

      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
    placeholderData: (previousData) => previousData,
  });
}

export function useExportAuditLogs(tenantId: string | undefined) {
  return useMutation({
    mutationFn: async (filters: AuditLogFilters = {}) => {
      if (!tenantId) throw new Error("Tenant ID required");

      const { data, error } = await supabase.functions.invoke("audit-log", {
        body: { action: "export", tenantId, filters },
      });

      if (error) throw error;

      // Download CSV
      const blob = new Blob([data], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `audit-log-${tenantId}-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      return data;
    },
    onSuccess: () => {
      toast({
        title: "Export complete",
        description: "Audit log has been downloaded.",
      });
    },
    onError: (error) => {
      toast({
        title: "Export failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useLogAuditEvent(tenantId: string | undefined) {
  return useMutation({
    mutationFn: async (event: {
      actionType: string;
      resourceType: string;
      resourceId?: string;
      resourceName?: string;
      details?: Record<string, unknown>;
    }) => {
      if (!tenantId) throw new Error("Tenant ID required");

      const { data, error } = await supabase.functions.invoke("audit-log", {
        body: { action: "log", tenantId, ...event },
      });

      if (error) throw error;
      return data.log;
    },
  });
}
