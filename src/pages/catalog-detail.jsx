import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Play,
  Clapperboard,
  Folder,
  Film,
  Captions,
  CalendarRange,
  CheckCircle2,
  CircleSlash,
} from "lucide-react";
import { useCatalog } from "../lib/catalog-context";
import { Poster } from "../components/poster";

export function CatalogDetailPage() {
  const { type, id } = useParams();
  const { movies, series } = useCatalog();
  const item = type === "movie" ? movies.find((m) => m.id === id) : series.find((s) => s.id === id);

  if (!item) return <div className="p-8 text-sm text-muted-foreground">Catalog item not found.</div>;

  const episodes = type === "series" ? (item.seasons || []).reduce((acc, season) => acc + (season.episodes?.length || 0), 0) : 0;
  const seasons = type === "series" ? (item.seasons || []).length : 0;
  const subtitles = Array.isArray(item.subtitles) ? item.subtitles.length : 0;
  const statusLabel = item.available === false ? "Unavailable" : "Available";

  return (
    <div className="mx-auto w-full max-w-6xl px-8 py-8">
      <div className="mb-6 flex items-center justify-between gap-4">
        <Link
          to="/catalog"
          className="inline-flex items-center gap-2 rounded-md border border-hairline bg-panel px-3 py-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
        <div className="inline-flex items-center gap-2 rounded-md bg-panel px-3 py-2 text-xs text-muted-foreground">
          <Clapperboard className="h-3.5 w-3.5" /> {type.toUpperCase()}
        </div>
      </div>

      {type === "movie" ? (
        <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
          <div className="space-y-4">
            <Poster
              title={item.title}
              hue={item.poster || "220"}
              thumbnailUrl={item.thumbnailUrl}
              aspect="poster"
              className="rounded-xl"
              size="sm"
            />
            <Link
              to={`/watch/${item.id}`}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-foreground text-sm text-background"
            >
              <Play className="h-4 w-4" /> Play
            </Link>
          </div>

          <div className="space-y-5">
            <div className="rounded-xl border border-hairline bg-panel p-5">
              <h1 className="text-2xl font-semibold leading-tight">{item.title}</h1>
              <div className="mt-3 inline-flex items-center gap-2 rounded-md bg-background px-3 py-1 text-xs text-muted-foreground">
                {item.available === false ? <CircleSlash className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                {statusLabel}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-hairline bg-panel p-4">
                <div className="mb-2 inline-flex items-center gap-2 text-xs text-muted-foreground">
                  <Folder className="h-3.5 w-3.5" /> Path
                </div>
                <div className="break-all text-sm">{item.path || item.sourceFolder || "-"}</div>
              </div>
              <div className="rounded-lg border border-hairline bg-panel p-4">
                <div className="mb-2 inline-flex items-center gap-2 text-xs text-muted-foreground">
                  <Film className="h-3.5 w-3.5" /> Trailer
                </div>
                <div className="break-all text-sm">{item.trailerPath || "No trailer"}</div>
              </div>
              <div className="rounded-lg border border-hairline bg-panel p-4">
                <div className="mb-2 inline-flex items-center gap-2 text-xs text-muted-foreground">
                  <Captions className="h-3.5 w-3.5" /> Subtitles
                </div>
                <div className="text-sm">{subtitles}</div>
              </div>
              <div className="rounded-lg border border-hairline bg-panel p-4">
                <div className="mb-2 inline-flex items-center gap-2 text-xs text-muted-foreground">
                  <CalendarRange className="h-3.5 w-3.5" /> Structure
                </div>
                <div className="text-sm">Single title</div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
            <Poster
              title={item.title}
              hue={item.poster || "220"}
              thumbnailUrl={item.thumbnailUrl}
              aspect="poster"
              className="rounded-xl"
              size="sm"
            />

            <div className="space-y-5">
              <div className="rounded-xl border border-hairline bg-panel p-5">
                <h1 className="text-3xl font-semibold leading-tight">{item.title}</h1>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-2 rounded-md bg-background px-3 py-1 text-xs text-muted-foreground">
                    {item.available === false ? <CircleSlash className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                    {statusLabel}
                  </span>
                  <span className="inline-flex items-center gap-2 rounded-md bg-background px-3 py-1 text-xs text-muted-foreground">
                    <CalendarRange className="h-3.5 w-3.5" />
                    {seasons} seasons | {episodes} episodes
                  </span>
                  <span className="inline-flex items-center gap-2 rounded-md bg-background px-3 py-1 text-xs text-muted-foreground">
                    <Captions className="h-3.5 w-3.5" />
                    {subtitles} subtitles
                  </span>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-hairline bg-panel p-4">
                  <div className="mb-2 inline-flex items-center gap-2 text-xs text-muted-foreground">
                    <Folder className="h-3.5 w-3.5" /> Root folder
                  </div>
                  <div className="break-all text-sm">{item.sourceFolder || "-"}</div>
                </div>
                <div className="rounded-lg border border-hairline bg-panel p-4">
                  <div className="mb-2 inline-flex items-center gap-2 text-xs text-muted-foreground">
                    <Film className="h-3.5 w-3.5" /> Trailer
                  </div>
                  <div className="break-all text-sm">{item.trailerPath || "No trailer"}</div>
                </div>
              </div>
            </div>
          </div>

          <section className="rounded-xl border border-hairline bg-panel">
            <div className="flex items-center justify-between border-b border-hairline px-5 py-4">
              <h2 className="text-sm font-semibold">Seasons and Episodes</h2>
              <span className="text-xs text-muted-foreground">{seasons} seasons</span>
            </div>
            <div className="space-y-4 p-5">
              {(item.seasons || []).length === 0 ? (
                <div className="text-sm text-muted-foreground">No seasons cataloged yet.</div>
              ) : (
                (item.seasons || []).map((season) => (
                  <div key={season.seasonNumber} className="rounded-lg border border-hairline bg-background/40 p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <h3 className="text-sm font-semibold">Season {season.seasonNumber}</h3>
                      <span className="text-xs text-muted-foreground">{season.episodes?.length || 0} episodes</span>
                    </div>
                    {!season.episodes?.length ? (
                      <div className="text-sm text-muted-foreground">No episodes found in this season.</div>
                    ) : (
                      <div className="max-h-64 overflow-auto rounded-md border border-hairline">
                        <table className="w-full text-sm">
                          <thead className="sticky top-0 bg-panel">
                            <tr className="text-left text-xs text-muted-foreground">
                              <th className="px-3 py-2 font-medium">#</th>
                              <th className="px-3 py-2 font-medium">Episode</th>
                              <th className="px-3 py-2 font-medium">File</th>
                            </tr>
                          </thead>
                          <tbody>
                            {season.episodes.map((ep, idx) => (
                              <tr key={ep.id || `${season.seasonNumber}-${idx}`} className="border-t border-hairline">
                                <td className="px-3 py-2 text-muted-foreground">{ep.episodeNumber || idx + 1}</td>
                                <td className="px-3 py-2">{ep.title || `Episode ${idx + 1}`}</td>
                                <td className="px-3 py-2 text-xs text-muted-foreground">{ep.path || ep.filePath || "-"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
