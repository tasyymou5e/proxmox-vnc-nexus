

## Tailscale Integration for Proxmox Server Connections

### Overview
Add Tailscale as an optional connection method for each Proxmox server. This allows users to connect to their Proxmox servers through a Tailscale VPN mesh network, which is especially useful when:
- Proxmox servers are behind NAT or firewalls
- Users want to access servers from anywhere without exposing them to the public internet
- Private networks need to be accessed securely

### How Tailscale Works with Proxmox
Tailscale creates a secure mesh VPN that assigns each device a unique IP address (100.x.x.x range) or a MagicDNS hostname (e.g., `proxmox-server.tailnet-name.ts.net`). When enabled, the connection broker will use the Tailscale hostname/IP instead of the public IP to reach the Proxmox API.

---

### Part 1: Database Schema Update

Add Tailscale configuration columns to the `proxmox_servers` table:

```sql
ALTER TABLE public.proxmox_servers 
ADD COLUMN IF NOT EXISTS use_tailscale boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS tailscale_hostname text,
ADD COLUMN IF NOT EXISTS tailscale_port integer DEFAULT 8006;
```

| Column | Type | Description |
|--------|------|-------------|
| `use_tailscale` | boolean | Enable Tailscale for this server |
| `tailscale_hostname` | text | Tailscale MagicDNS name or IP (e.g., `pve.tailnet.ts.net` or `100.x.x.x`) |
| `tailscale_port` | integer | Port to use when connecting via Tailscale (defaults to 8006) |

---

### Part 2: Type Updates

**File: `src/lib/types.ts`**

```typescript
export interface ProxmoxServer {
  // ...existing fields
  use_tailscale: boolean;
  tailscale_hostname: string | null;
  tailscale_port: number;
}

export interface ProxmoxServerInput {
  // ...existing fields
  use_tailscale?: boolean;
  tailscale_hostname?: string;
  tailscale_port?: number;
}
```

---

### Part 3: Update Shared Utility

**File: `supabase/functions/_shared/proxmox-utils.ts`**

Update `getProxmoxCredentials` to return the correct host based on Tailscale configuration:

```typescript
export interface ProxmoxCredentials {
  host: string;
  port: string;
  token: string;
  useTailscale: boolean;
}

export async function getProxmoxCredentials(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  serverId?: string
): Promise<ProxmoxCredentials> {
  // ...existing code
  
  if (serverId && encryptionKey) {
    const { data: server } = await supabase
      .from("proxmox_servers")
      .select("host, port, api_token_encrypted, is_active, use_tailscale, tailscale_hostname, tailscale_port")
      .eq("id", serverId)
      .eq("user_id", userId)
      .single();
    
    // If Tailscale is enabled, use the Tailscale hostname and port
    const effectiveHost = server.use_tailscale && server.tailscale_hostname 
      ? server.tailscale_hostname 
      : server.host;
    const effectivePort = server.use_tailscale 
      ? String(server.tailscale_port || server.port) 
      : String(server.port);
    
    return {
      host: effectiveHost,
      port: effectivePort,
      token: decryptToken(server.api_token_encrypted, encryptionKey),
      useTailscale: server.use_tailscale || false,
    };
  }
  // ...fallback code
}
```

---

### Part 4: Update Edge Functions

Update all edge functions that make Proxmox API calls to use the resolved host from `getProxmoxCredentials`:

**Files to update:**
- `supabase/functions/proxmox-servers/index.ts` (test connection, health checks)
- `supabase/functions/list-vms/index.ts`
- `supabase/functions/vm-console/index.ts`
- `supabase/functions/vm-actions/index.ts`
- `supabase/functions/proxmox-api/index.ts`

The connection URL construction will automatically use the Tailscale hostname when enabled since `getProxmoxCredentials` returns the effective host.

---

### Part 5: Frontend UI Updates

**File: `src/pages/ProxmoxServers.tsx`**

Add Tailscale configuration to the server form dialog:

