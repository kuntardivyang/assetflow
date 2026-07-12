// Shared loading placeholder — table-ish shimmer that roughly matches the
// real layout so the swap isn't jarring.
export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="h-4 w-64 animate-pulse rounded bg-muted" />
        <div className="h-9 w-36 animate-pulse rounded-md bg-muted" />
      </div>
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <div className="h-10 border-b border-border bg-muted/50" />
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-6 border-b border-border/60 px-4 py-3 last:border-0">
            <div className="h-4 w-20 animate-pulse rounded bg-muted" />
            <div className="h-4 w-40 animate-pulse rounded bg-muted" />
            <div className="h-4 w-24 animate-pulse rounded bg-muted" />
            <div className="ml-auto h-5 w-16 animate-pulse rounded-full bg-muted" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function PageHeaderSkeleton() {
  return (
    <div className="space-y-2">
      <div className="h-7 w-56 animate-pulse rounded bg-muted" />
      <div className="h-4 w-80 animate-pulse rounded bg-muted" />
    </div>
  );
}
