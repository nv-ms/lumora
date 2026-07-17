import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Check } from "lucide-react";
import { Poster } from "../components/poster";
import { ListSkeleton, SkeletonBlock } from "../components/skeletons";
import { cn } from "../lib/utils";
import { useCatalog } from "../lib/catalog-context";

export function SeriesDetailPage() {
  const { id } = useParams();
  const { series, loading } = useCatalog();
  const show = useMemo(() => series.find((entry) => entry.id === id), [series, id]);
  const [season, setSeason] = useState(1);

  if (loading) {
    return (
      <div className="px-8 py-10">
        <SkeletonBlock className="h-8 w-56" />
        <SkeletonBlock className="mt-3 h-4 w-80" />
        <div className="mt-10">
          <ListSkeleton rows={8} />
        </div>
      </div>
    );
  }
  if (!show) return <div className="p-12 text-sm text-muted-foreground">Series not found.</div>;

  const firstSeason = show.seasons[0]?.number ?? 1;
  const selectedSeason = show.seasons.find((entry) => entry.number === season) ?? show.seasons.find((entry) => entry.number === firstSeason);

  return (
    <div className="pb-16">
      <section className="px-8 pt-10 grid grid-cols-12 gap-10">
        <div className="col-span-12 md:col-span-3">
          <Poster title={show.title} hue={show.poster} thumbnailUrl={show.thumbnailUrl} />
          <div className="mt-4 text-xs text-muted-foreground font-mono break-all">{show.path}</div>
        </div>

        <div className="col-span-12 md:col-span-9">
          <h1 className="mt-2 text-4xl font-semibold">{show.title}</h1>

          <div className="mt-10 flex gap-1 border-b border-hairline">
            {show.seasons.map((entry) => (
              <button
                key={entry.number}
                onClick={() => setSeason(entry.number)}
                className={cn(
                  "px-4 py-2.5 text-sm font-medium -mb-px border-b-2 transition-colors",
                  selectedSeason?.number === entry.number ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                Season {entry.number}
              </button>
            ))}
          </div>

          <div className="mt-2 divide-y divide-hairline">
            {selectedSeason?.episodes.map((episode) => (
              <Link key={episode.id} to={`/watch/${episode.id}`} className="flex items-center gap-5 py-4 group">
                <span className="w-6 text-right font-mono text-xs text-muted-foreground">{String(episode.number || 0).padStart(2, "0")}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate group-hover:text-foreground">{episode.title}</div>
                  <div className="text-xs text-muted-foreground truncate">{episode.extension}</div>
                </div>
                {typeof episode.progress === "number" ? (
                  <div className="w-20"><div className="h-0.5 bg-panel rounded-full overflow-hidden"><div className="h-full bg-accent" style={{ width: `${episode.progress * 100}%` }} /></div></div>
                ) : (
                  <Check className="h-3 w-3 text-muted-foreground" />
                )}
                <span className="inline-flex items-center h-8 px-3 bg-foreground text-background rounded-md text-xs font-medium">Play</span>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