```
+----------------------------------------+
|  Add Proxmox Server                    |
+----------------------------------------+
|  Server Name *                         |
|  [Production Cluster              ]    |
|                                        |
|  Host/IP Address *                     |
|  [pve1.company.com               ]     |
|                                        |
|  Port *                                |
|  [8006                           ]     |
|                                        |
|  API Token *                           |
|  [user@realm!token=xxxx...       ]     |
|  Format: USER@REALM!TOKENID=UUID       |
|                                        |
|  [ ] Verify SSL Certificate            |
|                                        |
|  ─────── Tailscale (Optional) ───────  |  <- NEW SECTION
|                                        |
|  [x] Connect via Tailscale             |  <- NEW
|                                        |
|  Tailscale Hostname/IP                 |  <- NEW (shown when enabled)
|  [pve.tailnet-name.ts.net        ]     |
|                                        |
|  Tailscale Port                        |  <- NEW (shown when enabled)
|  [8006                           ]     |
|                                        |
|  [Cancel]              [Test & Save]   |
+----------------------------------------+
```

**Server card display:**

```
+-------------------------------------------+
| Server Name: Production Cluster           |
| Host: pve1.company.com:8006              |
| Tailscale: pve.tailnet.ts.net:8006  🔗   |  <- NEW (when enabled)
| Status: ● Online (checked 2m ago)         |
| [Test] [Edit] [Delete]                    |
+-------------------------------------------+
```

---

### Part 6: CSV Import Update

**File: `src/components/servers/CSVImportDialog.tsx`**

Update CSV template and parsing to support Tailscale fields:

```csv
name,host,port,api_token,verify_ssl,use_tailscale,tailscale_hostname,tailscale_port
Production,pve1.company.com,8006,user@realm!token=uuid,true,true,pve.tailnet.ts.net,8006
Development,192.168.1.100,8006,dev@pam!token=uuid,false,false,,
```

---

### Part 7: Hook Updates

**File: `src/hooks/useProxmoxServers.ts`**

Update form data handling to include Tailscale fields in CRUD operations.

---

### Implementation Order

| Step | Task | Files |
|------|------|-------|
| 1 | Database migration for Tailscale columns | SQL migration |
| 2 | Update ProxmoxServer types | `src/lib/types.ts` |
| 3 | Update shared utility for Tailscale host resolution | `supabase/functions/_shared/proxmox-utils.ts` |
| 4 | Update proxmox-servers edge function | `supabase/functions/proxmox-servers/index.ts` |
| 5 | Update list-vms edge function | `supabase/functions/list-vms/index.ts` |
| 6 | Update vm-console, vm-actions, proxmox-api edge functions | Edge functions |
| 7 | Update useProxmoxServers hook | `src/hooks/useProxmoxServers.ts` |
| 8 | Update ProxmoxServers page with Tailscale form fields | `src/pages/ProxmoxServers.tsx` |
| 9 | Update CSV import dialog | `src/components/servers/CSVImportDialog.tsx` |
| 10 | Deploy edge functions | Deployment |

---

### Summary of Changes

| Component | Changes |
|-----------|---------|
| **Database** | Add `use_tailscale`, `tailscale_hostname`, `tailscale_port` columns |
| **Types** | Add Tailscale fields to `ProxmoxServer` and `ProxmoxServerInput` |
| **Shared Utils** | Update `getProxmoxCredentials` to resolve effective host/port |
| **Edge Functions** | Use resolved credentials (automatically handles Tailscale) |
| **ProxmoxServers page** | Add Tailscale toggle and hostname/port fields to form |
| **Server Cards** | Show Tailscale hostname when enabled |
| **CSV Import** | Support Tailscale columns in import |

---

### User Experience Flow

1. User creates a new server with their public Proxmox host
2. User optionally enables "Connect via Tailscale" toggle
3. If enabled, user enters their Tailscale hostname (e.g., `pve.tailnet-name.ts.net`)
4. When testing connection or fetching VMs, the system uses the Tailscale hostname instead of the public host
5. Server cards show both the public host and Tailscale hostname for clarity

---

### Technical Notes

**Why separate Tailscale hostname?**
- The public hostname is kept for reference/documentation
- Tailscale hostname may change if the tailnet is reconfigured
- Allows easy switching between Tailscale and direct connection
- Different ports may be used for Tailscale vs public access

**Tailscale Requirements:**
- The edge function server must be connected to the same Tailnet OR have subnet routing enabled
- Since Supabase Edge Functions run in Deno Deploy (serverless), they may not have direct Tailscale access
- For production use, users might need to set up a Tailscale subnet router or use Tailscale Funnel to expose their Proxmox server

**Subnet Router Alternative:**
If the edge functions cannot reach Tailscale IPs directly, users can:
1. Use a self-hosted proxy with Tailscale installed
2. Use Tailscale Funnel to expose the Proxmox API securely
3. Set up a VPS with Tailscale as a gateway

