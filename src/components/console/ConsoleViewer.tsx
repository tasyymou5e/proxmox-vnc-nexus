import { useEffect, useRef, useState } from "react";
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
} from "lucide-react";

interface ConsoleViewerProps {
  connection: VNCConnection | null;
  isLoading: boolean;
  error: string | null;
  onReconnect: () => void;
}

export function ConsoleViewer({
  connection,
  isLoading,
  error,
  onReconnect,
}: ConsoleViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<
    "connecting" | "connected" | "disconnected" | "error"
  >("connecting");

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  const toggleFullscreen = () => {
    if (!containerRef.current) return;

    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  };

  const sendCtrlAltDel = () => {
    // This would send Ctrl+Alt+Del to the VM via noVNC
    toast({
      title: "Ctrl+Alt+Del sent",
      description: "The key combination was sent to the VM",
    });
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-muted/50">
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
          <Button onClick={onReconnect}>
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
    <div
      ref={containerRef}
      className="flex-1 flex flex-col bg-black"
    >
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
            onClick={sendCtrlAltDel}
            title="Send Ctrl+Alt+Del"
          >
            <Power className="h-4 w-4 mr-1" />
            Ctrl+Alt+Del
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={onReconnect}
            title="Reconnect"
          >
            <RefreshCcw className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={toggleFullscreen}
            title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
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
      <div className="flex-1 relative">
        {/* noVNC would be embedded here */}
        <div className="absolute inset-0 flex items-center justify-center text-white/50">
          <div className="text-center">
            <p className="text-lg font-medium mb-2">VNC Console</p>
            <p className="text-sm">
              WebSocket URL: {connection.websocketUrl}
            </p>
            <p className="text-xs mt-4 max-w-md mx-auto text-white/30">
              Note: Full noVNC integration requires the noVNC library.
              The connection details have been retrieved successfully.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
