import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { TenantLayout } from "@/components/layout/TenantLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantPermissions } from "@/hooks/useTenantPermissions";
import { useTenantSettings } from "@/hooks/useTenantSettings";
import { useRealtimeNotifications } from "@/hooks/useRealtimeNotifications";
import { LiveStatusIndicator } from "@/components/servers/LiveStatusIndicator";
import { format, formatDistanceToNow, isToday, isYesterday, startOfDay } from "date-fns";
import {
  Bell,
  BellOff,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  Activity,
  RefreshCw,
  Settings,
  TrendingDown,
  TrendingUp,
  Zap,
} from "lucide-react";

interface NotificationEvent {
  id: string;
  action_type: string;
  resource_type: string;
  resource_id: string | null;
  resource_name: string | null;
  details: Record<string, unknown>;
  created_at: string;
}

type NotificationType = "all" | "alerts" | "recovered" | "settings";

const notificationConfig: Record<string, {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  color: string;
  bgColor: string;
}> = {
  server_alert: {
    icon: AlertTriangle,
    label: "Server Alert",
    color: "text-destructive",
    bgColor: "bg-destructive/10",
  },
  server_offline: {
    icon: XCircle,
    label: "Server Offline",
    color: "text-destructive",
    bgColor: "bg-destructive/10",
  },
  server_recovered: {
    icon: CheckCircle2,
    label: "Server Recovered",
    color: "text-emerald-500",
    bgColor: "bg-emerald-500/10",
  },
  server_degraded: {
    icon: TrendingDown,
    label: "Performance Degraded",
    color: "text-amber-500",
    bgColor: "bg-amber-500/10",
  },
  settings_updated: {
    icon: Settings,
    label: "Settings Updated",
    color: "text-primary",
    bgColor: "bg-primary/10",
  },
  health_check_failed: {
    icon: Activity,
    label: "Health Check Failed",
    color: "text-destructive",
    bgColor: "bg-destructive/10",
  },
  health_check_passed: {
    icon: Zap,
    label: "Health Check Passed",
    color: "text-emerald-500",
    bgColor: "bg-emerald-500/10",
  },
};

function getNotificationConfig(actionType: string) {
  return notificationConfig[actionType] || {
    icon: Bell,
    label: actionType.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase()),
    color: "text-muted-foreground",
    bgColor: "bg-muted",
  };
}

function groupEventsByDate(events: NotificationEvent[]) {
  const groups: { date: string; label: string; events: NotificationEvent[] }[] = [];
  
  events.forEach(event => {
    const eventDate = startOfDay(new Date(event.created_at));
    const dateKey = eventDate.toISOString();
    
    let label: string;
    if (isToday(eventDate)) {
      label = "Today";
    } else if (isYesterday(eventDate)) {
      label = "Yesterday";
    } else {
      label = format(eventDate, "EEEE, MMMM d");
    }
    
    const existingGroup = groups.find(g => g.date === dateKey);
    if (existingGroup) {
      existingGroup.events.push(event);
    } else {
      groups.push({ date: dateKey, label, events: [event] });
    }
  });
  
  return groups;
}

