import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ConnectionMetricsRequest {
  action: 'record' | 'calculate-optimal' | 'cleanup' | 'get-stats' | 'get-history';
  serverId?: string;
  // For 'record' action
  success?: boolean;
  responseTimeMs?: number;
  errorMessage?: string;
  usedTailscale?: boolean;
  timeoutUsedMs?: number;
  retryCount?: number;
}

function calculatePercentile(values: number[], percentile: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
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

    const body: ConnectionMetricsRequest = await req.json();
    const { action, serverId } = body;

    switch (action) {
      case 'record': {
        if (!serverId) {
          return new Response(
            JSON.stringify({ error: "Server ID required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { success, responseTimeMs, errorMessage, usedTailscale, timeoutUsedMs, retryCount } = body;

        const { data: metric, error } = await supabase
          .from("connection_metrics")
          .insert({
            server_id: serverId,
            success: success ?? false,
            response_time_ms: responseTimeMs || null,
            error_message: errorMessage || null,
            used_tailscale: usedTailscale ?? false,
            timeout_used_ms: timeoutUsedMs || null,
            retry_count: retryCount ?? 0,
          })
          .select()
          .single();

        if (error) throw error;

        // After recording, recalculate optimal timeout
        await updateServerStats(supabase, serverId);

        return new Response(
          JSON.stringify({ metric }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case 'calculate-optimal': {
        if (!serverId) {
          return new Response(
            JSON.stringify({ error: "Server ID required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const stats = await updateServerStats(supabase, serverId);

        return new Response(
          JSON.stringify({ stats }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case 'get-stats': {
        if (!serverId) {
          return new Response(
            JSON.stringify({ error: "Server ID required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Get last 100 metrics for the server
        const { data: metrics, error } = await supabase
          .from("connection_metrics")
          .select("*")
          .eq("server_id", serverId)
          .order("created_at", { ascending: false })
          .limit(100);

        if (error) throw error;

        const successfulResponses = (metrics || [])
          .filter(m => m.success && m.response_time_ms)
          .map(m => m.response_time_ms!);

        const totalCount = metrics?.length || 0;
        const successCount = (metrics || []).filter(m => m.success).length;

        return new Response(
          JSON.stringify({
            stats: {
              totalConnections: totalCount,
              successfulConnections: successCount,
              successRate: totalCount > 0 ? Math.round((successCount / totalCount) * 100) : 0,
              avgResponseTimeMs: successfulResponses.length > 0 
                ? Math.round(successfulResponses.reduce((a, b) => a + b, 0) / successfulResponses.length)
                : null,
              p95ResponseTimeMs: calculatePercentile(successfulResponses, 95),
              recentErrors: (metrics || [])
                .filter(m => !m.success && m.error_message)
                .slice(0, 5)
                .map(m => ({ error: m.error_message, timestamp: m.created_at })),
            }
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case 'cleanup': {
        // Delete metrics older than 30 days
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const { error } = await supabase
          .from("connection_metrics")
          .delete()
          .lt("created_at", thirtyDaysAgo.toISOString());

        if (error) throw error;

        return new Response(
          JSON.stringify({ success: true, message: "Old metrics cleaned up" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case 'get-history': {
        if (!serverId) {
          return new Response(
            JSON.stringify({ error: "Server ID required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Get metrics from last 24 hours
        const twentyFourHoursAgo = new Date();
        twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

        const { data: metrics, error } = await supabase
          .from("connection_metrics")
          .select("success, response_time_ms, created_at, used_tailscale, error_message")
          .eq("server_id", serverId)
          .gte("created_at", twentyFourHoursAgo.toISOString())
          .order("created_at", { ascending: true });

        if (error) throw error;

        // Group by hour for chart display
        const hourlyData = groupByHour(metrics || []);

        const successfulResponses = (metrics || [])
          .filter((m: { success: boolean; response_time_ms: number | null }) => m.success && m.response_time_ms)
          .map((m: { response_time_ms: number }) => m.response_time_ms);

        return new Response(
          JSON.stringify({
            history: {
              hourly: hourlyData,
              summary: {
                totalAttempts: metrics?.length || 0,
                successCount: (metrics || []).filter((m: { success: boolean }) => m.success).length,
                avgResponseTime: successfulResponses.length > 0 
                  ? Math.round(successfulResponses.reduce((a: number, b: number) => a + b, 0) / successfulResponses.length)
                  : null,
              }
            }
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: "Unknown action" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
  } catch (error) {
    console.error("Connection metrics error:", error);
    return new Response(
      JSON.stringify({ error: (error as Error).message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function updateServerStats(supabase: any, serverId: string) {
  // Get last 100 successful connections
  const { data: metrics } = await supabase
    .from("connection_metrics")
    .select("success, response_time_ms")
    .eq("server_id", serverId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (!metrics || metrics.length === 0) {
    return { learned_timeout_ms: null, avg_response_time_ms: null, success_rate: null };
  }

  const successfulResponses = metrics
    .filter(m => m.success && m.response_time_ms)
    .map(m => m.response_time_ms!);

  const totalCount = metrics.length;
  const successCount = metrics.filter(m => m.success).length;
  const successRate = Math.round((successCount / totalCount) * 10000) / 100; // 2 decimal places

  let avgResponseTimeMs = null;
  let learnedTimeoutMs = null;

  if (successfulResponses.length >= 10) {
    avgResponseTimeMs = Math.round(
      successfulResponses.reduce((a, b) => a + b, 0) / successfulResponses.length
    );

    // Calculate optimal timeout: P95 response time + 50% buffer
    const p95 = calculatePercentile(successfulResponses, 95);
    learnedTimeoutMs = Math.max(5000, Math.min(120000, Math.round(p95 * 1.5)));
  }

  // Update server with learned values
  const { error } = await supabase
    .from("proxmox_servers")
    .update({
      learned_timeout_ms: learnedTimeoutMs,
      avg_response_time_ms: avgResponseTimeMs,
      success_rate: successRate,
    })
    .eq("id", serverId);

  if (error) {
    console.error("Failed to update server stats:", error);
  }

  return {
    learned_timeout_ms: learnedTimeoutMs,
    avg_response_time_ms: avgResponseTimeMs,
    success_rate: successRate,
  };
}

interface MetricRecord {
  created_at: string;
  success: boolean;
  response_time_ms: number | null;
}

function groupByHour(metrics: MetricRecord[]) {
  const hourlyMap = new Map<string, { success: number; failed: number; responseTimes: number[] }>();
  
  metrics.forEach(m => {
    const hour = new Date(m.created_at).toISOString().slice(0, 13) + ":00:00Z";
    if (!hourlyMap.has(hour)) {
      hourlyMap.set(hour, { success: 0, failed: 0, responseTimes: [] });
    }
    const data = hourlyMap.get(hour)!;
    if (m.success) {
      data.success++;
      if (m.response_time_ms) data.responseTimes.push(m.response_time_ms);
    } else {
      data.failed++;
    }
  });

  // Calculate averages and format for chart
  return Array.from(hourlyMap.entries()).map(([hour, data]) => ({
    time: hour,
    successRate: data.success + data.failed > 0 
      ? Math.round((data.success / (data.success + data.failed)) * 100) 
      : 100,
    avgResponseTime: data.responseTimes.length > 0
      ? Math.round(data.responseTimes.reduce((a, b) => a + b, 0) / data.responseTimes.length)
      : null,
    attempts: data.success + data.failed,
  }));
}
