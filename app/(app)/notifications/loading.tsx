import { PageHeaderSkeleton } from "@/components/TableSkeleton";

export default function Loading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="h-80 animate-pulse rounded-xl border border-border bg-card lg:col-span-2" />
        <div className="h-64 animate-pulse rounded-xl border border-border bg-card" />
      </div>
    </div>
  );
}
