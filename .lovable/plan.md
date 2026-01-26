

# Tailscale Enhancement: Timeout Settings, Funnel Support & Connection Indicators

## Overview

This plan implements three interconnected Tailscale-related features:

1. **Connection Timeout Settings per Server** - Configurable timeout values for high-latency Tailscale connections
2. **Tailscale Funnel Documentation & Support** - In-app documentation and UI hints for Funnel configuration
3. **Tailscale Connection Indicator on VM Cards** - Visual indicator showing when VMs are accessed via Tailscale

---

## Feature 1: Connection Timeout Settings per Server

### 1.1 Database Schema Update

Add a `connection_timeout` column to store custom timeout values:

```sql
ALTER TABLE public.proxmox_servers 
ADD COLUMN IF NOT EXISTS connection_timeout integer DEFAULT 10000;

-- connection_timeout is in milliseconds (default: 10 seconds)
-- Tailscale connections may need 30-60 seconds
```

### 1.2 Type Updates

**File: `src/lib/types.ts`**

```typescript
export interface ProxmoxServer {
  // ...existing fields
  connection_timeout: number; // milliseconds
}

export interface ProxmoxServerInput {
  // ...existing fields
  connection_timeout?: number;
}
```

### 1.3 Edge Function Updates

Update all edge functions to use the server's `connection_timeout` value:

**Files to update:**
- `supabase/functions/_shared/proxmox-utils.ts` - Add `timeout` to `ProxmoxCredentials` interface
- `supabase/functions/proxmox-servers/index.ts` - Use timeout in health checks and test connections
- `supabase/functions/list-vms/index.ts` - Use timeout when fetching VMs
- `supabase/functions/vm-actions/index.ts` - Use timeout for VM actions
- `supabase/functions/vm-console/index.ts` - Use timeout for VNC ticket requests

**Shared utility update:**

```typescript
export interface ProxmoxCredentials {
  host: string;
  port: string;
  token: string;
  useTailscale: boolean;
  timeout: number; // NEW
}

export async function getProxmoxCredentials(...): Promise<ProxmoxCredentials> {
  // ...existing code
  return {
    host: effectiveHost,
    port: effectivePort,
    token: decryptToken(server.api_token_encrypted, encryptionKey),
    useTailscale,
    timeout: server.connection_timeout || 10000, // NEW
  };
}
```

**Usage in fetch calls:**

```typescript
const response = await fetch(url, {
  headers: { "Authorization": `PVEAPIToken=${token}` },
  signal: AbortSignal.timeout(credentials.timeout),
});
```

### 1.4 Frontend UI Updates

**File: `src/pages/ProxmoxServers.tsx`**

Add timeout configuration to the server form:

```
+----------------------------------------+
|  ─────── Connection Settings ───────   |
|                                        |
|  Connection Timeout                    |
|  [──────────●───] 30 seconds          |  <- Slider input
|                                        |
|  Recommended: 10-15s for direct,      |
|  30-60s for Tailscale connections      |
+----------------------------------------+
```

The UI will include:
- A slider component (range: 5-120 seconds)
- Helper text explaining recommended values
- Auto-suggestion when Tailscale is enabled

**Form state addition:**

```typescript
const [formData, setFormData] = useState<ProxmoxServerInput & {
  // ...existing fields
  connection_timeout?: number; // in seconds for UI
}>({
  // ...existing defaults
  connection_timeout: 10,
});
```

### 1.5 CSV Import Update

**File: `src/components/servers/CSVImportDialog.tsx`**

Add `connection_timeout` column support:

```csv
name,host,port,api_token,verify_ssl,use_tailscale,tailscale_hostname,tailscale_port,connection_timeout
Production,pve1.company.com,8006,user@realm!token=uuid,true,false,,,10
Tailscale Server,192.168.1.100,8006,dev@pam!token=uuid,false,true,pve.tailnet.ts.net,8006,30
```

---

## Feature 2: Tailscale Funnel Support with Documentation

### 2.1 New Documentation Component

**File: `src/components/servers/TailscaleFunnelHelp.tsx`** (New)

A collapsible help section explaining Tailscale Funnel:

