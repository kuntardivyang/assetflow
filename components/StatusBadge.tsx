import { cn } from "@/lib/utils";

// Shared status pill used across Assets, Allocation, Maintenance, Bookings, Audit.
// Maps every status value in the app to a consistent colour tone.
const TONE: Record<string, string> = {
  // asset
  AVAILABLE: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  ALLOCATED: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  RESERVED: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  UNDER_MAINTENANCE: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
  LOST: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  RETIRED: "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300",
  DISPOSED: "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300",
  // generic workflow
  ACTIVE: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  INACTIVE: "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300",
  RETURNED: "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300",
  REQUESTED: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  APPROVED: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  REJECTED: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  PENDING: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  TECHNICIAN_ASSIGNED: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  IN_PROGRESS: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300",
  RESOLVED: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  UPCOMING: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  ONGOING: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300",
  COMPLETED: "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300",
  CANCELLED: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  VERIFIED: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  MISSING: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  DAMAGED: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
  OPEN: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  CLOSED: "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
        TONE[status] ?? "bg-muted text-muted-foreground",
      )}
    >
      {status.replaceAll("_", " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase())}
    </span>
  );
}
