
# Fix HTTP 412 Infrastructure Error - Trigger Rebuild

## Problem
The site is stuck on a loading state because the Lovable preview server is returning HTTP 412 (Precondition Failed) errors for all application resources. This is a server-side caching/deployment issue, not a code defect.

## Evidence from Investigation
| Check | Result |
|-------|--------|
| Browser screenshot | "This page isn't working - HTTP ERROR 412" |
| Network request status | ERR_HTTP_RESPONSE_CODE_FAILURE |
| Login.tsx | Correctly structured, no errors |
| AuthProvider.tsx | Properly exports context and hooks |
| App.tsx | Routes correctly configured |
| Supabase client | Properly initialized |
| useRealtimeNotifications.ts | Clean code, no syntax errors |

## Verified Code Files
All recently modified files have been checked and are syntactically correct:
- `src/pages/Login.tsx` - Simple component toggling between LoginForm/SignupForm
- `src/components/auth/LoginForm.tsx` - Full login form with proper imports
- `src/components/auth/AuthProvider.tsx` - Context provider with session management
- `src/hooks/useRealtimeNotifications.ts` - Realtime subscription hook
- `src/pages/NotificationsCenter.tsx` - Notifications timeline view
- `src/components/layout/TenantLayout.tsx` - Sidebar with Documentation link
- `src/components/layout/DashboardLayout.tsx` - Sidebar with Documentation link

## Solution
Trigger a fresh build by making a minimal, non-functional change to a core file. This will force the preview server to:
1. Invalidate its asset cache
2. Rebuild the application from source
3. Serve fresh resources with correct ETags

## Implementation

### File: src/main.tsx
Add a timestamp comment to force a rebuild:

```tsx
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// Proxmox VNC Nexus - Connection Broker Application
// Build trigger: 2026-01-26T23:00
createRoot(document.getElementById("root")!).render(<App />);
```

## Why This Works
The HTTP 412 error occurs when the server's cached assets don't match what the client expects (based on conditional headers like If-Match or If-None-Match). By changing any source file:
- Vite generates new hashed asset filenames
- The preview server creates new cache entries
- All clients receive fresh resources without precondition conflicts

## Technical Details
- No functional code changes required
- Only adds a comment with a timestamp
- Forces complete rebuild of all assets
- Takes 30-60 seconds to deploy

## Expected Outcome
After the rebuild completes:
1. Preview URL will load the Index page
2. User will be redirected to /login
3. Login form will render correctly
4. Both preview and published sites will work