```
+------------------------------------------------+
|  ℹ️ Tailscale Funnel Guide           [Expand]  |
+------------------------------------------------+
| Tailscale Funnel allows you to expose your     |
| Proxmox server securely to the internet        |
| without opening firewall ports.                |
|                                                |
| Setup Steps:                                   |
| 1. Install Tailscale on your Proxmox server   |
| 2. Enable Funnel: tailscale funnel 8006       |
| 3. Note the public URL (e.g., pve.tail1234.ts.net) |
| 4. Enter the Funnel URL as Tailscale hostname |
|                                                |
| Benefits:                                      |
| • No port forwarding needed                   |
| • End-to-end TLS encryption                   |
| • Automatic HTTPS certificates                |
|                                                |
| [Read Tailscale Docs ↗]                       |
+------------------------------------------------+
```

### 2.2 UI Integration

**File: `src/pages/ProxmoxServers.tsx`**

Add the help component below the Tailscale configuration section:

```tsx
{formData.use_tailscale && (
  <TailscaleFunnelHelp />
)}
```

### 2.3 Funnel Detection Badge

Add a visual indicator when the Tailscale hostname appears to be a Funnel URL (contains `.ts.net`):

```tsx
{server.use_tailscale && server.tailscale_hostname?.includes('.ts.net') && (
  <Badge variant="outline" className="text-xs text-purple-600 border-purple-600">
    <ExternalLink className="h-3 w-3 mr-1" />
    Funnel
  </Badge>
)}
```

### 2.4 Type Updates

**File: `src/lib/types.ts`**

No changes needed - existing fields support Funnel URLs.

---

## Feature 3: Tailscale Connection Indicator on VM Cards

### 3.1 Extend VM Interface

**File: `src/lib/types.ts`**

```typescript
export interface VM {
  // ...existing fields
  useTailscale?: boolean;      // NEW: Is this VM accessed via Tailscale?
  tailscaleHostname?: string;  // NEW: The Tailscale hostname used
}
```

### 3.2 Update List VMs Edge Function

**File: `supabase/functions/list-vms/index.ts`**

Include Tailscale info when fetching VMs from servers:

```typescript
// When fetching from each server, include Tailscale status
const { data: server } = await supabase
  .from("proxmox_servers")
  .select("id, name, host, port, api_token_encrypted, use_tailscale, tailscale_hostname, tailscale_port")
  ...

const vms = (proxmoxData.data || []).map((vm: VM) => ({
  ...vm,
  serverId: server.id,
  serverName: server.name,
  useTailscale: server.use_tailscale && !!server.tailscale_hostname, // NEW
  tailscaleHostname: server.use_tailscale ? server.tailscale_hostname : null, // NEW
}));
```

### 3.3 Update VMCard Component

**File: `src/components/dashboard/VMCard.tsx`**

Add a Tailscale indicator badge:

```tsx
import { Link2 } from "lucide-react";

// In the card header, next to server name badge
{vm.useTailscale && (
  <Tooltip>
    <TooltipTrigger asChild>
      <Badge variant="outline" className="text-xs text-blue-600 border-blue-600">
        <Link2 className="h-3 w-3 mr-1" />
        Tailscale
      </Badge>
    </TooltipTrigger>
    <TooltipContent>
      <p>Connected via Tailscale</p>
      {vm.tailscaleHostname && (
        <p className="text-xs text-muted-foreground">{vm.tailscaleHostname}</p>
      )}
    </TooltipContent>
  </Tooltip>
)}
```

Visual design:
- Blue outline badge with Link2 icon
- Tooltip showing "Connected via Tailscale" and the hostname
- Positioned after the server name badge

### 3.4 Update VMTable Component

**File: `src/components/dashboard/VMTable.tsx`**

Add Tailscale indicator to the Server column:

```tsx
<TableCell className="text-muted-foreground">
  <div className="flex items-center gap-1">
    {vm.serverName || "-"}
    {vm.useTailscale && (
      <Tooltip>
        <TooltipTrigger>
          <Link2 className="h-3 w-3 text-blue-600" />
        </TooltipTrigger>
        <TooltipContent>
          <p>Tailscale: {vm.tailscaleHostname}</p>
        </TooltipContent>
      </Tooltip>
    )}
  </div>
</TableCell>
```

