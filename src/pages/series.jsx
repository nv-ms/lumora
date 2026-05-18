import { Link } from "react-router-dom";
import { Poster } from "../components/poster";
import { PosterGridSkeleton, SkeletonBlock } from "../components/skeletons";
import { useCatalog } from "../lib/catalog-context";

export function SeriesPage() {
  const { series, loading, error } = useCatalog();
  if (loading) {
    return (
      <div className="px-8 py-10">
        <SkeletonBlock className="h-8 w-40" />
        <SkeletonBlock className="mt-2 h-4 w-56" />
        <div className="mt-8">
          <PosterGridSkeleton count={12} />
        </div>
      </div>
    );
  }
  if (error) return <div className="p-8 text-sm text-red-400">{error}</div>;

  return (
    <div className="px-8 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Series</h1>
      <p className="text-sm text-muted-foreground mt-1">{series.length} cataloged</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-5 mt-8">
        {series.map((show) => (
          <Link key={show.id} to={`/series/${show.id}`} className="group">
            <Poster title={show.title} hue={show.poster} />
            <div className="mt-2 text-sm font-medium truncate">{show.title}</div>
            <div className="text-xs text-muted-foreground font-mono">{show.seasons.length} season(s)</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
