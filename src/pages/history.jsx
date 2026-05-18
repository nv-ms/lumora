import { Link } from "react-router-dom";
import { Poster } from "../components/poster";
import { ListSkeleton, SkeletonBlock } from "../components/skeletons";
import { useCatalog } from "../lib/catalog-context";

export function HistoryPage() {
  const { history, loading } = useCatalog();

  if (loading) {
    return (
      <div className="px-8 py-10">
        <SkeletonBlock className="h-8 w-40" />
        <SkeletonBlock className="mt-2 h-4 w-56" />
        <div className="mt-10">
          <ListSkeleton rows={8} />
        </div>
      </div>
    );
  }

  return (
    <div className="px-8 py-10">
      <h1 className="text-2xl font-semibold">History</h1>
      <p className="text-sm text-muted-foreground mt-1">Recently watched</p>
      <div className="mt-10 divide-y divide-hairline">
        {history.map((item) => (
          <Link key={item.id} to={`/watch/${item.id}`} className="flex items-center gap-5 py-4 group">
            <div className="w-24 shrink-0"><Poster title={item.title} hue={item.poster} thumbnailUrl={item.thumbnailUrl} aspect="video" size="sm" /></div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate group-hover:text-foreground">{item.title}</div>
              <div className="text-xs text-muted-foreground font-mono">{new Date(item.lastWatchedAt).toLocaleString()}</div>
            </div>
          </Link>
        ))}
        {!history.length && <div className="text-sm text-muted-foreground py-4">No watch history yet.</div>}
      </div>
    </div>
  );
}

