import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TenantRequest {
  action: 'list' | 'create' | 'update' | 'delete' | 'get' | 'get-stats' | 'assign-user' | 'remove-user' | 'list-users' | 'search-users' | 'update-user-role';
  tenantId?: string;
  data?: Record<string, unknown>;
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

    const userId = userData.user.id;
    const { action, tenantId, data }: TenantRequest = await req.json();

    // Check if user is admin for admin-only actions
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .maybeSingle();
    
    const isAdmin = roleData?.role === "admin";

    switch (action) {
      case 'list': {
        // Get all tenants user has access to
        const { data: tenants, error } = await supabase
          .from("tenants")
          .select(`
            *,
            user_tenant_assignments!inner (
              role
            )
          `)
          .eq("user_tenant_assignments.user_id", userId)
          .eq("is_active", true)
          .order("name");

        // If admin, also get tenants they created
        if (isAdmin) {
          const { data: allTenants, error: allError } = await supabase
            .from("tenants")
            .select("*")
            .eq("is_active", true)
            .order("name");

          if (allError) throw allError;
          return new Response(
            JSON.stringify({ tenants: allTenants }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        if (error) throw error;
        
        // Transform to include role
        const tenantsWithRole = tenants?.map(t => ({
          ...t,
          userRole: t.user_tenant_assignments?.[0]?.role || 'viewer',
          user_tenant_assignments: undefined,
        }));

        return new Response(
          JSON.stringify({ tenants: tenantsWithRole }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case 'get': {
        if (!tenantId) {
          return new Response(
            JSON.stringify({ error: "Tenant ID required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { data: tenant, error } = await supabase
          .from("tenants")
          .select("*")
          .eq("id", tenantId)
          .single();

        if (error) throw error;

        return new Response(
          JSON.stringify({ tenant }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case 'create': {
        if (!isAdmin) {
          return new Response(
            JSON.stringify({ error: "Admin access required" }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { name, slug, description, logo_url } = data as Record<string, string>;
        
        if (!name || !slug) {
          return new Response(
            JSON.stringify({ error: "Name and slug are required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Create tenant
        const { data: tenant, error } = await supabase
          .from("tenants")
          .insert({
            name,
            slug: slug.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
            description,
            logo_url,
            created_by: userId,
          })
          .select()
          .single();

        if (error) throw error;

        // Auto-assign creator as tenant admin
        await supabase
          .from("user_tenant_assignments")
          .insert({
            user_id: userId,
            tenant_id: tenant.id,
            role: 'admin',
          });

        return new Response(
          JSON.stringify({ tenant }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case 'update': {
        if (!isAdmin) {
          return new Response(
            JSON.stringify({ error: "Admin access required" }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        if (!tenantId) {
          return new Response(
            JSON.stringify({ error: "Tenant ID required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { name, description, logo_url, is_active } = data as Record<string, unknown>;

        const { data: tenant, error } = await supabase
          .from("tenants")
          .update({
            ...(name && { name }),
            ...(description !== undefined && { description }),
            ...(logo_url !== undefined && { logo_url }),
            ...(is_active !== undefined && { is_active }),
          })
          .eq("id", tenantId)
          .select()
          .single();

        if (error) throw error;

        return new Response(
          JSON.stringify({ tenant }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case 'delete': {
        if (!isAdmin) {
          return new Response(
            JSON.stringify({ error: "Admin access required" }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        if (!tenantId) {
          return new Response(
            JSON.stringify({ error: "Tenant ID required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { error } = await supabase
          .from("tenants")
          .delete()
          .eq("id", tenantId);

        if (error) throw error;

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case 'get-stats': {
        if (!tenantId) {
          return new Response(
            JSON.stringify({ error: "Tenant ID required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Get servers for this tenant
        const { data: servers, error: serversError } = await supabase
          .from("proxmox_servers")
          .select("id, is_active, connection_status")
          .eq("tenant_id", tenantId);

        if (serversError) throw serversError;

        const stats = {
          servers: servers?.length || 0,
          activeServers: servers?.filter(s => s.connection_status === 'online').length || 0,
          totalVMs: 0, // Would need to query Proxmox API
          runningVMs: 0,
          totalStorage: 0,
          usedStorage: 0,
        };

        return new Response(
          JSON.stringify({ stats }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case 'assign-user': {
        // Check if user is system admin OR tenant admin
        const { data: hasTenantAdminRole } = await supabase.rpc("has_tenant_role", {
          _user_id: userId,
          _tenant_id: tenantId,
          _roles: ["admin"],
        });

        if (!isAdmin && !hasTenantAdminRole) {
          return new Response(
            JSON.stringify({ error: "Admin access required" }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { user_id, role } = data as { user_id: string; role: string };
        
        if (!tenantId || !user_id || !role) {
          return new Response(
            JSON.stringify({ error: "Tenant ID, user ID, and role are required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { data: assignment, error } = await supabase
          .from("user_tenant_assignments")
          .upsert({
            user_id,
            tenant_id: tenantId,
            role,
          }, {
            onConflict: 'user_id,tenant_id'
          })
          .select()
          .single();

        if (error) throw error;

        return new Response(
          JSON.stringify({ assignment }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case 'remove-user': {
        // Check if user is system admin OR tenant admin
        const { data: hasTenantAdminRole } = await supabase.rpc("has_tenant_role", {
          _user_id: userId,
          _tenant_id: tenantId,
          _roles: ["admin"],
        });

        if (!isAdmin && !hasTenantAdminRole) {
          return new Response(
            JSON.stringify({ error: "Admin access required" }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { user_id } = data as { user_id: string };
        
        if (!tenantId || !user_id) {
          return new Response(
            JSON.stringify({ error: "Tenant ID and user ID are required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { error } = await supabase
          .from("user_tenant_assignments")
          .delete()
          .eq("tenant_id", tenantId)
          .eq("user_id", user_id);

        if (error) throw error;

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case 'update-user-role': {
        // Check if user is system admin OR tenant admin
        const { data: hasTenantAdminRole } = await supabase.rpc("has_tenant_role", {
          _user_id: userId,
          _tenant_id: tenantId,
          _roles: ["admin"],
        });

        if (!isAdmin && !hasTenantAdminRole) {
          return new Response(
            JSON.stringify({ error: "Admin access required" }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { user_id, role } = data as { user_id: string; role: string };
        
        if (!tenantId || !user_id || !role) {
          return new Response(
            JSON.stringify({ error: "Tenant ID, user ID, and role are required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { data: assignment, error } = await supabase
          .from("user_tenant_assignments")
          .update({ role })
          .eq("tenant_id", tenantId)
          .eq("user_id", user_id)
          .select()
          .single();

        if (error) throw error;

        return new Response(
          JSON.stringify({ assignment }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case 'list-users': {
        if (!tenantId) {
          return new Response(
            JSON.stringify({ error: "Tenant ID required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { data: assignments, error } = await supabase
          .from("user_tenant_assignments")
          .select(`
            *,
            profiles:user_id (
              id,
              email,
              full_name,
              username,
              avatar_url
            )
          `)
          .eq("tenant_id", tenantId);

        if (error) throw error;

        return new Response(
          JSON.stringify({ users: assignments }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case 'search-users': {
        // Search for users that can be added to a tenant
        const { query: searchQuery } = data as { query: string };
        
        if (!searchQuery || searchQuery.length < 2) {
          return new Response(
            JSON.stringify({ users: [] }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Get users matching the search query
        const { data: profiles, error } = await supabase
          .from("profiles")
          .select("id, email, full_name, username, avatar_url")
          .or(`email.ilike.%${searchQuery}%,full_name.ilike.%${searchQuery}%,username.ilike.%${searchQuery}%`)
          .limit(10);

        if (error) throw error;

        // If tenantId provided, filter out users already in the tenant
        let filteredProfiles = profiles || [];
        if (tenantId && filteredProfiles.length > 0) {
          const { data: existingAssignments } = await supabase
            .from("user_tenant_assignments")
            .select("user_id")
            .eq("tenant_id", tenantId);

          const existingUserIds = new Set(existingAssignments?.map(a => a.user_id) || []);
          filteredProfiles = filteredProfiles.filter(p => !existingUserIds.has(p.id));
        }

        return new Response(
          JSON.stringify({ users: filteredProfiles }),
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
    console.error("Tenants error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
