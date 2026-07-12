import { PageHeaderSkeleton } from "@/components/TableSkeleton";

export default function Loading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          <div className="flex gap-2">
            <div className="h-9 w-72 animate-pulse rounded-md bg-muted" />
            <div className="h-9 w-40 animate-pulse rounded-md bg-muted" />
          </div>
          <div className="h-96 animate-pulse rounded-xl border border-border bg-card" />
        </div>
        <div className="space-y-4">
          <div className="h-64 animate-pulse rounded-xl border border-border bg-card" />
          <div className="h-40 animate-pulse rounded-xl border border-border bg-card" />
        </div>
      </div>
    </div>
  );
}