function NotificationItem({ event }: { event: NotificationEvent }) {
  const config = getNotificationConfig(event.action_type);
  const Icon = config.icon;
  const details = event.details as Record<string, unknown>;
  
  return (
    <div className="flex gap-4 py-4 relative">
      {/* Timeline connector */}
      <div className="absolute left-5 top-14 bottom-0 w-px bg-border" />
      
      {/* Icon */}
      <div className={`relative z-10 flex-shrink-0 w-10 h-10 rounded-full ${config.bgColor} flex items-center justify-center`}>
        <Icon className={`h-5 w-5 ${config.color}`} />
      </div>
      
      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-medium">{config.label}</p>
            <p className="text-sm text-muted-foreground">
              {event.resource_name || event.resource_id || "System"}
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            {formatDistanceToNow(new Date(event.created_at), { addSuffix: true })}
          </div>
        </div>
        
        {/* Details */}
        {details && Object.keys(details).length > 0 && (
          <div className="mt-2 text-sm text-muted-foreground space-y-1">
            {details.alert_type && (
              <Badge variant="outline" className="text-xs">
                {String(details.alert_type)}
              </Badge>
            )}
            {details.success_rate !== undefined && (
              <span className="ml-2">
                Success rate: {Number(details.success_rate).toFixed(1)}%
              </span>
            )}
            {details.threshold !== undefined && (
              <span className="ml-2">
                (threshold: {Number(details.threshold)}%)
              </span>
            )}
            {details.changes && typeof details.changes === "object" && (
              <div className="mt-1">
                Changed: {Object.keys(details.changes as object).join(", ")}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function TimelineGroup({ group }: { group: { date: string; label: string; events: NotificationEvent[] } }) {
  return (
    <div className="mb-8">
      <div className="flex items-center gap-3 mb-4">
        <div className="h-px flex-1 bg-border" />
        <span className="text-sm font-medium text-muted-foreground">{group.label}</span>
        <div className="h-px flex-1 bg-border" />
      </div>
      <div className="space-y-0">
        {group.events.map((event, idx) => (
          <div key={event.id} className={idx === group.events.length - 1 ? "[&_.absolute]:hidden" : ""}>
            <NotificationItem event={event} />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function NotificationsCenter() {
  const { tenantId } = useParams<{ tenantId: string }>();
  const { canViewAuditLogs } = useTenantPermissions(tenantId);
  const { settings } = useTenantSettings(tenantId);
  const [activeTab, setActiveTab] = useState<NotificationType>("all");

  // Subscribe to real-time notification updates
  useRealtimeNotifications(tenantId);

  // Fetch notification-related audit logs
  const { data: events, isLoading, refetch } = useQuery({
    queryKey: ["notifications", tenantId, activeTab],
    queryFn: async () => {
      if (!tenantId) return [];

      // Define action types for each tab
      const alertTypes = ["server_alert", "server_offline", "server_degraded", "health_check_failed"];
      const recoveredTypes = ["server_recovered", "health_check_passed"];
      const settingsTypes = ["settings_updated"];

      let actionTypes: string[];
      switch (activeTab) {
        case "alerts":
          actionTypes = alertTypes;
          break;
        case "recovered":
          actionTypes = recoveredTypes;
          break;
        case "settings":
          actionTypes = settingsTypes;
          break;
        default:
          actionTypes = [...alertTypes, ...recoveredTypes, ...settingsTypes];
      }

      const { data, error } = await supabase
        .from("audit_logs")
        .select("id, action_type, resource_type, resource_id, resource_name, details, created_at")
        .eq("tenant_id", tenantId)
        .in("action_type", actionTypes)
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;
      return (data || []) as NotificationEvent[];
    },
    enabled: !!tenantId && canViewAuditLogs,
  });

  const groupedEvents = events ? groupEventsByDate(events) : [];
  
  // Count stats
  const alertCount = events?.filter(e => 
    ["server_alert", "server_offline", "server_degraded", "health_check_failed"].includes(e.action_type)
  ).length || 0;
  const recoveredCount = events?.filter(e => 
    ["server_recovered", "health_check_passed"].includes(e.action_type)
  ).length || 0;

  if (!canViewAuditLogs) {
    return (
      <TenantLayout>
        <div className="p-6">
          <Card>
            <CardContent className="p-12 text-center">
              <BellOff className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h2 className="text-lg font-semibold mb-2">Access Denied</h2>
              <p className="text-muted-foreground">
                You need admin access to view notifications.
              </p>
            </CardContent>
          </Card>
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
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Bell className="h-6 w-6" />
              Notifications Center
            </h1>
            <p className="text-muted-foreground">
              View all alerts, status changes, and system notifications
            </p>
            <LiveStatusIndicator tenantId={tenantId} />
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link to={`/tenants/${tenantId}/settings`}>
                <Settings className="h-4 w-4 mr-2" />
                Alert Settings
              </Link>
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-muted">
                  <Bell className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{events?.length || 0}</p>
                  <p className="text-sm text-muted-foreground">Total Events</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-destructive/10">
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{alertCount}</p>
                  <p className="text-sm text-muted-foreground">Alerts</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-500/10">
                  <TrendingUp className="h-5 w-5 text-emerald-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{recoveredCount}</p>
                  <p className="text-sm text-muted-foreground">Recovered</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Activity className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {settings?.alert_success_rate_threshold ?? 80}%
                  </p>
                  <p className="text-sm text-muted-foreground">Alert Threshold</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Timeline */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Event Timeline</CardTitle>
                <CardDescription>
                  Recent notifications and status changes
                </CardDescription>
              </div>
              <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as NotificationType)}>
                <TabsList>
                  <TabsTrigger value="all">All</TabsTrigger>
                  <TabsTrigger value="alerts" className="gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    Alerts
                  </TabsTrigger>
                  <TabsTrigger value="recovered" className="gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    Recovered
                  </TabsTrigger>
                  <TabsTrigger value="settings">Settings</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex gap-4">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-1/3" />
                      <Skeleton className="h-3 w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : groupedEvents.length > 0 ? (
              <ScrollArea className="h-[600px] pr-4">
                {groupedEvents.map(group => (
                  <TimelineGroup key={group.date} group={group} />
                ))}
              </ScrollArea>
            ) : (
              <div className="py-12 text-center">
                <Bell className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No notifications yet</h3>
                <p className="text-muted-foreground max-w-md mx-auto">
                  When servers go offline, recover, or alert thresholds are triggered,
                  notifications will appear here in a timeline.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </TenantLayout>
  );
}
