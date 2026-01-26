
# Tenant Logo Storage, Exponential Backoff Retry, and VM Quick Actions

## Overview

This plan implements three features:

1. **Tenant Logo Storage Bucket** - Create Supabase storage bucket for tenant logos with upload functionality
2. **Exponential Backoff Retry Logic** - Add retry mechanism to proxmox-servers edge function for Tailscale connections
3. **VM Quick Actions on Dashboard** - Add inline power controls with role-based visibility for managers

---

## Part 1: Tenant Logo Storage and Upload

### 1.1 Create Storage Bucket (SQL Migration)

Create a public bucket for tenant logos with appropriate RLS policies:

```sql
-- Create the tenant-logos bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'tenant-logos',
  'tenant-logos',
  true,  -- Public bucket for logo display
  2097152,  -- 2MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']
);

-- RLS Policy: Users can view logos for their tenants
CREATE POLICY "Users can view tenant logos"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'tenant-logos' AND
  (
    auth.uid() IS NOT NULL AND
    (
      public.has_role(auth.uid(), 'admin'::app_role) OR
      public.user_has_tenant_access(auth.uid(), (storage.foldername(name))[1]::uuid)
    )
  )
);

-- RLS Policy: Tenant admins can upload logos
CREATE POLICY "Tenant admins can upload logos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'tenant-logos' AND
  auth.uid() IS NOT NULL AND
  (
    public.has_role(auth.uid(), 'admin'::app_role) OR
    public.has_tenant_role(auth.uid(), (storage.foldername(name))[1]::uuid, ARRAY['admin']::tenant_role[])
  )
);

-- RLS Policy: Tenant admins can update logos
CREATE POLICY "Tenant admins can update logos"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'tenant-logos' AND
  auth.uid() IS NOT NULL AND
  (
    public.has_role(auth.uid(), 'admin'::app_role) OR
    public.has_tenant_role(auth.uid(), (storage.foldername(name))[1]::uuid, ARRAY['admin']::tenant_role[])
  )
);

-- RLS Policy: Tenant admins can delete logos
CREATE POLICY "Tenant admins can delete logos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'tenant-logos' AND
  auth.uid() IS NOT NULL AND
  (
    public.has_role(auth.uid(), 'admin'::app_role) OR
    public.has_tenant_role(auth.uid(), (storage.foldername(name))[1]::uuid, ARRAY['admin']::tenant_role[])
  )
);
```

### 1.2 Create Logo Upload Hook

**File: `src/hooks/useLogoUpload.ts`** (New)

```typescript
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export function useLogoUpload(tenantId: string | undefined) {
  const uploadLogo = async (file: File): Promise<string | null> => {
    if (!tenantId) throw new Error("Tenant ID required");
    
    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'];
    if (!allowedTypes.includes(file.type)) {
      throw new Error("Invalid file type. Allowed: JPEG, PNG, WebP, SVG");
    }
    
    // Validate file size (2MB max)
    if (file.size > 2 * 1024 * 1024) {
      throw new Error("File too large. Maximum size: 2MB");
    }

    const fileExt = file.name.split('.').pop();
    const fileName = `${tenantId}/logo.${fileExt}`;
    
    const { data, error } = await supabase.storage
      .from('tenant-logos')
      .upload(fileName, file, { 
        upsert: true,
        contentType: file.type 
      });
    
    if (error) throw error;
    
    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('tenant-logos')
      .getPublicUrl(data.path);
    
    return publicUrl;
  };

  const deleteLogo = async () => {
    if (!tenantId) throw new Error("Tenant ID required");
    
    // List files in tenant folder
    const { data: files } = await supabase.storage
      .from('tenant-logos')
      .list(tenantId);
    
    if (files?.length) {
      await supabase.storage
        .from('tenant-logos')
        .remove(files.map(f => `${tenantId}/${f.name}`));
    }
  };

  return { uploadLogo, deleteLogo };
}
```

### 1.3 Update TenantSettings Page with Logo Upload

**File: `src/pages/TenantSettings.tsx`** (Update)

Add file upload UI to replace the URL input:

```text
Logo Upload Section:
+--------------------------------------------------+
|  Logo                                             |
|  +-------------+  +--------------------------+   |
|  | [Preview]   |  | Drag & drop or click    |   |
|  | Current     |  | to upload logo           |   |
|  | Logo        |  |                          |   |
|  +-------------+  | Formats: JPEG, PNG, WebP |   |
|                   | Max size: 2MB            |   |
|                   +--------------------------+   |
|                   [Remove Logo]                  |
+--------------------------------------------------+
```

