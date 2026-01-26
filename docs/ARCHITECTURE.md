# System Architecture

This document provides detailed architecture diagrams and explanations for the Proxmox VNC Nexus system.

## Table of Contents

- [High-Level Architecture](#high-level-architecture)
- [Component Architecture](#component-architecture)
- [Data Flow](#data-flow)
- [Authentication Flow](#authentication-flow)
- [VNC Console Flow](#vnc-console-flow)
- [Multi-Tenancy Architecture](#multi-tenancy-architecture)
- [Database Schema](#database-schema)
- [Edge Function Architecture](#edge-function-architecture)
- [Real-Time Updates](#real-time-updates)
- [Error Handling](#error-handling)

---

## High-Level Architecture

<presentation-mermaid>
graph TB
    subgraph "Client Layer"
        Browser["🌐 Web Browser"]
        React["⚛️ React Application"]
    end

    subgraph "API Gateway"
        Supabase["☁️ Supabase Platform"]
        Auth["🔐 Supabase Auth"]
        DB["🗄️ PostgreSQL + RLS"]
        Storage["📁 Storage Buckets"]
        Realtime["📡 Realtime Engine"]
        Edge["⚡ Edge Functions"]
    end

    subgraph "Proxmox Infrastructure"
        PVE1["🖥️ Proxmox Node 1"]
        PVE2["🖥️ Proxmox Node 2"]
        PVE3["🖥️ Proxmox Node N"]
        VMs["💻 Virtual Machines"]
    end

    Browser --> React
    React --> Auth
    React --> DB
    React --> Realtime
    React --> Edge
    Edge --> PVE1
    Edge --> PVE2
    Edge --> PVE3
    PVE1 --> VMs
    PVE2 --> VMs
    PVE3 --> VMs
    Storage --> React
</presentation-mermaid>

### Layer Responsibilities

| Layer | Responsibility |
|-------|----------------|
| **Client** | User interface, state management, real-time updates |
| **API Gateway** | Authentication, authorization, data persistence, API proxying |
| **Proxmox** | VM hosting, VNC access, resource management |

---

## Component Architecture

### Frontend Component Hierarchy

<presentation-mermaid>
graph TD
    App["App.tsx"]
    
    subgraph "Providers"
        QueryProvider["QueryClientProvider"]
        ThemeProvider["ThemeProvider"]
        AuthProvider["AuthProvider"]
        Toaster["Sonner Toaster"]
    end

    subgraph "Layouts"
        DashboardLayout["DashboardLayout"]
        TenantLayout["TenantLayout"]
    end

    subgraph "Pages"
        Login["Login"]
        Dashboard["Dashboard"]
        Console["Console"]
        Admin["Admin"]
        TenantSelector["TenantSelector"]
        TenantDashboard["TenantDashboard"]
        ProxmoxServers["ProxmoxServers"]
    end

    subgraph "Feature Components"
        VMCard["VMCard"]
        VMTable["VMTable"]
        ConsoleViewer["ConsoleViewer"]
        ServerForm["Server Forms"]
        LiveStatus["LiveStatusIndicator"]
    end

    App --> QueryProvider
    QueryProvider --> ThemeProvider
    ThemeProvider --> AuthProvider
    AuthProvider --> DashboardLayout
    AuthProvider --> TenantLayout
    
    DashboardLayout --> Dashboard
    DashboardLayout --> Admin
    DashboardLayout --> ProxmoxServers
    
    TenantLayout --> TenantDashboard
    TenantLayout --> Console
    
    Dashboard --> VMCard
    Dashboard --> VMTable
    Console --> ConsoleViewer
    ProxmoxServers --> ServerForm
    ProxmoxServers --> LiveStatus
</presentation-mermaid>

### Hooks Architecture

<presentation-mermaid>
graph LR
    subgraph "Data Fetching Hooks"
        useVMs["useVMs"]
        useTenants["useTenants"]
        useProxmoxServers["useProxmoxServers"]
        useAuditLogs["useAuditLogs"]
    end

    subgraph "Real-Time Hooks"
        useServerRealtime["useServerRealtimeUpdates"]
        useConnectionMetrics["useConnectionMetricsRealtime"]
        useLiveTenantStats["useLiveTenantStats"]
    end

    subgraph "Action Hooks"
        useProxmoxApi["useProxmoxApi"]
        useConnectivityTest["useConnectivityTest"]
        useTenantSettings["useTenantSettings"]
    end

    subgraph "Utility Hooks"
        useToast["useToast"]
        useMobile["useMobile"]
        useLogoUpload["useLogoUpload"]
    end

    useVMs --> useProxmoxApi
    useProxmoxServers --> useServerRealtime
    useProxmoxServers --> useConnectionMetrics
</presentation-mermaid>

---

## Data Flow

### Request/Response Flow

<presentation-mermaid>
sequenceDiagram
    participant User
    participant React
    participant ReactQuery
    participant EdgeFn as Edge Function
    participant DB as PostgreSQL
    participant Proxmox

    User->>React: Interact with UI
    React->>ReactQuery: Trigger Query/Mutation
    ReactQuery->>EdgeFn: HTTP Request + JWT
    
    EdgeFn->>EdgeFn: Validate JWT
    EdgeFn->>DB: Check Permissions (RLS)
    
    alt Proxmox API Call
        EdgeFn->>DB: Get Encrypted Token
        EdgeFn->>EdgeFn: Decrypt Token
        EdgeFn->>Proxmox: API Request
        Proxmox-->>EdgeFn: API Response
    end
    
    EdgeFn-->>ReactQuery: JSON Response
    ReactQuery->>ReactQuery: Update Cache
    ReactQuery-->>React: Updated Data
    React-->>User: UI Update
</presentation-mermaid>

### State Management Flow

<presentation-mermaid>
graph TD
    subgraph "Server State"
        RQ["React Query Cache"]
        API["Edge Functions"]
        DB["PostgreSQL"]
    end

    subgraph "Client State"
        Context["React Context"]
        Local["Component State"]
    end

    subgraph "Persistent State"
        LS["localStorage"]
        SS["sessionStorage"]
    end

    API --> RQ
    DB --> API
    RQ --> Local
    Context --> Local
    LS --> Context
    SS --> Context
</presentation-mermaid>

---

## Authentication Flow

### Login Sequence

<presentation-mermaid>
sequenceDiagram
    participant User
    participant LoginForm
    participant Supabase as Supabase Auth
    participant AuthProvider
    participant Router

    User->>LoginForm: Enter Credentials
    LoginForm->>Supabase: signInWithPassword()
    
    alt Success
        Supabase-->>LoginForm: Session + User
        LoginForm->>AuthProvider: Update Auth State
        AuthProvider->>Router: Navigate to Dashboard
    else Failure
        Supabase-->>LoginForm: Error
        LoginForm-->>User: Show Error Toast
    end
</presentation-mermaid>

### Authorization Check Flow

<presentation-mermaid>
flowchart TD
    Request["Incoming Request"]
    CheckJWT{"Valid JWT?"}
    CheckRole{"Has Required Role?"}
    CheckTenant{"Has Tenant Access?"}
    CheckRLS["RLS Policy Check"]
    Allow["✅ Allow Access"]
    Deny["❌ Deny Access"]

    Request --> CheckJWT
    CheckJWT -->|No| Deny
    CheckJWT -->|Yes| CheckRole
    CheckRole -->|Admin| Allow
    CheckRole -->|User| CheckTenant
    CheckTenant -->|No| Deny
    CheckTenant -->|Yes| CheckRLS
    CheckRLS -->|Pass| Allow
    CheckRLS -->|Fail| Deny
</presentation-mermaid>

---

## VNC Console Flow

### Console Connection Sequence

<presentation-mermaid>
sequenceDiagram
    participant User
    participant ConsoleViewer
    participant VmConsole as vm-console
    participant VncRelay as vnc-relay
    participant Proxmox
    participant noVNC

    User->>ConsoleViewer: Click Connect
    ConsoleViewer->>VmConsole: Request VNC Ticket
    VmConsole->>Proxmox: POST /vncproxy
    Proxmox-->>VmConsole: VNC Ticket + Port
    VmConsole-->>ConsoleViewer: Connection Info

    ConsoleViewer->>noVNC: Initialize RFB
    noVNC->>VncRelay: WebSocket Connect
    VncRelay->>Proxmox: VNC WebSocket
    
    loop Frame Updates
        Proxmox-->>VncRelay: VNC Frames
        VncRelay-->>noVNC: Forward Frames
        noVNC-->>ConsoleViewer: Render Display
    end

    User->>noVNC: Keyboard/Mouse Input
    noVNC->>VncRelay: Forward Input
    VncRelay->>Proxmox: Send to VM
</presentation-mermaid>

### VNC Relay Architecture

<presentation-mermaid>
graph LR
    subgraph "Browser"
        noVNC["noVNC Client"]
    end

    subgraph "Edge Function"
        Relay["vnc-relay"]
        Upgrade["WebSocket Upgrade"]
        Proxy["Bidirectional Proxy"]
    end

    subgraph "Proxmox"
        WS["VNC WebSocket"]
        VNC["VNC Server"]
    end

    noVNC <-->|WSS| Upgrade
    Upgrade --> Relay
    Relay <--> Proxy
    Proxy <-->|WSS| WS
    WS <--> VNC
</presentation-mermaid>

---

## Multi-Tenancy Architecture

### Tenant Isolation Model

<presentation-mermaid>
graph TD
    subgraph "Global Admin"
        Admin["System Admin"]
    end

    subgraph "Tenant A"
        TA_Admin["Tenant Admin A"]
        TA_Manager["Manager A"]
        TA_Viewer["Viewer A"]
        TA_Servers["Servers A"]
        TA_VMs["VMs A"]
    end

    subgraph "Tenant B"
        TB_Admin["Tenant Admin B"]
        TB_Manager["Manager B"]
        TB_Viewer["Viewer B"]
        TB_Servers["Servers B"]
        TB_VMs["VMs B"]
    end

    Admin -->|Full Access| TA_Admin
    Admin -->|Full Access| TB_Admin
    
    TA_Admin --> TA_Servers
    TA_Admin --> TA_VMs
    TA_Manager --> TA_Servers
    TA_Manager --> TA_VMs
    TA_Viewer -.->|Read Only| TA_VMs

    TB_Admin --> TB_Servers
    TB_Admin --> TB_VMs
    TB_Manager --> TB_Servers
    TB_Manager --> TB_VMs
    TB_Viewer -.->|Read Only| TB_VMs
</presentation-mermaid>

### RLS Policy Flow

<presentation-mermaid>
flowchart TD
    Query["Database Query"]
    
    subgraph "RLS Evaluation"
        IsAdmin{"has_role(admin)?"}
        HasAccess{"user_has_tenant_access()?"}
        TenantRole{"has_tenant_role()?"}
    end

    FilteredData["Filtered Results"]
    AllData["All Data"]
    NoData["Empty Results"]

    Query --> IsAdmin
    IsAdmin -->|Yes| AllData
    IsAdmin -->|No| HasAccess
    HasAccess -->|No| NoData
    HasAccess -->|Yes| TenantRole
    TenantRole -->|Pass| FilteredData
    TenantRole -->|Fail| NoData
</presentation-mermaid>

---

## Database Schema

### Entity Relationship Diagram

<presentation-mermaid>
erDiagram
    USERS ||--o{ USER_ROLES : has
    USERS ||--o{ PROFILES : has
    USERS ||--o{ USER_TENANT_ASSIGNMENTS : assigned
    USERS ||--o{ USER_VM_ASSIGNMENTS : assigned
    USERS ||--o{ CONNECTION_SESSIONS : creates
    
    TENANTS ||--o{ USER_TENANT_ASSIGNMENTS : contains
    TENANTS ||--o{ PROXMOX_SERVERS : owns
    TENANTS ||--|| TENANT_SETTINGS : has
    TENANTS ||--o{ AUDIT_LOGS : logs
    TENANTS ||--o{ PROXMOX_API_CONFIGS : configures
    
    PROXMOX_SERVERS ||--o{ CONNECTION_METRICS : tracks
    PROXMOX_SERVERS ||--o{ PROXMOX_API_CONFIGS : configured_by

    USERS {
        uuid id PK
        string email
    }
    
    PROFILES {
        uuid id PK
        string email
        string full_name
        string username
        string company_name
    }
    
    USER_ROLES {
        uuid id PK
        uuid user_id FK
        enum role
    }
    
    TENANTS {
        uuid id PK
        string name
        string slug
        string description
    }
    
    USER_TENANT_ASSIGNMENTS {
        uuid id PK
        uuid user_id FK
        uuid tenant_id FK
        enum role
    }
    
    PROXMOX_SERVERS {
        uuid id PK
        uuid tenant_id FK
        string name
        string host
        int port
        text api_token_encrypted
    }
    
    USER_VM_ASSIGNMENTS {
        uuid id PK
        uuid user_id FK
        int vm_id
        string node_name
        array permissions
    }
</presentation-mermaid>

---

## Edge Function Architecture

### Function Responsibilities

<presentation-mermaid>
graph TD
    subgraph "Authentication"
        AuthCheck["JWT Validation"]
    end

    subgraph "Proxmox Functions"
        ListVMs["list-vms"]
        VMActions["vm-actions"]
        VMConsole["vm-console"]
        VNCRelay["vnc-relay"]
        ProxmoxAPI["proxmox-api"]
        Servers["proxmox-servers"]
        ConnTest["connectivity-test"]
    end

    subgraph "Tenant Functions"
        Tenants["tenants"]
        TenantStats["tenant-stats"]
        TenantSettings["tenant-settings"]
    end

    subgraph "System Functions"
        AuditLog["audit-log"]
        ConnMetrics["connection-metrics"]
        DeleteUser["delete-user"]
    end

    AuthCheck --> ListVMs
    AuthCheck --> VMActions
    AuthCheck --> VMConsole
    AuthCheck --> Servers
    AuthCheck --> Tenants
    AuthCheck --> AuditLog
</presentation-mermaid>

### Edge Function Request Flow

<presentation-mermaid>
flowchart LR
    subgraph "Request Processing"
        CORS["CORS Handling"]
        Auth["Auth Validation"]
        Parse["Request Parsing"]
        Validate["Input Validation"]
    end

    subgraph "Business Logic"
        Decrypt["Decrypt Credentials"]
        Proxy["Proxmox API Call"]
        Process["Process Response"]
    end

    subgraph "Response"
        Format["Format Response"]
        Headers["Add Headers"]
        Return["Return JSON"]
    end

    CORS --> Auth
    Auth --> Parse
    Parse --> Validate
    Validate --> Decrypt
    Decrypt --> Proxy
    Proxy --> Process
    Process --> Format
    Format --> Headers
    Headers --> Return
</presentation-mermaid>

---

## Real-Time Updates

### Supabase Realtime Flow

<presentation-mermaid>
sequenceDiagram
    participant Component
    participant Hook as useServerRealtimeUpdates
    participant Supabase
    participant DB as PostgreSQL

    Component->>Hook: Mount
    Hook->>Supabase: Subscribe to Channel
    Supabase-->>Hook: Subscription Confirmed

    loop Data Changes
        DB->>Supabase: Row Change Event
        Supabase-->>Hook: Broadcast Payload
        Hook->>Hook: Invalidate Query Cache
        Hook-->>Component: Re-render with New Data
    end

    Component->>Hook: Unmount
    Hook->>Supabase: Unsubscribe
</presentation-mermaid>

### Real-Time Subscriptions

<presentation-mermaid>
graph TD
    subgraph "Subscribed Tables"
        Servers["proxmox_servers"]
        Metrics["connection_metrics"]
        Sessions["connection_sessions"]
    end

    subgraph "Update Handlers"
        ServerHandler["Server Status Update"]
        MetricsHandler["Metrics Chart Update"]
        SessionHandler["Session List Update"]
    end

    subgraph "UI Components"
        StatusBadge["LiveStatusIndicator"]
        Charts["ConnectionHistoryChart"]
        SessionList["Active Sessions"]
    end

    Servers --> ServerHandler
    Metrics --> MetricsHandler
    Sessions --> SessionHandler

    ServerHandler --> StatusBadge
    MetricsHandler --> Charts
    SessionHandler --> SessionList
</presentation-mermaid>

---

## Error Handling

### Error Boundary Architecture

<presentation-mermaid>
flowchart TD
    subgraph "Error Sources"
        RenderError["Render Error"]
        AsyncError["Async Error"]
        NetworkError["Network Error"]
    end

    subgraph "Error Handling"
        Boundary["ErrorBoundary"]
        QueryError["React Query Error"]
        EdgeError["Edge Function Error"]
    end

    subgraph "User Feedback"
        FallbackUI["Fallback UI"]
        Toast["Toast Notification"]
        Console["Console Log"]
    end

    RenderError --> Boundary
    Boundary --> FallbackUI
    
    AsyncError --> QueryError
    QueryError --> Toast
    
    NetworkError --> EdgeError
    EdgeError --> Toast
    EdgeError --> Console
</presentation-mermaid>

### Retry Strategy

<presentation-mermaid>
graph LR
    subgraph "Connection Strategy"
        Direct["Direct Connection"]
        Tailscale["Tailscale Fallback"]
    end

    subgraph "Retry Logic"
        Attempt1["Attempt 1"]
        Backoff["Exponential Backoff"]
        Attempt2["Attempt 2"]
        Attempt3["Attempt 3"]
    end

    subgraph "Outcome"
        Success["✅ Success"]
        Failure["❌ Max Retries"]
        Learn["📊 Learn Timeout"]
    end

    Direct --> Attempt1
    Attempt1 -->|Fail| Backoff
    Backoff --> Attempt2
    Attempt2 -->|Fail| Tailscale
    Tailscale --> Attempt3
    Attempt1 -->|Success| Success
    Attempt2 -->|Success| Success
    Attempt3 -->|Success| Success
    Attempt3 -->|Fail| Failure
    Success --> Learn
</presentation-mermaid>

---

## Infrastructure Diagram

### Deployment Architecture

<presentation-mermaid>
graph TB
    subgraph "CDN / Edge"
        CDN["Lovable CDN"]
    end

    subgraph "Supabase Cloud"
        Auth["Auth Service"]
        PostgREST["PostgREST API"]
        Realtime["Realtime Server"]
        Storage["Storage API"]
        Functions["Edge Runtime"]
        Postgres["PostgreSQL"]
    end

    subgraph "Customer Infrastructure"
        PVE["Proxmox VE Cluster"]
        Tailscale["Tailscale Network"]
    end

    CDN --> Auth
    CDN --> PostgREST
    CDN --> Realtime
    CDN --> Storage
    CDN --> Functions
    
    PostgREST --> Postgres
    Functions --> Postgres
    Functions --> PVE
    Functions -.-> Tailscale
    Tailscale -.-> PVE
</presentation-mermaid>

---

## Additional Resources

- [README.md](./README.md) - Project overview
- [API.md](./API.md) - API reference
- [SECURITY.md](./SECURITY.md) - Security documentation
- [CONTRIBUTING.md](./CONTRIBUTING.md) - Development guide
