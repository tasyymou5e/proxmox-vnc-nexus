import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Check for WebSocket upgrade
  const upgrade = req.headers.get("upgrade") || "";
  if (upgrade.toLowerCase() !== "websocket") {
    return new Response(
      JSON.stringify({ error: "Expected WebSocket upgrade request" }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  try {
    // Extract params from URL (browsers can't send custom headers for WS)
    const url = new URL(req.url);
    const jwt = url.searchParams.get("jwt");
    const node = url.searchParams.get("node");
    const vmid = url.searchParams.get("vmid");
    const vmType = url.searchParams.get("type") || "qemu";

    if (!jwt || !node || !vmid) {
      return new Response(
        JSON.stringify({ error: "Missing required parameters: jwt, node, vmid" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Authenticate user
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: `Bearer ${jwt}` } }, db: { schema: 'api' } }
    );

    const { data: userData, error: userError } = await supabase.auth.getUser(jwt);

    if (userError || !userData.user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
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

    // If not admin, check user has console permission for this VM
    if (!isAdmin) {
      const { data: assignment } = await supabase
        .from("user_vm_assignments")
        .select("permissions")
        .eq("user_id", userId)
        .eq("vm_id", parseInt(vmid))
        .eq("node_name", node)
        .single();

      if (!assignment || !assignment.permissions?.includes("console")) {
        return new Response(
          JSON.stringify({ error: "You don't have console access to this VM" }),
          {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
    }

    // Get Proxmox credentials
    const proxmoxHost = Deno.env.get("PROXMOX_HOST");
    const proxmoxPort = Deno.env.get("PROXMOX_PORT") || "8006";
    const proxmoxToken = Deno.env.get("PROXMOX_API_TOKEN");

    if (!proxmoxHost || !proxmoxToken) {
      return new Response(
        JSON.stringify({ error: "Proxmox configuration missing" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Get VNC proxy ticket from Proxmox
    const vncProxyUrl = `https://${proxmoxHost}:${proxmoxPort}/api2/json/nodes/${node}/${vmType}/${vmid}/vncproxy`;

    const vncResponse = await fetch(vncProxyUrl, {
      method: "POST",
      headers: {
        Authorization: `PVEAPIToken=${proxmoxToken}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "websocket=1",
    });

    const vncData = await vncResponse.json();

    if (!vncResponse.ok) {
      return new Response(
        JSON.stringify({ error: "Failed to get VNC proxy from Proxmox", details: vncData }),
        {
          status: vncResponse.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { ticket, port } = vncData.data;

    // Build Proxmox WebSocket URL
    const proxmoxWsUrl = `wss://${proxmoxHost}:${proxmoxPort}/api2/json/nodes/${node}/${vmType}/${vmid}/vncwebsocket?port=${port}&vncticket=${encodeURIComponent(ticket)}`;

    // Upgrade client connection
    const { socket: clientSocket, response } = Deno.upgradeWebSocket(req);

    clientSocket.onopen = () => {
      console.log("Client WebSocket connected, connecting to Proxmox...");

      // Connect to Proxmox VNC WebSocket
      const proxmoxWS = new WebSocket(proxmoxWsUrl);
      proxmoxWS.binaryType = "arraybuffer";

      proxmoxWS.onopen = () => {
        console.log("Connected to Proxmox VNC WebSocket");
      };

      proxmoxWS.onmessage = (e) => {
        try {
          if (clientSocket.readyState === WebSocket.OPEN) {
            clientSocket.send(e.data);
          }
        } catch (err) {
          console.error("Error forwarding message to client:", err);
        }
      };

      proxmoxWS.onerror = (e) => {
        console.error("Proxmox WebSocket error:", e);
        if (clientSocket.readyState === WebSocket.OPEN) {
          clientSocket.close(1011, "Proxmox connection error");
        }
      };

      proxmoxWS.onclose = (e) => {
        console.log("Proxmox WebSocket closed:", e.code, e.reason);
        if (clientSocket.readyState === WebSocket.OPEN) {
          clientSocket.close(e.code, e.reason || "Proxmox connection closed");
        }
      };

      // Forward client messages to Proxmox
      clientSocket.onmessage = (e) => {
        try {
          if (proxmoxWS.readyState === WebSocket.OPEN) {
            proxmoxWS.send(e.data);
          }
        } catch (err) {
          console.error("Error forwarding message to Proxmox:", err);
        }
      };

      clientSocket.onerror = (e) => {
        console.error("Client WebSocket error:", e);
        if (proxmoxWS.readyState === WebSocket.OPEN) {
          proxmoxWS.close();
        }
      };

      clientSocket.onclose = (e) => {
        console.log("Client WebSocket closed:", e.code, e.reason);
        if (proxmoxWS.readyState === WebSocket.OPEN) {
          proxmoxWS.close();
        }
      };
    };

    // Log connection session
    await supabase.from("connection_sessions").insert({
      user_id: userId,
      vm_id: parseInt(vmid),
      node_name: node,
      status: "active",
    });

    return response;
  } catch (error) {
    console.error("VNC Relay error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
