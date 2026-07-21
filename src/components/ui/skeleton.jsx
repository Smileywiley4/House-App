import { cn } from "@/lib/utils"

function Skeleton({
  className,
  ...props
}) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-slate-200/80", className)}
      {...props}
    />
  );
}

/** Property / browse list card placeholder */
function PropertyCardSkeleton({ className }) {
  return (
    <div
      className={cn("flex gap-3 p-4 border-b border-slate-100", className)}
      aria-hidden
    >
      <Skeleton className="h-20 w-24 shrink-0 rounded-xl" />
      <div className="flex-1 space-y-2 min-w-0 pt-0.5">
        <Skeleton className="h-4 w-3/4 max-w-[240px]" />
        <Skeleton className="h-3 w-1/2 max-w-[160px]" />
        <Skeleton className="h-3 w-1/3 max-w-[100px]" />
      </div>
    </div>
  );
}

/** Saved score / compare row placeholder */
function ScoreCardSkeleton({ className }) {
  return (
    <div
      className={cn(
        "bg-white rounded-2xl border border-slate-100 p-6 flex items-center gap-4",
        className,
      )}
      aria-hidden
    >
      <Skeleton className="h-12 w-12 rounded-xl shrink-0" />
      <div className="flex-1 space-y-2 min-w-0">
        <Skeleton className="h-4 w-2/3 max-w-[280px]" />
        <Skeleton className="h-3 w-1/3 max-w-[120px]" />
      </div>
      <Skeleton className="h-8 w-14 rounded-lg shrink-0" />
    </div>
  );
}

/** Generic stacked list rows */
function ListSkeleton({ rows = 4, className }) {
  return (
    <div className={cn("space-y-3", className)} aria-hidden>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white p-4"
        >
          <Skeleton className="h-10 w-10 rounded-xl shrink-0" />
          <div className="flex-1 space-y-2 min-w-0">
            <Skeleton className="h-3.5 w-1/2 max-w-[200px]" />
            <Skeleton className="h-3 w-1/3 max-w-[140px]" />
          </div>
        </div>
      ))}
    </div>
  );
}

function BrowseListSkeleton({ rows = 5, className }) {
  return (
    <div className={cn("divide-y divide-slate-100", className)} role="status" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <PropertyCardSkeleton key={i} />
      ))}
    </div>
  );
}

export {
  Skeleton,
  PropertyCardSkeleton,
  ScoreCardSkeleton,
  ListSkeleton,
  BrowseListSkeleton,
}
