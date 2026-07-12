import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

// Reusable KPI tile for the Dashboard (Screen 2) and Reports (Screen 9).
export function KpiCard({
  label,
  value,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  tone?: "default" | "warning" | "danger" | "success";
}) {
  const toneClass = {
    default: "text-primary bg-accent",
    warning: "text-warning bg-amber-50 dark:bg-amber-900/30",
    danger: "text-danger bg-red-50 dark:bg-red-900/30",
    success: "text-success bg-green-50 dark:bg-green-900/30",
  }[tone];

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="mt-1 text-3xl font-semibold tracking-tight">{value}</p>
        </div>
        {Icon && (
          <div className={cn("flex h-11 w-11 items-center justify-center rounded-[var(--radius)]", toneClass)}>
            <Icon className="h-5 w-5" />
          </div>
        )}
      </div>
    </Card>
  );
}
