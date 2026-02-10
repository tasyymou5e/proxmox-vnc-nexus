import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TenantSettingsRequest {
  action: 'get' | 'update';
  tenantId: string;
  settings?: Partial<{
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
  }>;
}

// Helper to log audit events
async function logAudit(
  supabase: any,
  tenantId: string,
  userId: string,
  actionType: string,
  resourceType: string,
  resourceName: string,
  details: Record<string, unknown>,
  req: Request
) {
  await supabase.from("audit_logs").insert({
    tenant_id: tenantId,
    user_id: userId,
    action_type: actionType,
    resource_type: resourceType,
    resource_name: resourceName,
    details,
    ip_address: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip'),
    user_agent: req.headers.get('user-agent'),
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } }, db: { schema: 'api' } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !userData.user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = userData.user.id;
    const body: TenantSettingsRequest = await req.json();
    const { action, tenantId, settings } = body;

    if (!tenantId) {
      return new Response(
        JSON.stringify({ error: "Tenant ID required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check user has access to this tenant
    const { data: hasAccess } = await supabase.rpc("user_has_tenant_access", {
      _user_id: userId,
      _tenant_id: tenantId,
    });

    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });

    if (!hasAccess && !isAdmin) {
      return new Response(
        JSON.stringify({ error: "Access denied" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    switch (action) {
      case 'get': {
        // Try to get existing settings
        let { data: existingSettings, error } = await supabase
          .from("tenant_settings")
          .select("*")
          .eq("tenant_id", tenantId)
          .maybeSingle();

        if (error) throw error;

        // If no settings exist, create default settings
        if (!existingSettings) {
          const { data: newSettings, error: insertError } = await supabase
            .from("tenant_settings")
            .insert({ tenant_id: tenantId })
            .select()
            .single();

          if (insertError) throw insertError;
          existingSettings = newSettings;
        }

        return new Response(
          JSON.stringify({ settings: existingSettings }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case 'update': {
        // Check if user is tenant admin for updates
        const { data: hasTenantAdminRole } = await supabase.rpc("has_tenant_role", {
          _user_id: userId,
          _tenant_id: tenantId,
          _roles: ["admin"],
        });

        if (!hasTenantAdminRole && !isAdmin) {
          return new Response(
            JSON.stringify({ error: "Admin access required to update settings" }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        if (!settings) {
          return new Response(
            JSON.stringify({ error: "Settings data required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Check if settings exist
        const { data: existingSettings } = await supabase
          .from("tenant_settings")
          .select("id")
          .eq("tenant_id", tenantId)
          .maybeSingle();

        let updatedSettings;

        if (existingSettings) {
          // Update existing
          const { data, error } = await supabase
            .from("tenant_settings")
            .update(settings)
            .eq("tenant_id", tenantId)
            .select()
            .single();

          if (error) throw error;
          updatedSettings = data;
        } else {
          // Create with provided settings
          const { data, error } = await supabase
            .from("tenant_settings")
            .insert({ tenant_id: tenantId, ...settings })
            .select()
            .single();

          if (error) throw error;
          updatedSettings = data;
        }

        // Log audit event
        await logAudit(
          supabase,
          tenantId,
          userId,
          'settings_updated',
          'settings',
          'Tenant Settings',
          { changes: settings },
          req
        );

        return new Response(
          JSON.stringify({ settings: updatedSettings }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: "Unknown action" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
  } catch (error) {
    console.error("Tenant settings error:", error);
    return new Response(
      JSON.stringify({ error: (error as Error).message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