Changes to implement:
- Import `useLogoUpload` hook
- Add file input with drag-and-drop support
- Show current logo preview if exists
- Handle upload progress and errors
- Update `logo_url` in settings after successful upload
- Add "Remove Logo" button functionality

```tsx
// New state for upload
const [isUploading, setIsUploading] = useState(false);
const fileInputRef = useRef<HTMLInputElement>(null);

// Handle file selection
const handleFileSelect = async (file: File) => {
  setIsUploading(true);
  try {
    const url = await uploadLogo(file);
    if (url) {
      handleChange("logo_url", url);
      toast({ title: "Logo uploaded", description: "Your logo has been updated." });
    }
  } catch (error) {
    toast({ title: "Upload failed", description: error.message, variant: "destructive" });
  } finally {
    setIsUploading(false);
  }
};
```

---

## Part 2: Exponential Backoff Retry Logic

### 2.1 Add fetchWithRetry Helper to proxmox-servers

**File: `supabase/functions/proxmox-servers/index.ts`** (Update)

Add at the top of the file after the encryption functions:

```typescript
// Retry configuration
interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
}

interface FetchWithRetryResult {
  response: Response | null;
  error: Error | null;
  attempts: number;
  totalTimeMs: number;
}

async function fetchWithRetry(
  url: string,
  options: RequestInit,
  config: RetryConfig = { maxRetries: 3, baseDelayMs: 1000, maxDelayMs: 8000 }
): Promise<FetchWithRetryResult> {
  const startTime = Date.now();
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);
      
      // Success - return immediately
      return {
        response,
        error: null,
        attempts: attempt + 1,
        totalTimeMs: Date.now() - startTime,
      };
    } catch (error) {
      lastError = error as Error;
      
      // Don't retry on timeout errors (AbortError) - they already waited
      if (error.name === 'TimeoutError' || error.name === 'AbortError') {
        break;
      }
      
      // If more retries available, wait with exponential backoff
      if (attempt < config.maxRetries) {
        // Exponential backoff: 1s, 2s, 4s, 8s (capped at maxDelayMs)
        const delay = Math.min(
          config.baseDelayMs * Math.pow(2, attempt),
          config.maxDelayMs
        );
        // Add jitter (0-20% of delay)
        const jitter = delay * 0.2 * Math.random();
        
        console.log(`Retry ${attempt + 1}/${config.maxRetries} after ${delay + jitter}ms`);
        await new Promise(r => setTimeout(r, delay + jitter));
      }
    }
  }
  
  return {
    response: null,
    error: lastError,
    attempts: config.maxRetries + 1,
    totalTimeMs: Date.now() - startTime,
  };
}
```

### 2.2 Update Health Check to Use Retry Logic

Replace the direct fetch calls in health-check-all action:

```typescript
// In health-check-all action, replace:
// const testResponse = await fetch(testUrl, { ... });

// With:
const useTailscale = server.use_tailscale && !!server.tailscale_hostname;
const retryConfig: RetryConfig = useTailscale 
  ? { maxRetries: 3, baseDelayMs: 1000, maxDelayMs: 8000 }  // More retries for Tailscale
  : { maxRetries: 1, baseDelayMs: 500, maxDelayMs: 2000 };  // Fewer retries for direct

const { response: testResponse, error: fetchError, attempts } = await fetchWithRetry(
  testUrl,
  {
    headers: { "Authorization": `PVEAPIToken=${decryptedToken}` },
    signal: AbortSignal.timeout(timeout),
  },
  retryConfig
);

// Log retry info if multiple attempts
if (attempts > 1) {
  console.log(`Server ${server.name}: Succeeded after ${attempts} attempts`);
}

if (fetchError) {
  result.error = `${fetchError.message} (after ${attempts} attempts)`;
  // ... update database status
}
```

### 2.3 Update Test Connection Endpoint

Similar update to the test action:

```typescript
// In test action, use fetchWithRetry:
const { response: testResponse, error: fetchError, attempts } = await fetchWithRetry(
  testUrl,
  {
    headers: { "Authorization": `PVEAPIToken=${tokenToUse}` },
    signal: AbortSignal.timeout(timeout),
  },
  useTailscale 
    ? { maxRetries: 3, baseDelayMs: 1000, maxDelayMs: 8000 }
    : { maxRetries: 1, baseDelayMs: 500, maxDelayMs: 2000 }
);

// Return retry info in response
return new Response(
  JSON.stringify({ 
    success: true, 
    message: `Connection successful${attempts > 1 ? ` (${attempts} attempts)` : ''}`,
    nodes: testData.data?.length || 0,
    retryAttempts: attempts,
  }),
  { headers: { ...corsHeaders, "Content-Type": "application/json" } }
);
```

