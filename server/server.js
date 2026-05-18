import { createReadStream } from "node:fs";
import { promises as fs } from "node:fs";
import http from "node:http";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
  addEpisode,
  addSeason,
  createMovie,
  createSeries,
  deleteMovie,
  deleteSeries,
  getLibrary,
  getThumbnail,
  readDb,
  setSources,
  setThumbnail,
  updateMovie,
  updatePlayback,
  updateSeries,
} from "./db.js";

const PORT = Number(process.env.PORT || 8787);
const MIME = {
  ".mp4": "video/mp4",
  ".mkv": "video/x-matroska",
  ".avi": "video/x-msvideo",
  ".mov": "video/quicktime",
  ".m4v": "video/x-m4v",
  ".webm": "video/webm",
  ".wmv": "video/x-ms-wmv",
  ".flv": "video/x-flv",
};

const VIDEO_EXTS = new Set(Object.keys(MIME));
const IMAGE_EXTS = new Set([".jpg", ".jpeg", ".png", ".webp"]);
const execFileAsync = promisify(execFile);

let cache = { generatedAt: null, sources: [], movies: [], series: [], fileMap: new Map() };

function normalizePath(value) {
  return path.resolve(value).replace(/[\\/]+/g, "/").toLowerCase();
}

function hueFor(seed) {
  let hash = 0;
  for (let idx = 0; idx < seed.length; idx += 1) hash = (hash << 5) - hash + seed.charCodeAt(idx);
  return String(Math.abs(hash) % 360);
}

function subtitleLangFromName(fileName) {
  const lower = fileName.toLowerCase();
  if (lower.includes(".en.")) return "en";
  if (lower.includes(".es.")) return "es";
  if (lower.includes(".fr.")) return "fr";
  return "und";
}

function parseEpisode(fileName) {
  const match = /S(\d{1,2})E(\d{1,2})/i.exec(fileName);
  if (!match) return null;
  return { season: Number(match[1]), episode: Number(match[2]) };
}

function escapeVttText(value) {
  return value.replace(/\r/g, "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function toVttTimestamp(srtTime) {
  return srtTime.replace(",", ".");
}

function srtToVtt(srt) {
  const normalized = srt.replace(/\r/g, "").trim();
  const blocks = normalized.split(/\n\n+/);
  const cues = blocks
    .map((block) => {
      const lines = block.split("\n");
      if (!lines.length) return null;
      const timeLine = lines[0].includes("-->") ? lines[0] : lines[1];
      if (!timeLine || !timeLine.includes("-->")) return null;
      const [startRaw, endRaw] = timeLine.split("-->").map((entry) => entry.trim());
      const textStart = lines[0].includes("-->") ? 1 : 2;
      const text = lines.slice(textStart).join("\n").trim();
      if (!text) return null;
      return `${toVttTimestamp(startRaw)} --> ${toVttTimestamp(endRaw)}\n${escapeVttText(text)}`;
    })
    .filter(Boolean);
  return `WEBVTT\n\n${cues.join("\n\n")}\n`;
}

async function toMediaEntry(base, playback) {
  const stat = await fs.stat(base.filePath);
  return {
    id: base.id,
    kind: base.kind,
    title: base.title,
    number: base.number,
    season: base.season,
    seriesId: base.seriesId,
    path: base.filePath,
    extension: path.extname(base.filePath).toLowerCase(),
    size: stat.size,
    modifiedAt: stat.mtime.toISOString(),
    poster: hueFor(base.filePath),
    streamUrl: `/api/media/${base.id}`,
    thumbnailUrl: `/api/thumbnail/${base.id}`,
    subtitles: Array.isArray(base.subtitles) ? base.subtitles : [],
    trailerPath: base.trailerPath || "",
    available: base.available !== false,
    progress: playback?.progress,
    lastWatchedAt: playback?.lastWatchedAt,
    currentTime: playback?.currentTime,
    duration: playback?.duration,
  };
}

async function buildCatalogFromLibrary() {
  const db = await readDb();
  const library = await getLibrary();
  const fileMap = new Map();
  const movies = [];
  const series = [];

  for (const movie of library.movies) {
    try {
      const entry = await toMediaEntry(movie, db.playback[movie.id]);
      movies.push(entry);
      fileMap.set(entry.id, { path: entry.path, name: path.basename(entry.path) });
    } catch {
      // skip
    }
  }

  for (const show of library.series) {
    const seasons = [];
    for (const season of show.seasons || []) {
      const episodes = [];
      for (const episode of season.episodes || []) {
        try {
          const entry = await toMediaEntry(episode, db.playback[episode.id]);
          episodes.push(entry);
          fileMap.set(entry.id, { path: entry.path, name: path.basename(entry.path) });
        } catch {
          // skip
        }
      }
      episodes.sort((a, b) => (a.number ?? 0) - (b.number ?? 0));
      seasons.push({ number: season.number, episodes });
    }
    seasons.sort((a, b) => a.number - b.number);
    series.push({
      id: show.id,
      kind: "series",
      title: show.title,
      poster: hueFor(show.title),
      seasons,
      sourceFolder: show.sourceFolder || "",
      subtitles: Array.isArray(show.subtitles) ? show.subtitles : [],
      trailerPath: show.trailerPath || "",
      available: show.available !== false,
      thumbnailUrl: `/api/thumbnail/${show.id}`,
      path: show.sourceFolder || "",
    });
  }

  movies.sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt));
  series.sort((a, b) => a.title.localeCompare(b.title));
  cache = { generatedAt: new Date().toISOString(), sources: db.sources, movies, series, fileMap };
  return cache;
}

