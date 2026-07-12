import { PageHeaderSkeleton } from "@/components/TableSkeleton";

export default function Loading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      <div className="flex gap-4 overflow-x-auto pb-4">
        {Array.from({ length: 5 }).map((_, col) => (
          <div key={col} className="w-72 shrink-0 space-y-3">
            <div className="h-5 w-32 animate-pulse rounded bg-muted" />
            <div className="h-28 animate-pulse rounded-lg border border-border bg-card" />
            <div className="h-28 animate-pulse rounded-lg border border-border bg-card" />
          </div>
        ))}
      </div>
    </div>
  );
}
