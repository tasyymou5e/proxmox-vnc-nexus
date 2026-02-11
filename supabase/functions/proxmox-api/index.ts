import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ProxmoxRequest {
  path: string;
  method?: string;
  body?: Record<string, unknown>;
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
    const { data: claimsData, error: claimsError } = await supabase.auth.getUser(token);
    
    if (claimsError || !claimsData.user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get request body
    const { path, method = "GET", body }: ProxmoxRequest = await req.json();

    if (!path) {
      return new Response(
        JSON.stringify({ error: "Path is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get Proxmox credentials from environment
    const proxmoxHost = Deno.env.get("PROXMOX_HOST");
    const proxmoxPort = Deno.env.get("PROXMOX_PORT") || "8006";
    const proxmoxToken = Deno.env.get("PROXMOX_API_TOKEN");

    if (!proxmoxHost || !proxmoxToken) {
      return new Response(
        JSON.stringify({ error: "Proxmox configuration missing" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Make request to Proxmox API
    const proxmoxUrl = `https://${proxmoxHost}:${proxmoxPort}/api2/json${path}`;
    
    const fetchOptions: RequestInit = {
      method,
      headers: {
        "Authorization": `PVEAPIToken=${proxmoxToken}`,
        "Content-Type": "application/json",
      },
    };

    if (body && method !== "GET") {
      fetchOptions.body = JSON.stringify(body);
    }

    const proxmoxResponse = await fetch(proxmoxUrl, fetchOptions);
    const data = await proxmoxResponse.json();

    return new Response(
      JSON.stringify(data),
      { 
        status: proxmoxResponse.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  } catch (error) {
    console.error("Proxmox API error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
