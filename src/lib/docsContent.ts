// Documentation content stored as TypeScript constants
// This allows the docs to be bundled with the app

export const DOCS_CONTENT: Record<string, string> = {
  readme: `# Proxmox VNC Nexus

A multi-tenant Proxmox VE connection broker enabling secure VM console access through a modern web interface.

## 📚 Documentation Index

| Document | Description |
|----------|-------------|
| Overview | This document - Project overview and quick start |
| Architecture | Detailed system architecture with diagrams |
| API Reference | Edge Function API documentation |
| Deployment | Production deployment guide |
| Security | Security model and best practices |
| Contributing | Contribution guidelines |
| Changelog | Version history |
| Troubleshooting | Common issues and solutions |

## Overview

Proxmox VNC Nexus is a web application that acts as a connection broker for Proxmox VE clusters. It allows authenticated users to:

- **List and manage VMs** from multiple Proxmox servers
- **Access VM consoles** via noVNC in the browser
- **Perform VM actions** (start, stop, reset, shutdown)
- **Monitor server health** with real-time status updates
- **Manage multi-tenant environments** with role-based access control

## Key Capabilities

| Feature | Description |
|---------|-------------|
| Multi-Server Support | Connect up to 50 Proxmox VE servers per tenant |
| Encrypted Credentials | API tokens encrypted server-side |
| Real-Time Updates | Supabase Realtime for live status changes |
| VNC Console | Browser-based console via noVNC WebSocket relay |
| Multi-Tenancy | Isolated tenant environments with RBAC |
| Audit Logging | Track all user actions and system events |
| Connection Metrics | 24-hour history charts with success rates |

## Quick Start

1. **Sign up** for an account
2. **Create or join** a tenant organization
3. **Add Proxmox servers** with API tokens
4. **Browse VMs** and connect to consoles

## Technology Stack

| Category | Technologies |
|----------|-------------|
| Frontend | React, TypeScript, Vite, Tailwind CSS |
| Backend | Supabase Edge Functions (Deno) |
| Database | PostgreSQL with Row Level Security |
| Auth | Supabase Auth |
| Realtime | Supabase Realtime |
`,

  architecture: `# System Architecture

## High-Level Architecture

The application follows a three-tier architecture:

\`\`\`
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (React)                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│  │   Auth UI   │  │  Dashboard  │  │    Console Viewer       │ │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Supabase Edge Functions                       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│  │  list-vms   │  │  vm-actions │  │      vnc-relay          │ │
│  │  vm-console │  │proxmox-api  │  │  connection-metrics     │ │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Proxmox VE Clusters                           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│  │   Node 1    │  │   Node 2    │  │        Node N           │ │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
\`\`\`

## API Proxy Pattern

All Proxmox API calls are proxied through Supabase Edge Functions to:
- Bypass CORS restrictions
- Validate JWT authentication
- Decrypt stored API tokens
- Enforce tenant/server access control
- Log connection metrics

## VNC Console Flow

\`\`\`
Browser (noVNC) ←→ vnc-relay Edge Function ←→ Proxmox VNC WebSocket
\`\`\`

## Database Schema

### Core Tables

- **tenants** - Organization entities
- **proxmox_servers** - Server configurations with encrypted tokens
- **user_roles** - Global application roles (admin/user)
- **user_tenant_assignments** - Tenant-specific roles
- **connection_metrics** - Health check and connection data
- **audit_logs** - Action tracking

## Security Model

### Row-Level Security

All tables use RLS policies with helper functions:
- \`has_role()\` - Check global app role
- \`has_tenant_role()\` - Check tenant-specific role
- \`user_has_tenant_access()\` - Verify tenant membership

### Role Hierarchy

**Global Roles:**
- \`admin\` - Full system access
- \`user\` - Access assigned tenants only

**Tenant Roles:**
- \`admin\` - Full tenant control
- \`manager\` - Manage servers and VMs
- \`viewer\` - Read-only access
`,

  api: `# API Reference

## Edge Functions

All edge functions require JWT authentication via the Authorization header.

### list-vms

Fetch VMs from a Proxmox server.

**Request:**
\`\`\`json
{
  "serverId": "uuid",
  "tenantId": "uuid"
}
\`\`\`

**Response:**
\`\`\`json
{
  "data": [
    {
      "vmid": 100,
      "name": "vm-name",
      "status": "running",
      "node": "pve1",
      "type": "qemu"
    }
  ]
}
\`\`\`

### vm-console

Get VNC ticket for console access.

**Request:**
\`\`\`json
{
  "serverId": "uuid",
  "node": "pve1",
  "vmid": 100,
  "vmtype": "qemu"
}
\`\`\`

**Response:**
\`\`\`json
{
  "ticket": "PVEVNC:...",
  "port": "5900",
  "websocketUrl": "wss://..."
}
\`\`\`

### vm-actions

Perform power actions on VMs.

**Request:**
\`\`\`json
{
  "serverId": "uuid",
  "node": "pve1",
  "vmid": 100,
  "action": "start|stop|reset|shutdown"
}
\`\`\`

### proxmox-api

Generic Proxmox API proxy.

**Request:**
\`\`\`json
{
  "path": "/cluster/resources",
  "method": "GET",
  "tenantId": "uuid"
}
\`\`\`

### proxmox-servers

CRUD operations for server configurations.

### connection-metrics

Record and query connection metrics for health monitoring.

### connectivity-test

Test server connectivity before saving configuration.

### tenants

Tenant management operations.

### audit-log

Query audit logs for a tenant.
`,

  deployment: `# Deployment Guide

## Prerequisites

- Lovable account (or self-hosted setup)
- Supabase project
- Proxmox VE cluster with API access

## Lovable Deployment

### Step 1: Create Project

1. Log into Lovable
2. Create new project or import existing code
3. Connect to Supabase

### Step 2: Configure Supabase

1. Create new Supabase project
2. Run database migrations
3. Enable required auth providers
4. Configure storage buckets

### Step 3: Set Secrets

Add the following secrets in Supabase:

| Secret | Description |
|--------|-------------|
| PROXMOX_HOST | Default Proxmox host |
| PROXMOX_PORT | Default port (8006) |
| PROXMOX_API_TOKEN | Default API token |
| PROXMOX_ENCRYPTION_KEY | Token encryption key |

### Step 4: Deploy Edge Functions

Edge functions deploy automatically with Lovable.

### Step 5: Configure Domain

1. Go to Project Settings → Domains
2. Add custom domain
3. Configure DNS records

## Post-Deployment

### Verify Checklist

- [ ] Authentication working
- [ ] Database migrations applied
- [ ] Edge functions responding
- [ ] VNC console connecting
- [ ] Real-time updates working

### Monitoring

- Check Edge Function logs in Supabase dashboard
- Monitor connection metrics
- Review audit logs regularly
`,

  security: `# Security Guide

## Authentication

- Supabase Auth with JWT tokens
- Session management with automatic refresh
- Role-based access control

## Data Protection

### API Token Encryption

API tokens are encrypted server-side before storage:

\`\`\`typescript
function encryptToken(token: string, key: string): string {
  const keyBytes = new TextEncoder().encode(key);
  const tokenBytes = new TextEncoder().encode(token);
  const encrypted = new Uint8Array(tokenBytes.length);
  
  for (let i = 0; i < tokenBytes.length; i++) {
    encrypted[i] = tokenBytes[i] ^ keyBytes[i % keyBytes.length];
  }
  
  return btoa(String.fromCharCode(...encrypted));
}
\`\`\`

### Row-Level Security

All database tables have RLS policies enabled:

\`\`\`sql
CREATE POLICY "Users can view tenant servers"
ON proxmox_servers FOR SELECT
USING (
  has_role(auth.uid(), 'admin') 
  OR user_has_tenant_access(auth.uid(), tenant_id)
);
\`\`\`

## Best Practices

1. **Use API tokens** instead of passwords for Proxmox
2. **Enable privilege separation** on Proxmox tokens
3. **Regularly rotate** encryption keys
4. **Monitor audit logs** for suspicious activity
5. **Use HTTPS** for all connections

## Reporting Issues

Report security vulnerabilities to security@example.com
`,

  contributing: `# Contributing Guide

## Development Setup

\`\`\`bash
# Clone repository
git clone <repo-url>
cd proxmox-vnc-nexus

# Install dependencies
npm install

# Start development server
npm run dev
\`\`\`

## Code Style

- Use TypeScript for all code
- Follow ESLint configuration
- Use Tailwind CSS for styling
- Prefer functional components with hooks

## Pull Request Process

1. Fork the repository
2. Create feature branch
3. Make changes with tests
4. Submit pull request
5. Wait for review

## Commit Messages

Use conventional commits:

- \`feat:\` New features
- \`fix:\` Bug fixes
- \`docs:\` Documentation
- \`style:\` Formatting
- \`refactor:\` Code refactoring
- \`test:\` Adding tests
- \`chore:\` Maintenance

## Testing

\`\`\`bash
# Run all tests
npm test

# Run specific test file
npm test -- src/components/Example.test.tsx
\`\`\`

## Documentation

- Update docs for new features
- Include JSDoc comments
- Add examples where helpful
`,

  changelog: `# Changelog

All notable changes to this project will be documented here.

## [Unreleased]

### Added
- In-app documentation viewer with markdown rendering
- API Playground with custom headers support
- Request/response headers display

### Changed
- Updated documentation structure
- Improved code organization

## [1.0.0] - 2024-01-26

### Added
- Initial release
- Multi-tenant support
- Proxmox server management
- VNC console access
- Real-time status updates
- Connection metrics and history
- Audit logging
- Role-based access control

### Security
- API token encryption
- Row-level security policies
- JWT authentication
`,

  troubleshooting: `# Troubleshooting

## Common Issues

### VNC Console Not Connecting

**Symptoms:** Console shows "Connecting..." but never loads

**Solutions:**
1. Check Proxmox firewall allows WebSocket connections
2. Verify VNC is enabled on the VM
3. Check browser console for CORS errors
4. Ensure VM is running

### Server Shows "Offline"

**Symptoms:** Server status shows offline despite being reachable

**Solutions:**
1. Verify API token is correct
2. Check Proxmox host is accessible from Supabase
3. Review connection timeout settings
4. Check Tailscale if using private network

### Authentication Errors

**Symptoms:** 401 Unauthorized errors

**Solutions:**
1. Clear browser cache and cookies
2. Sign out and sign in again
3. Check JWT token expiration
4. Verify user has required roles

### Slow Performance

**Symptoms:** Dashboard or VM list loads slowly

**Solutions:**
1. Increase Supabase instance size
2. Check network latency to Proxmox
3. Reduce number of servers per tenant
4. Enable connection caching

## Getting Help

1. Check this troubleshooting guide
2. Review Edge Function logs
3. Search existing issues
4. Open new issue with details

## Debug Mode

Enable debug logging in browser console:
\`\`\`javascript
localStorage.setItem('debug', 'true');
\`\`\`
`,
};
