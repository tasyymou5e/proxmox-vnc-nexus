# Environment Variables

Complete reference of all environment variables used by Proxmox VNC Nexus.

---

## Frontend (Vite)

These variables are set in the `.env` file and exposed to the browser via Vite's `import.meta.env`.

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `VITE_SUPABASE_URL` | ✅ | Supabase project URL | `https://xxxxx.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | ✅ | Supabase anon/public key | `eyJhbGciOi...` |
| `VITE_SUPABASE_PROJECT_ID` | ✅ | Supabase project ID | `lbfabewnshfjdjfosqxl` |

> **Note:** These are **publishable** keys safe to include in client-side code. Never put private keys here.

---

## Edge Function Secrets (Supabase)

These are configured in **Supabase Dashboard → Settings → Edge Functions** and accessed via `Deno.env.get()` in edge functions.

### Supabase (Auto-Provisioned)

| Variable | Required | Description |
|----------|----------|-------------|
| `SUPABASE_URL` | ✅ | Supabase project URL (auto-set by Supabase) |
| `SUPABASE_ANON_KEY` | ✅ | Supabase anon key (auto-set by Supabase) |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Supabase service role key (auto-set by Supabase) |

> These are automatically available in all edge functions — no manual configuration needed.

### Proxmox Configuration

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `PROXMOX_HOST` | ⚠️ Fallback | Default Proxmox host (used when no server is configured in DB) | `192.168.1.100` |
| `PROXMOX_PORT` | ❌ | Default Proxmox port (defaults to `8006`) | `8006` |
| `PROXMOX_API_TOKEN` | ⚠️ Fallback | Default Proxmox API token (used when no server is configured in DB) | `root@pam!broker=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` |

> **Fallback only:** These are used when no Proxmox servers are configured in the database. Once servers are added via the UI, credentials are stored encrypted in the database instead.

### Security

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `PROXMOX_ENCRYPTION_KEY` | ✅ | Encryption key for Proxmox API tokens stored in the database (32+ characters) | `openssl rand -base64 32` |

### Lovable Platform

| Variable | Required | Description |
|----------|----------|-------------|
| `LOVABLE_API_KEY` | ✅ | Lovable AI Gateway key (auto-provisioned, cannot be deleted) |

---

## Edge Functions Using Each Variable

| Variable | Used By |
|----------|---------|
| `SUPABASE_URL` | All edge functions |
| `SUPABASE_ANON_KEY` | All edge functions |
| `PROXMOX_ENCRYPTION_KEY` | `list-vms`, `vm-actions`, `vm-console`, `proxmox-servers`, `connectivity-test`, `tenant-stats`, `vm-rrd-data`, `_shared/proxmox-utils` |
| `PROXMOX_HOST` | `list-vms`, `vnc-relay`, `proxmox-api`, `_shared/proxmox-utils` (fallback) |
| `PROXMOX_PORT` | `list-vms`, `vnc-relay`, `proxmox-api`, `_shared/proxmox-utils` (fallback) |
| `PROXMOX_API_TOKEN` | `list-vms`, `vnc-relay`, `proxmox-api`, `_shared/proxmox-utils` (fallback) |

---

## Setup Checklist

1. **Frontend `.env`** — Copy `.env.example` and fill in your Supabase credentials
2. **`PROXMOX_ENCRYPTION_KEY`** — Generate with `openssl rand -base64 32` and add to Supabase secrets
3. **Proxmox fallback credentials** (optional) — Add `PROXMOX_HOST`, `PROXMOX_PORT`, `PROXMOX_API_TOKEN` if not using the server management UI

---

## Where to Configure

| Scope | Location |
|-------|----------|
| Frontend variables | `.env` file in project root |
| Edge function secrets | [Supabase Dashboard → Settings → Edge Functions](https://supabase.com/dashboard/project/lbfabewnshfjdjfosqxl/settings/functions) |
| Lovable secrets | Managed automatically by the platform |