async function listFilesFromSources(mode = "video") {
  const db = await readDb();
  const out = [];
  const seen = new Set();
  const allowVideo = mode === "video" || mode === "all";
  const allowSubtitle = mode === "subtitle" || mode === "all";
  const allowImage = mode === "image" || mode === "all";
  const allowTrailer = mode === "trailer" || mode === "all";

  async function walk(dir) {
    let entries = [];
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
        continue;
      }
      if (!entry.isFile()) continue;
      const ext = path.extname(entry.name).toLowerCase();
      const isVideo = VIDEO_EXTS.has(ext);
      const isSubtitle = ext === ".srt" || ext === ".vtt";
      const isImage = [".jpg", ".jpeg", ".png", ".webp"].includes(ext);
      const isTrailer = isVideo;
      const allowed = (allowVideo && isVideo) || (allowSubtitle && isSubtitle) || (allowImage && isImage) || (allowTrailer && isTrailer);
      if (!allowed) continue;
      const normalized = normalizePath(full);
      if (seen.has(normalized)) continue;
      seen.add(normalized);
      out.push({ path: full, name: entry.name, ext, folder: path.dirname(full) });
    }
  }

  for (const source of db.sources) await walk(path.resolve(source));
  out.sort((a, b) => a.path.localeCompare(b.path));
  return out;
}

async function listFoldersFromSources() {
  const db = await readDb();
  const out = [];
  const seen = new Set();
  for (const source of db.sources) {
    const root = path.resolve(source);
    let entries = [];
    try {
      entries = await fs.readdir(root, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const folder = path.join(root, entry.name);
      const key = normalizePath(folder);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(folder);
    }
  }
  out.sort((a, b) => a.localeCompare(b));
  return out;
}

async function getSystemRoots() {
  const roots = [];
  for (let code = 67; code <= 90; code += 1) {
    const drive = `${String.fromCharCode(code)}:/`;
    try {
      await fs.access(drive);
      roots.push(drive.replace("/", "\\"));
    } catch {
      // ignore missing drives
    }
  }
  if (!roots.length) roots.push(path.parse(process.cwd()).root);
  return roots;
}

async function listPathEntries(targetPath, mode = "all") {
  const entries = await fs.readdir(targetPath, { withFileTypes: true });
  const dirs = [];
  const files = [];
  for (const entry of entries) {
    const full = path.join(targetPath, entry.name);
    if (entry.isDirectory()) {
      dirs.push({ name: entry.name, path: full, type: "dir" });
      continue;
    }
    if (!entry.isFile()) continue;
    const ext = path.extname(entry.name).toLowerCase();
    const isVideo = VIDEO_EXTS.has(ext);
    const isSubtitle = ext === ".srt" || ext === ".vtt";
    const isImage = [".jpg", ".jpeg", ".png", ".webp"].includes(ext);
    const allowed =
      mode === "all" ||
      (mode === "video" && isVideo) ||
      (mode === "subtitle" && isSubtitle) ||
      (mode === "image" && isImage) ||
      (mode === "trailer" && isVideo);
    if (!allowed) continue;
    files.push({ name: entry.name, path: full, type: "file", ext });
  }
  dirs.sort((a, b) => a.name.localeCompare(b.name));
  files.sort((a, b) => a.name.localeCompare(b.name));
  return { dirs, files };
}

async function autoCatalogSeriesEpisodes(seriesId, sourceFolder) {
  const files = [];
  async function walk(dir) {
    let entries = [];
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) await walk(full);
      if (entry.isFile() && VIDEO_EXTS.has(path.extname(full).toLowerCase())) files.push(full);
    }
  }
  await walk(sourceFolder);

  const created = [];
  for (const filePath of files) {
    const parsed = parseEpisode(path.basename(filePath));
    const season = parsed?.season ?? 1;
    const episodeNumber = parsed?.episode ?? 0;
    const title = path.basename(filePath, path.extname(filePath)).replace(/[._]/g, " ").trim();
    await addSeason(seriesId, season);
    const seasonResult = await addEpisode(seriesId, season, { title, filePath, episodeNumber, subtitles: [] });
    const episode = seasonResult.episodes.find((ep) => ep.filePath === filePath);
    if (episode) created.push(episode);
  }

  return created;
}

