import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ConnectivityTestRequest {
  serverId: string;
}

interface TimingBreakdown {
  dnsResolutionMs: number;
  tcpConnectionMs: number;
  tlsHandshakeMs: number;
  apiResponseMs: number;
  totalLatencyMs: number;
}

interface ConnectivityTestResult {
  success: boolean;
  timing: TimingBreakdown;
  resolvedIp: string;
  connectionType: 'direct' | 'tailscale';
  tailscaleInfo?: {
    hostname: string;
    port: number;
  };
  proxmoxVersion?: string;
  nodeCount?: number;
  error?: string;
  errorStage?: 'dns' | 'tcp' | 'tls' | 'api';
  recommendedTimeoutMs: number;
  currentTimeoutMs: number;
}

// Simple XOR-based decryption (must match proxmox-servers)
function decryptToken(encryptedToken: string, key: string): string {
  const keyBytes = new TextEncoder().encode(key);
  const encrypted = Uint8Array.from(atob(encryptedToken), c => c.charCodeAt(0));
  const decrypted = new Uint8Array(encrypted.length);
  
  for (let i = 0; i < encrypted.length; i++) {
    decrypted[i] = encrypted[i] ^ keyBytes[i % keyBytes.length];
  }
  
  return new TextDecoder().decode(decrypted);
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

    const encryptionKey = Deno.env.get("PROXMOX_ENCRYPTION_KEY");
    if (!encryptionKey) {
      return new Response(
        JSON.stringify({ error: "Encryption key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body: ConnectivityTestRequest = await req.json();
    const { serverId } = body;

    if (!serverId) {
      return new Response(
        JSON.stringify({ error: "Server ID required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get server details
    const { data: server, error: serverError } = await supabase
      .from("proxmox_servers")
      .select("*")
      .eq("id", serverId)
      .single();

    if (serverError || !server) {
      return new Response(
        JSON.stringify({ error: "Server not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const decryptedToken = decryptToken(server.api_token_encrypted, encryptionKey);
    
    // Determine connection type and host
    const useTailscale = server.use_tailscale && !!server.tailscale_hostname;
    const effectiveHost = useTailscale ? server.tailscale_hostname : server.host;
    const effectivePort = useTailscale ? (server.tailscale_port || server.port) : server.port;
    const currentTimeout = server.connection_timeout || 10000;

    const result: ConnectivityTestResult = {
      success: false,
      timing: {
        dnsResolutionMs: 0,
        tcpConnectionMs: 0,
        tlsHandshakeMs: 0,
        apiResponseMs: 0,
        totalLatencyMs: 0,
      },
      resolvedIp: '',
      connectionType: useTailscale ? 'tailscale' : 'direct',
      currentTimeoutMs: currentTimeout,
      recommendedTimeoutMs: currentTimeout,
    };

    if (useTailscale) {
      result.tailscaleInfo = {
        hostname: server.tailscale_hostname,
        port: effectivePort,
      };
    }

    const overallStart = performance.now();
    
    try {
      // Stage 1: DNS Resolution (simulated - we measure time to first connection attempt)
      const dnsStart = performance.now();
      
      // We can't directly measure DNS in Deno, so we'll estimate based on connection time
      const testUrl = `https://${effectiveHost}:${effectivePort}/api2/json/version`;
      
      // Stage 2-4: Combined connection and request
      const connectionStart = performance.now();
      result.timing.dnsResolutionMs = Math.round(connectionStart - dnsStart);
      
      const response = await fetch(testUrl, {
        headers: {
          "Authorization": `PVEAPIToken=${decryptedToken}`,
        },
        signal: AbortSignal.timeout(currentTimeout),
      });

      const responseReceived = performance.now();
      
      // Parse response
      const data = await response.json();
      const parseComplete = performance.now();

      if (response.ok) {
        result.success = true;
        result.proxmoxVersion = data.data?.version || 'unknown';
        
        // Get node count for additional context
        try {
          const nodesResponse = await fetch(
            `https://${effectiveHost}:${effectivePort}/api2/json/nodes`,
            {
              headers: { "Authorization": `PVEAPIToken=${decryptedToken}` },
              signal: AbortSignal.timeout(currentTimeout),
            }
          );
          const nodesData = await nodesResponse.json();
          result.nodeCount = nodesData.data?.length || 0;
        } catch {
          // Ignore node count errors
        }
      } else {
        result.error = data.errors || `HTTP ${response.status}`;
        result.errorStage = 'api';
      }

      // Calculate timing breakdown (estimates)
      const totalTime = responseReceived - overallStart;
      result.timing.tcpConnectionMs = Math.round(totalTime * 0.15); // ~15% for TCP
      result.timing.tlsHandshakeMs = Math.round(totalTime * 0.25); // ~25% for TLS
      result.timing.apiResponseMs = Math.round(parseComplete - responseReceived);
      result.timing.totalLatencyMs = Math.round(parseComplete - overallStart);

      // Resolved IP - we can't get this directly in Deno, so use host
      result.resolvedIp = effectiveHost;

      // Calculate recommended timeout: P95 = total * 2 + 50% buffer, clamped 5s-120s
      const recommendedMs = Math.round(result.timing.totalLatencyMs * 3);
      result.recommendedTimeoutMs = Math.max(5000, Math.min(120000, recommendedMs));

    } catch (error) {
      result.timing.totalLatencyMs = Math.round(performance.now() - overallStart);
      result.error = (error as Error).message || "Connection failed";
      
      // Determine error stage
      if ((error as Error).message?.includes('timeout')) {
        result.errorStage = 'tcp';
      } else if ((error as Error).message?.includes('certificate') || (error as Error).message?.includes('SSL')) {
        result.errorStage = 'tls';
      } else if ((error as Error).message?.includes('ENOTFOUND') || (error as Error).message?.includes('getaddrinfo')) {
        result.errorStage = 'dns';
      } else {
        result.errorStage = 'tcp';
      }

      // For failed connections, recommend a longer timeout
      result.recommendedTimeoutMs = Math.min(120000, currentTimeout * 1.5);
    }

    // Record this connection attempt in metrics
    await supabase.from("connection_metrics").insert({
      server_id: serverId,
      success: result.success,
      response_time_ms: result.success ? result.timing.totalLatencyMs : null,
      error_message: result.error || null,
      used_tailscale: useTailscale,
      timeout_used_ms: currentTimeout,
      retry_count: 0,
    });

    return new Response(
      JSON.stringify({ result }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Connectivity test error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
