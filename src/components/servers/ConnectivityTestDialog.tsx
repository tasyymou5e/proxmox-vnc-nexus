import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useConnectivityTest, useApplyRecommendedTimeout } from "@/hooks/useConnectivityTest";
import type { ConnectivityTestResult, ProxmoxServer } from "@/lib/types";
import {
  Activity,
  CheckCircle,
  XCircle,
  Wifi,
  Globe,
  Clock,
  Loader2,
  RefreshCw,
  Zap,
  Shield,
  Server,
  AlertTriangle,
} from "lucide-react";

interface ConnectivityTestDialogProps {
  server: ProxmoxServer;
  children?: React.ReactNode;
}

export function ConnectivityTestDialog({ server, children }: ConnectivityTestDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [result, setResult] = useState<ConnectivityTestResult | null>(null);
  
  const connectivityTest = useConnectivityTest();
  const applyTimeout = useApplyRecommendedTimeout();

  const handleRunTest = async () => {
    setResult(null);
    const testResult = await connectivityTest.mutateAsync(server.id);
    setResult(testResult);
  };

  const handleApplyRecommendation = () => {
    if (result) {
      applyTimeout.mutate({
        serverId: server.id,
        recommendedTimeoutMs: result.recommendedTimeoutMs,
      });
    }
  };

  const getTimingProgress = (ms: number, maxMs: number = 500) => {
    return Math.min((ms / maxMs) * 100, 100);
  };

  const getTimingColor = (ms: number) => {
    if (ms < 100) return "bg-green-500";
    if (ms < 300) return "bg-yellow-500";
    return "bg-red-500";
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button variant="outline" size="sm">
            <Activity className="h-4 w-4 mr-2" />
            Test Connection
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Server className="h-5 w-5" />
            Connection Test
          </DialogTitle>
          <DialogDescription>
            {server.name}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Status */}
          {connectivityTest.isPending ? (
            <div className="flex items-center justify-center p-8">
              <div className="text-center space-y-4">
                <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
                <p className="text-sm text-muted-foreground">Testing connection...</p>
              </div>
            </div>
          ) : result ? (
            <>
              {/* Connection Status */}
              <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/50">
                {result.success ? (
                  <>
                    <CheckCircle className="h-8 w-8 text-green-500" />
                    <div>
                      <p className="font-semibold text-green-500">Connected</p>
                      <p className="text-sm text-muted-foreground">
                        {result.proxmoxVersion && `Proxmox VE ${result.proxmoxVersion}`}
                        {result.nodeCount && ` • ${result.nodeCount} nodes`}
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <XCircle className="h-8 w-8 text-destructive" />
                    <div>
                      <p className="font-semibold text-destructive">Connection Failed</p>
                      <p className="text-sm text-muted-foreground">{result.error}</p>
                    </div>
                  </>
                )}
              </div>

              {/* Timing Breakdown */}
              <div className="space-y-3">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Timing Breakdown
                </h4>
                
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground flex items-center gap-2">
                    <Globe className="h-3 w-3" /> DNS Resolution
                  </span>
                  <span className="font-mono">{result.timing.dnsResolutionMs}ms</span>
                </div>
                <Progress 
                  value={getTimingProgress(result.timing.dnsResolutionMs)} 
                  className="h-1"
                />

                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground flex items-center gap-2">
                    <Wifi className="h-3 w-3" /> TCP Connection
                  </span>
                  <span className="font-mono">{result.timing.tcpConnectionMs}ms</span>
                </div>
                <Progress 
                  value={getTimingProgress(result.timing.tcpConnectionMs)} 
                  className="h-1"
                />

                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground flex items-center gap-2">
                    <Shield className="h-3 w-3" /> TLS Handshake
                  </span>
                  <span className="font-mono">{result.timing.tlsHandshakeMs}ms</span>
                </div>
                <Progress 
                  value={getTimingProgress(result.timing.tlsHandshakeMs)} 
                  className="h-1"
                />

                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground flex items-center gap-2">
                    <Zap className="h-3 w-3" /> API Response
                  </span>
                  <span className="font-mono">{result.timing.apiResponseMs}ms</span>
                </div>
                <Progress 
                  value={getTimingProgress(result.timing.apiResponseMs)} 
                  className="h-1"
                />

                  <div className="pt-2 border-t flex items-center justify-between font-medium">
                    <span>Total Latency</span>
                    <span className="font-mono">{result.timing.totalLatencyMs}ms</span>
                  </div>
                </div>
              </div>

              {/* Connection Path */}
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Connection Path</h4>
                <div className="p-3 rounded-lg bg-muted/50 space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <Badge variant={result.connectionType === 'tailscale' ? 'default' : 'secondary'}>
                      {result.connectionType === 'tailscale' ? 'Tailscale' : 'Direct'}
                    </Badge>
                    {result.tailscaleInfo && (
                      <span className="text-muted-foreground">
                        via {result.tailscaleInfo.hostname}:{result.tailscaleInfo.port}
                      </span>
                    )}
                  </div>
                  <p className="text-muted-foreground font-mono text-xs">
                    IP: {result.resolvedIp}
                  </p>
                </div>
              </div>

              {/* Timeout Recommendation */}
              {result.success && result.recommendedTimeoutMs !== result.currentTimeoutMs && (
              <div className="p-3 rounded-lg bg-accent/50 border border-accent space-y-2">
                <div className="flex items-center gap-2 text-accent-foreground">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="text-sm font-medium">Timeout Recommendation</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Based on connection metrics, we recommend a timeout of{" "}
                    <span className="font-medium">{Math.round(result.recommendedTimeoutMs / 1000)}s</span>{" "}
                    (current: {Math.round(result.currentTimeoutMs / 1000)}s)
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleApplyRecommendation}
                    disabled={applyTimeout.isPending}
                    className="w-full"
                  >
                    {applyTimeout.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : null}
                    Apply Recommendation
                  </Button>
                </div>
              )}
            </>
          ) : (
            <div className="text-center p-8 space-y-4">
              <Activity className="h-12 w-12 mx-auto text-muted-foreground" />
              <div>
                <p className="font-medium">Ready to Test</p>
                <p className="text-sm text-muted-foreground">
                  Click the button below to test the connection to this server
                </p>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleRunTest}
              disabled={connectivityTest.isPending}
              className="flex-1"
            >
              {connectivityTest.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              {result ? "Run Again" : "Run Test"}
            </Button>
            <Button variant="ghost" onClick={() => setIsOpen(false)}>
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