async function resolveSubtitlesForMedia(id) {
  if (!cache.fileMap.has(id)) await buildCatalogFromLibrary();
  const media = cache.fileMap.get(id);
  if (!media) return [];
  const library = await getLibrary();

  const dir = path.dirname(media.path);
  const mediaBase = path.basename(media.path, path.extname(media.path)).toLowerCase();
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const subtitleFiles = entries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((name) => {
      const ext = path.extname(name).toLowerCase();
      return ext === ".srt" || ext === ".vtt";
    });

  const matched = subtitleFiles.filter((name) => {
    const lower = name.toLowerCase();
    return lower.startsWith(mediaBase) || lower.includes(mediaBase);
  });
  const out = [];
  const seen = new Set();

  function pushSubtitle(filePath) {
    const normalized = normalizePath(filePath);
    if (seen.has(normalized)) return;
    seen.add(normalized);
    const fileName = path.basename(filePath);
    const ext = path.extname(fileName).toLowerCase();
    if (ext !== ".srt" && ext !== ".vtt") return;
    out.push({
      fileName,
      path: filePath,
      ext,
      label: fileName.replace(ext, ""),
      lang: subtitleLangFromName(fileName),
    });
  }

  for (const name of matched.length ? matched : subtitleFiles) {
    pushSubtitle(path.join(dir, name));
  }

  for (const movie of library.movies || []) {
    if (movie.id !== id || !Array.isArray(movie.subtitles)) continue;
    for (const subPath of movie.subtitles) pushSubtitle(subPath);
  }
  for (const show of library.series || []) {
    for (const season of show.seasons || []) {
      for (const ep of season.episodes || []) {
        if (ep.id !== id || !Array.isArray(ep.subtitles)) continue;
        for (const subPath of ep.subtitles) pushSubtitle(subPath);
      }
    }
  }

  return out.map((track, index) => ({ ...track, id: String(index) }));
}

