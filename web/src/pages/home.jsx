import { Link } from "react-router-dom";
import { Play } from "lucide-react";
import { Poster } from "../components/poster";
import { PosterGridSkeleton, SkeletonBlock } from "../components/skeletons";
import { useCatalog } from "../lib/catalog-context";

export function HomePage() {
  const { continueWatching, recentlyAdded, series, loading, error } = useCatalog();
  const hero = continueWatching[0];
  const recentMovies = recentlyAdded.filter((item) => item.kind !== "episode").slice(0, 12);
  const yourShows = series.slice(0, 12);

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
        <section className="relative h-[330px] overflow-hidden">
          {hero.thumbnailUrl && <img src={hero.thumbnailUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />}
          <div className="absolute inset-0 bg-linear-to-r from-black via-black/80 to-transparent" />
          <div className="absolute inset-0 bg-linear-to-b from-transparent via-transparent to-black" />
          <div className="absolute bottom-9 left-8 w-[520px] max-w-[70%]">
            <div className="text-[10px] font-mono font-semibold uppercase text-muted-foreground">Continue watching</div>
            <h1 className="mt-2 line-clamp-2 text-4xl font-bold leading-tight">{displayTitle(hero)}</h1>
            <div className="mt-4 h-1 w-72 max-w-full overflow-hidden rounded-full bg-white/10">
              <div className="h-full bg-white" style={{ width: `${(hero.progress ?? 0) * 100}%` }} />
            </div>
            <Link to={`/watch/${hero.id}`} className="mt-5 inline-flex h-11 items-center gap-2 rounded-md bg-white px-5 text-sm font-medium text-black transition hover:bg-white/90 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white">
              <Play className="h-4 w-4 fill-current" />Resume
            </Link>
          </div>
        </section>
      )}

      <Shelf title="Continue watching" items={continueWatching} />
      <Shelf title="Recently added" items={recentMovies} />
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
            <Poster title={displayTitle(item)} hue={item.poster} thumbnailUrl={item.thumbnailUrl} />
            <div className="mt-2 truncate text-sm font-medium group-hover:text-foreground">{displayTitle(item)}</div>
          </Link>
        ))}
      </div>
    </section>
  );
}

function displayTitle(item) {
  if (item.kind !== "episode") return item.title;
  const match = item.title.match(/S(\d{1,2})E(\d{1,3})/i);
  const season = Number(match?.[1] || item.season || 0);
  const episode = Number(match?.[2] || item.number || 0);
  return `${item.seriesTitle || item.title} S${season} Episode ${episode}`;
}
