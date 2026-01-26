import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useConnectionHealthAlerts } from "@/hooks/useConnectionHealthAlerts";
import { 
  AlertTriangle, 
  CheckCircle2, 
  RefreshCw, 
  Server,
  Bell,
  BellOff
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface ConnectionHealthAlertsProps {
  tenantId: string;
  successRateThreshold?: number;
}

export function ConnectionHealthAlerts({ 
  tenantId,
  successRateThreshold = 80 
}: ConnectionHealthAlertsProps) {
  const { alerts, refetch, isEnabled, thresholds } = useConnectionHealthAlerts({
    tenantId,
    successRateThreshold,
  });

  // Use configured thresholds from tenant settings
  const displayThreshold = thresholds?.successRate ?? successRateThreshold;
  const latencyThreshold = thresholds?.latencyMs ?? 500;

  const hasAlerts = alerts.length > 0;

  return (
    <Card className={hasAlerts ? "border-destructive/50" : ""}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            {hasAlerts ? (
              <AlertTriangle className="h-5 w-5 text-destructive" />
            ) : (
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            )}
            Connection Health
          </CardTitle>
          <div className="flex items-center gap-2">
            {isEnabled ? (
              <Badge variant="secondary" className="gap-1">
                <Bell className="h-3 w-3" />
                Alerts On
              </Badge>
            ) : (
              <Badge variant="outline" className="gap-1 text-muted-foreground">
                <BellOff className="h-3 w-3" />
                Alerts Off
              </Badge>
            )}
            <Button variant="ghost" size="icon" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {!hasAlerts ? (
          <div className="text-center py-6">
            <CheckCircle2 className="h-12 w-12 mx-auto text-emerald-500 mb-3" />
            <p className="font-medium text-foreground">All Systems Operational</p>
            <p className="text-sm text-muted-foreground">
              All servers online with success rates above {displayThreshold}% and latency below {latencyThreshold}ms
            </p>
          </div>
        ) : (
          <ScrollArea className="max-h-[300px]">
            <div className="space-y-3">
              {alerts.map((alert) => (
                <div 
                  key={alert.serverId}
                  className="flex items-start gap-3 p-3 rounded-lg bg-destructive/5 border border-destructive/20"
                >
                  <div className="p-2 rounded-full bg-destructive/10">
                    <Server className="h-4 w-4 text-destructive" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{alert.serverName}</span>
                      <Badge 
                        variant="outline"
                        className={
                          alert.status === "offline" 
                            ? "bg-red-500/10 text-red-500 border-red-500/20"
                            : "bg-amber-500/10 text-amber-500 border-amber-500/20"
                        }
                      >
                        {alert.status === "offline" ? "Offline" : "Degraded"}
                      </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">
                      {alert.status === "offline" ? (
                        "Server is not responding to health checks"
                      ) : alert.successRate < displayThreshold ? (
                        `Success rate: ${alert.successRate.toFixed(1)}% (threshold: ${displayThreshold}%)`
                      ) : (
                        `Latency: ${alert.avgLatency}ms (threshold: ${latencyThreshold}ms)`
                      )}
                    </div>
                    {alert.lastCheck && (
                      <div className="text-xs text-muted-foreground mt-1">
                        Last check: {formatDistanceToNow(new Date(alert.lastCheck), { addSuffix: true })}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
