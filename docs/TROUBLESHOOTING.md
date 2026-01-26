# Troubleshooting Guide

## Common Issues

### Authentication

#### "Unauthorized" errors on all requests

**Symptoms:** Every API call returns 401 Unauthorized.

**Causes & Solutions:**
1. **Session expired:** Sign out and sign back in
2. **Invalid JWT:** Clear browser storage and re-authenticate
3. **Missing auth header:** Ensure Supabase client is initialized correctly

```typescript
// Check if session exists
const { data: { session } } = await supabase.auth.getSession();
console.log("Session:", session);
```

---

### VNC Console

#### Console shows blank/black screen

**Symptoms:** Console opens but shows nothing.

**Causes & Solutions:**
1. **VM not running:** Start the VM before connecting
2. **VNC not enabled:** Ensure VM has VNC display configured in Proxmox
3. **Ticket expired:** VNC tickets are short-lived, refresh the page

#### "Failed to get VNC proxy" error

**Symptoms:** Error when trying to open console.

**Causes & Solutions:**
1. **Permission denied:** Check user has "console" permission for the VM
2. **Server unreachable:** Verify server connectivity
3. **Invalid credentials:** Re-enter API token for the server

#### Console disconnects frequently

**Symptoms:** Connection drops after a few minutes.

**Causes & Solutions:**
1. **Edge function timeout:** Free tier has ~2.5 min limit
2. **Network issues:** Check for unstable connection
3. **Proxmox firewall:** Ensure VNC WebSocket ports are open

```
# Check Proxmox firewall
pveum firewall status
```

---

### Server Connectivity

#### Server shows "offline" status

**Symptoms:** Server appears offline but Proxmox is running.

**Causes & Solutions:**
1. **Wrong host/port:** Verify server address and port (default: 8006)
2. **SSL certificate:** If using self-signed cert, try disabling SSL verification
3. **Firewall blocking:** Ensure port 8006 is accessible
4. **API token expired:** Regenerate token in Proxmox

#### Tailscale connection not working

**Symptoms:** Can't connect via Tailscale hostname.

**Causes & Solutions:**
1. **Tailscale not running:** Verify Tailscale is active on both ends
2. **MagicDNS not enabled:** Enable in Tailscale admin console
3. **Wrong hostname:** Use full hostname (e.g., `server.tail12345.ts.net`)

```bash
# Test Tailscale connectivity
tailscale ping proxmox-server
```

#### Health checks failing intermittently

**Symptoms:** Server status flickers between online/offline.

**Causes & Solutions:**
1. **Timeout too short:** Increase connection timeout in server settings
2. **High latency:** The system learns optimal timeouts over time
3. **Rate limiting:** Proxmox may be rate-limiting requests

---

### Database & RLS

#### "new row violates row-level security policy"

**Symptoms:** Can't insert data into tables.

**Causes & Solutions:**
1. **Missing user_id:** Ensure user_id column is set correctly
2. **Wrong tenant:** Verify tenant_id matches user's assignment
3. **Insufficient role:** Check user has required tenant role

```sql
-- Check user's tenant assignments
SELECT * FROM user_tenant_assignments 
WHERE user_id = 'your-user-id';
```

#### Can't see data that should exist

**Symptoms:** Data exists but queries return empty.

**Causes & Solutions:**
1. **RLS filtering:** User doesn't have access to those records
2. **Query limit:** Supabase limits to 1000 rows by default
3. **Tenant isolation:** Data belongs to different tenant

```typescript
// Add limit to avoid hitting default
const { data } = await supabase
  .from("table")
  .select("*")
  .limit(2000);
```

---

### Real-Time Updates

#### Live updates not working

**Symptoms:** Need to refresh to see changes.

**Causes & Solutions:**
1. **Realtime not enabled:** Tables must be in `supabase_realtime` publication
2. **Filter mismatch:** Check subscription filter matches data
3. **Connection lost:** Check browser console for WebSocket errors

```sql
-- Check if table is in Realtime publication
SELECT * FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime';

-- Add table to publication
ALTER PUBLICATION supabase_realtime ADD TABLE proxmox_servers;
```

#### Too many Realtime connections

**Symptoms:** "Too many connections" error.

**Causes & Solutions:**
1. **Clean up subscriptions:** Ensure channels are removed on component unmount
2. **Deduplicate channels:** Use consistent channel names

```typescript
// Proper cleanup
useEffect(() => {
  const channel = supabase.channel("my-channel");
  channel.subscribe();
  
  return () => {
    supabase.removeChannel(channel);
  };
}, []);
```

---

### Performance

#### Slow VM list loading

**Symptoms:** VM list takes long to load.

**Causes & Solutions:**
1. **Many servers:** Queries run sequentially; consider pagination
2. **Large cluster:** Filter by node to reduce data
3. **Network latency:** Use Tailscale for private network access

#### Charts not rendering

**Symptoms:** Connection history chart shows loading forever.

**Causes & Solutions:**
1. **No data:** Chart requires at least one metric entry
2. **Invalid date range:** Check date filtering in query
3. **Browser compatibility:** Recharts requires modern browser

---

### Edge Functions

#### Function timeout

**Symptoms:** Request hangs then fails.

**Causes & Solutions:**
1. **Slow Proxmox response:** Increase timeout in server settings
2. **Cold start:** First request after idle period is slower
3. **Heavy computation:** Consider caching results

#### "Function not found"

**Symptoms:** 404 when calling edge function.

**Causes & Solutions:**
1. **Not deployed:** Deploy with `supabase functions deploy`
2. **Wrong name:** Function names are case-sensitive
3. **Missing in config:** Add to `supabase/config.toml`

---

## Debugging Tools

### Browser Console

```javascript
// Check auth state
const { data } = await supabase.auth.getSession();
console.log("Session:", data.session);

// Check user roles
const { data: roles } = await supabase
  .from("user_roles")
  .select("*")
  .eq("user_id", data.session.user.id);
console.log("Roles:", roles);
```

### Edge Function Logs

```bash
# View logs in Supabase Dashboard
# Or via CLI:
supabase functions logs function-name --follow
```

### Database Queries

```sql
-- Check server status
SELECT name, connection_status, last_health_check_at, health_check_error
FROM proxmox_servers
WHERE tenant_id = 'your-tenant-id';

-- Check recent metrics
SELECT * FROM connection_metrics
WHERE server_id = 'your-server-id'
ORDER BY created_at DESC
LIMIT 10;

-- Check audit logs
SELECT * FROM audit_logs
WHERE tenant_id = 'your-tenant-id'
ORDER BY created_at DESC
LIMIT 20;
```

---

## Getting Help

1. **Check logs:** Browser console, Edge Function logs, Postgres logs
2. **Search documentation:** Review this guide and API docs
3. **Community:** Join Discord for community support
4. **Report issues:** File GitHub issues with reproduction steps
