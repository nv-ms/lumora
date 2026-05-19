import { useMemo, useState } from "react";
import { Film, Search, Tv, Plus, Eye, Pencil, Trash2, Power, ChevronUp, ChevronDown } from "lucide-react";
import { Link } from "react-router-dom";
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
  const [editRow, setEditRow] = useState(null);
  const [editTitle, setEditTitle] = useState("");
  const [editAvailable, setEditAvailable] = useState(true);
  const [editFilePath, setEditFilePath] = useState("");
  const [editSubtitlePaths, setEditSubtitlePaths] = useState([]);
  const [editThumbnailPath, setEditThumbnailPath] = useState("");
  const [editTrailerPath, setEditTrailerPath] = useState("");
  const [editSeriesSeasons, setEditSeriesSeasons] = useState([]);
  const [editStep, setEditStep] = useState(1);

  const [movieTitle, setMovieTitle] = useState("");
  const [movieFilePath, setMovieFilePath] = useState("");
  const [movieSubtitlePaths, setMovieSubtitlePaths] = useState([]);
  const [movieThumbnailPath, setMovieThumbnailPath] = useState("");
  const [movieTrailerPath, setMovieTrailerPath] = useState("");
  const [seriesTitle, setSeriesTitle] = useState("");
  const [seriesSeasonCount, setSeriesSeasonCount] = useState(1);
  const [seriesSubtitlePaths, setSeriesSubtitlePaths] = useState([]);
  const [seriesThumbnailPath, setSeriesThumbnailPath] = useState("");
  const [seriesTrailerPath, setSeriesTrailerPath] = useState("");
  const [seriesSeasons, setSeriesSeasons] = useState([{ number: 1, folderPath: "", episodes: [], loading: false }]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerTarget, setPickerTarget] = useState("movie");
  const [pickerMode, setPickerMode] = useState("video");
  const [pickerSeasonIdx, setPickerSeasonIdx] = useState(-1);

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
  
  const openPicker = (target, mode, seasonIdx = -1) => {
    setPickerTarget(target);
    setPickerMode(mode);
    setPickerSeasonIdx(seasonIdx);
    setPickerOpen(true);
  };

  const handlePick = (value) => {
    if (!value) return;
    if (pickerTarget === "movie") setMovieFilePath(String(value));
    if (pickerTarget === "subs") setMovieSubtitlePaths(Array.isArray(value) ? value : [String(value)]);
    if (pickerTarget === "thumb") setMovieThumbnailPath(String(value));
    if (pickerTarget === "trailer") setMovieTrailerPath(String(value));
    if (pickerTarget === "series-subs") setSeriesSubtitlePaths(Array.isArray(value) ? value : [String(value)]);
    if (pickerTarget === "series-thumb") setSeriesThumbnailPath(String(value));
    if (pickerTarget === "series-trailer") setSeriesTrailerPath(String(value));
    if (pickerTarget === "season-folder" && pickerSeasonIdx >= 0) {
      setSeriesSeasons((prev) => prev.map((s, idx) => (idx === pickerSeasonIdx ? { ...s, folderPath: String(value), episodes: [] } : s)));
    }
    if (pickerTarget === "edit-file") setEditFilePath(String(value));
    if (pickerTarget === "edit-season-folder" && pickerSeasonIdx >= 0) {
      setEditSeriesSeasons((prev) => prev.map((s, idx) => (idx === pickerSeasonIdx ? { ...s, folderPath: String(value) } : s)));
    }
    if (pickerTarget === "edit-subs") setEditSubtitlePaths(Array.isArray(value) ? value : [String(value)]);
    if (pickerTarget === "edit-thumb") setEditThumbnailPath(String(value));
    if (pickerTarget === "edit-trailer") setEditTrailerPath(String(value));
    setPickerOpen(false);
  };

  const rebuildSeasonRows = (count) => {
    const next = [];
    for (let i = 0; i < count; i += 1) {
      const existing = seriesSeasons[i];
      next.push(existing || { number: i + 1, folderPath: "", episodes: [], loading: false });
    }
    setSeriesSeasons(next.map((row, idx) => ({ ...row, number: idx + 1 })));
  };

  const sortEpisodeNames = (a, b) => {
    const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });
    return collator.compare(a, b);
  };

  const scanEpisodes = async (folderPath) => {
    const videoExts = new Set([".mp4", ".mkv", ".avi", ".mov", ".m4v", ".webm", ".wmv", ".flv"]);
    const subExts = new Set([".srt", ".vtt"]);
    const videos = [];
    const subtitles = [];
    const queue = [folderPath];
    while (queue.length) {
      const dir = queue.shift();
      const url = `/api/fs/list?path=${encodeURIComponent(dir)}&mode=all`;
      const res = await fetch(url);
      const data = await res.json();
      const dirs = Array.isArray(data.dirs) ? data.dirs : [];
      const files = Array.isArray(data.files) ? data.files : [];
      for (const d of dirs) queue.push(d.path);
      for (const f of files) {
        const ext = String(f.ext || "").toLowerCase();
        if (videoExts.has(ext)) videos.push(f.path);
        if (subExts.has(ext)) subtitles.push(f.path);
      }
    }
    videos.sort(sortEpisodeNames);
    return videos.map((filePath, idx) => {
      const videoBase = String(filePath).split(/[\\/]/).pop()?.replace(/\.[^.]+$/, "").toLowerCase() || "";
      const videoDir = String(filePath).replace(/[\\/][^\\/]+$/, "");
      const episodeSubs = subtitles.filter((subPath) => {
        const subLower = String(subPath).toLowerCase();
        const subDir = subLower.replace(/[\\/][^\\/]+$/, "");
        const subName = subLower.split(/[\\/]/).pop()?.replace(/\.[^.]+$/, "") || "";
        return subDir === videoDir.toLowerCase() || subName.includes(videoBase);
      });
      const stem = String(filePath).split(/[\\/]/).pop()?.replace(/\.[^.]+$/, "") || `Episode ${idx + 1}`;
      return { title: stem.replace(/[._]/g, " ").trim(), filePath, episodeNumber: idx + 1, subtitles: episodeSubs };
    });
  };

  const previewSeason = async (seasonIdx) => {
    const season = seriesSeasons[seasonIdx];
    if (!season?.folderPath) return;
    setSeriesSeasons((prev) => prev.map((s, idx) => (idx === seasonIdx ? { ...s, loading: true } : s)));
    try {
      const episodes = await scanEpisodes(season.folderPath);
      setSeriesSeasons((prev) => prev.map((s, idx) => (idx === seasonIdx ? { ...s, episodes, loading: false } : s)));
    } catch {
      setSeriesSeasons((prev) => prev.map((s, idx) => (idx === seasonIdx ? { ...s, episodes: [], loading: false } : s)));
    }
  };

  const moveEpisode = (seasonIdx, epIdx, dir) => {
    setSeriesSeasons((prev) => {
      const next = [...prev];
      const episodes = [...next[seasonIdx].episodes];
      const to = epIdx + dir;
      if (to < 0 || to >= episodes.length) return prev;
      const temp = episodes[epIdx];
      episodes[epIdx] = episodes[to];
      episodes[to] = temp;
      next[seasonIdx] = {
        ...next[seasonIdx],
        episodes: episodes.map((ep, idx) => ({ ...ep, episodeNumber: idx + 1 })),
      };
      return next;
    });
  };

  const updateEpisode = (seasonIdx, epIdx, patch) => {
    setSeriesSeasons((prev) => prev.map((season, sIdx) => {
      if (sIdx !== seasonIdx) return season;
      const episodes = season.episodes.map((ep, eIdx) => (eIdx === epIdx ? { ...ep, ...patch } : ep));
      return { ...season, episodes };
    }));
  };

  const createSeries = async () => {
    if (!seriesTitle.trim()) return;
    const episodeFiles = seriesSeasons.flatMap((season) =>
      season.episodes.map((ep) => ({
        title: ep.title,
        filePath: ep.filePath,
        seasonNumber: season.number,
        episodeNumber: ep.episodeNumber,
        subtitles: Array.isArray(ep.subtitles) ? ep.subtitles : [],
      })),
    );
    if (!episodeFiles.length) return;

    await run(async () => {
      await fetch("/api/library/series", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: seriesTitle.trim(),
          subtitles: seriesSubtitlePaths,
          thumbnailPath: seriesThumbnailPath,
          trailerPath: seriesTrailerPath,
          episodeFiles,
        }),
      });
      setSeriesTitle("");
      setSeriesSeasonCount(1);
      setSeriesSubtitlePaths([]);
      setSeriesThumbnailPath("");
      setSeriesTrailerPath("");
      setSeriesSeasons([{ number: 1, folderPath: "", episodes: [], loading: false }]);
      setShowSeriesModal(false);
      setMessage("Series added.");
    });
  };

  const toggleAvailability = async (row) => {
    await run(async () => {
      const endpoint = row.type === "movie" ? `/api/library/movie/${row.id}/update` : `/api/library/series/${row.id}/update`;
      await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ available: !row.available }) });
      setMessage(`${row.type === "movie" ? "Movie" : "Series"} updated.`);
    });
  };

  const deleteRow = async (row) => {
    await run(async () => {
      const endpoint = row.type === "movie" ? `/api/library/movie/${row.id}/delete` : `/api/library/series/${row.id}/delete`;
      await fetch(endpoint, { method: "POST" });
      setMessage(`${row.type === "movie" ? "Movie" : "Series"} deleted.`);
    });
  };

  const openEdit = (row) => {
    setEditRow(row);
    setEditTitle(row.title || "");
    setEditAvailable(row.available !== false);
    const source = row.type === "movie"
      ? movies.find((m) => m.id === row.id)
      : series.find((s) => s.id === row.id);
    setEditFilePath(source?.path || source?.sourceFolder || "");
    setEditSubtitlePaths(Array.isArray(source?.subtitles) ? source.subtitles : []);
    setEditThumbnailPath(source?.thumbnailPath || "");
    setEditTrailerPath(source?.trailerPath || "");
    setEditStep(1);
    if (row.type === "series") {
      const seasons = Array.isArray(source?.seasons)
        ? source.seasons.map((season) => ({
          number: season.number,
          folderPath: "",
          loading: false,
          episodes: (season.episodes || []).map((ep, idx) => ({
            id: ep.id,
            title: ep.title || `Episode ${idx + 1}`,
            number: Number(ep.number || idx + 1),
            episodeNumber: Number(ep.number || idx + 1),
            filePath: ep.path || ep.filePath || "",
            subtitles: Array.isArray(ep.subtitles) ? ep.subtitles : [],
          })),
        }))
        : [];
      setEditSeriesSeasons(seasons);
    } else {
      setEditSeriesSeasons([]);
    }
  };

  const saveEdit = async () => {
    if (!editRow) return;
    await run(async () => {
      const endpoint = editRow.type === "movie"
        ? `/api/library/movie/${editRow.id}/update`
        : `/api/library/series/${editRow.id}/update`;
      await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editTitle,
          available: editAvailable,
          filePath: editFilePath,
          sourceFolder: editRow.type === "series" ? editFilePath : undefined,
          subtitles: editSubtitlePaths,
          thumbnailPath: editThumbnailPath,
          trailerPath: editTrailerPath,
          seasons: editRow.type === "series"
            ? editSeriesSeasons.map((season) => ({
              number: season.number,
              episodes: season.episodes.map((ep) => ({
                id: ep.id,
                kind: "episode",
                title: ep.title,
                number: Number(ep.number || 0),
                filePath: ep.filePath,
                season: season.number,
                seriesId: editRow.id,
                subtitles: Array.isArray(ep.subtitles) ? ep.subtitles : [],
                available: true,
              })),
            }))
            : undefined,
        }),
      });
      setEditRow(null);
      setMessage(`${editRow.type === "movie" ? "Movie" : "Series"} edited.`);
    });
  };

  const updateEditEpisode = (seasonIdx, epIdx, patch) => {
    setEditSeriesSeasons((prev) => prev.map((season, sIdx) => {
      if (sIdx !== seasonIdx) return season;
      return {
        ...season,
        episodes: season.episodes.map((ep, eIdx) => (eIdx === epIdx ? { ...ep, ...patch } : ep)),
      };
    }));
  };

  const addEditSeason = () => {
    setEditSeriesSeasons((prev) => [...prev, { number: prev.length + 1, folderPath: "", loading: false, episodes: [] }]);
  };

  const previewEditSeason = async (seasonIdx) => {
    const season = editSeriesSeasons[seasonIdx];
    if (!season?.folderPath) return;
    setEditSeriesSeasons((prev) => prev.map((s, idx) => (idx === seasonIdx ? { ...s, loading: true } : s)));
    try {
      const episodes = await scanEpisodes(season.folderPath);
      setEditSeriesSeasons((prev) => prev.map((s, idx) => (
        idx === seasonIdx ? { ...s, loading: false, episodes: episodes.map((ep, i) => ({ ...ep, number: i + 1 })) } : s
      )));
    } catch {
      setEditSeriesSeasons((prev) => prev.map((s, idx) => (idx === seasonIdx ? { ...s, loading: false } : s)));
    }
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
                <td className="p-3">
                  <div className="flex items-center justify-end gap-2">
                    <Link
                      to={`/catalog/${row.type}/${row.id}`}
                      className="inline-flex h-8 w-8 items-center justify-center rounded bg-panel-2 hover:bg-panel"
                      title="View"
                    >
                      <Eye className="h-4 w-4" />
                    </Link>
                    <button
                      onClick={() => openEdit(row)}
                      className="inline-flex h-8 w-8 items-center justify-center rounded bg-panel-2 hover:bg-panel"
                      title="Edit"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => toggleAvailability(row)}
                      className="inline-flex h-8 w-8 items-center justify-center rounded bg-panel-2 hover:bg-panel"
                      title={row.available ? "Disable" : "Enable"}
                    >
                      <Power className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => deleteRow(row)}
                      className="inline-flex h-8 w-8 items-center justify-center rounded bg-red-900/40 hover:bg-red-900/60"
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
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

      <Modal open={showSeriesModal} title="Create Series" onClose={() => setShowSeriesModal(false)}>
        <div className="space-y-5">
          <div>
            <label className="mb-2 block text-sm">Title</label>
            <input value={seriesTitle} onChange={(e) => setSeriesTitle(e.target.value)} className="h-11 w-full rounded-md border border-hairline bg-background px-3 text-sm outline-none focus:border-foreground/50" />
          </div>
          <div>
            <label className="mb-2 block text-sm">Number of seasons</label>
            <input
              type="number"
              min={1}
              max={50}
              value={seriesSeasonCount}
              onChange={(e) => {
                const count = Math.max(1, Number(e.target.value || 1));
                setSeriesSeasonCount(count);
                rebuildSeasonRows(count);
              }}
              className="h-11 w-36 rounded-md border border-hairline bg-background px-3 text-sm outline-none focus:border-foreground/50"
            />
          </div>

          <div className="space-y-3 rounded-md border border-hairline p-3">
            {seriesSeasons.map((season, seasonIdx) => (
              <div key={`season-${season.number}`} className="rounded-md border border-hairline p-3">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm font-medium">Season {season.number}</div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => openPicker("season-folder", "all", seasonIdx)} className="h-9 rounded-md border border-hairline bg-background px-3 text-xs hover:bg-panel">Choose Folder</button>
                    <button onClick={() => previewSeason(seasonIdx)} disabled={!season.folderPath || season.loading} className="h-9 rounded-md bg-panel px-3 text-xs hover:bg-panel-2 disabled:opacity-50">{season.loading ? "Scanning..." : "Preview Episodes"}</button>
                  </div>
                </div>
                <div className="mb-2 break-all text-xs text-muted-foreground">{season.folderPath || "No folder selected"}</div>
                {!!season.episodes.length && (
                  <div className="overflow-x-auto rounded border border-hairline">
                    <table className="w-full text-xs">
                      <thead className="bg-panel">
                        <tr>
                          <th className="p-2 text-left">#</th>
                          <th className="p-2 text-left">Title</th>
                          <th className="p-2 text-left">File</th>
                          <th className="p-2 text-right">Order</th>
                        </tr>
                      </thead>
                      <tbody>
                        {season.episodes.map((ep, epIdx) => (
                          <tr key={`${season.number}-${ep.filePath}`} className="border-t border-hairline">
                            <td className="p-2">
                              <input
                                type="number"
                                min={1}
                                value={ep.episodeNumber}
                                onChange={(e) => updateEpisode(seasonIdx, epIdx, { episodeNumber: Number(e.target.value || ep.episodeNumber) })}
                                className="h-8 w-16 rounded border border-hairline bg-background px-2"
                              />
                            </td>
                            <td className="p-2">
                              <input value={ep.title} onChange={(e) => updateEpisode(seasonIdx, epIdx, { title: e.target.value })} className="h-8 w-full rounded border border-hairline bg-background px-2" />
                            </td>
                            <td className="p-2 break-all text-muted-foreground">{ep.filePath}</td>
                            <td className="p-2">
                              <div className="flex justify-end gap-1">
                                <button onClick={() => moveEpisode(seasonIdx, epIdx, -1)} className="inline-flex h-8 w-8 items-center justify-center rounded bg-panel-2"><ChevronUp className="h-4 w-4" /></button>
                                <button onClick={() => moveEpisode(seasonIdx, epIdx, 1)} className="inline-flex h-8 w-8 items-center justify-center rounded bg-panel-2"><ChevronDown className="h-4 w-4" /></button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div>
            <label className="mb-2 block text-sm">Subtitles folder/files</label>
            <button onClick={() => openPicker("series-subs", "subtitle")} className="inline-flex h-10 items-center rounded-md border border-hairline bg-background px-4 text-sm hover:bg-panel">Choose subtitles</button>
            <div className="mt-1 whitespace-pre-line break-all text-xs text-muted-foreground">{seriesSubtitlePaths.join("\n") || "No subtitles selected"}</div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm">Thumbnail</label>
              <button onClick={() => openPicker("series-thumb", "image")} className="inline-flex h-10 items-center rounded-md border border-hairline bg-background px-4 text-sm hover:bg-panel">Choose thumbnail</button>
              <div className="mt-1 break-all text-xs text-muted-foreground">{seriesThumbnailPath || "No thumbnail selected"}</div>
            </div>
            <div>
              <label className="mb-2 block text-sm">Trailer</label>
              <button onClick={() => openPicker("series-trailer", "trailer")} className="inline-flex h-10 items-center rounded-md border border-hairline bg-background px-4 text-sm hover:bg-panel">Choose trailer</button>
              <div className="mt-1 break-all text-xs text-muted-foreground">{seriesTrailerPath || "No trailer selected"}</div>
            </div>
          </div>

          <div className="flex justify-end">
            <button onClick={createSeries} disabled={busy || !seriesTitle.trim() || !seriesSeasons.some((s) => s.episodes.length)} className="h-12 rounded-md bg-foreground px-5 text-sm text-background disabled:opacity-50">Save Series</button>
          </div>
        </div>
      </Modal>
      <Modal open={!!editRow} title={`Edit ${editRow?.type || ""}`} onClose={() => setEditRow(null)}>
        <div className="space-y-4">
          {editRow?.type === "series" && (
            <div className="flex items-center gap-2">
              <button onClick={() => setEditStep(1)} className={`h-9 rounded-md px-3 text-sm ${editStep === 1 ? "bg-foreground text-background" : "bg-panel"}`}>1. Details</button>
              <button onClick={() => setEditStep(2)} className={`h-9 rounded-md px-3 text-sm ${editStep === 2 ? "bg-foreground text-background" : "bg-panel"}`}>2. Seasons & Episodes</button>
            </div>
          )}
          {(editRow?.type !== "series" || editStep === 1) && (
            <>
          <div>
            <label className="mb-2 block text-sm">Title</label>
            <input
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="h-11 w-full rounded-md border border-hairline bg-background px-3 text-sm outline-none focus:border-foreground/50"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm">{editRow?.type === "series" ? "Source Folder" : "Movie File"}</label>
            <button onClick={() => openPicker("edit-file", editRow?.type === "series" ? "all" : "video")} className="inline-flex h-10 items-center rounded-md border border-hairline bg-background px-4 text-sm hover:bg-panel">Choose {editRow?.type === "series" ? "folder" : "file"}</button>
            <div className="mt-1 break-all text-xs text-muted-foreground">{editFilePath || "No file selected"}</div>
          </div>
          <div>
            <label className="mb-2 block text-sm">Subtitles</label>
            <button onClick={() => openPicker("edit-subs", "subtitle")} className="inline-flex h-10 items-center rounded-md border border-hairline bg-background px-4 text-sm hover:bg-panel">Choose subtitle files</button>
            <div className="mt-1 whitespace-pre-line break-all text-xs text-muted-foreground">{editSubtitlePaths.join("\n") || "No subtitles selected"}</div>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="min-w-0">
              <label className="mb-2 block text-sm">Thumbnail</label>
              <button onClick={() => openPicker("edit-thumb", "image")} className="inline-flex h-10 items-center rounded-md border border-hairline bg-background px-4 text-sm hover:bg-panel">Choose thumbnail</button>
              <div className="mt-1 break-all text-xs text-muted-foreground">{editThumbnailPath || "No thumbnail selected"}</div>
            </div>
            <div className="min-w-0">
              <label className="mb-2 block text-sm">Trailer</label>
              <button onClick={() => openPicker("edit-trailer", "trailer")} className="inline-flex h-10 items-center rounded-md border border-hairline bg-background px-4 text-sm hover:bg-panel">Choose trailer</button>
              <div className="mt-1 break-all text-xs text-muted-foreground">{editTrailerPath || "No trailer selected"}</div>
            </div>
          </div>
            </>
          )}
          {editRow?.type === "series" && (
            <div className={`space-y-3 rounded-md border border-hairline p-3 ${editStep === 2 ? "" : "hidden"}`}>
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium">Seasons & Episodes</div>
                <button onClick={addEditSeason} className="h-9 rounded-md border border-hairline bg-panel px-3 text-xs hover:bg-panel-2">Add Season</button>
              </div>
              {!editSeriesSeasons.length && <div className="text-xs text-muted-foreground">No seasons available.</div>}
              {editSeriesSeasons.map((season, seasonIdx) => (
                <div key={`edit-season-${season.number}`} className="rounded-md border border-hairline p-2">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <div className="text-xs text-muted-foreground">Season {season.number}</div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => openPicker("edit-season-folder", "all", seasonIdx)} className="h-8 rounded-md border border-hairline bg-background px-3 text-xs hover:bg-panel">Choose Folder</button>
                      <button onClick={() => previewEditSeason(seasonIdx)} disabled={!season.folderPath || season.loading} className="h-8 rounded-md bg-panel px-3 text-xs hover:bg-panel-2 disabled:opacity-50">{season.loading ? "Scanning..." : "Preview Episodes"}</button>
                    </div>
                  </div>
                  {!!season.folderPath && <div className="mb-2 break-all text-xs text-muted-foreground">{season.folderPath}</div>}
                  <div className="space-y-2">
                    {season.episodes.map((ep, epIdx) => (
                      <div key={ep.id || `${season.number}-${epIdx}`} className="grid grid-cols-1 gap-2 md:grid-cols-[80px_1fr]">
                        <input
                          type="number"
                          min={1}
                          value={ep.number}
                          onChange={(e) => updateEditEpisode(seasonIdx, epIdx, { number: Number(e.target.value || ep.number), episodeNumber: Number(e.target.value || ep.number) })}
                          className="h-9 rounded border border-hairline bg-background px-2 text-sm"
                        />
                        <input
                          value={ep.title}
                          onChange={(e) => updateEditEpisode(seasonIdx, epIdx, { title: e.target.value })}
                          className="h-9 rounded border border-hairline bg-background px-2 text-sm"
                        />
                        <div className="md:col-span-2 break-all text-xs text-muted-foreground">{ep.filePath}</div>
                      </div>
                    ))}
                    {!season.episodes.length && <div className="text-xs text-muted-foreground">No episodes for this season.</div>}
                  </div>
                </div>
              ))}
            </div>
          )}
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={editAvailable} onChange={(e) => setEditAvailable(e.target.checked)} />
            Available
          </label>
          <div className="flex justify-end">
            <button onClick={saveEdit} className="h-10 rounded-md bg-foreground px-4 text-sm text-background">Save</button>
          </div>
        </div>
      </Modal>
      <PathPickerModal
        open={pickerOpen}
        title={pickerTarget === "subs" ? "Select Subtitle Files" : "Select File"}
        mode={pickerMode}
        multi={pickerTarget === "subs" || pickerTarget === "edit-subs" || pickerTarget === "series-subs"}
        allowFolder={pickerTarget === "season-folder" || pickerTarget === "edit-season-folder" || (pickerTarget === "edit-file" && editRow?.type === "series")}
        onClose={() => setPickerOpen(false)}
        onPick={handlePick}
      />
    </div>
  );
}
