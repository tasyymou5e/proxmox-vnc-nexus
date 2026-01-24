import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { VM } from "@/lib/types";

interface VMStatusBadgeProps {
  status: VM["status"];
  className?: string;
}

export function VMStatusBadge({ status, className }: VMStatusBadgeProps) {
  const getStatusConfig = (status: VM["status"]) => {
    switch (status) {
      case "running":
        return {
          label: "Running",
          className: "bg-success/10 text-success border-success/20 hover:bg-success/20",
        };
      case "stopped":
        return {
          label: "Stopped",
          className: "bg-destructive/10 text-destructive border-destructive/20 hover:bg-destructive/20",
        };
      case "paused":
        return {
          label: "Paused",
          className: "bg-warning/10 text-warning border-warning/20 hover:bg-warning/20",
        };
      case "suspended":
        return {
          label: "Suspended",
          className: "bg-warning/10 text-warning border-warning/20 hover:bg-warning/20",
        };
      default:
        return {
          label: "Unknown",
          className: "bg-muted text-muted-foreground border-muted-foreground/20",
        };
    }
  };

  const config = getStatusConfig(status);

  return (
    <Badge
      variant="outline"
      className={cn(config.className, className)}
    >
      <span className="relative flex h-2 w-2 mr-1.5">
        <span
          className={cn(
            "absolute inline-flex h-full w-full rounded-full opacity-75",
            status === "running" && "animate-ping bg-success"
          )}
        />
        <span
          className={cn(
            "relative inline-flex rounded-full h-2 w-2",
            status === "running" && "bg-success",
            status === "stopped" && "bg-destructive",
            status === "paused" && "bg-warning",
            status === "suspended" && "bg-warning",
            status === "unknown" && "bg-muted-foreground"
          )}
        />
      </span>
      {config.label}
    </Badge>
  );
}
