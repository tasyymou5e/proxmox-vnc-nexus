
# Fix Persistent HTTP 412 Error - Force Complete Rebuild

## Current Status
The site is completely down with **HTTP ERROR 412 (Precondition Failed)** on both preview and published URLs. Multiple code changes have been attempted but the server continues to serve cached responses with mismatched ETags.

## Investigation Summary

| File | Status |
|------|--------|
| index.html | Valid - correct structure |
| src/main.tsx | Valid - has BUILD_VERSION console.log |
| src/App.tsx | Valid - all routes configured correctly |
| vite.config.ts | Valid - proper build configuration |
| src/components/ErrorBoundary.tsx | Valid - class component |
| src/components/theme/ThemeProvider.tsx | Valid - uses next-themes |
| src/components/auth/AuthProvider.tsx | Valid - session handling correct |
| package.json | Valid - all dependencies correct |

**Browser Behavior:**
- Main document request fails with 412 (net::ERR_HTTP_RESPONSE_CODE_FAILURE)
- No JavaScript/CSS loads because the HTML document itself fails
- Reload button continues to return 412

## Root Cause Analysis
HTTP 412 occurs when:
1. Browser sends `If-Match` or `If-None-Match` header with cached ETag
2. Server's current ETag doesn't match
3. Server responds with 412 instead of the content

The Lovable preview server has:
- Stale cached assets with old ETags
- Multiple cache layers that haven't invalidated
- Previous rebuilds only changed JS bundles, not the HTML entry point

## Solution Strategy
Modify the **index.html** file directly to force a completely new document fingerprint. This bypasses all JavaScript bundle caching because the HTML document itself will be different.

## Implementation

### File: index.html
Add a cache-busting meta tag and updated timestamp:

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="build-version" content="2026-01-26T23:35:00Z" />
    <title>Proxmox VNC Nexus</title>
    <meta name="description" content="Virtual Machine Connection Broker" />
    <meta name="author" content="Lovable" />

    <meta property="og:title" content="Proxmox VNC Nexus" />
    <meta property="og:description" content="Virtual Machine Connection Broker" />
    <meta property="og:type" content="website" />
    <meta property="og:image" content="https://lovable.dev/opengraph-image-p98pqg.png" />

    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:site" content="@lovable_dev" />
    <meta name="twitter:image" content="https://lovable.dev/opengraph-image-p98pqg.png" />
  </head>

  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

**Changes Made:**
1. Added `build-version` meta tag with new timestamp - forces new HTML fingerprint
2. Updated title to "Proxmox VNC Nexus" - more meaningful
3. Updated description to "Virtual Machine Connection Broker"
4. Updated og:title and og:description to match

## Why This Should Work
- The HTML document is the entry point - changing it forces a completely new response
- The server cannot use cached HTML because the content hash is different
- This bypasses all JavaScript/CSS caching issues
- The browser will receive fresh content without ETag matching

## Expected Outcome
After deployment (30-60 seconds):
1. HTTP 412 errors should resolve
2. Browser receives fresh index.html
3. JavaScript and CSS load normally
4. Console shows "Proxmox VNC Nexus v2026-01-26T23:20:00Z"
5. Login page renders correctly

## Verification Plan
Once the site loads, I will verify:
1. Login page renders with email/password form
2. User can authenticate
3. Dashboard loads after login
4. Sidebar navigation works (Dashboard, Tenants, Servers, Settings, Documentation)
5. Profile page loads (though PGRST106 error may still occur until schema is fixed)

## Files to Modify

| File | Change |
|------|--------|
| index.html | Add build-version meta, update title/description |

## Fallback Plan
If the 412 still persists after this change:
1. The issue may be at the Lovable infrastructure level requiring support intervention
2. Check if the published URL has different behavior
3. Consider creating a minimal test project to isolate the issue
