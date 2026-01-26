import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Simple XOR-based encryption for API tokens (production should use AES)
function encryptToken(token: string, key: string): string {
  const keyBytes = new TextEncoder().encode(key);
  const tokenBytes = new TextEncoder().encode(token);
  const encrypted = new Uint8Array(tokenBytes.length);
  
  for (let i = 0; i < tokenBytes.length; i++) {
    encrypted[i] = tokenBytes[i] ^ keyBytes[i % keyBytes.length];
  }
  
  return btoa(String.fromCharCode(...encrypted));
}

function decryptToken(encryptedToken: string, key: string): string {
  const keyBytes = new TextEncoder().encode(key);
  const encrypted = Uint8Array.from(atob(encryptedToken), c => c.charCodeAt(0));
  const decrypted = new Uint8Array(encrypted.length);
  
  for (let i = 0; i < encrypted.length; i++) {
    decrypted[i] = encrypted[i] ^ keyBytes[i % keyBytes.length];
  }
  
  return new TextDecoder().decode(decrypted);
}

interface ServerInput {
  name: string;
  host: string;
  port: number;
  api_token: string;
  verify_ssl?: boolean;
  use_tailscale?: boolean;
  tailscale_hostname?: string;
  tailscale_port?: number;
  connection_timeout?: number;
}

interface HealthCheckResult {
  serverId: string;
  serverName: string;
  status: 'online' | 'offline';
  error?: string;
  nodes?: number;
}

interface ImportError {
  index: number;
  name: string;
  error: string;
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
    
