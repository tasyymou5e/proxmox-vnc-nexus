import { useState, useEffect, useRef } from "react";
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
import { useLogoUpload } from "@/hooks/useLogoUpload";
import { toast } from "@/hooks/use-toast";
import { Slider } from "@/components/ui/slider";
import { Palette, Bell, Settings, Save, Loader2, Upload, Trash2, Image, AlertTriangle } from "lucide-react";
import type { TenantSettings as TenantSettingsType } from "@/lib/types";

export default function TenantSettings() {
  const { tenantId } = useParams<{ tenantId: string }>();
  const { settings, isLoading, updateSettings, isUpdating } = useTenantSettings(tenantId);
  const { canManageSettings } = useTenantPermissions(tenantId);
  const { uploadLogo, deleteLogo, isUploading } = useLogoUpload(tenantId);
  
  const [formData, setFormData] = useState<Partial<TenantSettingsType>>({});
  const [hasChanges, setHasChanges] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
        alert_success_rate_threshold: settings.alert_success_rate_threshold,
        alert_latency_threshold_ms: settings.alert_latency_threshold_ms,
        alert_offline_duration_seconds: settings.alert_offline_duration_seconds,
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

  const handleFileSelect = async (file: File) => {
    try {
      const url = await uploadLogo(file);
      if (url) {
        handleChange("logo_url", url);
        toast({ title: "Logo uploaded", description: "Your logo has been updated." });
      }
    } catch (error) {
      toast({ 
        title: "Upload failed", 
        description: (error as Error).message, 
        variant: "destructive" 
      });
    }
  };

  const handleRemoveLogo = async () => {
    try {
      await deleteLogo();
      handleChange("logo_url", null);
      toast({ title: "Logo removed", description: "Your logo has been removed." });
    } catch (error) {
      toast({ 
        title: "Failed to remove logo", 
        description: (error as Error).message, 
        variant: "destructive" 
      });
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      handleFileSelect(file);
    } else {
      toast({ 
        title: "Invalid file", 
        description: "Please drop an image file (JPEG, PNG, or WebP)", 
        variant: "destructive" 
      });
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
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
          <Card className="lg:row-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="h-5 w-5" />
                Branding
              </CardTitle>
              <CardDescription>
                Customize the look and feel of your tenant
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Logo Upload */}
              <div className="space-y-2">
                <Label>Logo</Label>
                <div className="flex gap-4">
                  {/* Preview */}
                  <div className="w-20 h-20 border rounded-lg flex items-center justify-center bg-muted overflow-hidden">
                    {formData.logo_url ? (
                      <img 
                        src={formData.logo_url} 
                        alt="Tenant logo" 
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <Image className="h-8 w-8 text-muted-foreground" />
                    )}
                  </div>
                  
                  {/* Upload Zone */}
                  <div 
                    className={`flex-1 border-2 border-dashed rounded-lg p-4 text-center transition-colors cursor-pointer ${
                      isDragging 
                        ? 'border-primary bg-primary/5' 
                        : 'border-border hover:border-primary/50'
                    } ${!canManageSettings ? 'opacity-50 pointer-events-none' : ''}`}
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onClick={() => canManageSettings && fileInputRef.current?.click()}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFileSelect(file);
                      }}
                      disabled={!canManageSettings || isUploading}
                    />
                    {isUploading ? (
                      <Loader2 className="h-6 w-6 mx-auto animate-spin text-muted-foreground" />
                    ) : (
                      <Upload className="h-6 w-6 mx-auto text-muted-foreground" />
                    )}
                    <p className="text-xs text-muted-foreground mt-2">
                      Drop image or click to upload
                    </p>
                    <p className="text-xs text-muted-foreground">
                      JPEG, PNG, WebP • Max 2MB
                    </p>
                  </div>
                </div>
                {formData.logo_url && canManageSettings && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleRemoveLogo}
                    disabled={isUploading}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Remove Logo
                  </Button>
                )}
              </div>

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

          {/* Alert Thresholds Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                Alert Thresholds
              </CardTitle>
              <CardDescription>
                Configure when health alerts should trigger
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Success Rate Threshold</Label>
                  <span className="text-sm font-medium tabular-nums">
                    {formData.alert_success_rate_threshold ?? 80}%
                  </span>
                </div>
                <Slider
                  value={[formData.alert_success_rate_threshold ?? 80]}
                  onValueChange={([value]) => handleChange("alert_success_rate_threshold", value)}
                  min={50}
                  max={100}
                  step={5}
                  disabled={!canManageSettings}
                />
                <p className="text-xs text-muted-foreground">
                  Alert when server success rate drops below this percentage
                </p>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Latency Threshold</Label>
                  <span className="text-sm font-medium tabular-nums">
                    {formData.alert_latency_threshold_ms ?? 500}ms
                  </span>
                </div>
                <Slider
                  value={[formData.alert_latency_threshold_ms ?? 500]}
                  onValueChange={([value]) => handleChange("alert_latency_threshold_ms", value)}
                  min={100}
                  max={5000}
                  step={100}
                  disabled={!canManageSettings}
                />
                <p className="text-xs text-muted-foreground">
                  Alert when average response time exceeds this value
                </p>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Offline Duration</Label>
                  <span className="text-sm font-medium tabular-nums">
                    {formData.alert_offline_duration_seconds ?? 60}s
                  </span>
                </div>
                <Slider
                  value={[formData.alert_offline_duration_seconds ?? 60]}
                  onValueChange={([value]) => handleChange("alert_offline_duration_seconds", value)}
                  min={10}
                  max={300}
                  step={10}
                  disabled={!canManageSettings}
                />
                <p className="text-xs text-muted-foreground">
                  Only alert if server is offline for at least this duration
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </TenantLayout>
  );
}
