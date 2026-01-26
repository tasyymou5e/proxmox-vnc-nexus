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
        .select("id, name, host, port, verify_ssl, is_active, last_connected_at, created_at, updated_at")
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

      // Test connection endpoint
      if (action === "test" || body.action === "test") {
        const { host, port, api_token, server_id } = body;
        
        let tokenToUse = api_token;
        
        // If server_id is provided, get the token from database
        if (server_id && !api_token) {
          const { data: server } = await supabase
            .from("proxmox_servers")
            .select("api_token_encrypted, host, port")
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
        }

        if (!host || !port || !tokenToUse) {
          return new Response(
            JSON.stringify({ error: "Host, port, and API token are required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        try {
          const testUrl = `https://${host}:${port}/api2/json/nodes`;
          const testResponse = await fetch(testUrl, {
            headers: {
              "Authorization": `PVEAPIToken=${tokenToUse}`,
            },
          });

          const testData = await testResponse.json();

          if (!testResponse.ok) {
            return new Response(
              JSON.stringify({ 
                success: false, 
                error: testData.errors || "Failed to connect to Proxmox server",
                status: testResponse.status 
              }),
              { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }

          // Update last_connected_at if server_id was provided
          if (server_id) {
            await supabase
              .from("proxmox_servers")
              .update({ last_connected_at: new Date().toISOString() })
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
      const { name, host, port, api_token, verify_ssl = true }: ServerInput = body;

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
        })
        .select("id, name, host, port, verify_ssl, is_active, created_at, updated_at")
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
      const { id, name, host, port, api_token, verify_ssl, is_active } = body;

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
        .select("id, name, host, port, verify_ssl, is_active, last_connected_at, created_at, updated_at")
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
