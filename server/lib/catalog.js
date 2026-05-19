import path from "node:path";
import { promises as fs } from "node:fs";
import { getLibrary, readDb } from "../db.js";
import { hueFor } from "./media-utils.js";

let cache = { generatedAt: null, sources: [], movies: [], series: [], fileMap: new Map() };

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

export async function buildCatalogFromLibrary() {
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
    } catch {}
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
        } catch {}
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

export function getCache() {
  return cache;
}

export async function ensureCachedMedia(id) {
  if (!cache.fileMap.has(id)) await buildCatalogFromLibrary();
  return cache.fileMap.get(id);
}
