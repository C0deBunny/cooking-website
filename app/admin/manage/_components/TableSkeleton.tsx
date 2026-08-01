// import components
import { Skeleton } from "@/components/ui/skeleton";

/**
 * The Suspense fallback. Row heights approximate the real ones so the page doesn't jump when the
 * data arrives — the point of a skeleton is the absence of a reflow, not the shimmer.
 */
export default function TableSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-8 w-full sm:w-64" />
        <Skeleton className="ml-auto h-5 w-48" />
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="border-b border-border px-4 py-3">
          <Skeleton className="h-4 w-28" />
        </div>

        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="flex items-center gap-4 border-b border-border px-4 py-3 last:border-b-0">
            <Skeleton className="size-4 shrink-0 rounded" />
            <Skeleton className="h-4 w-56" />
            <Skeleton className="ml-auto h-5 w-20 rounded-full" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-7 w-32" />
          </div>
        ))}
      </div>
    </div>
  );
}
