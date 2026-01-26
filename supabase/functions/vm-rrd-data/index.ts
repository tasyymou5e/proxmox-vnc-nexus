import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { decryptToken } from "../_shared/proxmox-utils.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RrdDataRequest {
  serverId: string;
  node: string;
  vmid: number;
  vmtype: "qemu" | "lxc";
  timeframe?: "hour" | "day" | "week" | "month" | "year";
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

    const body: RrdDataRequest = await req.json();
    const { serverId, node, vmid, vmtype, timeframe = "hour" } = body;

    if (!serverId || !node || !vmid || !vmtype) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: serverId, node, vmid, vmtype" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const encryptionKey = Deno.env.get("PROXMOX_ENCRYPTION_KEY");
    if (!encryptionKey) {
      return new Response(
        JSON.stringify({ error: "Encryption key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get server details
    const { data: server, error: serverError } = await supabase
      .from("proxmox_servers")
      .select("id, host, port, api_token_encrypted, use_tailscale, tailscale_hostname, tailscale_port, connection_timeout")
      .eq("id", serverId)
      .eq("is_active", true)
      .single();

    if (serverError || !server) {
      return new Response(
        JSON.stringify({ error: "Server not found or access denied" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const decryptedToken = decryptToken(server.api_token_encrypted, encryptionKey);
    
    const useTailscale = server.use_tailscale && !!server.tailscale_hostname;
    const effectiveHost = useTailscale ? server.tailscale_hostname : server.host;
    const effectivePort = useTailscale ? (server.tailscale_port || server.port) : server.port;
    const timeout = server.connection_timeout || 10000;

    // Fetch RRD data from Proxmox
    const rrdUrl = `https://${effectiveHost}:${effectivePort}/api2/json/nodes/${node}/${vmtype}/${vmid}/rrddata?timeframe=${timeframe}`;
    
    const proxmoxResponse = await fetch(rrdUrl, {
      headers: { "Authorization": `PVEAPIToken=${decryptedToken}` },
      signal: AbortSignal.timeout(timeout),
    });

    if (!proxmoxResponse.ok) {
      const errorText = await proxmoxResponse.text();
      return new Response(
        JSON.stringify({ error: "Failed to fetch RRD data", details: errorText }),
        { status: proxmoxResponse.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const rrdData = await proxmoxResponse.json();
    
    // Process and format the data for charts
    const formattedData = (rrdData.data || []).map((point: Record<string, unknown>) => ({
      time: point.time ? new Date((point.time as number) * 1000).toISOString() : null,
      cpu: point.cpu !== undefined ? Math.round((point.cpu as number) * 100) : null,
      memory: point.mem !== undefined && point.maxmem !== undefined 
        ? Math.round(((point.mem as number) / (point.maxmem as number)) * 100) 
        : null,
      memoryUsed: point.mem,
      memoryMax: point.maxmem,
      disk: point.disk !== undefined && point.maxdisk !== undefined
        ? Math.round(((point.disk as number) / (point.maxdisk as number)) * 100)
        : null,
      diskRead: point.diskread,
      diskWrite: point.diskwrite,
      netIn: point.netin,
      netOut: point.netout,
    })).filter((p: Record<string, unknown>) => p.time !== null);

    return new Response(
      JSON.stringify({ data: formattedData, timeframe }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("VM RRD data error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
