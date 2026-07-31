import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Check, Play } from "lucide-react";
import { Poster } from "../components/poster";
import { ListSkeleton, SkeletonBlock } from "../components/skeletons";
import { cn } from "../lib/utils";
import { useCatalog } from "../lib/catalog-context";

export function SeriesDetailPage() {
  const { id } = useParams();
  const { series, loading } = useCatalog();
  const show = useMemo(() => series.find((entry) => entry.id === id), [series, id]);
  const [season, setSeason] = useState(1);
  const continuation = useMemo(() => {
    if (!show) return null;
    const episodes = show.seasons.toSorted((a, b) => a.number - b.number).flatMap((entry) => entry.episodes.toSorted((a, b) => a.number - b.number).map((episode) => ({ episode, season: entry.number })));
    const latest = episodes.filter((entry) => entry.episode.lastWatchedAt).toSorted((a, b) => b.episode.lastWatchedAt.localeCompare(a.episode.lastWatchedAt))[0];
    if (!latest) return episodes[0] || null;
    const latestIndex = episodes.findIndex((entry) => entry.episode.id === latest.episode.id);
    return (latest.episode.progress ?? 0) >= 0.999 ? episodes[latestIndex + 1] || null : latest;
  }, [show]);

  useEffect(() => {
    if (continuation) setSeason(continuation.season);
  }, [show?.id, continuation]);

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
    <div className="h-full overflow-hidden">
      <section className="grid h-full grid-cols-12 gap-10 px-8 py-10">
        <div className="col-span-12 md:col-span-3 md:overflow-hidden">
          <Poster title={show.title} hue={show.poster} thumbnailUrl={show.thumbnailUrl} />
          <div className="mt-4 text-xs text-muted-foreground font-mono break-all">{show.path}</div>
        </div>

        <div className="col-span-12 flex min-h-0 flex-col md:col-span-9">
          <h1 className="mt-2 text-4xl font-semibold">{show.title}</h1>
          {continuation && (
            <Link to={`/watch/${continuation.episode.id}`} className="mt-5 inline-flex h-11 w-fit items-center gap-2 rounded-md bg-foreground px-5 text-sm font-medium text-background">
              <Play className="h-4 w-4 fill-current" />Continue playing
            </Link>
          )}

          <div className="mt-7 flex shrink-0 gap-1 border-b border-hairline">
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

          <div data-dpad-scroll className="mt-2 min-h-0 flex-1 divide-y divide-hairline overflow-y-auto pr-2">
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
