import { TableSkeleton, PageHeaderSkeleton } from "@/components/TableSkeleton";

export default function Loading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      <div className="h-9 w-72 animate-pulse rounded-lg bg-muted" />
      <TableSkeleton />
    </div>
  );
}
