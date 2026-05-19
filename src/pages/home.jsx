import { Link } from "react-router-dom";
import { Play } from "lucide-react";
import { Poster } from "../components/poster";
import { PosterGridSkeleton, SkeletonBlock } from "../components/skeletons";
import { useCatalog } from "../lib/catalog-context";

export function HomePage() {
  const { continueWatching, recentlyAdded, series, loading, error } = useCatalog();
  const hero = continueWatching[0];
  const recent = recentlyAdded.slice(0, 6);
  const yourShows = series.slice(0, 6);

  if (loading) {
    return (
      <div className="px-8 py-10">
        <SkeletonBlock className="h-8 w-64" />
        <SkeletonBlock className="mt-3 h-4 w-80" />
        <div className="mt-10">
          <PosterGridSkeleton count={12} />
        </div>
      </div>
    );
  }
  if (error) return <div className="p-8 text-sm text-red-400">{error}</div>;

  return (
    <div className="pb-16">
      {hero && (
        <section className="px-8 pt-10">
          <div className="flex gap-8 items-end">
            <div className="w-48 shrink-0"><Poster title={hero.title} hue={hero.poster} thumbnailUrl={hero.thumbnailUrl} /></div>
            <div className="flex-1 min-w-0 pb-2">
              <div className="text-[10px] font-mono uppercase text-muted-foreground">
                Resume {hero.kind === "episode" ? `- S${hero.season}-E${hero.number}` : "- Movie"}
              </div>
              <h1 className="mt-2 text-4xl font-semibold">{hero.title}</h1>
              <div className="mt-6 flex items-center gap-4">
                <Link to={`/watch/${hero.id}`} className="inline-flex items-center gap-2 h-10 px-5 bg-foreground text-background rounded-md text-sm font-medium hover:opacity-90 transition">
                  <Play className="h-4 w-4 fill-current" />Continue
                </Link>
                <div className="h-1 w-64 bg-panel rounded-full overflow-hidden"><div className="h-full bg-accent" style={{ width: `${(hero.progress ?? 0) * 100}%` }} /></div>
              </div>
            </div>
          </div>
        </section>
      )}

      <Shelf title="Continue watching" items={continueWatching} />
      <Shelf title="Recently added" items={recent} />
      <Shelf title="Your shows" items={yourShows} />
    </div>
  );
}

function Shelf({ title, items }) {
  if (!items.length) return null;
  return (
    <section className="px-8 mt-14">
      <div className="flex items-baseline justify-between mb-5">
        <h2 className="text-lg font-medium">{title}</h2>
        <span className="text-[10px] font-mono uppercase text-muted-foreground">{items.length} items</span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-5">
        {items.map((item) => (
          <Link key={item.id} to={item.kind === "series" ? `/series/${item.id}` : `/watch/${item.id}`} className="group">
            <Poster title={item.title} hue={item.poster} thumbnailUrl={item.thumbnailUrl} />
            <div className="mt-2 text-sm font-medium truncate group-hover:text-foreground">{item.title}</div>
          </Link>
        ))}
      </div>
    </section>
  );
}