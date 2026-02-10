import { useEffect, useState, useCallback } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/layout";
import { ConsoleViewer } from "@/components/console";
import { useVMConsole } from "@/hooks/useVMs";
import { Button } from "@/components/ui/button";
import type { VNCConnection } from "@/lib/types";
import { ArrowLeft } from "lucide-react";

export default function Console() {
  const { node, vmid } = useParams<{ node: string; vmid: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const vmType = (searchParams.get("type") as "qemu" | "lxc") || "qemu";
  const serverId = searchParams.get("serverId");

  const vmConsole = useVMConsole();
  const [connection, setConnection] = useState<VNCConnection | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchConsole = useCallback(async () => {
    if (!node || !vmid) return;

    const parsedVmid = parseInt(vmid, 10);
    if (isNaN(parsedVmid)) {
      setError("Invalid VM ID");
      return;
    }

    setError(null);
    try {
      const data = await vmConsole.mutateAsync({
        node,
        vmid: parsedVmid,
        vmType,
        serverId: serverId || undefined,
      });
      setConnection(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to connect");
    }
  }, [node, vmid, vmType, serverId, vmConsole]);

  useEffect(() => {
    fetchConsole();
  }, [fetchConsole]);

  return (
    <DashboardLayout>
      <div className="h-[calc(100vh-3.5rem)] lg:h-screen flex flex-col">
        {/* Header */}
        <div className="flex items-center gap-4 px-4 py-3 border-b bg-card">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/dashboard")}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="font-semibold">Console: VM {vmid}</h1>
            <p className="text-xs text-muted-foreground">
              Node: {node} • Type: {vmType.toUpperCase()}
            </p>
          </div>
        </div>

        {/* Console viewer */}
        <ConsoleViewer
          connection={connection}
          isLoading={vmConsole.isPending}
          error={error}
          onReconnect={fetchConsole}
        />
      </div>
    </DashboardLayout>
  );
}
