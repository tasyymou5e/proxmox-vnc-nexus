

# Fix 412 Precondition Failed Error

The 412 error occurs when the CDN/preview server serves stale cached assets. The fix is to update the build-version meta tag in `index.html` to a new timestamp, which forces the CDN to invalidate its cache and serve fresh content.

## Change

**File: `index.html` (line 18)**

Update the build-version meta tag from:
```html
<meta name="build-version" content="2026-02-10T19-27" />
```
To:
```html
<meta name="build-version" content="2026-02-10T20-20" />
```

This is a single-line change that triggers a new build with a fresh asset fingerprint, resolving the 412 cache mismatch.

