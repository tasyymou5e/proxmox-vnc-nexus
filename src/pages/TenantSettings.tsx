import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { TenantLayout } from "@/components/layout/TenantLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useTenantSettings } from "@/hooks/useTenantSettings";
import { useTenantPermissions } from "@/hooks/useTenantPermissions";
import { Palette, Bell, Settings, Save, Loader2 } from "lucide-react";
import type { TenantSettings as TenantSettingsType } from "@/lib/types";

export default function TenantSettings() {
  const { tenantId } = useParams<{ tenantId: string }>();
  const { settings, isLoading, updateSettings, isUpdating } = useTenantSettings(tenantId);
  const { canManageSettings } = useTenantPermissions(tenantId);
  
  const [formData, setFormData] = useState<Partial<TenantSettingsType>>({});
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (settings) {
      setFormData({
        primary_color: settings.primary_color,
        secondary_color: settings.secondary_color,
        accent_color: settings.accent_color,
        logo_url: settings.logo_url,
        notification_email: settings.notification_email,
        notify_on_server_offline: settings.notify_on_server_offline,
        notify_on_vm_action: settings.notify_on_vm_action,
        notify_on_user_changes: settings.notify_on_user_changes,
        default_connection_timeout: settings.default_connection_timeout,
        default_verify_ssl: settings.default_verify_ssl,
        auto_health_check_interval: settings.auto_health_check_interval,
      });
    }
  }, [settings]);

  const handleChange = (key: keyof TenantSettingsType, value: unknown) => {
    setFormData(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const handleSave = () => {
    updateSettings(formData);
    setHasChanges(false);
  };

  if (isLoading) {
    return (
      <TenantLayout>
        <div className="p-6 space-y-6">
          <Skeleton className="h-8 w-48" />
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <Skeleton className="h-64" />
            <Skeleton className="h-64" />
            <Skeleton className="h-64" />
          </div>
        </div>
      </TenantLayout>
    );
  }

  return (
    <TenantLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Tenant Settings</h1>
            <p className="text-muted-foreground">
              Configure branding, notifications, and default settings
            </p>
          </div>
          {canManageSettings && (
            <Button onClick={handleSave} disabled={!hasChanges || isUpdating}>
              {isUpdating ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save Changes
            </Button>
          )}
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {/* Branding Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="h-5 w-5" />
                Branding
              </CardTitle>
              <CardDescription>
                Customize the look and feel of your tenant
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="primary_color">Primary Color</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="primary_color"
                    type="color"
                    value={formData.primary_color || "#3b82f6"}
                    onChange={(e) => handleChange("primary_color", e.target.value)}
                    className="w-12 h-10 p-1 cursor-pointer"
                    disabled={!canManageSettings}
                  />
                  <Input
                    value={formData.primary_color || "#3b82f6"}
                    onChange={(e) => handleChange("primary_color", e.target.value)}
                    className="flex-1 font-mono"
                    disabled={!canManageSettings}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="secondary_color">Secondary Color</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="secondary_color"
                    type="color"
                    value={formData.secondary_color || "#1e40af"}
                    onChange={(e) => handleChange("secondary_color", e.target.value)}
                    className="w-12 h-10 p-1 cursor-pointer"
                    disabled={!canManageSettings}
                  />
                  <Input
                    value={formData.secondary_color || "#1e40af"}
                    onChange={(e) => handleChange("secondary_color", e.target.value)}
                    className="flex-1 font-mono"
                    disabled={!canManageSettings}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="accent_color">Accent Color</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="accent_color"
                    type="color"
                    value={formData.accent_color || "#f59e0b"}
                    onChange={(e) => handleChange("accent_color", e.target.value)}
                    className="w-12 h-10 p-1 cursor-pointer"
                    disabled={!canManageSettings}
                  />
                  <Input
                    value={formData.accent_color || "#f59e0b"}
                    onChange={(e) => handleChange("accent_color", e.target.value)}
                    className="flex-1 font-mono"
                    disabled={!canManageSettings}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="logo_url">Logo URL</Label>
                <Input
                  id="logo_url"
                  type="url"
                  value={formData.logo_url || ""}
                  onChange={(e) => handleChange("logo_url", e.target.value || null)}
                  placeholder="https://example.com/logo.png"
                  disabled={!canManageSettings}
                />
              </div>
            </CardContent>
          </Card>

          {/* Notifications Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Notifications
              </CardTitle>
              <CardDescription>
                Configure when to receive notifications
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="notification_email">Notification Email</Label>
                <Input
                  id="notification_email"
                  type="email"
                  value={formData.notification_email || ""}
                  onChange={(e) => handleChange("notification_email", e.target.value || null)}
                  placeholder="admin@company.com"
                  disabled={!canManageSettings}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Server Offline Alerts</Label>
                  <p className="text-xs text-muted-foreground">
                    Get notified when a server goes offline
                  </p>
                </div>
                <Switch
                  checked={formData.notify_on_server_offline ?? true}
                  onCheckedChange={(checked) => handleChange("notify_on_server_offline", checked)}
                  disabled={!canManageSettings}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>VM Power Actions</Label>
                  <p className="text-xs text-muted-foreground">
                    Get notified on VM start/stop/restart
                  </p>
                </div>
                <Switch
                  checked={formData.notify_on_vm_action ?? false}
                  onCheckedChange={(checked) => handleChange("notify_on_vm_action", checked)}
                  disabled={!canManageSettings}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>User Changes</Label>
                  <p className="text-xs text-muted-foreground">
                    Get notified when users are added/removed
                  </p>
                </div>
                <Switch
                  checked={formData.notify_on_user_changes ?? true}
                  onCheckedChange={(checked) => handleChange("notify_on_user_changes", checked)}
                  disabled={!canManageSettings}
                />
              </div>
            </CardContent>
          </Card>

          {/* Default Configurations Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Default Configurations
              </CardTitle>
              <CardDescription>
                Set default values for new servers
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="default_connection_timeout">
                  Default Connection Timeout (seconds)
                </Label>
                <Input
                  id="default_connection_timeout"
                  type="number"
                  min={5}
                  max={120}
                  value={Math.round((formData.default_connection_timeout || 10000) / 1000)}
                  onChange={(e) => handleChange("default_connection_timeout", parseInt(e.target.value) * 1000)}
                  disabled={!canManageSettings}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>SSL Verification</Label>
                  <p className="text-xs text-muted-foreground">
                    Verify SSL certificates by default
                  </p>
                </div>
                <Switch
                  checked={formData.default_verify_ssl ?? true}
                  onCheckedChange={(checked) => handleChange("default_verify_ssl", checked)}
                  disabled={!canManageSettings}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="auto_health_check_interval">
                  Health Check Interval (minutes)
                </Label>
                <Input
                  id="auto_health_check_interval"
                  type="number"
                  min={1}
                  max={60}
                  value={Math.round((formData.auto_health_check_interval || 300000) / 60000)}
                  onChange={(e) => handleChange("auto_health_check_interval", parseInt(e.target.value) * 60000)}
                  disabled={!canManageSettings}
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </TenantLayout>
  );
}
