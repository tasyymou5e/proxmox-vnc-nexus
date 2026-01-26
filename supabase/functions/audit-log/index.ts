import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AuditLogRequest {
  action: 'log' | 'list' | 'export';
  tenantId: string;
  // For 'log' action
  actionType?: string;
  resourceType?: string;
  resourceId?: string;
  resourceName?: string;
  details?: Record<string, unknown>;
  // For 'list' action
  filters?: {
    actionType?: string;
    resourceType?: string;
    startDate?: string;
    endDate?: string;
    search?: string;
    page?: number;
    limit?: number;
  };
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

    const userId = userData.user.id;
    const body: AuditLogRequest = await req.json();
    const { action, tenantId } = body;

    if (!tenantId) {
      return new Response(
        JSON.stringify({ error: "Tenant ID required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    switch (action) {
      case 'log': {
        const { actionType, resourceType, resourceId, resourceName, details } = body;

        if (!actionType || !resourceType) {
          return new Response(
            JSON.stringify({ error: "Action type and resource type are required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { data: log, error } = await supabase
          .from("audit_logs")
          .insert({
            tenant_id: tenantId,
            user_id: userId,
            action_type: actionType,
            resource_type: resourceType,
            resource_id: resourceId || null,
            resource_name: resourceName || null,
            details: details || {},
            ip_address: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip'),
            user_agent: req.headers.get('user-agent'),
          })
          .select()
          .single();

        if (error) throw error;

        return new Response(
          JSON.stringify({ log }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case 'list': {
        const { filters = {} } = body;
        const { actionType, resourceType, startDate, endDate, search, page = 1, limit = 50 } = filters;
        const offset = (page - 1) * limit;

        let query = supabase
          .from("audit_logs")
          .select(`
            *,
            profiles:user_id (
              email,
              full_name
            )
          `, { count: 'exact' })
          .eq("tenant_id", tenantId)
          .order("created_at", { ascending: false })
          .range(offset, offset + limit - 1);

        if (actionType) {
          query = query.eq("action_type", actionType);
        }
        if (resourceType) {
          query = query.eq("resource_type", resourceType);
        }
        if (startDate) {
          query = query.gte("created_at", startDate);
        }
        if (endDate) {
          query = query.lte("created_at", endDate);
        }
        if (search) {
          query = query.or(`resource_name.ilike.%${search}%,resource_id.ilike.%${search}%`);
        }

        const { data: logs, count, error } = await query;

        if (error) throw error;

        return new Response(
          JSON.stringify({ 
            logs: logs || [],
            total: count || 0,
            page,
            limit,
            totalPages: Math.ceil((count || 0) / limit)
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case 'export': {
        const { filters = {} } = body;
        const { actionType, resourceType, startDate, endDate } = filters;

        let query = supabase
          .from("audit_logs")
          .select(`
            *,
            profiles:user_id (
              email,
              full_name
            )
          `)
          .eq("tenant_id", tenantId)
          .order("created_at", { ascending: false });

        if (actionType) {
          query = query.eq("action_type", actionType);
        }
        if (resourceType) {
          query = query.eq("resource_type", resourceType);
        }
        if (startDate) {
          query = query.gte("created_at", startDate);
        }
        if (endDate) {
          query = query.lte("created_at", endDate);
        }

        const { data: logs, error } = await query;

        if (error) throw error;

        // Convert to CSV
        const headers = ['Timestamp', 'User', 'Action', 'Resource Type', 'Resource', 'Details', 'IP Address'];
        const rows = (logs || []).map(log => [
          log.created_at,
          log.profiles?.email || log.user_id,
          log.action_type,
          log.resource_type,
          log.resource_name || log.resource_id || '',
          JSON.stringify(log.details),
          log.ip_address || ''
        ]);

        const csv = [
          headers.join(','),
          ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
        ].join('\n');

        return new Response(csv, {
          headers: {
            ...corsHeaders,
            "Content-Type": "text/csv",
            "Content-Disposition": `attachment; filename="audit-log-${tenantId}-${new Date().toISOString().split('T')[0]}.csv"`
          }
        });
      }

      default:
        return new Response(
          JSON.stringify({ error: "Unknown action" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
  } catch (error) {
    console.error("Audit log error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
