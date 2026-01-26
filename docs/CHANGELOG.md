# Changelog

All notable changes to the Proxmox VNC Nexus project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Planned
- Apache Guacamole integration for enhanced remote access
- VM power state scheduling
- Batch VM operations
- Enhanced resource monitoring dashboards

---

## [1.0.0] - 2025-01-26

### Added

#### Multi-Tenancy System
- Complete multi-tenant architecture with tenant isolation
- Tenant creation and management
- User-tenant assignments with role-based access (admin, manager, viewer)
- Tenant-specific settings and branding (logo, colors)
- Tenant selector interface for users with multiple tenant access

#### Authentication & Authorization
- Supabase Auth integration with email/password authentication
- Role-based access control (RBAC) at application and tenant levels
- Row Level Security (RLS) policies for all database tables
- Protected routes with authentication guards
- User profile management

#### Proxmox Server Management
- Add/edit/delete Proxmox server configurations
- Encrypted API token storage
- SSL verification options
- Connection timeout configuration
- Tailscale VPN support with automatic fallback
- Server health monitoring with status indicators
- CSV bulk import for server configurations

#### VM Management
- List VMs from connected Proxmox clusters
- VM status display (running, stopped, paused)
- Resource usage meters (CPU, memory, disk)
- VM quick actions (start, stop, restart, shutdown)
- User-VM assignments for access control
- Search and filter capabilities

#### VNC Console Access
- Browser-based VNC console using noVNC
- VNC ticket generation via Proxmox API
- WebSocket connection through VNC relay
- Fullscreen mode support
- Connection status indicators
- Session management and cleanup

#### Real-Time Features
- Live server status updates via Supabase Realtime
- Connection metrics tracking and visualization
- Real-time tenant statistics
- Automatic UI updates on data changes

#### Connectivity & Monitoring
- Server connectivity testing
- Connection history with response time charts
- Success rate tracking
- Adaptive timeout learning
- Tailscale funnel support with documentation

#### Proxmox API Explorer
- Interactive API documentation browser
- Tree navigation of API endpoints
- Request/response viewing
- Direct API testing capabilities

#### Audit Logging
- Comprehensive audit trail for all actions
- User action tracking
- Resource change logging
- Filterable audit log viewer

#### Tenant Settings
- Custom branding (logo upload, color themes)
- Notification preferences
- Default server configuration options
- Health check interval settings

### Technical Implementation

#### Frontend
- React 18 with TypeScript
- Vite build system
- Tailwind CSS with custom design system
- shadcn/ui component library
- React Query for server state management
- React Router for navigation

#### Backend
- Supabase Edge Functions (Deno runtime)
- PostgreSQL database with RLS
- Supabase Realtime for subscriptions
- Secure API proxy for Proxmox communication

#### Security
- JWT-based authentication
- Encrypted credential storage
- CORS-compliant API proxy
- Input validation and sanitization
- Secure WebSocket connections

---

## Version History Format

### Types of Changes
- **Added** - New features
- **Changed** - Changes to existing functionality
- **Deprecated** - Features to be removed in future
- **Removed** - Removed features
- **Fixed** - Bug fixes
- **Security** - Vulnerability fixes

---

## Contributing

When adding entries to this changelog:

1. Add entries under `[Unreleased]` section
2. Use present tense ("Add feature" not "Added feature")
3. Include issue/PR references where applicable
4. Group changes by type (Added, Changed, Fixed, etc.)
5. Keep descriptions concise but informative

## Links

- [Project Repository](https://lovable.dev/projects/e604b526-3432-41aa-9d49-24634864cdb5)
- [Documentation](./README.md)
- [API Reference](./API.md)
- [Troubleshooting Guide](./TROUBLESHOOTING.md)