---

## Part 3: VM Quick Actions on Tenant Dashboard

### 3.1 Create VMQuickActions Component

**File: `src/components/dashboard/VMQuickActions.tsx`** (New)

```tsx
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Play, Square, RotateCcw, Loader2, Monitor, Link2 } from "lucide-react";
import type { VM } from "@/lib/types";

interface VMQuickActionsProps {
  vm: VM;
  onAction: (action: "start" | "stop" | "reset") => Promise<void>;
  isPerformingAction: boolean;
  canManage: boolean;
}

export function VMQuickActions({ vm, onAction, isPerformingAction, canManage }: VMQuickActionsProps) {
  const [confirmAction, setConfirmAction] = useState<"stop" | "reset" | null>(null);
  
  const isRunning = vm.status === "running";
  const isStopped = vm.status === "stopped";
  
  const handleAction = async (action: "start" | "stop" | "reset") => {
    if (action === "stop" || action === "reset") {
      setConfirmAction(action);
    } else {
      await onAction(action);
    }
  };

  const confirmAndExecute = async () => {
    if (confirmAction) {
      await onAction(confirmAction);
      setConfirmAction(null);
    }
  };

  return (
    <>
      <div className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
        <div className="flex items-center gap-3">
          <Monitor className="h-4 w-4 text-muted-foreground" />
          <div>
            <div className="flex items-center gap-2">
              <span className="font-medium">{vm.name || `VM ${vm.vmid}`}</span>
              <Badge variant={isRunning ? "default" : "secondary"} className="text-xs">
                {vm.status}
              </Badge>
              {vm.useTailscale && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <Link2 className="h-3 w-3 text-blue-500" />
                    </TooltipTrigger>
                    <TooltipContent>Tailscale: {vm.tailscaleHostname}</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {vm.node} • {vm.type.toUpperCase()} • ID: {vm.vmid}
            </p>
          </div>
        </div>
        
        {canManage && (
          <div className="flex items-center gap-1">
            {isStopped ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleAction("start")}
                disabled={isPerformingAction}
                className="text-green-600 hover:text-green-700 hover:bg-green-100"
              >
                {isPerformingAction ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
                <span className="ml-1">Start</span>
              </Button>
            ) : isRunning ? (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleAction("stop")}
                  disabled={isPerformingAction}
                  className="text-red-600 hover:text-red-700 hover:bg-red-100"
                >
                  {isPerformingAction ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Square className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleAction("reset")}
                  disabled={isPerformingAction}
                  className="text-orange-600 hover:text-orange-700 hover:bg-orange-100"
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
              </>
            ) : null}
          </div>
        )}
      </div>

      {/* Confirmation Dialog */}
      <AlertDialog open={!!confirmAction} onOpenChange={() => setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction === "stop" ? "Stop" : "Reset"} {vm.name || `VM ${vm.vmid}`}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction === "stop"
                ? "This will gracefully stop the virtual machine. Any unsaved data may be lost."
                : "This will immediately reset the virtual machine. All unsaved data will be lost."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmAndExecute}
              className={confirmAction === "reset" ? "bg-orange-600 hover:bg-orange-700" : "bg-red-600 hover:bg-red-700"}
            >
              {confirmAction === "stop" ? "Stop VM" : "Reset VM"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
```

### 3.2 Update TenantDashboard with VM Quick Actions Section

**File: `src/pages/TenantDashboard.tsx`** (Update)

Add new import and VM Quick Actions section after the Node Status section:

```tsx
// Add imports
import { useTenantVMs } from "@/hooks/useTenantVMs";
import { VMQuickActions } from "@/components/dashboard/VMQuickActions";
import { MonitorPlay } from "lucide-react";

// Inside component, add hook
const { vms, isLoading: isVMsLoading, performAction, isPerformingAction } = useTenantVMs(tenantId);
const { canManageVMs } = useTenantPermissions(tenantId);

// Get first 5 running/stopped VMs (not templates)
const recentVMs = vms
  .filter(vm => !vm.template && (vm.status === 'running' || vm.status === 'stopped'))
  .slice(0, 5);
```

