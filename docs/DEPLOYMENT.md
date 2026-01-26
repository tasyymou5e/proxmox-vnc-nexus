# Deployment Guide

This guide provides step-by-step instructions for deploying Proxmox VNC Nexus to production.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Deployment Options](#deployment-options)
- [Lovable Deployment](#lovable-deployment)
- [Supabase Configuration](#supabase-configuration)
- [Environment Setup](#environment-setup)
- [Custom Domain Setup](#custom-domain-setup)
- [Edge Function Deployment](#edge-function-deployment)
- [Post-Deployment Checklist](#post-deployment-checklist)
- [Monitoring & Maintenance](#monitoring--maintenance)
- [Troubleshooting](#troubleshooting)

---

## Prerequisites

Before deploying, ensure you have:

- [ ] Lovable account with appropriate plan
- [ ] Supabase project created
- [ ] Proxmox VE server(s) with API access configured
- [ ] Domain name (optional, for custom domain)
- [ ] API tokens generated for Proxmox

---

## Deployment Options

### Option 1: Lovable Hosted (Recommended)

- One-click deployment
- Automatic SSL certificates
- CDN distribution
- Zero infrastructure management

### Option 2: Self-Hosted

- Clone repository from GitHub
- Deploy to your own infrastructure
- Requires manual SSL and CDN setup
- See [Self-Hosting Guide](https://docs.lovable.dev/tips-tricks/self-hosting)

---

## Lovable Deployment

### Step 1: Publish Your App

1. Open your project in Lovable
2. Click the **Publish** button (top-right corner)
3. Review the publish dialog
4. Click **Update** to deploy

```
📍 Your app will be available at:
   https://your-project.lovable.app
```

### Step 2: Verify Deployment

1. Visit your published URL
2. Test the login flow
3. Verify VM listing works
4. Test console connections

### Understanding Deployment Types

| Change Type | Deployment |
|-------------|------------|
| Frontend (UI, components) | Requires clicking "Update" |
| Edge Functions | Automatic, immediate |
| Database migrations | Automatic, immediate |

---

## Supabase Configuration

### Step 1: Project Setup

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Note your project credentials:
   - Project URL
   - Anon Key
   - Service Role Key (keep secret!)

### Step 2: Configure Authentication

1. Navigate to **Authentication** → **Providers**
2. Enable **Email** provider
3. Configure email templates (optional)
4. Set up redirect URLs:

```
Site URL: https://your-domain.com
Redirect URLs:
  - https://your-domain.com
  - https://your-domain.com/dashboard
  - https://your-project.lovable.app (for staging)
```

### Step 3: Configure Secrets

1. Go to **Settings** → **Edge Functions**
2. Add the following secrets:

| Secret Name | Description |
|-------------|-------------|
| `PROXMOX_HOST` | Default Proxmox host (optional) |
| `PROXMOX_PORT` | Default Proxmox port (usually 8006) |
| `PROXMOX_API_TOKEN` | Default API token (optional) |
| `PROXMOX_ENCRYPTION_KEY` | 32+ character encryption key |

**Generate Encryption Key:**
```bash
openssl rand -base64 32
```

### Step 4: Configure Storage

1. Navigate to **Storage**
2. Verify `tenant-logos` bucket exists
3. Check bucket is set to **Public**

### Step 5: Review RLS Policies

1. Go to **Database** → **Tables**
2. Verify RLS is enabled on all tables
3. Review policies match expected access patterns

---

## Environment Setup

### Frontend Environment Variables

These are configured in the Lovable project:

| Variable | Value | Notes |
|----------|-------|-------|
| `VITE_SUPABASE_URL` | `https://xxx.supabase.co` | Your Supabase URL |
| `VITE_SUPABASE_ANON_KEY` | `eyJ...` | Public anon key |

### Edge Function Secrets

Configure in Supabase Dashboard → Settings → Edge Functions:

```bash
# Required
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Proxmox (for default/fallback)
PROXMOX_HOST=your-proxmox-host
PROXMOX_PORT=8006
PROXMOX_API_TOKEN=user@realm!tokenid=uuid

# Security
PROXMOX_ENCRYPTION_KEY=your-32-char-encryption-key
```

---

## Custom Domain Setup

### Step 1: Add Domain in Lovable

1. Go to **Project Settings** → **Domains**
2. Click **Connect Domain**
3. Enter your domain (e.g., `app.yourcompany.com`)

### Step 2: Configure DNS

Add these records at your domain registrar:

**For root domain (yourcompany.com):**
```
Type: A
Name: @
Value: 185.158.133.1
```

**For www subdomain:**
```
Type: A
Name: www
Value: 185.158.133.1
```

**Verification record:**
```
Type: TXT
Name: _lovable
Value: lovable_verify=ABC123 (provided by Lovable)
```

### Step 3: Wait for Propagation

- DNS changes can take up to 72 hours
- SSL certificate is provisioned automatically
- Check status in Project Settings → Domains

### Domain Status Reference

| Status | Meaning | Action |
|--------|---------|--------|
| Ready | DNS configured, not published | Publish your app |
| Verifying | Waiting for DNS propagation | Wait up to 72 hours |
| Setting up | SSL being provisioned | No action needed |
| Active | Domain is live | ✅ Complete |
| Offline | DNS changed | Fix DNS records |
| Failed | Certificate error | Check DNS, retry |

### Step 4: Update Supabase Redirect URLs

Add your custom domain to Supabase Auth:

1. Go to **Authentication** → **URL Configuration**
2. Add to **Redirect URLs**:
   - `https://yourdomain.com`
   - `https://yourdomain.com/*`

---

## Edge Function Deployment

Edge functions deploy automatically when you publish. To verify:

### Check Deployment Status

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Navigate to **Edge Functions**
3. Verify all functions show "Active"

### Required Functions

| Function | Purpose |
|----------|---------|
| `list-vms` | Fetch VMs from Proxmox |
| `vm-actions` | Start/stop/restart VMs |
| `vm-console` | Get VNC tickets |
| `vnc-relay` | WebSocket proxy for VNC |
| `proxmox-api` | Generic Proxmox API proxy |
| `proxmox-servers` | Server CRUD operations |
| `connectivity-test` | Test server connectivity |
| `tenants` | Tenant management |
| `tenant-stats` | Tenant statistics |
| `tenant-settings` | Tenant configuration |
| `audit-log` | Audit logging |
| `connection-metrics` | Connection tracking |
| `delete-user` | User deletion |

### View Function Logs

1. Click on a function name
2. Go to **Logs** tab
3. Filter by time range or search

---

## Post-Deployment Checklist

### Security Verification

- [ ] All secrets configured in Supabase
- [ ] No hardcoded credentials in code
- [ ] RLS policies enabled on all tables
- [ ] SSL certificate active
- [ ] Authentication working

### Functionality Testing

- [ ] User registration/login works
- [ ] VMs list correctly
- [ ] VM power actions work
- [ ] VNC console connects
- [ ] Tenant isolation verified
- [ ] Audit logs recording

### Performance Verification

- [ ] Page loads under 3 seconds
- [ ] API responses under 1 second
- [ ] No console errors
- [ ] Real-time updates working

### Backup Configuration

- [ ] Database backups enabled (Supabase Pro)
- [ ] Point-in-time recovery configured
- [ ] Backup retention policy set

---

## Monitoring & Maintenance

### Supabase Monitoring

1. **Database Health**
   - Monitor connection pool usage
   - Check query performance
   - Review slow query logs

2. **Edge Function Metrics**
   - Monitor invocation counts
   - Track error rates
   - Review execution times

3. **Auth Metrics**
   - Track sign-up rates
   - Monitor failed login attempts
   - Review active sessions

### Recommended Alerts

Set up alerts for:
- Edge function error rate > 5%
- Database CPU > 80%
- Failed authentication spike
- Storage approaching limits

### Regular Maintenance Tasks

| Task | Frequency |
|------|-----------|
| Review audit logs | Weekly |
| Check function logs | Weekly |
| Update dependencies | Monthly |
| Rotate API tokens | Quarterly |
| Security review | Quarterly |
| Database optimization | Monthly |

### Upgrading Instance Size

If experiencing performance issues:

1. Go to **Settings** → **Cloud** → **Advanced settings**
2. Upgrade instance size
3. Wait up to 10 minutes for changes
4. Note: Larger instances have higher costs

---

## Troubleshooting

### Common Deployment Issues

#### Edge Functions Not Deploying

```
Error: 500 Internal Server Error during deploy
```

**Solution:**
1. Check for `deno.lock` issues
2. Remove or rename the lockfile
3. Redeploy

#### Authentication Not Working

**Symptoms:** Login fails, redirect loops

**Solutions:**
1. Verify redirect URLs in Supabase
2. Check Site URL configuration
3. Clear browser cookies
4. Verify CORS settings

#### VNC Console Not Connecting

**Symptoms:** Console shows "Connecting..." indefinitely

**Solutions:**
1. Check `vnc-relay` function logs
2. Verify Proxmox API token permissions
3. Test Proxmox API connectivity
4. Check WebSocket support

#### Database Connection Issues

**Symptoms:** "Failed to fetch" errors

**Solutions:**
1. Check RLS policies
2. Verify user is authenticated
3. Review database logs
4. Check connection pool limits

### Viewing Logs

**Edge Function Logs:**
```
Supabase Dashboard → Edge Functions → [function-name] → Logs
```

**Database Logs:**
```
Supabase Dashboard → Database → Logs
```

**Auth Logs:**
```
Supabase Dashboard → Authentication → Logs
```

### Getting Help

1. Check [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)
2. Review [Supabase Docs](https://supabase.com/docs)
3. Check [Lovable Docs](https://docs.lovable.dev)
4. Contact support with:
   - Error messages
   - Screenshots
   - Reproduction steps

---

## Quick Reference

### URLs

| Resource | URL |
|----------|-----|
| Lovable Project | `https://lovable.dev/projects/[id]` |
| Supabase Dashboard | `https://supabase.com/dashboard/project/[id]` |
| Published App | `https://[project].lovable.app` |
| Custom Domain | `https://yourdomain.com` |

### Key Commands

```bash
# Check DNS propagation
dig yourdomain.com

# Verify SSL certificate
openssl s_client -connect yourdomain.com:443

# Test API endpoint
curl https://[supabase-url]/functions/v1/list-vms \
  -H "Authorization: Bearer [token]"
```

---

## Additional Resources

- [Lovable Deployment Docs](https://docs.lovable.dev)
- [Supabase Production Guide](https://supabase.com/docs/guides/platform/going-into-prod)
- [Custom Domain Setup](https://docs.lovable.dev/features/custom-domain)
- [Edge Functions Guide](https://supabase.com/docs/guides/functions)