async function resolveThumbnailPath(id) {
  const library = await getLibrary();

  const findEntry = () => {
    for (const movie of library.movies || []) if (movie.id === id) return { entry: movie, kind: "movie" };
    for (const show of library.series || []) {
      if (show.id === id) return { entry: show, kind: "series" };
      for (const season of show.seasons || []) {
        for (const ep of season.episodes || []) if (ep.id === id) return { entry: ep, kind: "episode" };
      }
    }
    return { entry: null, kind: "" };
  };

  const findImageInDir = async (dir, mediaBase) => {
    let entries = [];
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return null;
    }
    const files = entries
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name)
      .filter((name) => IMAGE_EXTS.has(path.extname(name).toLowerCase()));

    const preferred = files.find((name) => {
      const lower = name.toLowerCase();
      return lower.startsWith(mediaBase) || lower.includes(mediaBase);
    });
    if (preferred) return path.join(dir, preferred);

    const common = ["poster.jpg", "poster.jpeg", "poster.png", "cover.jpg", "cover.jpeg", "cover.png", "folder.jpg", "folder.jpeg", "thumb.jpg", "thumb.jpeg", "thumbnail.jpg", "thumbnail.jpeg"];
    for (const name of common) {
      const full = path.join(dir, name);
      try {
        await fs.access(full);
        return full;
      } catch {}
    }
    return null;
  };

  const findImageRecursively = async (rootDir, mediaBase, maxDepth = 3) => {
    const queue = [{ dir: rootDir, depth: 0 }];
    while (queue.length) {
      const { dir, depth } = queue.shift();
      const hit = await findImageInDir(dir, mediaBase);
      if (hit) return hit;
      if (depth >= maxDepth) continue;
      let entries = [];
      try {
        entries = await fs.readdir(dir, { withFileTypes: true });
      } catch {
        continue;
      }
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        queue.push({ dir: path.join(dir, entry.name), depth: depth + 1 });
      }
    }
    return null;
  };

  const generateWithFfmpeg = async (mediaPath) => {
    try {
      const outDir = path.resolve("data/thumbnails/auto");
      await fs.mkdir(outDir, { recursive: true });
      const outPath = path.join(outDir, `${id}.jpg`);
      await execFileAsync("ffmpeg", ["-y", "-ss", "00:00:03", "-i", mediaPath, "-frames:v", "1", "-vf", "scale=640:-1", outPath], { windowsHide: true });
      await fs.access(outPath);
      await setThumbnail(id, outPath);
      return outPath;
    } catch {
      return null;
    }
  };

  const customPath = await getThumbnail(id);
  if (customPath) {
    try {
      await fs.access(customPath);
      return customPath;
    } catch { }
  }

  const { entry: mediaEntry, kind } = findEntry();
  if (!mediaEntry) return null;

  if (mediaEntry?.thumbnailPath) {
    try {
      await fs.access(mediaEntry.thumbnailPath);
      await setThumbnail(id, mediaEntry.thumbnailPath);
      return mediaEntry.thumbnailPath;
    } catch {}
  }

  if (kind === "series") {
    const baseDir = mediaEntry.sourceFolder ? path.resolve(mediaEntry.sourceFolder) : "";
    if (!baseDir) return null;
    const titleBase = String(mediaEntry.title || "").toLowerCase();
    const direct = await findImageInDir(baseDir, titleBase);
    if (direct) return direct;
    const deep = await findImageRecursively(baseDir, titleBase, 4);
    if (deep) return deep;
    return null;
  }

  if (!cache.fileMap.has(id)) await buildCatalogFromLibrary();
  const media = cache.fileMap.get(id);
  if (!media) return null;

  const dir = path.dirname(media.path);
  const mediaBase = path.basename(media.path, path.extname(media.path)).toLowerCase();
  const local = await findImageInDir(dir, mediaBase);
  if (local) return local;

  const parent = path.dirname(dir);
  if (parent && parent !== dir) {
    const parentHit = await findImageInDir(parent, mediaBase);
    if (parentHit) return parentHit;
  }

  const recursive = await findImageRecursively(dir, mediaBase, 3);
  if (recursive) return recursive;

  const generated = await generateWithFfmpeg(media.path);
  if (generated) return generated;

  return null;
}

function sendJson(res, status, payload) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function ensureWithin(baseDir, fileName) {
  const safeName = path.basename(fileName).replace(/[^\w.\- ()[\]]+/g, "_");
  return path.join(baseDir, safeName);
}

async function readMultipartFile(req) {
  const contentType = req.headers["content-type"] || "";
  const match = /boundary=(.+)$/.exec(contentType);
  if (!match) throw new Error("Invalid multipart request");
  const boundary = `--${match[1]}`;

  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const buffer = Buffer.concat(chunks);
  const raw = buffer.toString("binary");
  const parts = raw.split(boundary).filter((part) => part.includes("Content-Disposition"));
  if (!parts.length) throw new Error("No file payload found");

  const part = parts[0];
  const fileNameMatch = /filename=\"([^\"]+)\"/.exec(part);
  if (!fileNameMatch) throw new Error("No filename found");
  const fileName = fileNameMatch[1];

  const headerEnd = part.indexOf("\r\n\r\n");
  if (headerEnd === -1) throw new Error("Malformed multipart body");
  const dataStart = headerEnd + 4;
  const dataEnd = part.lastIndexOf("\r\n");
  const binaryBody = part.slice(dataStart, dataEnd);
  const fileBuffer = Buffer.from(binaryBody, "binary");

  return { fileName, fileBuffer };
}

