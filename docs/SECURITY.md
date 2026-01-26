# Security Policy

This document outlines security practices, vulnerability reporting procedures, and security considerations for the Proxmox VNC Nexus project.

## Table of Contents

- [Supported Versions](#supported-versions)
- [Reporting a Vulnerability](#reporting-a-vulnerability)
- [Security Architecture](#security-architecture)
- [Authentication & Authorization](#authentication--authorization)
- [Data Protection](#data-protection)
- [API Security](#api-security)
- [Infrastructure Security](#infrastructure-security)
- [Security Best Practices](#security-best-practices)
- [Security Checklist](#security-checklist)

---

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | :white_check_mark: |
| < 1.0   | :x:                |

---

## Reporting a Vulnerability

We take security vulnerabilities seriously. If you discover a security issue, please report it responsibly.

### How to Report

1. **Do NOT** open a public GitHub issue for security vulnerabilities
2. Email security details to the project maintainers
3. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

### What to Expect

- **Acknowledgment**: Within 48 hours
- **Initial Assessment**: Within 7 days
- **Resolution Timeline**: Based on severity
  - Critical: 24-72 hours
  - High: 1-2 weeks
  - Medium: 2-4 weeks
  - Low: Next release cycle

### Severity Classification

| Severity | Description | Example |
|----------|-------------|---------|
| Critical | Immediate exploitation possible | Authentication bypass, RCE |
| High | Significant impact with exploitation | Data exposure, privilege escalation |
| Medium | Limited impact or difficult exploitation | Information disclosure |
| Low | Minimal impact | Minor information leakage |

---

## Security Architecture

### Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (React)                         │
│  • No sensitive data storage                                    │
│  • JWT-based authentication                                     │
│  • Input validation                                             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Supabase Edge Functions                       │
│  • JWT validation                                               │
│  • Request authorization                                        │
│  • Credential decryption                                        │
│  • Proxmox API proxying                                         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Supabase Database                            │
│  • Row Level Security (RLS)                                     │
│  • Encrypted credential storage                                 │
│  • Audit logging                                                │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Proxmox VE API                             │
│  • API token authentication                                     │
│  • HTTPS/TLS encryption                                         │
└─────────────────────────────────────────────────────────────────┘
```

### Key Security Principles

1. **Defense in Depth**: Multiple security layers
2. **Least Privilege**: Minimal access rights
3. **Zero Trust**: Verify every request
4. **Secure by Default**: Safe configurations out-of-box

---

## Authentication & Authorization

### User Authentication

- **Provider**: Supabase Auth
- **Methods**: Email/password
- **Token Format**: JWT (JSON Web Tokens)
- **Session Management**: Automatic refresh tokens

### Role-Based Access Control (RBAC)

#### Application Roles

| Role | Description | Capabilities |
|------|-------------|--------------|
| `admin` | System administrator | Full system access |
| `user` | Standard user | Access to assigned resources |

#### Tenant Roles

| Role | Description | Capabilities |
|------|-------------|--------------|
| `admin` | Tenant administrator | Full tenant management |
| `manager` | Tenant manager | Server/VM management |
| `viewer` | Read-only access | View resources only |

### Role Storage Security

```sql
-- Roles stored in dedicated table, NOT in profiles
-- Prevents privilege escalation attacks
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL,
    UNIQUE (user_id, role)
);
```

**⚠️ CRITICAL**: Never store roles in:
- `localStorage` / `sessionStorage`
- Profile tables
- Client-accessible locations

### Security Definer Functions

```sql
-- Bypasses RLS for role checks, preventing recursion
CREATE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;
```

---

## Data Protection

### Credential Encryption

Proxmox API tokens are encrypted at rest:

```typescript
// Server-side encryption using PROXMOX_ENCRYPTION_KEY
const encryptedToken = await encrypt(apiToken, ENCRYPTION_KEY);
// Only encrypted tokens stored in database
```

**Key Management**:
- Encryption key stored as Supabase secret
- Never exposed to frontend
- Rotated periodically

### Row Level Security (RLS)

All tables have RLS policies enforcing:

1. **Multi-tenant isolation**: Users only see their tenant's data
2. **Role-based access**: Operations restricted by role
3. **User-specific data**: Personal data protected

Example policy:

```sql
CREATE POLICY "Users can view tenant servers"
ON public.proxmox_servers
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  user_has_tenant_access(auth.uid(), tenant_id)
);
```

### Sensitive Data Handling

| Data Type | Storage | Access |
|-----------|---------|--------|
| API Tokens | Encrypted in DB | Edge Functions only |
| Passwords | Never stored | Supabase Auth handles |
| VNC Tickets | Temporary, in-memory | Single-use |
| Audit Logs | Database with RLS | Tenant admins only |

---

## API Security

### Edge Function Security

All Edge Functions implement:

1. **JWT Validation**:
```typescript
const { data, error } = await supabase.auth.getClaims(token);
if (error || !data?.claims) {
  return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
    status: 401 
  });
}
```

2. **CORS Headers**:
```typescript
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
```

3. **Input Validation**:
```typescript
// Using Zod for schema validation
const schema = z.object({
  serverId: z.string().uuid(),
  action: z.enum(['start', 'stop', 'restart']),
});
```

### API Proxy Pattern

The frontend **never** communicates directly with Proxmox:

```
Frontend → Edge Function → Proxmox API
              ↓
         JWT validation
         Tenant validation
         Token decryption
         Request forwarding
```

### Rate Limiting Considerations

- Implement rate limiting at Edge Function level
- Monitor for unusual request patterns
- Use Supabase's built-in protections

---

## Infrastructure Security

### Environment Variables

| Variable | Type | Storage |
|----------|------|---------|
| `SUPABASE_URL` | Public | Code/Env |
| `SUPABASE_ANON_KEY` | Public | Code/Env |
| `SUPABASE_SERVICE_ROLE_KEY` | Secret | Supabase Secrets |
| `PROXMOX_ENCRYPTION_KEY` | Secret | Supabase Secrets |
| `PROXMOX_API_TOKEN` | Secret | Encrypted in DB |

### Secret Management

```
❌ Never store secrets in:
   - Git repositories
   - Frontend code
   - localStorage/sessionStorage
   - Unencrypted database columns

✅ Always use:
   - Supabase Secrets for Edge Functions
   - Encrypted storage for credentials
   - Environment variables for configuration
```

### TLS/SSL

- All connections use HTTPS/WSS
- SSL verification configurable per server
- Certificate validation for production

---

## Security Best Practices

### For Developers

1. **Input Validation**
   ```typescript
   // Always validate user input
   const schema = z.object({
     email: z.string().email().max(255),
     name: z.string().trim().min(1).max(100),
   });
   ```

2. **Output Encoding**
   ```typescript
   // Never use dangerouslySetInnerHTML with user data
   // Use proper encoding for URLs
   const safeUrl = encodeURIComponent(userInput);
   ```

3. **Error Handling**
   ```typescript
   // Never expose internal errors to users
   catch (error) {
     console.error('Internal error:', error);
     return { error: 'An error occurred' };
   }
   ```

4. **Dependency Management**
   - Keep dependencies updated
   - Review security advisories
   - Use `npm audit` regularly

### For Administrators

1. **Proxmox API Tokens**
   - Use dedicated API tokens per installation
   - Apply principle of least privilege
   - Rotate tokens periodically

2. **User Management**
   - Review user access regularly
   - Remove inactive accounts
   - Audit role assignments

3. **Monitoring**
   - Review audit logs regularly
   - Monitor for failed authentication attempts
   - Set up alerts for suspicious activity

---

## Security Checklist

### Deployment Checklist

- [ ] All secrets stored in Supabase Secrets
- [ ] RLS policies enabled on all tables
- [ ] SSL certificates valid and up-to-date
- [ ] Default credentials changed
- [ ] Audit logging enabled
- [ ] Error messages don't expose internals

### Code Review Checklist

- [ ] Input validation on all user inputs
- [ ] No hardcoded credentials or secrets
- [ ] Authentication required for sensitive operations
- [ ] Authorization checks for role-based access
- [ ] No SQL injection vulnerabilities
- [ ] No XSS vulnerabilities
- [ ] Proper error handling

### Periodic Security Tasks

| Task | Frequency |
|------|-----------|
| Dependency updates | Weekly |
| Security audit review | Monthly |
| Access review | Monthly |
| Credential rotation | Quarterly |
| Penetration testing | Annually |

---

## Known Security Considerations

### VNC Console Access

- VNC tickets are time-limited and single-use
- WebSocket connections authenticated per-session
- Consider network segmentation for VNC traffic

### Multi-Tenancy

- Strict RLS enforcement for tenant isolation
- Cross-tenant access requires explicit admin role
- Tenant data never mixed in queries

### Third-Party Dependencies

- Regular `npm audit` checks
- Dependency lock files committed
- Critical vulnerabilities addressed immediately

---

## Additional Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Supabase Security Best Practices](https://supabase.com/docs/guides/platform/going-into-prod)
- [Proxmox VE Security](https://pve.proxmox.com/wiki/Security)

---

## Contact

For security-related inquiries, contact the project maintainers through appropriate channels.

**Do not disclose vulnerabilities publicly until they have been addressed.**
