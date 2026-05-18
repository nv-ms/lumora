import crypto from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

const VIDEO_EXTS = new Set([".mp4", ".mkv", ".avi", ".mov", ".m4v", ".webm", ".wmv", ".flv"]);

function isVideoFile(filePath) {
  return VIDEO_EXTS.has(path.extname(filePath).toLowerCase());
}

function idFor(sourcePath, filePath) {
  return crypto.createHash("sha1").update(`${sourcePath}|${filePath}`).digest("hex").slice(0, 16);
}

function hueFor(seed) {
  const hash = crypto.createHash("md5").update(seed).digest();
  return String(hash[0] * 1.4);
}

function cleanTitle(name) {
  return name
    .replace(/[._]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\bS\d{1,2}E\d{1,2}\b/i, "")
    .replace(/\b\d{3,4}p\b/gi, "")
    .replace(/\b(x264|x265|h264|h265|bluray|webrip|web-dl|dvdrip)\b/gi, "")
    .trim();
}

function parseEpisodeNumber(fileName) {
  const match = fileName.match(/S(\d{1,2})E(\d{1,2})/i);
  if (!match) return null;
  return { season: Number(match[1]), episode: Number(match[2]) };
}

async function walk(dir, acc) {
  let entries = [];
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) await walk(fullPath, acc);
    if (entry.isFile() && isVideoFile(fullPath)) {
      const stat = await fs.stat(fullPath);
      acc.push({ fullPath, name: entry.name, size: stat.size, modifiedAt: stat.mtime.toISOString() });
    }
  }
}

function normalizePath(value) {
  return path.resolve(value).replace(/[\\/]+/g, "/").toLowerCase();
}

export async function buildCatalog(sources, playback = {}) {
  const sourceMeta = sources.map((source) => ({
    source,
    normalized: normalizePath(source),
    resolved: path.resolve(source),
  }));
  const files = [];
  for (const entry of sourceMeta) await walk(entry.resolved, files);

  const movies = [];
  const seriesMap = new Map();
  const fileMap = new Map();

  for (const file of files) {
    const normalizedFilePath = normalizePath(file.fullPath);
    const matchedSource = sourceMeta.find((entry) => normalizedFilePath.startsWith(entry.normalized));
    if (!matchedSource) continue;

    const rel = path.relative(matchedSource.resolved, file.fullPath);
    const parts = rel.split(path.sep);
    const ext = path.extname(file.name).toLowerCase();
    const id = idFor(matchedSource.source, file.fullPath);
    const watch = playback[id] || {};

    const common = {
      id,
      title: cleanTitle(path.basename(file.name, ext)) || file.name,
      path: file.fullPath,
      extension: ext,
      size: file.size,
      modifiedAt: file.modifiedAt,
      poster: hueFor(file.fullPath),
      streamUrl: `/api/media/${id}`,
      thumbnailUrl: `/api/thumbnail/${id}`,
      progress: watch.progress,
      lastWatchedAt: watch.lastWatchedAt,
      currentTime: watch.currentTime,
      duration: watch.duration,
    };

    fileMap.set(id, { path: file.fullPath, ext, size: file.size, name: file.name });

    const parsed = parseEpisodeNumber(file.name);
    if (!parsed) {
      movies.push({ ...common, kind: "movie" });
      continue;
    }

    const showName = cleanTitle(parts[0]) || parts[0];
    const seasonNumber = parsed?.season ?? 1;
    const episodeNumber = parsed?.episode ?? 0;

    if (!seriesMap.has(showName)) {
      seriesMap.set(showName, {
        id: `series-${crypto.createHash("sha1").update(showName).digest("hex").slice(0, 12)}`,
        kind: "series",
        title: showName,
        path: path.join(matchedSource.resolved, parts[0]),
        poster: hueFor(showName),
        seasons: new Map(),
      });
    }

    const show = seriesMap.get(showName);
    if (!show.seasons.has(seasonNumber)) show.seasons.set(seasonNumber, { number: seasonNumber, episodes: [] });

    show.seasons.get(seasonNumber).episodes.push({
      ...common,
      number: episodeNumber,
      kind: "episode",
      seriesId: show.id,
      season: seasonNumber,
    });
  }

  const series = [...seriesMap.values()].map((show) => ({
    id: show.id,
    kind: show.kind,
    title: show.title,
    path: show.path,
    poster: show.poster,
    seasons: [...show.seasons.values()].map((season) => ({
      number: season.number,
      episodes: season.episodes.sort((a, b) => a.number - b.number || a.title.localeCompare(b.title)),
    })).sort((a, b) => a.number - b.number),
  }));

  movies.sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt));
  series.sort((a, b) => a.title.localeCompare(b.title));

  return { generatedAt: new Date().toISOString(), sources, movies, series, fileMap };
}
