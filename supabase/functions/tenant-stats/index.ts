import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { getProxmoxCredentials, decryptToken } from "../_shared/proxmox-utils.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface LiveTenantStats {
  totalVMs: number;
  runningVMs: number;
  stoppedVMs: number;
  totalContainers: number;
  runningContainers: number;
  stoppedContainers: number;
  nodes: {
    total: number;
    online: number;
    offline: number;
  };
  cpuUsage: {
    used: number;
    total: number;
    percentage: number;
  };
  memoryUsage: {
    used: number;
    total: number;
    percentage: number;
  };
  storageUsage: {
    used: number;
    total: number;
    percentage: number;
  };
  servers: {
    total: number;
    online: number;
    offline: number;
  };
  lastUpdated: string;
}

async function fetchProxmoxApi(
  host: string,
  port: string,
  token: string,
  path: string,
  timeout: number = 10000
): Promise<{ success: boolean; data?: unknown; error?: string }> {
  const url = `https://${host}:${port}/api2/json${path}`;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Authorization": `PVEAPIToken=${token}`,
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}` };
    }

    const json = await response.json();
    return { success: true, data: json.data };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const encryptionKey = Deno.env.get("PROXMOX_ENCRYPTION_KEY");

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub;
    const body = await req.json();
    const { action, tenantId } = body;

    if (!tenantId) {
      return new Response(JSON.stringify({ error: "tenantId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify user has access to this tenant
    const { data: hasAccess } = await supabase.rpc("user_has_tenant_access", {
      _user_id: userId,
      _tenant_id: tenantId,
    });

    // Also check if user is system admin
    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });

    if (!hasAccess && !isAdmin) {
      return new Response(JSON.stringify({ error: "Access denied to tenant" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "get-live-stats") {
      // Get all active servers for this tenant
      const { data: servers, error: serversError } = await supabase
        .from("proxmox_servers")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("is_active", true);

      if (serversError) {
        throw new Error(`Failed to fetch servers: ${serversError.message}`);
      }

      const stats: LiveTenantStats = {
        totalVMs: 0,
        runningVMs: 0,
        stoppedVMs: 0,
        totalContainers: 0,
        runningContainers: 0,
        stoppedContainers: 0,
        nodes: { total: 0, online: 0, offline: 0 },
        cpuUsage: { used: 0, total: 0, percentage: 0 },
        memoryUsage: { used: 0, total: 0, percentage: 0 },
        storageUsage: { used: 0, total: 0, percentage: 0 },
        servers: { total: servers?.length || 0, online: 0, offline: 0 },
        lastUpdated: new Date().toISOString(),
      };

      if (!servers || servers.length === 0) {
        return new Response(JSON.stringify({ stats }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Fetch data from each server in parallel
      const results = await Promise.all(
        servers.map(async (server) => {
          try {
            // Determine connection endpoint
            const useTailscale = server.use_tailscale && server.tailscale_hostname;
            const host = useTailscale ? server.tailscale_hostname : server.host;
            const port = useTailscale ? String(server.tailscale_port || 8006) : String(server.port);
            const timeout = server.connection_timeout || 10000;

            // Decrypt token
            let apiToken: string;
            if (encryptionKey) {
              apiToken = decryptToken(server.api_token_encrypted, encryptionKey);
            } else {
              apiToken = server.api_token_encrypted;
            }

            // Fetch resources and nodes
            const [resourcesResult, nodesResult] = await Promise.all([
              fetchProxmoxApi(host, port, apiToken, "/cluster/resources", timeout),
              fetchProxmoxApi(host, port, apiToken, "/nodes", timeout),
            ]);

            return {
              serverId: server.id,
              online: resourcesResult.success,
              resources: resourcesResult.data,
              nodes: nodesResult.data,
            };
          } catch (error) {
            console.error(`Error fetching from server ${server.id}:`, error);
            return { serverId: server.id, online: false, resources: null, nodes: null };
          }
        })
      );

      // Aggregate stats from all servers
      for (const result of results) {
        if (result.online) {
          stats.servers.online++;
        } else {
          stats.servers.offline++;
        }

        // Process resources
        if (result.resources && Array.isArray(result.resources)) {
          for (const resource of result.resources) {
            if (resource.type === "qemu") {
              stats.totalVMs++;
              if (resource.status === "running") {
                stats.runningVMs++;
              } else {
                stats.stoppedVMs++;
              }
            } else if (resource.type === "lxc") {
              stats.totalContainers++;
              if (resource.status === "running") {
                stats.runningContainers++;
              } else {
                stats.stoppedContainers++;
              }
            } else if (resource.type === "node") {
              stats.nodes.total++;
              if (resource.status === "online") {
                stats.nodes.online++;
              } else {
                stats.nodes.offline++;
              }
              
              // Aggregate CPU, memory
              if (resource.cpu !== undefined && resource.maxcpu !== undefined) {
                stats.cpuUsage.used += resource.cpu * resource.maxcpu;
                stats.cpuUsage.total += resource.maxcpu;
              }
              if (resource.mem !== undefined && resource.maxmem !== undefined) {
                stats.memoryUsage.used += resource.mem;
                stats.memoryUsage.total += resource.maxmem;
              }
            } else if (resource.type === "storage") {
              if (resource.disk !== undefined && resource.maxdisk !== undefined) {
                stats.storageUsage.used += resource.disk;
                stats.storageUsage.total += resource.maxdisk;
              }
            }
          }
        }
      }

      // Calculate percentages
      if (stats.cpuUsage.total > 0) {
        stats.cpuUsage.percentage = Math.round((stats.cpuUsage.used / stats.cpuUsage.total) * 100);
      }
      if (stats.memoryUsage.total > 0) {
        stats.memoryUsage.percentage = Math.round((stats.memoryUsage.used / stats.memoryUsage.total) * 100);
      }
      if (stats.storageUsage.total > 0) {
        stats.storageUsage.percentage = Math.round((stats.storageUsage.used / stats.storageUsage.total) * 100);
      }

      return new Response(JSON.stringify({ stats }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("tenant-stats error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
