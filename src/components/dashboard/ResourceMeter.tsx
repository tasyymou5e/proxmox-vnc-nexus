import { cn } from "@/lib/utils";

interface ResourceMeterProps {
  value: number;
  max: number;
  label: string;
  unit?: string;
  className?: string;
}

export function ResourceMeter({ value, max, label, unit = "", className }: ResourceMeterProps) {
  const percentage = max > 0 ? (value / max) * 100 : 0;
  
  const getColorClass = (percent: number) => {
    if (percent >= 90) return "bg-destructive";
    if (percent >= 70) return "bg-warning";
    return "bg-primary";
  };

  const formatValue = (val: number) => {
    if (unit === "GB") {
      return (val / 1024 / 1024 / 1024).toFixed(1);
    }
    if (unit === "MB") {
      return (val / 1024 / 1024).toFixed(0);
    }
    if (unit === "%") {
      return (val * 100).toFixed(0);
    }
    return val.toFixed(1);
  };

  const formatMax = (val: number) => {
    if (unit === "GB") {
      return (val / 1024 / 1024 / 1024).toFixed(1);
    }
    if (unit === "MB") {
      return (val / 1024 / 1024).toFixed(0);
    }
    return val.toFixed(0);
  };

  return (
    <div className={cn("space-y-1", className)}>
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">
          {unit === "%" ? (
            `${formatValue(value)}%`
          ) : (
            `${formatValue(value)} / ${formatMax(max)} ${unit}`
          )}
        </span>
      </div>
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all", getColorClass(percentage))}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>
    </div>
  );
}
