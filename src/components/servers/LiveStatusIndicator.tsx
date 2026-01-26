import { Activity, WifiOff } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface LiveStatusIndicatorProps {
  tenantId?: string;
}

export function LiveStatusIndicator({ tenantId }: LiveStatusIndicatorProps) {
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!tenantId) return;

    const channel = supabase.channel(`presence-${tenantId}`);
    
    channel
      .subscribe((status) => {
        setIsConnected(status === "SUBSCRIBED");
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tenantId]);

  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      {isConnected ? (
        <>
          <Activity className="h-3 w-3 animate-pulse text-green-500" />
          <span>Live updates active</span>
        </>
      ) : (
        <>
          <WifiOff className="h-3 w-3 text-muted-foreground" />
          <span>Connecting...</span>
        </>
      )}
    </div>
  );
}
