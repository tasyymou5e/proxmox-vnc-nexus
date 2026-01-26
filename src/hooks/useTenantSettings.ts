import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import type { TenantSettings } from "@/lib/types";

export function useTenantSettings(tenantId: string | undefined) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["tenant-settings", tenantId],
    queryFn: async (): Promise<TenantSettings | null> => {
      if (!tenantId) return null;

      const { data, error } = await supabase.functions.invoke("tenant-settings", {
        body: { action: "get", tenantId },
      });

      if (error) throw error;
      return data.settings;
    },
    enabled: !!tenantId,
  });

  const mutation = useMutation({
    mutationFn: async (settings: Partial<TenantSettings>) => {
      if (!tenantId) throw new Error("Tenant ID required");

      const { data, error } = await supabase.functions.invoke("tenant-settings", {
        body: { action: "update", tenantId, settings },
      });

      if (error) throw error;
      return data.settings;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tenant-settings", tenantId] });
      toast({
        title: "Settings saved",
        description: "Your tenant settings have been updated.",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to save settings",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return {
    settings: query.data,
    isLoading: query.isLoading,
    error: query.error,
    updateSettings: mutation.mutate,
    isUpdating: mutation.isPending,
  };
}
