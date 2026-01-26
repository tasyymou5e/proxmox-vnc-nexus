
## Multi-Proxmox Server Management Feature

### Overview
Add the ability for users to configure and manage up to 50 Proxmox VE servers through the Settings section. Each user can add their own Proxmox server connections, which are securely stored in the database with encrypted API tokens.

---

### Architecture Decision

**User-scoped vs Global Servers:**
- Each user can add their own Proxmox servers (personal connection management)
- Admins can optionally see/manage all servers for administrative purposes
- API tokens are encrypted at rest using Supabase's pgcrypto extension

---

### Part 1: Database Schema

**New Table: `proxmox_servers`**

```sql
-- Enable pgcrypto for encryption
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Create the proxmox_servers table
CREATE TABLE public.proxmox_servers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name text NOT NULL,
    host text NOT NULL,
    port integer NOT NULL DEFAULT 8006,
    api_token_encrypted text NOT NULL,
    verify_ssl boolean DEFAULT true,
    is_active boolean DEFAULT true,
    last_connected_at timestamptz,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    CONSTRAINT proxmox_servers_port_check CHECK (port > 0 AND port < 65536),
    CONSTRAINT proxmox_servers_user_limit CHECK (
        (SELECT COUNT(*) FROM public.proxmox_servers ps WHERE ps.user_id = user_id) <= 50
    )
);

-- Create unique constraint on user_id + host + port
CREATE UNIQUE INDEX proxmox_servers_user_host_port_idx 
ON public.proxmox_servers(user_id, host, port);

-- Enable RLS
ALTER TABLE public.proxmox_servers ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own servers"
ON public.proxmox_servers FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own servers"
ON public.proxmox_servers FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own servers"
ON public.proxmox_servers FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own servers"
ON public.proxmox_servers FOR DELETE
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all servers"
ON public.proxmox_servers FOR SELECT
USING (has_role(auth.uid(), 'admin'));

-- Updated_at trigger
CREATE TRIGGER update_proxmox_servers_updated_at
    BEFORE UPDATE ON public.proxmox_servers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
```

---

### Part 2: Edge Function for Token Encryption/Decryption

**New Edge Function: `proxmox-servers`**

Handles CRUD operations with secure token encryption:

```typescript
// supabase/functions/proxmox-servers/index.ts

// POST - Create server (encrypts token)
// GET - List user's servers (tokens masked)
// PUT - Update server
// DELETE - Remove server
// POST /test - Test connection to a Proxmox server
```

**Encryption approach:**
- Use a server-side encryption key stored as a Supabase secret (`PROXMOX_ENCRYPTION_KEY`)
- Tokens encrypted before storage, decrypted only when making API calls
- Tokens never exposed to frontend after initial submission

---

### Part 3: Update Existing Edge Functions

Modify `list-vms`, `vm-console`, and `vm-actions` to:

1. Accept an optional `serverId` parameter
2. Look up server credentials from `proxmox_servers` table
3. Decrypt the API token for the request
4. Fall back to environment variables if no serverId (for backward compatibility)

**Updated flow:**

```text
Frontend Request (with serverId)
       ↓
Edge Function validates user owns server
       ↓
Decrypt API token from database
       ↓
Make Proxmox API call
       ↓
Return results
```

---

### Part 4: New UI Components

**File: `src/pages/ProxmoxServers.tsx`**

New page accessible from Settings in the sidebar:

```
+--------------------------------------------------+
|  Proxmox Servers                    [+ Add Server]|
+--------------------------------------------------+
|  Search servers...                               |
+--------------------------------------------------+
|  +-------------------------------------------+   |
|  | Server Name: Production Cluster           |   |
|  | Host: pve1.company.com:8006              |   |
|  | Status: ● Connected                       |   |
|  | Last connected: Jan 26, 2026              |   |
|  | [Test] [Edit] [Delete]                    |   |
|  +-------------------------------------------+   |
|  | Server Name: Development                  |   |
|  | Host: 192.168.1.100:8006                 |   |
|  | Status: ○ Not tested                      |   |
|  | [Test] [Edit] [Delete]                    |   |
|  +-------------------------------------------+   |
|                                                  |
|  Showing 2 of 50 server slots used              |
+--------------------------------------------------+
```

**Add/Edit Server Dialog:**

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
|  [Cancel]              [Test & Save]   |
+----------------------------------------+
```

---

### Part 5: Dashboard Integration

**Updated VM fetching logic:**

1. If user has configured servers, aggregate VMs from all active servers
2. Display server name badge on each VM card
3. Add server filter dropdown in Dashboard

**Updated VM type:**

```typescript
interface VM {
  // ...existing fields
  serverId?: string;      // New - which server this VM belongs to
  serverName?: string;    // New - display name of the server
}
```

---

### Part 6: Navigation Updates

**File: `src/components/layout/DashboardLayout.tsx`**

Add "Proxmox Servers" link in the Settings section:

```tsx
const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Settings", href: "/profile", icon: Settings },
  { label: "Servers", href: "/servers", icon: Server },  // New
  ...(isAdmin ? [{ label: "Admin", href: "/admin", icon: Users }] : []),
];
```

---

### Part 7: Types Update

**File: `src/lib/types.ts`**

```typescript
export interface ProxmoxServer {
  id: string;
  user_id: string;
  name: string;
  host: string;
  port: number;
  verify_ssl: boolean;
  is_active: boolean;
  last_connected_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProxmoxServerInput {
  name: string;
  host: string;
  port: number;
  api_token: string;  // Only used for create/update
  verify_ssl?: boolean;
}
```

---

### Implementation Order

| Step | Task | Files |
|------|------|-------|
| 1 | Database migration for `proxmox_servers` table | SQL migration |
| 2 | Add `PROXMOX_ENCRYPTION_KEY` secret | Supabase secrets |
| 3 | Create `proxmox-servers` edge function | `supabase/functions/proxmox-servers/index.ts` |
| 4 | Add types for ProxmoxServer | `src/lib/types.ts` |
| 5 | Create ProxmoxServers page | `src/pages/ProxmoxServers.tsx` |
| 6 | Add API functions | `src/lib/api.ts` |
| 7 | Create hooks for server management | `src/hooks/useProxmoxServers.ts` |
| 8 | Update navigation | `src/components/layout/DashboardLayout.tsx` |
| 9 | Add route | `src/App.tsx` |
| 10 | Update `list-vms` to use user servers | `supabase/functions/list-vms/index.ts` |
| 11 | Update `vm-console` and `vm-actions` | Edge functions |

---

### Security Considerations

1. **Token Encryption**: API tokens encrypted with AES-256 before storage
2. **RLS Policies**: Users can only access their own server configurations
3. **Input Validation**: Host, port, and token format validated both client and server side
4. **Token Masking**: Tokens never returned to frontend after initial creation
5. **Connection Testing**: Test endpoint validates credentials without storing them until confirmed

---

### Validation Rules

| Field | Validation |
|-------|------------|
| Name | Required, 1-100 characters |
| Host | Required, valid hostname or IP |
| Port | Required, 1-65535 (default 8006) |
| API Token | Required, format: `USER@REALM!TOKENID=UUID` |

---

### Backward Compatibility

- Existing global `PROXMOX_*` environment variables continue to work
- If a user has no configured servers, the system falls back to global config
- Gradual migration path for users adopting personal server configs