async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

async function streamMedia(req, res, id) {
  if (!cache.fileMap.has(id)) await buildCatalogFromLibrary();
  const file = cache.fileMap.get(id);
  if (!file) return sendJson(res, 404, { error: "Media not found" });

  const stat = await fs.stat(file.path);
  const total = stat.size;
  const range = req.headers.range;
  const contentType = MIME[path.extname(file.path).toLowerCase()] || "application/octet-stream";

  if (!range) {
    res.writeHead(200, { "Content-Type": contentType, "Content-Length": total, "Accept-Ranges": "bytes", "Content-Disposition": `inline; filename="${file.name}"` });
    createReadStream(file.path).pipe(res);
    return;
  }

  const match = /bytes=(\d+)-(\d*)/.exec(range);
  if (!match) {
    res.writeHead(416, { "Content-Range": `bytes */${total}` });
    res.end();
    return;
  }

  const start = Number(match[1]);
  const end = match[2] ? Number(match[2]) : total - 1;
  if (start >= total || end >= total) {
    res.writeHead(416, { "Content-Range": `bytes */${total}` });
    res.end();
    return;
  }

  res.writeHead(206, {
    "Content-Type": contentType,
    "Content-Length": end - start + 1,
    "Accept-Ranges": "bytes",
    "Content-Range": `bytes ${start}-${end}/${total}`,
    "Content-Disposition": `inline; filename="${file.name}"`,
  });
  createReadStream(file.path, { start, end }).pipe(res);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host}`);

  try {
    if (url.pathname === "/api/health") return sendJson(res, 200, { ok: true });

    if (url.pathname === "/api/catalog" && req.method === "GET") {
      const catalog = await buildCatalogFromLibrary();
      return sendJson(res, 200, { generatedAt: catalog.generatedAt, sources: catalog.sources, movies: catalog.movies, series: catalog.series });
    }

    if (url.pathname === "/api/files" && req.method === "GET") {
      const mode = url.searchParams.get("mode") || "video";
      return sendJson(res, 200, { files: await listFilesFromSources(mode) });
    }

    if (url.pathname === "/api/upload" && req.method === "POST") {
      const category = url.searchParams.get("category") || "media";
      const validCategories = new Set(["media", "subtitle", "image", "trailer"]);
      if (!validCategories.has(category)) return sendJson(res, 400, { error: "Invalid upload category" });

      const { fileName, fileBuffer } = await readMultipartFile(req);
      const outDir = path.resolve(`data/uploads/${category}`);
      await fs.mkdir(outDir, { recursive: true });
      const outPath = ensureWithin(outDir, `${Date.now()}-${fileName}`);
      await fs.writeFile(outPath, fileBuffer);
      return sendJson(res, 200, { path: outPath, fileName });
    }

    if (url.pathname === "/api/folders" && req.method === "GET") {
      return sendJson(res, 200, { folders: await listFoldersFromSources() });
    }

    if (url.pathname === "/api/fs/roots" && req.method === "GET") {
      return sendJson(res, 200, { roots: await getSystemRoots() });
    }

    if (url.pathname === "/api/fs/list" && req.method === "GET") {
      const targetPath = url.searchParams.get("path");
      const mode = url.searchParams.get("mode") || "all";
      if (!targetPath) return sendJson(res, 400, { error: "path is required" });
      return sendJson(res, 200, await listPathEntries(targetPath, mode));
    }

    if (url.pathname === "/api/sources" && req.method === "GET") {
      const db = await readDb();
      return sendJson(res, 200, { sources: db.sources });
    }

    if (url.pathname === "/api/sources" && req.method === "POST") {
      const body = await readJsonBody(req);
      if (!body.path || typeof body.path !== "string") return sendJson(res, 400, { error: "path is required" });
      const db = await readDb();
      const sources = await setSources([...db.sources, body.path]);
      return sendJson(res, 200, { sources });
    }

    if (url.pathname === "/api/sources" && req.method === "DELETE") {
      const target = url.searchParams.get("path");
      const db = await readDb();
      const sources = await setSources(db.sources.filter((entry) => entry !== target));
      return sendJson(res, 200, { sources });
    }

    if (url.pathname === "/api/library/movie" && req.method === "POST") {
      const body = await readJsonBody(req);
      if (!body.title || !body.filePath) return sendJson(res, 400, { error: "title and filePath are required" });
      const movie = await createMovie({
        title: body.title,
        filePath: body.filePath,
        subtitles: Array.isArray(body.subtitles) ? body.subtitles : [],
        thumbnailPath: body.thumbnailPath || "",
        trailerPath: body.trailerPath || "",
      });
      return sendJson(res, 200, { movie });
    }

    if (url.pathname.match(/^\/api\/library\/movie\/[^/]+$/) && req.method === "PATCH") {
      const movieId = url.pathname.split("/")[4];
      const patch = await readJsonBody(req);
      const movie = await updateMovie(movieId, patch);
      if (!movie) return sendJson(res, 404, { error: "Movie not found" });
      return sendJson(res, 200, { movie });
    }

    if (url.pathname.match(/^\/api\/library\/movie\/[^/]+$/) && req.method === "DELETE") {
      const movieId = url.pathname.split("/")[4];
      const ok = await deleteMovie(movieId);
      return sendJson(res, ok ? 200 : 404, ok ? { ok: true } : { error: "Movie not found" });
    }

    if (url.pathname === "/api/library/series" && req.method === "POST") {
      const body = await readJsonBody(req);
      if (!body.title) return sendJson(res, 400, { error: "title is required" });
      const series = await createSeries({
        title: body.title,
        sourceFolder: body.sourceFolder || "",
        subtitles: Array.isArray(body.subtitles) ? body.subtitles : [],
        thumbnailPath: body.thumbnailPath || "",
        trailerPath: body.trailerPath || "",
      });

      let previewEpisodes = [];
      if (Array.isArray(body.episodeFiles) && body.episodeFiles.length) {
        for (const ep of body.episodeFiles) {
          const parsed = parseEpisode(path.basename(ep.filePath));
          const season = Number(ep.seasonNumber || parsed?.season || 1);
          const number = Number(ep.episodeNumber || parsed?.episode || 0);
          await addSeason(series.id, season);
          const seasonResult = await addEpisode(series.id, season, {
            title: ep.title || path.basename(ep.filePath, path.extname(ep.filePath)),
            filePath: ep.filePath,
            episodeNumber: number,
            subtitles: Array.isArray(ep.subtitles) ? ep.subtitles : [],
            thumbnailPath: ep.thumbnailPath || "",
            trailerPath: ep.trailerPath || "",
          });
          const added = seasonResult.episodes.find((entry) => entry.filePath === ep.filePath);
          if (added) previewEpisodes.push(added);
        }
      } else if (body.autoCatalog && body.sourceFolder) {
        previewEpisodes = await autoCatalogSeriesEpisodes(series.id, body.sourceFolder);
      }

      return sendJson(res, 200, { series, previewEpisodes });
    }

    if (url.pathname.match(/^\/api\/library\/series\/[^/]+$/) && req.method === "PATCH") {
      const seriesId = url.pathname.split("/")[4];
      const patch = await readJsonBody(req);
      const series = await updateSeries(seriesId, patch);
      if (!series) return sendJson(res, 404, { error: "Series not found" });
      return sendJson(res, 200, { series });
    }

    if (url.pathname.match(/^\/api\/library\/series\/[^/]+$/) && req.method === "DELETE") {
      const seriesId = url.pathname.split("/")[4];
      const ok = await deleteSeries(seriesId);
      return sendJson(res, ok ? 200 : 404, ok ? { ok: true } : { error: "Series not found" });
    }

    if (url.pathname.match(/^\/api\/library\/series\/[^/]+\/season$/) && req.method === "POST") {
      const seriesId = url.pathname.split("/")[4];
      const body = await readJsonBody(req);
      const seasonNumber = Number(body.seasonNumber);
      if (!seasonNumber) return sendJson(res, 400, { error: "seasonNumber is required" });
      const show = await addSeason(seriesId, seasonNumber);
      if (!show) return sendJson(res, 404, { error: "Series not found" });
      return sendJson(res, 200, { series: show });
    }

    if (url.pathname.match(/^\/api\/library\/series\/[^/]+\/season\/\d+\/episode$/) && req.method === "POST") {
      const parts = url.pathname.split("/");
      const seriesId = parts[4];
      const seasonNumber = Number(parts[6]);
      const body = await readJsonBody(req);
      if (!body.title || !body.filePath) return sendJson(res, 400, { error: "title and filePath are required" });
      const season = await addEpisode(seriesId, seasonNumber, {
        title: body.title,
        filePath: body.filePath,
        episodeNumber: Number(body.episodeNumber || 0),
        subtitles: Array.isArray(body.subtitles) ? body.subtitles : [],
        thumbnailPath: body.thumbnailPath || "",
        trailerPath: body.trailerPath || "",
      });
      if (!season) return sendJson(res, 404, { error: "Series not found" });
      return sendJson(res, 200, { season });
    }

    if (url.pathname.startsWith("/api/playback/") && req.method === "PATCH") {
      const id = url.pathname.split("/").pop();
      const body = await readJsonBody(req);
      const playback = await updatePlayback(id, {
        progress: Number(body.progress || 0),
        currentTime: Number(body.currentTime || 0),
        duration: Number(body.duration || 0),
      });
      return sendJson(res, 200, { playback });
    }

    if (url.pathname.startsWith("/api/thumbnail/")) {
      const id = url.pathname.split("/").pop();
      if (!id) return sendJson(res, 400, { error: "media id is required" });

      if (req.method === "GET") {
        const filePath = await resolveThumbnailPath(id);
        if (!filePath) return sendJson(res, 404, { error: "Thumbnail not found" });
        const ext = path.extname(filePath).toLowerCase();
        const contentType = ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg";
        const buf = await fs.readFile(filePath);
        res.writeHead(200, { "Content-Type": contentType, "Cache-Control": "no-store" });
        res.end(buf);
        return;
      }

      if (req.method === "POST") {
        const body = await readJsonBody(req);
        if (!body.dataUrl || typeof body.dataUrl !== "string") return sendJson(res, 400, { error: "dataUrl is required" });
        const match = /^data:(image\/(?:jpeg|jpg|png|webp));base64,(.+)$/i.exec(body.dataUrl);
        if (!match) return sendJson(res, 400, { error: "Unsupported image format" });
        const mime = match[1].toLowerCase();
        const ext = mime.includes("png") ? ".png" : mime.includes("webp") ? ".webp" : ".jpg";
        const buf = Buffer.from(match[2], "base64");
        const outDir = path.resolve("data/thumbnails");
        await fs.mkdir(outDir, { recursive: true });
        const outPath = path.join(outDir, `${id}${ext}`);
        await fs.writeFile(outPath, buf);
        await setThumbnail(id, outPath);
        return sendJson(res, 200, { ok: true, path: outPath });
      }
    }

    if (url.pathname.startsWith("/api/subtitles/") && req.method === "GET") {
      const parts = url.pathname.split("/").filter(Boolean);
      const mediaId = parts[2];
      if (!mediaId) return sendJson(res, 400, { error: "media id is required" });

      if (parts.length === 3) {
        const tracks = await resolveSubtitlesForMedia(mediaId);
        return sendJson(res, 200, {
          tracks: tracks.map((track) => ({ id: track.id, label: track.label, lang: track.lang, ext: track.ext, url: `/api/subtitles/${mediaId}/${track.id}` })),
        });
      }

      const trackId = parts[3];
      const tracks = await resolveSubtitlesForMedia(mediaId);
      const track = tracks.find((entry) => entry.id === trackId);
      if (!track) return sendJson(res, 404, { error: "Subtitle track not found" });

      const raw = await fs.readFile(track.path, "utf8");
      if (track.ext === ".vtt") {
        res.writeHead(200, { "Content-Type": "text/vtt; charset=utf-8" });
        res.end(raw);
        return;
      }

      res.writeHead(200, { "Content-Type": "text/vtt; charset=utf-8" });
      res.end(srtToVtt(raw));
      return;
    }

    if (url.pathname.startsWith("/api/media/") && req.method === "GET") {
      const id = url.pathname.split("/").pop();
      return streamMedia(req, res, id);
    }

    sendJson(res, 404, { error: "Not found" });
  } catch (error) {
    sendJson(res, 500, { error: error.message || "Server error" });
  }
});

server.listen(PORT, () => {
  console.log(`Media server listening on http://localhost:${PORT}`);
});
