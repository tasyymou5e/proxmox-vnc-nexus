import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getProxmoxCredentials } from "../_shared/proxmox-utils.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type VMAction = "start" | "stop" | "shutdown" | "reset" | "suspend" | "resume";

interface ActionRequest {
  node: string;
  vmid: number;
  action: VMAction;
  vmType?: "qemu" | "lxc";
  serverId?: string;
  tenantId?: string;
  vmName?: string;
  serverName?: string;
}

// Helper to log audit events
async function logAudit(
  supabase: any,
  tenantId: string,
  userId: string,
  actionType: string,
  resourceType: string,
  resourceId: string,
  resourceName: string,
  details: Record<string, unknown>,
  req: Request
) {
  try {
    await supabase.from("audit_logs").insert({
      tenant_id: tenantId,
      user_id: userId,
      action_type: actionType,
      resource_type: resourceType,
      resource_id: resourceId,
      resource_name: resourceName,
      details,
      ip_address: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip'),
      user_agent: req.headers.get('user-agent'),
    });
  } catch (error) {
    console.error("Failed to log audit event:", error);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate authorization
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

    // Get request body
    const { node, vmid, action, vmType = "qemu", serverId, tenantId, vmName, serverName }: ActionRequest = await req.json();

    if (!node || !vmid || !action) {
      return new Response(
        JSON.stringify({ error: "Node, vmid, and action are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate action
    const validActions: VMAction[] = ["start", "stop", "shutdown", "reset", "suspend", "resume"];
    if (!validActions.includes(action)) {
      return new Response(
        JSON.stringify({ error: `Invalid action. Valid actions: ${validActions.join(", ")}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if user is admin
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .single();

    const isAdmin = roleData?.role === "admin";

    // If not admin, check user has permission for this action
    if (!isAdmin) {
      const { data: assignment } = await supabase
        .from("user_vm_assignments")
        .select("permissions")
        .eq("user_id", userId)
        .eq("vm_id", vmid)
        .eq("node_name", node)
        .single();

      if (!assignment) {
        return new Response(
          JSON.stringify({ error: "You don't have access to this VM" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Map action to required permission
      const actionPermissionMap: Record<VMAction, string> = {
        start: "start",
        stop: "stop",
        shutdown: "stop",
        reset: "restart",
        suspend: "stop",
        resume: "start",
      };

      const requiredPermission = actionPermissionMap[action];
      if (!assignment.permissions?.includes(requiredPermission)) {
        return new Response(
          JSON.stringify({ error: `You don't have permission to ${action} this VM` }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Get Proxmox credentials (from database if serverId provided, else from env)
    let proxmoxHost: string;
    let proxmoxPort: string;
    let proxmoxToken: string;
    let credentials: { host: string; port: string; token: string; timeout: number };

    try {
      credentials = await getProxmoxCredentials(supabase, userId, serverId);
      proxmoxHost = credentials.host;
      proxmoxPort = credentials.port;
      proxmoxToken = credentials.token;
    } catch (error) {
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Map action to Proxmox API endpoint
    const actionEndpointMap: Record<VMAction, string> = {
      start: "start",
      stop: "stop",
      shutdown: "shutdown",
      reset: "reset",
      suspend: "suspend",
      resume: "resume",
    };

    const endpoint = actionEndpointMap[action];
    const actionUrl = `https://${proxmoxHost}:${proxmoxPort}/api2/json/nodes/${node}/${vmType}/${vmid}/status/${endpoint}`;
    const timeout = credentials.timeout || 10000;
    
    const actionResponse = await fetch(actionUrl, {
      method: "POST",
      headers: {
        "Authorization": `PVEAPIToken=${proxmoxToken}`,
      },
      signal: AbortSignal.timeout(timeout),
    });

    const actionData = await actionResponse.json();
    
    if (!actionResponse.ok) {
      return new Response(
        JSON.stringify({ error: `Failed to ${action} VM`, details: actionData }),
        { status: actionResponse.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Log audit event if tenantId is provided
    if (tenantId) {
      await logAudit(
        supabase,
        tenantId,
        userId,
        `vm_${action}`,
        'vm',
        String(vmid),
        vmName || `VM ${vmid}`,
        { node, vmType, serverId, serverName, action },
        req
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `VM ${action} initiated`,
        upid: actionData.data,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("VM Action error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
