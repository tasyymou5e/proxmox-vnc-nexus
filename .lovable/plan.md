

# Make Documentation Internal (Protected)

## Overview
Move the documentation from being publicly accessible to being a protected route that requires authentication. The docs link will be added to the dashboard navigation sidebar and removed from the public landing page.

## Current State
- Documentation is publicly accessible at `/docs` without authentication
- A link to docs exists on the Index page (landing/loading page)
- The route in `App.tsx` is not wrapped with `ProtectedRoute`

## Changes Required

### 1. Protect the Docs Route
**File:** `src/App.tsx`

Wrap the `/docs` route with `ProtectedRoute` so only authenticated users can access it:
```tsx
// Change from:
<Route path="/docs" element={<Suspense fallback={<PageLoader />}><Docs /></Suspense>} />

// Change to:
<Route path="/docs" element={
  <ProtectedRoute>
    <Suspense fallback={<PageLoader />}><Docs /></Suspense>
  </ProtectedRoute>
} />
```

### 2. Remove Public Docs Link
**File:** `src/pages/Index.tsx`

Remove the documentation link from the Index page since it will no longer be publicly accessible:
- Remove the `BookOpen` icon import
- Remove the `Button` component linking to `/docs`

### 3. Add Docs to Dashboard Navigation
**File:** `src/components/layout/DashboardLayout.tsx`

Add a "Documentation" item to the sidebar navigation:
- Import `BookOpen` icon from lucide-react
- Add new nav item: `{ label: "Documentation", href: "/docs", icon: BookOpen }`
- Position it after Settings for easy access

### 4. Add Docs to Tenant Layout Navigation
**File:** `src/components/layout/TenantLayout.tsx`

Add a "Documentation" item to the tenant sidebar navigation:
- Import `BookOpen` icon (add to existing imports)
- Add new nav item: `{ label: "Documentation", href: "/docs", icon: BookOpen }`
- Position it at the bottom of the navigation list

## User Flow After Changes

```text
User visits site
        |
        v
  Authenticated? ----No----> Login Page
        |
       Yes
        |
        v
    Dashboard
        |
        v
  Sidebar contains "Documentation" link
        |
        v
  Click Documentation
        |
        v
  View protected docs at /docs
```

## Files to Modify

| File | Change |
|------|--------|
| `src/App.tsx` | Wrap `/docs` route with `ProtectedRoute` |
| `src/pages/Index.tsx` | Remove public docs link |
| `src/components/layout/DashboardLayout.tsx` | Add Documentation nav item |
| `src/components/layout/TenantLayout.tsx` | Add Documentation nav item |

