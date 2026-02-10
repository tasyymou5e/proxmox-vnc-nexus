import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ error: "No authorization header" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Create client with user's token to verify identity and admin role
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
      db: { schema: "api" },
    });

    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    // Verify requesting user is admin
    const { data: roleData } = await userClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    const isAdmin = roleData?.role === "admin";

    const body = await req.json();
    const { action } = body;

    switch (action) {
      // ── VM Assignment CRUD (admin-only) ─────────────────────────────
      case "assign-vm": {
        if (!isAdmin) return jsonResponse({ error: "Admin access required" }, 403);

        const { user_id, vm_id, node_name, vm_name, permissions } = body;
        if (!user_id || vm_id == null || !node_name) {
          return jsonResponse({ error: "Missing required fields: user_id, vm_id, node_name" }, 400);
        }

        const parsedVmId = parseInt(String(vm_id), 10);
        if (isNaN(parsedVmId)) {
          return jsonResponse({ error: "vm_id must be a valid number" }, 400);
        }

        const { data, error } = await userClient.from("user_vm_assignments").insert({
          user_id,
          vm_id: parsedVmId,
          node_name,
          vm_name: vm_name || null,
          permissions: permissions || ["view", "console"],
        }).select().single();

        if (error) return jsonResponse({ error: error.message }, 500);
        return jsonResponse({ success: true, assignment: data });
      }

      case "delete-assignment": {
        if (!isAdmin) return jsonResponse({ error: "Admin access required" }, 403);

        const { assignment_id } = body;
        if (!assignment_id) {
          return jsonResponse({ error: "Missing required field: assignment_id" }, 400);
        }

        const { error } = await userClient
          .from("user_vm_assignments")
          .delete()
          .eq("id", assignment_id);

        if (error) return jsonResponse({ error: error.message }, 500);
        return jsonResponse({ success: true });
      }

      case "change-role": {
        if (!isAdmin) return jsonResponse({ error: "Admin access required" }, 403);

        const { user_id: targetUserId, new_role } = body;
        if (!targetUserId || !new_role) {
          return jsonResponse({ error: "Missing required fields: user_id, new_role" }, 400);
        }

        if (!["admin", "user"].includes(new_role)) {
          return jsonResponse({ error: "Invalid role. Must be 'admin' or 'user'" }, 400);
        }

        // Prevent self-demotion
        if (targetUserId === user.id && new_role !== "admin") {
          return jsonResponse({ error: "Cannot demote yourself" }, 400);
        }

        const { error } = await userClient
          .from("user_roles")
          .update({ role: new_role })
          .eq("user_id", targetUserId);

        if (error) return jsonResponse({ error: error.message }, 500);
        return jsonResponse({ success: true });
      }

      // ── Audit Log Entry (any authenticated user with tenant access) ──
      case "log-alert": {
        const { tenant_id, action_type, resource_type, resource_id, resource_name, details } = body;
        if (!tenant_id || !action_type) {
          return jsonResponse({ error: "Missing required fields: tenant_id, action_type" }, 400);
        }

        // Verify user has access to this tenant (admin or tenant member)
        if (!isAdmin) {
          const { data: tenantAccess } = await userClient
            .from("user_tenant_assignments")
            .select("id")
            .eq("user_id", user.id)
            .eq("tenant_id", tenant_id)
            .maybeSingle();

          if (!tenantAccess) {
            return jsonResponse({ error: "No access to this tenant" }, 403);
          }
        }

        const { error } = await userClient.from("audit_logs").insert({
          user_id: user.id,
          tenant_id,
          action_type,
          resource_type: resource_type || null,
          resource_id: resource_id || null,
          resource_name: resource_name || null,
          details: details || null,
        });

        if (error) return jsonResponse({ error: error.message }, 500);
        return jsonResponse({ success: true });
      }

      default:
        return jsonResponse({ error: `Unknown action: ${action}` }, 400);
    }
  } catch (error) {
    console.error("Admin actions error:", error);
    return jsonResponse({ error: error.message || "Internal server error" }, 500);
  }
});
