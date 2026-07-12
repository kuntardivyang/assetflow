import { TableSkeleton, PageHeaderSkeleton } from "@/components/TableSkeleton";

export default function Loading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      <div className="flex gap-2">
        <div className="h-9 flex-1 animate-pulse rounded-md bg-muted" />
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-9 w-40 animate-pulse rounded-md bg-muted" />
        ))}
      </div>
      <TableSkeleton rows={8} />
    </div>
  );
}
