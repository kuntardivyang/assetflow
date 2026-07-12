import { PageHeaderSkeleton } from "@/components/TableSkeleton";

export default function Loading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      <div className="h-40 animate-pulse rounded-xl border border-border bg-card" />
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="h-56 animate-pulse rounded-xl border border-border bg-card" />
        <div className="h-56 animate-pulse rounded-xl border border-border bg-card" />
      </div>
    </div>
  );
}
