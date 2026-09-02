// Neutral loading placeholders. Used both by the route-level loading.tsx and
// inline where a page is waiting on its client-side data fetch (the entity
// stores hydrate on the client, so a server loading.tsx alone doesn't cover
// that gap).

export function SkeletonLine({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-black/[.06] dark:bg-white/[.08] ${className}`} />;
}

export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-2" aria-hidden>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 rounded-lg bg-black/[.02] px-4 py-3 dark:bg-white/[.04]"
        >
          <SkeletonLine className="h-4 w-4 shrink-0 rounded-full" />
          <SkeletonLine className="h-4 flex-1" />
        </div>
      ))}
    </div>
  );
}