---

## Implementation Order

| Step | Task | Files |
|------|------|-------|
| 1 | Database migration for connection_timeout | SQL migration |
| 2 | Update VM and ProxmoxServer types | `src/lib/types.ts` |
| 3 | Update shared proxmox-utils | `supabase/functions/_shared/proxmox-utils.ts` |
| 4 | Update proxmox-servers edge function | `supabase/functions/proxmox-servers/index.ts` |
| 5 | Update list-vms edge function with Tailscale info | `supabase/functions/list-vms/index.ts` |
| 6 | Update vm-actions and vm-console functions | Edge functions |
| 7 | Create TailscaleFunnelHelp component | `src/components/servers/TailscaleFunnelHelp.tsx` |
| 8 | Update ProxmoxServers page with timeout slider | `src/pages/ProxmoxServers.tsx` |
| 9 | Update VMCard with Tailscale indicator | `src/components/dashboard/VMCard.tsx` |
| 10 | Update VMTable with Tailscale indicator | `src/components/dashboard/VMTable.tsx` |
| 11 | Update CSVImportDialog for timeout column | `src/components/servers/CSVImportDialog.tsx` |
| 12 | Deploy edge functions | Deployment |

---

## Summary of Changes

| Component | Changes |
|-----------|---------|
| **Database** | Add `connection_timeout` column (integer, default 10000ms) |
| **Types** | Add `connection_timeout` to server types, `useTailscale` and `tailscaleHostname` to VM interface |
| **Shared Utils** | Add `timeout` to `ProxmoxCredentials` interface |
| **Edge Functions** | Use configurable timeout in all fetch calls, include Tailscale info in VM data |
| **TailscaleFunnelHelp** | New component with Funnel setup documentation |
| **ProxmoxServers page** | Add timeout slider, integrate Funnel help, show Funnel badge |
| **VMCard** | Add blue Tailscale badge with tooltip |
| **VMTable** | Add Tailscale icon in Server column |
| **CSVImportDialog** | Support `connection_timeout` column |

---

## UI/UX Details

### Timeout Slider

```
Connection Timeout
[─────────●──────────────] 30s

5s ──────────────────────── 120s
     ↑ Direct    Tailscale ↑
```

- Range: 5-120 seconds
- Step: 5 seconds
- Shows current value next to slider
- Helper text below recommends 10-15s for direct, 30-60s for Tailscale

### Tailscale Indicator on VM Cards

```
+-------------------------------------------+
| [Server Icon] Web Server                  |
| QEMU • Node: pve1 • ID: 101              |
| [Production] [🔗 Tailscale]              |  <- Blue Tailscale badge
|                                           |
| CPU: [======     ] 45%                   |
| Memory: [========  ] 78%                 |
+-------------------------------------------+
```

### Funnel Badge on Server Cards

```
+-------------------------------------------+
| Server: Production Cluster                |
| Host: pve1.company.com:8006              |
| Tailscale: pve.tail1234.ts.net [Funnel]  |  <- Purple Funnel badge
| Status: ● Online                          |
+-------------------------------------------+
```

---

## Security Considerations

1. **Timeout Limits**: Maximum timeout capped at 120 seconds to prevent abuse
2. **Funnel Security**: Document that Funnel URLs are publicly accessible
3. **Tailscale Info Exposure**: Only show Tailscale hostnames to authenticated users

---

## Technical Notes

### Why Custom Timeouts Matter for Tailscale

- Tailscale connections may traverse multiple relay servers (DERP)
- Initial connection establishment can take longer than direct connections
- High-latency paths require longer timeouts to avoid false negatives
- Default 10-second timeout often insufficient for distant Tailscale peers

### Tailscale Funnel vs Direct Tailscale

| Feature | Direct Tailscale | Tailscale Funnel |
|---------|------------------|------------------|
| Requires Tailnet membership | Yes | No |
| Public access | No | Yes |
| Edge function compatibility | Requires Tailscale | Works natively |
| Security | Tailnet auth | HTTPS + optional auth |

Funnel is recommended for Supabase Edge Functions since they cannot join a Tailnet.