Add new section before Quick Actions:

```tsx
{/* VM Quick Actions - visible to managers+ */}
{canManageVMs && (
  <div>
    <div className="flex items-center justify-between mb-4">
      <h2 className="text-lg font-semibold flex items-center gap-2">
        <MonitorPlay className="h-5 w-5" />
        VM Quick Actions
      </h2>
      <Button variant="ghost" size="sm" asChild>
        <Link to={`/tenants/${tenantId}/vms`}>
          View All VMs
        </Link>
      </Button>
    </div>
    
    {isVMsLoading ? (
      <div className="space-y-2">
        {[1, 2, 3].map(i => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    ) : recentVMs.length === 0 ? (
      <Card className="border-dashed">
        <CardContent className="flex items-center justify-center py-8 text-muted-foreground">
          No virtual machines found
        </CardContent>
      </Card>
    ) : (
      <div className="space-y-2">
        {recentVMs.map(vm => (
          <VMQuickActions
            key={`${vm.serverId}-${vm.node}-${vm.vmid}`}
            vm={vm}
            onAction={async (action) => {
              await performAction({
                vmid: vm.vmid,
                node: vm.node,
                action,
                vmType: vm.type,
                vmName: vm.name,
                serverId: vm.serverId,
                serverName: vm.serverName,
              });
            }}
            isPerformingAction={isPerformingAction}
            canManage={canManageVMs}
          />
        ))}
      </div>
    )}
  </div>
)}
```

### 3.3 Update Dashboard Index Export

**File: `src/components/dashboard/index.ts`** (Update)

Add export for new component:

```typescript
export { VMQuickActions } from "./VMQuickActions";
```

---

## Implementation Order

| Step | Task | Files |
|------|------|-------|
| 1 | Create storage bucket migration | SQL migration |
| 2 | Create useLogoUpload hook | `src/hooks/useLogoUpload.ts` |
| 3 | Update TenantSettings with upload UI | `src/pages/TenantSettings.tsx` |
| 4 | Add fetchWithRetry to proxmox-servers | `supabase/functions/proxmox-servers/index.ts` |
| 5 | Update health-check-all with retry | `supabase/functions/proxmox-servers/index.ts` |
| 6 | Update test connection with retry | `supabase/functions/proxmox-servers/index.ts` |
| 7 | Create VMQuickActions component | `src/components/dashboard/VMQuickActions.tsx` |
| 8 | Update TenantDashboard | `src/pages/TenantDashboard.tsx` |
| 9 | Update dashboard index export | `src/components/dashboard/index.ts` |
| 10 | Deploy edge functions | Deployment |

---

## Summary of Changes

| Component | Changes |
|-----------|---------|
| **Database** | Create `tenant-logos` storage bucket with RLS policies |
| **useLogoUpload** | New hook for logo upload/delete operations |
| **TenantSettings** | Replace URL input with file upload UI, preview, and remove button |
| **proxmox-servers** | Add `fetchWithRetry` helper with exponential backoff (1s, 2s, 4s, 8s) |
| **VMQuickActions** | New component for inline VM power controls with confirmation dialogs |
| **TenantDashboard** | Add VM Quick Actions section showing first 5 VMs with power controls |
| **dashboard/index.ts** | Export VMQuickActions component |

---

## Security Considerations

1. **Logo Upload Security**:
   - File type validation (JPEG, PNG, WebP, SVG only)
   - File size limit (2MB)
   - RLS policies restrict uploads to tenant admins
   - Files stored in tenant-specific folders

2. **Retry Logic Security**:
   - Max retries capped at 3 for Tailscale, 1 for direct
   - Delay capped at 8 seconds to prevent indefinite blocking
   - Timeout errors skip retry (already waited)

3. **VM Actions Security**:
   - Role-based visibility (managers+ only)
   - Confirmation dialogs for destructive actions
   - Audit logging via vm-actions edge function

---

## Retry Algorithm Visualization

```text
Direct Connection:
  Attempt 1 (immediate)
    ↓ fail
  Wait: 500ms + jitter
  Attempt 2 (final)
    ↓ fail
  Return error

Tailscale Connection:
  Attempt 1 (immediate)
    ↓ fail
  Wait: 1000ms + jitter
  Attempt 2
    ↓ fail  
  Wait: 2000ms + jitter
  Attempt 3
    ↓ fail
  Wait: 4000ms + jitter
  Attempt 4 (final)
    ↓ fail
  Return error
```
