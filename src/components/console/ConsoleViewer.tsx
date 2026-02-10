import { useEffect, useRef, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import type { VNCConnection } from "@/lib/types";
import {
  Maximize,
  Minimize,
  RefreshCcw,
  Power,
  Loader2,
  AlertCircle,
  Clipboard,
} from "lucide-react";
import RFB from "@novnc/novnc";

interface ConsoleViewerProps {
  connection: VNCConnection | null;
  isLoading: boolean;
  error: string | null;
  onReconnect: () => void;
}

type ConnectionStatus = "connecting" | "connected" | "disconnected" | "error";

export function ConsoleViewer({
  connection,
  isLoading,
  error,
  onReconnect,
}: ConsoleViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const rfbRef = useRef<RFB | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("connecting");

  // Fullscreen handling
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  // Initialize RFB connection when connection data is available
  useEffect(() => {
    if (!connection?.relayUrl || !canvasRef.current) return;

    // Clean up existing connection
    if (rfbRef.current) {
      rfbRef.current.disconnect();
      rfbRef.current = null;
    }

    setConnectionStatus("connecting");

    try {
      // Pass JWT via WebSocket sub-protocol instead of URL query parameter
      // This prevents the token from appearing in browser history, server logs, or Referer headers
      const wsProtocols: string[] = [];
      if (connection.wsAuthToken) {
        wsProtocols.push(`auth-${connection.wsAuthToken}`);
      }

      const rfb = new RFB(canvasRef.current, connection.relayUrl, {
        credentials: { password: connection.ticket },
        wsProtocols,
      });

      // Configure RFB
      rfb.scaleViewport = true;
      rfb.resizeSession = true;
      rfb.focusOnClick = true;
      rfb.background = "rgb(0, 0, 0)";

      // Event handlers
      rfb.addEventListener("connect", () => {
        setConnectionStatus("connected");
        toast({
          title: "Connected",
          description: "VNC session established successfully",
        });
      });

      rfb.addEventListener("disconnect", (e) => {
        setConnectionStatus("disconnected");
        rfbRef.current = null;

        if (e.detail.clean) {
          toast({
            title: "Disconnected",
            description: "VNC session ended",
          });
        } else {
          toast({
            title: "Connection lost",
            description: "The VNC connection was interrupted",
            variant: "destructive",
          });
        }
      });

      rfb.addEventListener("securityfailure", (e) => {
        setConnectionStatus("error");
        rfbRef.current = null;
        toast({
          title: "Security failure",
          description: e.detail.reason || "Authentication failed",
          variant: "destructive",
        });
      });

      rfbRef.current = rfb;

      return () => {
        if (rfbRef.current) {
          rfbRef.current.disconnect();
          rfbRef.current = null;
        }
      };
    } catch (err) {
      console.error("RFB initialization failed:", err);
      setConnectionStatus("error");
      toast({
        title: "Connection failed",
        description: err instanceof Error ? err.message : "Failed to initialize VNC",
        variant: "destructive",
      });
    }
  }, [connection?.relayUrl, connection?.ticket, connection?.wsAuthToken]);

  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;

    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  }, []);

  const sendCtrlAltDel = useCallback(() => {
    if (rfbRef.current) {
      rfbRef.current.sendCtrlAltDel();
      toast({
        title: "Ctrl+Alt+Del sent",
        description: "The key combination was sent to the VM",
      });
    }
  }, []);

  const pasteClipboard = useCallback(async () => {
    if (!rfbRef.current) return;

    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        rfbRef.current.clipboardPasteFrom(text);
        toast({
          title: "Clipboard pasted",
          description: "Text sent to VM",
        });
      }
    } catch (err) {
      toast({
        title: "Clipboard access denied",
        description: "Please allow clipboard access",
        variant: "destructive",
      });
    }
  }, []);

  const handleReconnect = useCallback(() => {
    if (rfbRef.current) {
      rfbRef.current.disconnect();
      rfbRef.current = null;
    }
    setConnectionStatus("connecting");
    onReconnect();
  }, [onReconnect]);

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-muted/50" role="status">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Connecting to console...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center bg-muted/50">
        <div className="text-center">
          <AlertCircle className="h-8 w-8 text-destructive mx-auto mb-4" />
          <p className="text-destructive font-medium mb-2">Connection Failed</p>
          <p className="text-muted-foreground text-sm mb-4">{error}</p>
          <Button onClick={handleReconnect}>
            <RefreshCcw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  if (!connection) {
    return (
      <div className="flex-1 flex items-center justify-center bg-muted/50">
        <div className="text-center">
          <AlertCircle className="h-8 w-8 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">No connection data available</p>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="flex-1 flex flex-col bg-black">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 bg-card border-b">
        <div className="flex items-center gap-2">
          <span
            className={`h-2 w-2 rounded-full ${
              connectionStatus === "connected"
                ? "bg-success"
                : connectionStatus === "connecting"
                  ? "bg-warning animate-pulse"
                  : "bg-destructive"
            }`}
            aria-hidden="true"
          />
          <span className="text-sm text-muted-foreground">
            {connectionStatus === "connected"
              ? "Connected"
              : connectionStatus === "connecting"
                ? "Connecting..."
                : "Disconnected"}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={pasteClipboard}
            disabled={connectionStatus !== "connected"}
            aria-label="Paste from clipboard"
          >
            <Clipboard className="h-4 w-4 mr-1" />
            Paste
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={sendCtrlAltDel}
            disabled={connectionStatus !== "connected"}
            aria-label="Send Ctrl+Alt+Del to VM"
          >
            <Power className="h-4 w-4 mr-1" />
            Ctrl+Alt+Del
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={handleReconnect}
            aria-label="Reconnect to console"
          >
            <RefreshCcw className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={toggleFullscreen}
            aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
          >
            {isFullscreen ? (
              <Minimize className="h-4 w-4" />
            ) : (
              <Maximize className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Console area */}
      <div className="flex-1 relative overflow-hidden">
        {/* noVNC canvas container */}
        <div
          ref={canvasRef}
          className="absolute inset-0"
          style={{
            display: connectionStatus === "connected" ? "block" : "none",
          }}
        />

        {/* Connecting overlay */}
        {connectionStatus === "connecting" && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80">
            <div className="text-center text-white">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
              <p>Establishing VNC connection...</p>
              <p className="text-xs text-white/50 mt-2">
                Connecting to {connection.node} / VM {connection.vmid}
              </p>
            </div>
          </div>
        )}

        {/* Disconnected overlay */}
        {connectionStatus === "disconnected" && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80">
            <div className="text-center text-white">
              <AlertCircle className="h-8 w-8 mx-auto mb-4 text-destructive" />
              <p className="mb-4">Connection closed</p>
              <Button onClick={handleReconnect} variant="secondary">
                <RefreshCcw className="h-4 w-4 mr-2" />
                Reconnect
              </Button>
            </div>
          </div>
        )}

        {/* Error overlay */}
        {connectionStatus === "error" && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80">
            <div className="text-center text-white">
              <AlertCircle className="h-8 w-8 mx-auto mb-4 text-destructive" />
              <p className="mb-4">Connection error</p>
              <Button onClick={handleReconnect} variant="secondary">
                <RefreshCcw className="h-4 w-4 mr-2" />
                Try again
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
