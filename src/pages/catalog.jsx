import { useMemo, useState } from "react";
import { Film, Search, Tv, Plus } from "lucide-react";
import { useCatalog } from "../lib/catalog-context";
import { PathPickerModal } from "../components/path-picker-modal";

function Modal({ open, title, onClose, children }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black/70 p-4 md:p-6" onClick={onClose}>
      <div className="mx-auto h-full  w-full max-w-4xl rounded-2xl border border-hairline bg-background shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex h-16 items-center justify-between border-b border-hairline px-5">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button onClick={onClose} className="h-10 rounded-md bg-panel px-4 text-sm hover:bg-panel-2">Close</button>
        </div>
        <div className="h-[calc(100%-4rem)] overflow-auto p-5">{children}</div>
      </div>
    </div>
  );
}

export function CatalogPage() {
  const { movies, series, refresh } = useCatalog();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterAvailable, setFilterAvailable] = useState("all");

  const [showMovieModal, setShowMovieModal] = useState(false);
  const [showSeriesModal, setShowSeriesModal] = useState(false);

  const [movieTitle, setMovieTitle] = useState("");
  const [movieFilePath, setMovieFilePath] = useState("");
  const [movieSubtitlePaths, setMovieSubtitlePaths] = useState([]);
  const [movieThumbnailPath, setMovieThumbnailPath] = useState("");
  const [movieTrailerPath, setMovieTrailerPath] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerTarget, setPickerTarget] = useState("movie");
  const [pickerMode, setPickerMode] = useState("video");

  const rows = useMemo(() => {
    const movieRows = movies.map((movie) => ({ id: movie.id, type: "movie", title: movie.title, path: movie.path, available: movie.available !== false, meta: movie.extension }));
    const seriesRows = series.map((show) => ({ id: show.id, type: "series", title: show.title, path: show.path || "", available: show.available !== false, meta: `${show.seasons.reduce((acc, season) => acc + season.episodes.length, 0)} episodes` }));
    return [...movieRows, ...seriesRows];
  }, [movies, series]);

  const filteredRows = rows.filter((row) => {
    const s = search.trim().toLowerCase();
    if (s && !(`${row.title} ${row.path} ${row.meta}`.toLowerCase().includes(s))) return false;
    if (filterType !== "all" && row.type !== filterType) return false;
    if (filterAvailable === "available" && !row.available) return false;
    if (filterAvailable === "unavailable" && row.available) return false;
    return true;
  });

  const run = async (fn) => {
    setBusy(true);
    setMessage("");
    try {
      await fn();
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const createMovie = async () => {
    if (!movieFilePath) return;
    await run(async () => {
      const inferredTitle = movieFilePath.split(/[\\/]/).pop().replace(/\.[^.]+$/, "").replace(/[._]/g, " ").trim();
      await fetch("/api/library/movie", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: movieTitle.trim() || inferredTitle,
          filePath: movieFilePath,
          subtitles: movieSubtitlePaths,
          thumbnailPath: movieThumbnailPath,
          trailerPath: movieTrailerPath,
        }),
      });
      setMovieTitle("");
      setMovieFilePath("");
      setMovieSubtitlePaths([]);
      setMovieThumbnailPath("");
      setMovieTrailerPath("");
      setShowMovieModal(false);
      setMessage("Movie added.");
    });
  };
  
  const openPicker = (target, mode) => {
    setPickerTarget(target);
    setPickerMode(mode);
    setPickerOpen(true);
  };

  const handlePick = (value) => {
    if (!value) return;
    if (pickerTarget === "movie") setMovieFilePath(String(value));
    if (pickerTarget === "subs") setMovieSubtitlePaths(Array.isArray(value) ? value : [String(value)]);
    if (pickerTarget === "thumb") setMovieThumbnailPath(String(value));
    if (pickerTarget === "trailer") setMovieTrailerPath(String(value));
    setPickerOpen(false);
  };

  const toggleAvailability = async (row) => {
    await run(async () => {
      const endpoint = row.type === "movie" ? `/api/library/movie/${row.id}` : `/api/library/series/${row.id}`;
      await fetch(endpoint, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ available: !row.available }) });
      setMessage(`${row.type === "movie" ? "Movie" : "Series"} updated.`);
    });
  };

  const deleteRow = async (row) => {
    await run(async () => {
      const endpoint = row.type === "movie" ? `/api/library/movie/${row.id}` : `/api/library/series/${row.id}`;
      await fetch(endpoint, { method: "DELETE" });
      setMessage(`${row.type === "movie" ? "Movie" : "Series"} deleted.`);
    });
  };

  return (
    <div className="mx-auto w-full px-8 py-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Catalog</h1>
          <p className="mt-1 text-sm text-muted-foreground">Movies and Series management.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button onClick={() => setShowMovieModal(true)} className="h-10 px-5 rounded-[5px] bg-foreground text-background text-sm inline-flex items-center gap-2"><Film className="h-4 w-4" /> Add Movie</button>
          <button onClick={() => setShowSeriesModal(true)} className="h-10 px-5 rounded-[5px] bg-panel hover:bg-panel-2 text-sm inline-flex items-center gap-2 border border-hairline"><Tv className="h-4 w-4" /> Add Series</button>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto]">
        <div className="h-12 px-3 bg-panel rounded-md inline-flex items-center gap-2 w-full max-w-xl">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search catalog" className="bg-transparent outline-none text-sm w-full" />
        </div>
        <div className="flex items-center gap-2 justify-end">
          <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="h-12 px-3 rounded-md bg-panel text-sm">
            <option value="all">All Types</option>
            <option value="movie">Movies</option>
            <option value="series">Series</option>
          </select>
          <select value={filterAvailable} onChange={(e) => setFilterAvailable(e.target.value)} className="h-12 px-3 rounded-md bg-panel text-sm">
            <option value="all">All Availability</option>
            <option value="available">Available</option>
            <option value="unavailable">Unavailable</option>
          </select>
        </div>
      </div>

      <div className="mt-6 overflow-x-auto rounded-md border border-hairline">
        <table className="w-full text-sm">
          <thead className="bg-panel">
            <tr>
              <th className="text-left p-3">Type</th>
              <th className="text-left p-3">Title</th>
              <th className="text-left p-3">Path/Info</th>
              <th className="text-left p-3">Available</th>
              <th className="text-right p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((row) => (
              <tr key={`${row.type}:${row.id}`} className="border-t border-hairline">
                <td className="p-3 capitalize">{row.type}</td>
                <td className="p-3">{row.title}</td>
                <td className="p-3 text-xs text-muted-foreground break-all">{row.path || row.meta}</td>
                <td className="p-3">{row.available ? "Yes" : "No"}</td>
                <td className="p-3 text-right space-x-2">
                  <button onClick={() => toggleAvailability(row)} className="h-8 px-3 rounded bg-panel-2">{row.available ? "Disable" : "Enable"}</button>
                  <button onClick={() => deleteRow(row)} className="h-8 px-3 rounded bg-red-900/40">Delete</button>
                </td>
              </tr>
            ))}
            {!filteredRows.length && <tr><td colSpan={5} className="p-4 text-muted-foreground">No catalog entries found.</td></tr>}
          </tbody>
        </table>
      </div>

      {busy && <div className="mt-3 text-xs text-muted-foreground">Processing...</div>}
      {!!message && <div className="mt-2 text-sm text-emerald-400">{message}</div>}

      <Modal open={showMovieModal} title="Create Movie" onClose={() => setShowMovieModal(false)}>
        <div className="space-y-5">
          <div>
            <label className="block text-sm mb-2">Title</label>
            <input
              value={movieTitle}
              onChange={(e) => setMovieTitle(e.target.value)}
              placeholder="Movie Name"
              className="h-11 w-full rounded-md border border-hairline bg-background px-3 text-sm outline-none focus:border-foreground/50"
            />
          </div>

          <div>
            <label className="block text-sm mb-2">Movie file</label>
            <button onClick={() => openPicker("movie", "video")} className="inline-flex h-10 items-center rounded-md border border-hairline bg-background px-4 text-sm hover:bg-panel">Choose video file</button>
            <div className="mt-1 text-xs text-muted-foreground break-all">{movieFilePath || "No file selected"}</div>
          </div>

          <div>
            <label className="block text-sm mb-2">Subtitle files</label>
            <button onClick={() => openPicker("subs", "subtitle")} className="inline-flex h-10 items-center rounded-md border border-hairline bg-background px-4 text-sm hover:bg-panel">Choose subtitle files</button>
            <div className="mt-1 text-xs text-muted-foreground break-all">{movieSubtitlePaths.join("\n") || "No subtitles selected"}</div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="min-w-0">
              <label className="block text-sm mb-2">Thumbnail file</label>
              <button onClick={() => openPicker("thumb", "image")} className="inline-flex h-10 items-center rounded-md border border-hairline bg-background px-4 text-sm hover:bg-panel">Choose thumbnail</button>
              <div className="mt-1 text-xs text-muted-foreground break-all">{movieThumbnailPath || "No thumbnail selected"}</div>
            </div>
            <div className="min-w-0">
              <label className="block text-sm mb-2">Trailer file</label>
              <button onClick={() => openPicker("trailer", "trailer")} className="inline-flex h-10 items-center rounded-md border border-hairline bg-background px-4 text-sm hover:bg-panel">Choose trailer</button>
              <div className="mt-1 text-xs text-muted-foreground break-all">{movieTrailerPath || "No trailer selected"}</div>
            </div>
          </div>

          <div className="flex justify-end">
            <button disabled={busy || !movieFilePath} onClick={createMovie} className="h-12 px-5 rounded-md bg-foreground text-background text-sm inline-flex items-center gap-2"><Plus className="h-4 w-4" /> Save Movie</button>
          </div>
        </div>
      </Modal>

      <Modal open={showSeriesModal} title="Series Flow" onClose={() => setShowSeriesModal(false)}>
        <div className="text-sm text-muted-foreground">Next step after movie flow approval.</div>
      </Modal>
      <PathPickerModal
        open={pickerOpen}
        title={pickerTarget === "subs" ? "Select Subtitle Files" : "Select File"}
        mode={pickerMode}
        multi={pickerTarget === "subs"}
        onClose={() => setPickerOpen(false)}
        onPick={handlePick}
      />
    </div>
  );
}
