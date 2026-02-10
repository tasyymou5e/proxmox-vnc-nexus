import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getProxmoxCredentials } from "../_shared/proxmox-utils.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ConsoleRequest {
  node: string;
  vmid: number;
  vmType?: "qemu" | "lxc";
  serverId?: string;
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
    const { node, vmid, vmType = "qemu", serverId }: ConsoleRequest = await req.json();

    if (!node || !vmid) {
      return new Response(
        JSON.stringify({ error: "Node and vmid are required" }),
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

    // If not admin, check user has console permission for this VM
    if (!isAdmin) {
      const { data: assignment } = await supabase
        .from("user_vm_assignments")
        .select("permissions")
        .eq("user_id", userId)
        .eq("vm_id", vmid)
        .eq("node_name", node)
        .single();

      if (!assignment || !assignment.permissions?.includes("console")) {
        return new Response(
          JSON.stringify({ error: "You don't have console access to this VM" }),
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
        JSON.stringify({ error: (error as Error).message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get VNC proxy ticket from Proxmox
    const vncProxyUrl = `https://${proxmoxHost}:${proxmoxPort}/api2/json/nodes/${node}/${vmType}/${vmid}/vncproxy`;
    const timeout = credentials.timeout || 10000;
    
    const vncResponse = await fetch(vncProxyUrl, {
      method: "POST",
      headers: {
        "Authorization": `PVEAPIToken=${proxmoxToken}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "websocket=1",
      signal: AbortSignal.timeout(timeout),
    });

    const vncData = await vncResponse.json();
    
    if (!vncResponse.ok) {
      return new Response(
        JSON.stringify({ error: "Failed to get VNC proxy", details: vncData }),
        { status: vncResponse.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create connection session record
    await supabase.from("connection_sessions").insert({
      user_id: userId,
      vm_id: vmid,
      node_name: node,
      status: "active",
    });

    // Return VNC connection details
    const response = {
      ticket: vncData.data.ticket,
      port: vncData.data.port,
      user: vncData.data.user,
      upid: vncData.data.upid,
      websocketUrl: `wss://${proxmoxHost}:${proxmoxPort}/api2/json/nodes/${node}/${vmType}/${vmid}/vncwebsocket?port=${vncData.data.port}&vncticket=${encodeURIComponent(vncData.data.ticket)}`,
      proxmoxHost,
      proxmoxPort,
      node,
      vmid,
      vmType,
    };

    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("VM Console error:", error);
    return new Response(
      JSON.stringify({ error: (error as Error).message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
