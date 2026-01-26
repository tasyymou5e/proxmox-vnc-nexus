import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getProxmoxCredentials, decryptToken } from "../_shared/proxmox-utils.ts";

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
  permissions?: string[];
}

interface ListVMsRequest {
  serverId?: string;
  tenantId?: string;
}

interface ServerInfo {
  id: string;
  name: string;
  host: string;
  port: number;
  api_token_encrypted: string;
  use_tailscale: boolean;
  tailscale_hostname: string | null;
  tailscale_port: number | null;
  connection_timeout: number | null;
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
    const encryptionKey = Deno.env.get("PROXMOX_ENCRYPTION_KEY");

    // Check if user is admin
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .single();

    const isAdmin = roleData?.role === "admin";

    // Parse request body for optional filters
    let serverId: string | undefined;
    let tenantId: string | undefined;
    try {
      const body: ListVMsRequest = await req.json();
      serverId = body.serverId;
      tenantId = body.tenantId;
    } catch {
      // No body or invalid JSON, continue without filters
    }

    // Get servers to query
    let serversToQuery: ServerInfo[] = [];
    
    if (serverId) {
      // Query specific server
      const { data: server } = await supabase
        .from("proxmox_servers")
        .select("id, name, host, port, api_token_encrypted, use_tailscale, tailscale_hostname, tailscale_port, connection_timeout")
        .eq("id", serverId)
        .eq("is_active", true)
        .single();

      if (server) {
        serversToQuery = [server];
      }
    } else if (encryptionKey) {
      // Query servers - filter by tenant if specified
      let query = supabase
        .from("proxmox_servers")
        .select("id, name, host, port, api_token_encrypted, use_tailscale, tailscale_hostname, tailscale_port, connection_timeout")
        .eq("is_active", true)
        .order("name");

      if (tenantId) {
        query = query.eq("tenant_id", tenantId);
      }

      const { data: servers } = await query;

      if (servers && servers.length > 0) {
        serversToQuery = servers;
      }
    }

    // If no database servers found, try environment variables as fallback
    if (serversToQuery.length === 0) {
      const proxmoxHost = Deno.env.get("PROXMOX_HOST");
      const proxmoxPort = Deno.env.get("PROXMOX_PORT") || "8006";
      const proxmoxToken = Deno.env.get("PROXMOX_API_TOKEN");

      if (!proxmoxHost || !proxmoxToken) {
        return new Response(
          JSON.stringify({ vms: [], isAdmin, servers: [], message: "No Proxmox servers configured" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Fetch VMs from environment-configured server
      const proxmoxUrl = `https://${proxmoxHost}:${proxmoxPort}/api2/json/cluster/resources?type=vm`;
      
      const proxmoxResponse = await fetch(proxmoxUrl, {
        headers: { "Authorization": `PVEAPIToken=${proxmoxToken}` },
      });

      const proxmoxData = await proxmoxResponse.json();
      
      if (!proxmoxResponse.ok) {
        return new Response(
          JSON.stringify({ error: "Failed to fetch VMs from Proxmox", details: proxmoxData }),
          { status: proxmoxResponse.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      let vms: VM[] = (proxmoxData.data || []).map((vm: VM) => ({
        ...vm,
        serverName: "Default Server",
      }));

      // Filter and add permissions
      vms = await filterAndEnrichVMs(supabase, vms, userId, isAdmin);

      return new Response(
        JSON.stringify({ vms, isAdmin, servers: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch VMs from all servers in parallel
    const allVMs: VM[] = [];
    const serversList: { id: string; name: string }[] = [];

    await Promise.all(serversToQuery.map(async (server) => {
      try {
        const decryptedToken = decryptToken(server.api_token_encrypted, encryptionKey!);
        
        // Use Tailscale host/port if enabled
        const useTailscale = server.use_tailscale && !!server.tailscale_hostname;
        const effectiveHost = useTailscale ? server.tailscale_hostname : server.host;
        const effectivePort = useTailscale ? (server.tailscale_port || server.port) : server.port;
        const timeout = server.connection_timeout || 10000;
        
        const proxmoxUrl = `https://${effectiveHost}:${effectivePort}/api2/json/cluster/resources?type=vm`;
        
        const proxmoxResponse = await fetch(proxmoxUrl, {
          headers: { "Authorization": `PVEAPIToken=${decryptedToken}` },
          signal: AbortSignal.timeout(timeout),
        });

        if (proxmoxResponse.ok) {
          const proxmoxData = await proxmoxResponse.json();
          const vms = (proxmoxData.data || []).map((vm: VM) => ({
            ...vm,
            serverId: server.id,
            serverName: server.name,
            useTailscale,
            tailscaleHostname: useTailscale ? server.tailscale_hostname : null,
          }));
          allVMs.push(...vms);
          serversList.push({ id: server.id, name: server.name });
        } else {
          console.error(`Failed to fetch VMs from ${server.name}:`, await proxmoxResponse.text());
        }
      } catch (err) {
        console.error(`Error fetching VMs from ${server.name}:`, err.message);
      }
    }));

    // Filter and enrich VMs based on user permissions
    const enrichedVMs = await filterAndEnrichVMs(supabase, allVMs, userId, isAdmin);

    return new Response(
      JSON.stringify({ vms: enrichedVMs, isAdmin, servers: serversList }),
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

async function filterAndEnrichVMs(
  supabase: ReturnType<typeof createClient>,
  vms: VM[],
  userId: string,
  isAdmin: boolean
): Promise<VM[]> {
  if (isAdmin) {
    // Admin gets full permissions on all VMs
    return vms.map((vm) => ({
      ...vm,
      permissions: ["view", "console", "start", "stop", "restart"],
    }));
  }

  // For regular users, filter based on assignments
  const { data: assignments } = await supabase
    .from("user_vm_assignments")
    .select("vm_id, node_name, vm_name, permissions")
    .eq("user_id", userId);

  if (!assignments || assignments.length === 0) {
    return [];
  }

  const assignedVmIds = assignments.map((a) => a.vm_id);
  
  return vms
    .filter((vm) => assignedVmIds.includes(vm.vmid))
    .map((vm) => {
      const assignment = assignments.find((a) => a.vm_id === vm.vmid);
      return {
        ...vm,
        permissions: assignment?.permissions || ["view"],
      };
    });
}