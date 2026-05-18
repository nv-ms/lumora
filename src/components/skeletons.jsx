export function SkeletonBlock({ className = "" }) {
  return <div className={`animate-pulse rounded-md bg-panel-2/80 ${className}`} />;
}

export function SidebarSourcesSkeleton() {
  return (
    <div className="space-y-2">
      <SkeletonBlock className="h-4 w-full" />
      <SkeletonBlock className="h-4 w-11/12" />
      <SkeletonBlock className="h-4 w-10/12" />
    </div>
  );
}

export function PosterGridSkeleton({ count = 12 }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-5">
      {Array.from({ length: count }, (_, idx) => (
        <div key={idx}>
          <SkeletonBlock className="aspect-[2/3] w-full" />
          <SkeletonBlock className="mt-2 h-4 w-4/5" />
          <SkeletonBlock className="mt-1 h-3 w-2/5" />
        </div>
      ))}
    </div>
  );
}

export function ListSkeleton({ rows = 6 }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }, (_, idx) => (
        <SkeletonBlock key={idx} className="h-12 w-full" />
      ))}
    </div>
  );
}
