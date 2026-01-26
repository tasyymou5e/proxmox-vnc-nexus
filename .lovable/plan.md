
# Fix Persistent HTTP 412 Error - More Aggressive Cache Invalidation

## Current Status
The site is completely down with HTTP 412 (Precondition Failed) errors on both preview and published URLs. Multiple rebuild attempts have not resolved the issue.

## Evidence from Investigation

| File | Status |
|------|--------|
| `src/main.tsx` | Valid - clean entry point |
| `src/App.tsx` | Valid - proper React structure, all routes configured |
| `src/pages/Index.tsx` | Valid - redirects to login/dashboard |
| `src/pages/Login.tsx` | Valid - toggles LoginForm/SignupForm |
| `src/components/auth/index.ts` | Valid - exports AuthProvider, useAuth, LoginForm, SignupForm |
| `src/components/theme/index.ts` | Valid - exports ThemeProvider, ThemeToggle |
| `src/components/ErrorBoundary.tsx` | Valid - class component with error handling |
| `index.html` | Valid - references /src/main.tsx |
| `vite.config.ts` | Valid - ESNext target, proper aliases |

**Browser Console Errors:**
- HTTP 412 on `/src/App.tsx`
- HTTP 412 on `/src/index.css`
- HTTP 412 on `/node_modules/.vite/deps/react-dom_client.js`
- HTTP 412 on `/node_modules/.vite/deps/react_jsx-dev-runtime.js`
- HTTP 412 on `/node_modules/vite/dist/client/env.mjs`

## Root Cause
The Lovable preview server has severely corrupted cache state. Previous timestamp-based rebuild triggers were insufficient because:
1. Only comments changed, no actual code changes
2. The server may be caching at multiple layers
3. ETags/If-Match headers are still mismatched

## Solution
Make a **functional but harmless code change** that forces Vite to generate completely new asset hashes. Adding an unused constant to the main entry point will:
1. Change the compiled JavaScript output (not just comments)
2. Force new chunk hashes for all downstream imports
3. Invalidate all cached assets at the server level

## Implementation

### File: src/main.tsx
Add a build version constant before the render call:

```tsx
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// Proxmox VNC Nexus - Connection Broker Application
// Build version for cache invalidation
const BUILD_VERSION = "2026-01-26T23:20:00Z";
console.log(`Proxmox VNC Nexus v${BUILD_VERSION}`);

createRoot(document.getElementById("root")!).render(<App />);
```

## Why This is Different
- **Previous attempts**: Only changed comments (stripped by minifier)
- **This change**: Adds actual JavaScript code that appears in the compiled output
- **Console.log**: Forces the bundler to include this code in the final bundle
- **Result**: Completely new chunk hashes for all assets

## Expected Outcome
After deployment (30-60 seconds):
1. HTTP 412 errors resolve
2. Console shows: "Proxmox VNC Nexus v2026-01-26T23:20:00Z"
3. Index page loads and redirects to /login
4. Login form renders correctly

## Files to Modify
| File | Change |
|------|--------|
| `src/main.tsx` | Add BUILD_VERSION constant with console.log |

## Verification After Fix
Once the site loads, we can verify:
1. Authentication flow works
2. Dashboard loads after login
3. Sidebar navigation shows Documentation link
4. All protected routes redirect properly
