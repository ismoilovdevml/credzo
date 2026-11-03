import { Skeleton } from "@/components/ui";

/** Placeholder rows shaped like `AuditEventList`. */
export function AuditRowsSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div role="status" aria-label="Loading audit events">
      <div className="border-b border-line-soft bg-surface-2 px-5 py-2.5">
        <Skeleton className="h-4 w-20" />
      </div>
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line-soft px-4 py-4 sm:px-5">
          <Skeleton className="h-4 w-[84px]" />
          <Skeleton className="h-6 w-[88px] rounded-full" />
          <div className="flex min-w-0 flex-[1_1_300px] items-center gap-2.5">
            <Skeleton className="h-6 w-6 flex-none rounded-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
          <Skeleton className="h-4 w-[110px]" />
        </div>
      ))}
    </div>
  );
}

/** Full-page placeholder used while the session or the URL query is not ready yet. */
export function AuditLogSkeleton() {
  return (
    <div className="flex flex-col gap-[22px]">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-3 rounded-2xl border border-line bg-surface p-4">
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} className="flex flex-col gap-2">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-9 w-full rounded-lg" />
          </div>
        ))}
      </div>
      <div className="overflow-hidden rounded-2xl border border-line bg-surface">
        <AuditRowsSkeleton />
      </div>
    </div>
  );
}