    if (!encryptionKey) {
      return new Response(
        JSON.stringify({ error: "Encryption key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const url = new URL(req.url);
    const pathParts = url.pathname.split("/").filter(Boolean);
    const action = pathParts[pathParts.length - 1];

    // Handle different HTTP methods and actions
    if (req.method === "GET") {
      // List all servers for the user
      const { data: servers, error } = await supabase
        .from("proxmox_servers")
        .select("id, name, host, port, verify_ssl, is_active, last_connected_at, created_at, updated_at, connection_status, last_health_check_at, health_check_error, use_tailscale, tailscale_hostname, tailscale_port, connection_timeout")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (error) {
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ servers: servers || [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (req.method === "POST") {
      const body = await req.json();

      // Health check all servers
      if (action === "health-check-all" || body.action === "health-check-all") {
        const { data: servers } = await supabase
          .from("proxmox_servers")
          .select("id, name, host, port, api_token_encrypted, is_active, use_tailscale, tailscale_hostname, tailscale_port, connection_timeout")
          .eq("user_id", userId)
          .eq("is_active", true);

        if (!servers || servers.length === 0) {
          return new Response(
            JSON.stringify({ results: [], message: "No active servers to check" }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const results: HealthCheckResult[] = [];

        // Check all servers in parallel
        await Promise.all(servers.map(async (server) => {
          const result: HealthCheckResult = {
            serverId: server.id,
            serverName: server.name,
            status: 'offline',
          };

          try {
            const decryptedToken = decryptToken(server.api_token_encrypted, encryptionKey);
            
            // Use Tailscale host/port if enabled
            const useTailscale = server.use_tailscale && !!server.tailscale_hostname;
            const effectiveHost = useTailscale ? server.tailscale_hostname : server.host;
            const effectivePort = useTailscale ? (server.tailscale_port || server.port) : server.port;
            const timeout = server.connection_timeout || 10000;
            
            const testUrl = `https://${effectiveHost}:${effectivePort}/api2/json/nodes`;
            const testResponse = await fetch(testUrl, {
              headers: { "Authorization": `PVEAPIToken=${decryptedToken}` },
              signal: AbortSignal.timeout(timeout),
            });

            if (testResponse.ok) {
              const testData = await testResponse.json();
              result.status = 'online';
              result.nodes = testData.data?.length || 0;

              // Update database
              await supabase
                .from("proxmox_servers")
                .update({
                  connection_status: 'online',
                  last_health_check_at: new Date().toISOString(),
                  last_connected_at: new Date().toISOString(),
                  health_check_error: null,
                })
                .eq("id", server.id)
                .eq("user_id", userId);
            } else {
              const errorData = await testResponse.json().catch(() => ({}));
              result.error = errorData.errors || `HTTP ${testResponse.status}`;

              await supabase
                .from("proxmox_servers")
                .update({
                  connection_status: 'offline',
                  last_health_check_at: new Date().toISOString(),
                  health_check_error: result.error,
                })
                .eq("id", server.id)
                .eq("user_id", userId);
            }
          } catch (err) {
            result.error = err.message || "Connection failed";

            await supabase
              .from("proxmox_servers")
              .update({
                connection_status: 'offline',
                last_health_check_at: new Date().toISOString(),
                health_check_error: result.error,
              })
              .eq("id", server.id)
              .eq("user_id", userId);
          }

          results.push(result);
        }));

        return new Response(
          JSON.stringify({ results }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Bulk import servers
      if (action === "bulk-import" || body.action === "bulk-import") {
        const { servers: serversToImport }: { servers: ServerInput[] } = body;

        if (!serversToImport || !Array.isArray(serversToImport) || serversToImport.length === 0) {
          return new Response(
            JSON.stringify({ error: "No servers provided for import" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Check server limit
        const { count: currentCount } = await supabase
          .from("proxmox_servers")
          .select("*", { count: "exact", head: true })
          .eq("user_id", userId);

        const remainingSlots = 50 - (currentCount || 0);
        if (serversToImport.length > remainingSlots) {
          return new Response(
            JSON.stringify({ 
              error: `Cannot import ${serversToImport.length} servers. Only ${remainingSlots} slots remaining.` 
            }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const tokenRegex = /^[\w.-]+@[\w.-]+![\w.-]+=[\w-]+$/;
        const failed: ImportError[] = [];
        const successful: string[] = [];

        for (let i = 0; i < serversToImport.length; i++) {
          const server = serversToImport[i];
          
          // Validate required fields
          if (!server.name?.trim()) {
            failed.push({ index: i, name: server.name || `Server ${i + 1}`, error: "Name is required" });
            continue;
          }
          if (!server.host?.trim()) {
            failed.push({ index: i, name: server.name, error: "Host is required" });
            continue;
          }
          if (!server.api_token?.trim()) {
            failed.push({ index: i, name: server.name, error: "API token is required" });
            continue;
          }
          if (!tokenRegex.test(server.api_token)) {
            failed.push({ index: i, name: server.name, error: "Invalid API token format" });
            continue;
          }

          const encryptedToken = encryptToken(server.api_token, encryptionKey);

          const insertData: Record<string, unknown> = {
            user_id: userId,
            name: server.name.trim(),
            host: server.host.trim(),
            port: server.port || 8006,
            api_token_encrypted: encryptedToken,
            verify_ssl: server.verify_ssl !== false,
            connection_status: 'unknown',
            use_tailscale: server.use_tailscale || false,
            tailscale_hostname: server.tailscale_hostname?.trim() || null,
            tailscale_port: server.tailscale_port || 8006,
          };
          
          // Add connection_timeout if provided (in seconds from CSV, convert to ms)
          if ((server as ServerInput & { connection_timeout?: number }).connection_timeout) {
            insertData.connection_timeout = (server as ServerInput & { connection_timeout?: number }).connection_timeout! * 1000;
          }

          const { error: insertError } = await supabase
            .from("proxmox_servers")
            .insert(insertData);

          if (insertError) {
            if (insertError.code === "23505") {
              failed.push({ index: i, name: server.name, error: "Server already exists" });
            } else {
              failed.push({ index: i, name: server.name, error: insertError.message });
            }
          } else {
            successful.push(server.name);
          }
        }

        return new Response(
          JSON.stringify({ 
            success: successful.length, 
            failed,
            message: `Imported ${successful.length} of ${serversToImport.length} servers`
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Test connection endpoint
      if (action === "test" || body.action === "test") {
        const { host, port, api_token, server_id } = body;
        
        let tokenToUse = api_token;
        let serverHost = host;
        let serverPort = port;
        let timeout = 10000;
        
        // If server_id is provided, get the token from database
        if (server_id && !api_token) {
          const { data: server } = await supabase
            .from("proxmox_servers")
            .select("api_token_encrypted, host, port, use_tailscale, tailscale_hostname, tailscale_port, connection_timeout")
            .eq("id", server_id)
            .eq("user_id", userId)
            .single();
          
          if (!server) {
            return new Response(
              JSON.stringify({ error: "Server not found" }),
              { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
          
          tokenToUse = decryptToken(server.api_token_encrypted, encryptionKey);
          
          // Use Tailscale host/port if enabled
          const useTailscale = server.use_tailscale && !!server.tailscale_hostname;
          serverHost = useTailscale ? server.tailscale_hostname : server.host;
          serverPort = useTailscale ? (server.tailscale_port || server.port) : server.port;
          timeout = server.connection_timeout || 10000;
        }

        if (!serverHost || !serverPort || !tokenToUse) {
          return new Response(
            JSON.stringify({ error: "Host, port, and API token are required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        try {
          const testUrl = `https://${serverHost}:${serverPort}/api2/json/nodes`;
          const testResponse = await fetch(testUrl, {
            headers: {
              "Authorization": `PVEAPIToken=${tokenToUse}`,
            },
            signal: AbortSignal.timeout(timeout),
          });

          const testData = await testResponse.json();

          if (!testResponse.ok) {
            // Update status if server_id provided
            if (server_id) {
              await supabase
                .from("proxmox_servers")
                .update({ 
                  connection_status: 'offline',
                  last_health_check_at: new Date().toISOString(),
                  health_check_error: testData.errors || "Connection failed"
                })
                .eq("id", server_id)
                .eq("user_id", userId);
            }

            return new Response(
              JSON.stringify({ 
                success: false, 
                error: testData.errors || "Failed to connect to Proxmox server",
                status: testResponse.status 
              }),
              { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }

          // Update last_connected_at and status if server_id was provided
          if (server_id) {
            await supabase
              .from("proxmox_servers")
              .update({ 
                last_connected_at: new Date().toISOString(),
                connection_status: 'online',
                last_health_check_at: new Date().toISOString(),
                health_check_error: null
              })
              .eq("id", server_id)
              .eq("user_id", userId);
          }

          return new Response(
            JSON.stringify({ 
              success: true, 
              message: "Connection successful",
              nodes: testData.data?.length || 0
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        } catch (error) {
          // Update status if server_id provided
          if (server_id) {
            await supabase
              .from("proxmox_servers")
              .update({ 
                connection_status: 'offline',
                last_health_check_at: new Date().toISOString(),
                health_check_error: error.message || "Connection failed"
              })
              .eq("id", server_id)
              .eq("user_id", userId);
          }

          return new Response(
            JSON.stringify({ 
              success: false, 
              error: error.message || "Connection failed" 
            }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }

      // Create new server
      const { 
        name, 
        host, 
        port, 
        api_token, 
        verify_ssl = true,
        use_tailscale = false,
        tailscale_hostname,
        tailscale_port = 8006,
        connection_timeout = 10000
      }: ServerInput = body;

      if (!name || !host || !port || !api_token) {
        return new Response(
          JSON.stringify({ error: "Name, host, port, and API token are required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Validate API token format
      const tokenRegex = /^[\w.-]+@[\w.-]+![\w.-]+=[\w-]+$/;
      if (!tokenRegex.test(api_token)) {
        return new Response(
          JSON.stringify({ error: "Invalid API token format. Expected: USER@REALM!TOKENID=UUID" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check server limit
      const { count } = await supabase
        .from("proxmox_servers")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId);

      if (count && count >= 50) {
        return new Response(
          JSON.stringify({ error: "Maximum number of servers (50) reached" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Encrypt the token
      const encryptedToken = encryptToken(api_token, encryptionKey);

      const { data: server, error } = await supabase
        .from("proxmox_servers")
        .insert({
          user_id: userId,
          name,
          host,
          port,
          api_token_encrypted: encryptedToken,
          verify_ssl,
          connection_status: 'unknown',
          use_tailscale,
          tailscale_hostname: tailscale_hostname?.trim() || null,
          tailscale_port,
          connection_timeout: Math.min(Math.max(connection_timeout, 5000), 120000), // Clamp between 5s and 120s
        })
        .select("id, name, host, port, verify_ssl, is_active, created_at, updated_at, connection_status, last_health_check_at, health_check_error, use_tailscale, tailscale_hostname, tailscale_port, connection_timeout")
        .single();

      if (error) {
        if (error.code === "23505") {
          return new Response(
            JSON.stringify({ error: "A server with this host and port already exists" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ server }),
        { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (req.method === "PUT") {
      const body = await req.json();
      const { id, name, host, port, api_token, verify_ssl, is_active, use_tailscale, tailscale_hostname, tailscale_port } = body;

      if (!id) {
        return new Response(
          JSON.stringify({ error: "Server ID is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const updateData: Record<string, unknown> = {};
      if (name !== undefined) updateData.name = name;
      if (host !== undefined) updateData.host = host;
      if (port !== undefined) updateData.port = port;
      if (verify_ssl !== undefined) updateData.verify_ssl = verify_ssl;
      if (use_tailscale !== undefined) updateData.use_tailscale = use_tailscale;
      if (tailscale_hostname !== undefined) updateData.tailscale_hostname = tailscale_hostname?.trim() || null;
      if (tailscale_port !== undefined) updateData.tailscale_port = tailscale_port;
      if (is_active !== undefined) updateData.is_active = is_active;
      
      // If new API token provided, encrypt it
      if (api_token) {
        const tokenRegex = /^[\w.-]+@[\w.-]+![\w.-]+=[\w-]+$/;
        if (!tokenRegex.test(api_token)) {
          return new Response(
            JSON.stringify({ error: "Invalid API token format. Expected: USER@REALM!TOKENID=UUID" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        updateData.api_token_encrypted = encryptToken(api_token, encryptionKey);
      }

      const { data: server, error } = await supabase
        .from("proxmox_servers")
        .update(updateData)
        .eq("id", id)
        .eq("user_id", userId)
        .select("id, name, host, port, verify_ssl, is_active, last_connected_at, created_at, updated_at, connection_status, last_health_check_at, health_check_error, use_tailscale, tailscale_hostname, tailscale_port")
        .single();

      if (error) {
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!server) {
        return new Response(
          JSON.stringify({ error: "Server not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ server }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (req.method === "DELETE") {
      const body = await req.json();
      const { id } = body;

      if (!id) {
        return new Response(
          JSON.stringify({ error: "Server ID is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { error } = await supabase
        .from("proxmox_servers")
        .delete()
        .eq("id", id)
        .eq("user_id", userId);

      if (error) {
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Proxmox servers error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});