import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getProxmoxCredentials } from "../_shared/proxmox-utils.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface VM {
  vmid: number;
  name: string;
  node: string;
  status: string;
  type: string;
  cpu?: number;
  maxcpu?: number;
  mem?: number;
  maxmem?: number;
  disk?: number;
  maxdisk?: number;
  uptime?: number;
  template?: boolean;
  serverId?: string;
  serverName?: string;
}

interface ListVMsRequest {
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
      { global: { headers: { Authorization: authHeader } } }
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

    // Check if user is admin
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .single();

    const isAdmin = roleData?.role === "admin";

    // Parse request body for optional serverId
    let serverId: string | undefined;
    try {
      const body: ListVMsRequest = await req.json();
      serverId = body.serverId;
    } catch {
      // No body or invalid JSON, continue without serverId
    }

    // Get Proxmox credentials (from database if serverId provided, else from env)
    let proxmoxHost: string;
    let proxmoxPort: string;
    let proxmoxToken: string;
    let serverName: string | undefined;

    try {
      const credentials = await getProxmoxCredentials(supabase, userId, serverId);
      proxmoxHost = credentials.host;
      proxmoxPort = credentials.port;
      proxmoxToken = credentials.token;
      
      // Get server name if serverId provided
      if (serverId) {
        const { data: server } = await supabase
          .from("proxmox_servers")
          .select("name")
          .eq("id", serverId)
          .single();
        serverName = server?.name;
      }
    } catch (error) {
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch all VMs from Proxmox
    const proxmoxUrl = `https://${proxmoxHost}:${proxmoxPort}/api2/json/cluster/resources?type=vm`;
    
    const proxmoxResponse = await fetch(proxmoxUrl, {
      headers: {
        "Authorization": `PVEAPIToken=${proxmoxToken}`,
      },
    });

    const proxmoxData = await proxmoxResponse.json();
    
    if (!proxmoxResponse.ok) {
      return new Response(
        JSON.stringify({ error: "Failed to fetch VMs from Proxmox", details: proxmoxData }),
        { status: proxmoxResponse.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let vms: VM[] = proxmoxData.data || [];

    // If not admin, filter VMs based on user assignments
    if (!isAdmin) {
      const { data: assignments } = await supabase
        .from("user_vm_assignments")
        .select("vm_id, node_name, vm_name, permissions")
        .eq("user_id", userId);

      if (!assignments || assignments.length === 0) {
        return new Response(
          JSON.stringify({ vms: [], message: "No VMs assigned to this user" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const assignedVmIds = assignments.map((a) => a.vm_id);
      vms = vms.filter((vm) => assignedVmIds.includes(vm.vmid));

      // Add permissions and server info to each VM
      vms = vms.map((vm) => {
        const assignment = assignments.find((a) => a.vm_id === vm.vmid);
        return {
          ...vm,
          permissions: assignment?.permissions || ["view"],
          serverId,
          serverName,
        };
      });
    } else {
      // Admin gets full permissions
      vms = vms.map((vm) => ({
        ...vm,
        permissions: ["view", "console", "start", "stop", "restart"],
        serverId,
        serverName,
      }));
    }

    return new Response(
      JSON.stringify({ vms, isAdmin, serverId, serverName }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("List VMs error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
