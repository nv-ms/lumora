import { useEffect, useMemo, useState } from "react";
import { Plus, Tv, Film } from "lucide-react";
import { useCatalog } from "../lib/catalog-context";

function Modal({ open, title, onClose, children }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65" onClick={onClose}>
      <div className="w-full max-w-2xl bg-panel border border-hairline rounded-xl p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button onClick={onClose} className="h-9 px-3 rounded-md bg-panel-2 text-sm">Close</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function CatalogPage() {
  const { refresh, series, movies } = useCatalog();
  const [files, setFiles] = useState([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const [showMovieModal, setShowMovieModal] = useState(false);
  const [showSeriesModal, setShowSeriesModal] = useState(false);
  const [showEpisodeModal, setShowEpisodeModal] = useState(false);
  const [editMovieModal, setEditMovieModal] = useState(false);
  const [editSeriesModal, setEditSeriesModal] = useState(false);
  const [editingMovie, setEditingMovie] = useState(null);
  const [editingSeries, setEditingSeries] = useState(null);

  const [movieTitle, setMovieTitle] = useState("");
  const [movieFilePath, setMovieFilePath] = useState("");
  const [movieSubtitlePaths, setMovieSubtitlePaths] = useState([]);
  const [movieThumbnailPath, setMovieThumbnailPath] = useState("");
  const [movieTrailerPath, setMovieTrailerPath] = useState("");
  const [seriesTitle, setSeriesTitle] = useState("");
  const [seriesFolder, setSeriesFolder] = useState("");
  const [seriesAutoCatalog, setSeriesAutoCatalog] = useState(true);
  const [seriesPreview, setSeriesPreview] = useState([]);
  const [seriesId, setSeriesId] = useState("");
  const [seasonNumber, setSeasonNumber] = useState(1);
  const [episodeNumber, setEpisodeNumber] = useState(1);
  const [episodeTitle, setEpisodeTitle] = useState("");
  const [episodeFilePath, setEpisodeFilePath] = useState("");
  const [episodeSubtitlePaths, setEpisodeSubtitlePaths] = useState([]);
  const [episodeThumbnailPath, setEpisodeThumbnailPath] = useState("");
  const [episodeTrailerPath, setEpisodeTrailerPath] = useState("");

  const seriesOptions = useMemo(() => series.map((entry) => ({ id: entry.id, title: entry.title })), [series]);

  const loadFiles = async () => {
    const response = await fetch("/api/files?mode=all");
    const payload = await response.json();
    setFiles(Array.isArray(payload.files) ? payload.files : []);
  };

  useEffect(() => {
    loadFiles();
  }, []);

  const run = async (fn, done) => {
    setBusy(true);
    setMessage("");
    try {
      await fn();
      await refresh();
      await loadFiles();
      if (done) done();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="px-8 py-8 max-w-6xl">
      <h1 className="text-2xl font-semibold">Catalog</h1>
      <p className="text-sm text-muted-foreground mt-1">Movies and Series catalog management.</p>

      <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-3">
        <button onClick={() => setShowMovieModal(true)} className="h-12 rounded-lg bg-panel hover:bg-panel-2 text-sm inline-flex items-center justify-center gap-2"><Film className="h-4 w-4" /> Add Movie</button>
        <button onClick={() => setShowSeriesModal(true)} className="h-12 rounded-lg bg-panel hover:bg-panel-2 text-sm inline-flex items-center justify-center gap-2"><Tv className="h-4 w-4" /> Add Series</button>
        <button onClick={() => setShowEpisodeModal(true)} className="h-12 rounded-lg bg-panel hover:bg-panel-2 text-sm inline-flex items-center justify-center gap-2"><Tv className="h-4 w-4" /> Add Episode</button>
      </div>

      <div className="mt-8">
        <h2 className="text-sm font-medium mb-3">Movies</h2>
        <div className="overflow-x-auto rounded-md border border-hairline">
          <table className="w-full text-sm">
            <thead className="bg-panel">
              <tr>
                <th className="text-left p-3">Title</th>
                <th className="text-left p-3">File</th>
                <th className="text-left p-3">Available</th>
                <th className="text-right p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {movies.map((movie) => (
                <tr key={movie.id} className="border-t border-hairline">
                  <td className="p-3">{movie.title}</td>
                  <td className="p-3 text-xs text-muted-foreground break-all">{movie.path}</td>
                  <td className="p-3">{movie.available === false ? "No" : "Yes"}</td>
                  <td className="p-3 text-right space-x-2">
                    <button onClick={() => { setEditingMovie(movie); setEditMovieModal(true); }} className="h-8 px-3 rounded bg-panel-2">Edit</button>
                    <button onClick={() => run(async () => { await fetch(`/api/library/movie/${movie.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ available: movie.available === false }) }); setMessage("Movie updated."); })} className="h-8 px-3 rounded bg-panel-2">{movie.available === false ? "Enable" : "Disable"}</button>
                    <button onClick={() => run(async () => { await fetch(`/api/library/movie/${movie.id}`, { method: "DELETE" }); setMessage("Movie deleted."); })} className="h-8 px-3 rounded bg-red-900/40">Delete</button>
                  </td>
                </tr>
              ))}
              {!movies.length && <tr><td colSpan={4} className="p-3 text-muted-foreground">No movies cataloged.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-8">
        <h2 className="text-sm font-medium mb-3">Series</h2>
        <div className="overflow-x-auto rounded-md border border-hairline">
          <table className="w-full text-sm">
            <thead className="bg-panel">
              <tr>
                <th className="text-left p-3">Title</th>
                <th className="text-left p-3">Episodes</th>
                <th className="text-left p-3">Available</th>
                <th className="text-right p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {series.map((show) => {
                const episodeCount = show.seasons.reduce((acc, season) => acc + season.episodes.length, 0);
                return (
                  <tr key={show.id} className="border-t border-hairline">
                    <td className="p-3">{show.title}</td>
                    <td className="p-3">{episodeCount}</td>
                    <td className="p-3">{show.available === false ? "No" : "Yes"}</td>
                    <td className="p-3 text-right space-x-2">
                      <button onClick={() => { setEditingSeries(show); setEditSeriesModal(true); }} className="h-8 px-3 rounded bg-panel-2">Edit</button>
                      <button onClick={() => run(async () => { await fetch(`/api/library/series/${show.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ available: show.available === false }) }); setMessage("Series updated."); })} className="h-8 px-3 rounded bg-panel-2">{show.available === false ? "Enable" : "Disable"}</button>
                      <button onClick={() => run(async () => { await fetch(`/api/library/series/${show.id}`, { method: "DELETE" }); setMessage("Series deleted."); })} className="h-8 px-3 rounded bg-red-900/40">Delete</button>
                    </td>
                  </tr>
                );
              })}
              {!series.length && <tr><td colSpan={4} className="p-3 text-muted-foreground">No series cataloged.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {!!message && <div className="mt-5 text-sm text-emerald-400">{message}</div>}
      {busy && <div className="mt-2 text-xs text-muted-foreground">Working...</div>}

      <Modal open={showMovieModal} title="Add Movie" onClose={() => setShowMovieModal(false)}>
        <div className="space-y-3">
          <input value={movieTitle} onChange={(e) => setMovieTitle(e.target.value)} placeholder="Movie title" className="h-11 w-full px-3 rounded-md bg-background border border-hairline" />
          <select value={movieFilePath} onChange={(e) => setMovieFilePath(e.target.value)} className="h-11 w-full px-3 rounded-md bg-background border border-hairline">
            <option value="">Select file...</option>
            {files.map((file) => <option key={file.path} value={file.path}>{file.path}</option>)}
          </select>
          <select multiple value={movieSubtitlePaths} onChange={(e) => setMovieSubtitlePaths(Array.from(e.target.selectedOptions).map((o) => o.value))} className="h-28 w-full px-3 rounded-md bg-background border border-hairline">
            {files.filter((f) => [".srt", ".vtt"].includes(f.ext)).map((file) => <option key={file.path} value={file.path}>{file.path}</option>)}
          </select>
          <select value={movieThumbnailPath} onChange={(e) => setMovieThumbnailPath(e.target.value)} className="h-11 w-full px-3 rounded-md bg-background border border-hairline">
            <option value="">Thumbnail (optional)</option>
            {files.filter((f) => [".jpg", ".jpeg", ".png", ".webp"].includes(f.ext)).map((file) => <option key={file.path} value={file.path}>{file.path}</option>)}
          </select>
          <select value={movieTrailerPath} onChange={(e) => setMovieTrailerPath(e.target.value)} className="h-11 w-full px-3 rounded-md bg-background border border-hairline">
            <option value="">Trailer (optional)</option>
            {files.filter((f) => [".mp4", ".mkv", ".mov", ".webm", ".m4v", ".avi", ".wmv", ".flv"].includes(f.ext)).map((file) => <option key={file.path} value={file.path}>{file.path}</option>)}
          </select>
          <button
            disabled={busy || !movieTitle.trim() || !movieFilePath}
            onClick={() => run(async () => {
              await fetch("/api/library/movie", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: movieTitle.trim(), filePath: movieFilePath, subtitles: movieSubtitlePaths, thumbnailPath: movieThumbnailPath, trailerPath: movieTrailerPath }) });
              setMessage("Movie added.");
              setMovieTitle("");
              setMovieFilePath("");
              setMovieSubtitlePaths([]);
              setMovieThumbnailPath("");
              setMovieTrailerPath("");
            }, () => setShowMovieModal(false))}
            className="h-11 px-4 rounded-md bg-foreground text-background text-sm"
          >Create Movie</button>
        </div>
      </Modal>

      <Modal open={showSeriesModal} title="Add Series" onClose={() => setShowSeriesModal(false)}>
        <div className="space-y-3">
          <input value={seriesTitle} onChange={(e) => setSeriesTitle(e.target.value)} placeholder="Series title" className="h-11 w-full px-3 rounded-md bg-background border border-hairline" />
          <input value={seriesFolder} onChange={(e) => setSeriesFolder(e.target.value)} placeholder="Series folder path (for auto-catalog)" className="h-11 w-full px-3 rounded-md bg-background border border-hairline" />
          <label className="inline-flex items-center gap-2 text-sm"><input type="checkbox" checked={seriesAutoCatalog} onChange={(e) => setSeriesAutoCatalog(e.target.checked)} /> Auto-catalog episodes from folder</label>
          {!!seriesPreview.length && (
            <div className="max-h-40 overflow-auto rounded-md border border-hairline p-2 text-xs">
              {seriesPreview.map((ep) => <div key={ep.id}>{`S${ep.season}E${ep.number} - ${ep.title}`}</div>)}
            </div>
          )}
          <button
            disabled={busy || !seriesTitle.trim()}
            onClick={() => run(async () => {
              const response = await fetch("/api/library/series", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: seriesTitle.trim(), sourceFolder: seriesFolder.trim(), autoCatalog: seriesAutoCatalog }) });
              const payload = await response.json();
              setSeriesPreview(Array.isArray(payload.previewEpisodes) ? payload.previewEpisodes : []);
              setMessage("Series created.");
              setSeriesTitle("");
              setSeriesFolder("");
            }, () => setShowSeriesModal(false))}
            className="h-11 px-4 rounded-md bg-foreground text-background text-sm"
          >Create Series</button>
        </div>
      </Modal>

      <Modal open={showEpisodeModal} title="Add Episode" onClose={() => setShowEpisodeModal(false)}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <select value={seriesId} onChange={(e) => setSeriesId(e.target.value)} className="h-11 px-3 rounded-md bg-background border border-hairline">
            <option value="">Select series...</option>
            {seriesOptions.map((entry) => <option key={entry.id} value={entry.id}>{entry.title}</option>)}
          </select>
          <input type="number" min={1} value={seasonNumber} onChange={(e) => setSeasonNumber(Number(e.target.value || 1))} className="h-11 px-3 rounded-md bg-background border border-hairline" placeholder="Season" />
          <input type="number" min={1} value={episodeNumber} onChange={(e) => setEpisodeNumber(Number(e.target.value || 1))} className="h-11 px-3 rounded-md bg-background border border-hairline" placeholder="Episode" />
          <input value={episodeTitle} onChange={(e) => setEpisodeTitle(e.target.value)} className="h-11 px-3 rounded-md bg-background border border-hairline" placeholder="Episode title" />
          <select value={episodeFilePath} onChange={(e) => setEpisodeFilePath(e.target.value)} className="h-11 px-3 rounded-md bg-background border border-hairline md:col-span-2">
            <option value="">Select file...</option>
            {files.map((file) => <option key={file.path} value={file.path}>{file.path}</option>)}
          </select>
          <select multiple value={episodeSubtitlePaths} onChange={(e) => setEpisodeSubtitlePaths(Array.from(e.target.selectedOptions).map((o) => o.value))} className="h-24 px-3 rounded-md bg-background border border-hairline md:col-span-2">
            {files.filter((f) => [".srt", ".vtt"].includes(f.ext)).map((file) => <option key={file.path} value={file.path}>{file.path}</option>)}
          </select>
          <select value={episodeThumbnailPath} onChange={(e) => setEpisodeThumbnailPath(e.target.value)} className="h-11 px-3 rounded-md bg-background border border-hairline md:col-span-2">
            <option value="">Episode thumbnail (optional)</option>
            {files.filter((f) => [".jpg", ".jpeg", ".png", ".webp"].includes(f.ext)).map((file) => <option key={file.path} value={file.path}>{file.path}</option>)}
          </select>
          <select value={episodeTrailerPath} onChange={(e) => setEpisodeTrailerPath(e.target.value)} className="h-11 px-3 rounded-md bg-background border border-hairline md:col-span-2">
            <option value="">Episode trailer (optional)</option>
            {files.filter((f) => [".mp4", ".mkv", ".mov", ".webm", ".m4v", ".avi", ".wmv", ".flv"].includes(f.ext)).map((file) => <option key={file.path} value={file.path}>{file.path}</option>)}
          </select>
        </div>
        <button
          disabled={busy || !seriesId || !episodeTitle.trim() || !episodeFilePath}
          onClick={() => run(async () => {
            await fetch(`/api/library/series/${seriesId}/season`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ seasonNumber: Number(seasonNumber) }) });
            await fetch(`/api/library/series/${seriesId}/season/${Number(seasonNumber)}/episode`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ title: episodeTitle.trim(), filePath: episodeFilePath, episodeNumber: Number(episodeNumber), subtitles: episodeSubtitlePaths, thumbnailPath: episodeThumbnailPath, trailerPath: episodeTrailerPath }),
            });
            setMessage("Episode added.");
            setEpisodeTitle("");
            setEpisodeFilePath("");
            setEpisodeSubtitlePaths([]);
            setEpisodeThumbnailPath("");
            setEpisodeTrailerPath("");
          }, () => setShowEpisodeModal(false))}
          className="mt-4 h-11 px-4 rounded-md bg-foreground text-background text-sm"
        >Add Episode</button>
      </Modal>

      <Modal open={editMovieModal} title="Edit Movie" onClose={() => setEditMovieModal(false)}>
        {editingMovie && (
          <div className="space-y-3">
            <input value={editingMovie.title} onChange={(e) => setEditingMovie((prev) => ({ ...prev, title: e.target.value }))} className="h-11 w-full px-3 rounded-md bg-background border border-hairline" />
            <button
              className="h-11 px-4 rounded-md bg-foreground text-background text-sm"
              onClick={() => run(async () => {
                await fetch(`/api/library/movie/${editingMovie.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: editingMovie.title }) });
                setMessage("Movie updated.");
              }, () => setEditMovieModal(false))}
            >Save</button>
          </div>
        )}
      </Modal>

      <Modal open={editSeriesModal} title="Edit Series" onClose={() => setEditSeriesModal(false)}>
        {editingSeries && (
          <div className="space-y-3">
            <input value={editingSeries.title} onChange={(e) => setEditingSeries((prev) => ({ ...prev, title: e.target.value }))} className="h-11 w-full px-3 rounded-md bg-background border border-hairline" />
            <button
              className="h-11 px-4 rounded-md bg-foreground text-background text-sm"
              onClick={() => run(async () => {
                await fetch(`/api/library/series/${editingSeries.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: editingSeries.title }) });
                setMessage("Series updated.");
              }, () => setEditSeriesModal(false))}
            >Save</button>
          </div>
        )}
      </Modal>
    </div>
  );
}
