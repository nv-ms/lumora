import { promises as fs } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const DB_FILE = path.resolve("data/catalog-db.json");
const DEFAULT_DB = {
  sources: ["C:/Users/kipto/Downloads/utorrent"],
  playback: {},
  thumbnails: {},
  library: {
    movies: [],
    series: [],
  },
};

async function ensureDbFile() {
  try {
    await fs.access(DB_FILE);
  } catch {
    await fs.mkdir(path.dirname(DB_FILE), { recursive: true });
    await fs.writeFile(DB_FILE, JSON.stringify(DEFAULT_DB, null, 2), "utf8");
  }
}

function normalizeLibrary(library) {
  return {
    movies: Array.isArray(library?.movies) ? library.movies : [],
    series: Array.isArray(library?.series) ? library.series : [],
  };
}

export async function readDb() {
  await ensureDbFile();
  const raw = await fs.readFile(DB_FILE, "utf8");
  const db = JSON.parse(raw);
  return {
    sources: Array.isArray(db.sources) ? db.sources : DEFAULT_DB.sources,
    playback: db.playback && typeof db.playback === "object" ? db.playback : {},
    thumbnails: db.thumbnails && typeof db.thumbnails === "object" ? db.thumbnails : {},
    library: normalizeLibrary(db.library),
  };
}

export async function writeDb(nextDb) {
  await fs.mkdir(path.dirname(DB_FILE), { recursive: true });
  await fs.writeFile(DB_FILE, JSON.stringify(nextDb, null, 2), "utf8");
}

function makeId(prefix, seed) {
  return `${prefix}-${crypto.createHash("sha1").update(seed).digest("hex").slice(0, 12)}`;
}

export async function setSources(sources) {
  const db = await readDb();
  db.sources = [...new Set(sources.map((source) => source.trim()).filter(Boolean))];
  await writeDb(db);
  return db.sources;
}

export async function updatePlayback(id, payload) {
  const db = await readDb();
  db.playback[id] = {
    ...(db.playback[id] || {}),
    ...payload,
    lastWatchedAt: new Date().toISOString(),
  };
  await writeDb(db);
  return db.playback[id];
}

export async function setThumbnail(id, thumbnailPath) {
  const db = await readDb();
  db.thumbnails[id] = thumbnailPath;
  await writeDb(db);
  return thumbnailPath;
}

export async function getThumbnail(id) {
  const db = await readDb();
  return db.thumbnails[id];
}

export async function getLibrary() {
  const db = await readDb();
  return db.library;
}

export async function createMovie({ title, filePath, subtitles = [], thumbnailPath = "", trailerPath = "" }) {
  const db = await readDb();
  const id = makeId("movie", `${title}|${filePath}|${Date.now()}`);
  const movie = {
    id,
    kind: "movie",
    title,
    filePath,
    subtitles,
    thumbnailPath,
    trailerPath,
    available: true,
    createdAt: new Date().toISOString(),
  };
  db.library.movies.push(movie);
  await writeDb(db);
  return movie;
}

export async function updateMovie(movieId, patch) {
  const db = await readDb();
  const movie = db.library.movies.find((entry) => entry.id === movieId);
  if (!movie) return null;
  Object.assign(movie, patch, { updatedAt: new Date().toISOString() });
  await writeDb(db);
  return movie;
}

export async function deleteMovie(movieId) {
  const db = await readDb();
  const before = db.library.movies.length;
  db.library.movies = db.library.movies.filter((entry) => entry.id !== movieId);
  await writeDb(db);
  return before !== db.library.movies.length;
}

export async function createSeries({ title, sourceFolder = "", subtitles = [], thumbnailPath = "", trailerPath = "" }) {
  const db = await readDb();
  const id = makeId("series", `${title}|${sourceFolder}|${Date.now()}`);
  const series = {
    id,
    kind: "series",
    title,
    sourceFolder,
    subtitles,
    thumbnailPath,
    trailerPath,
    available: true,
    seasons: [],
    createdAt: new Date().toISOString(),
  };
  db.library.series.push(series);
  await writeDb(db);
  return series;
}

export async function updateSeries(seriesId, patch) {
  const db = await readDb();
  const show = db.library.series.find((entry) => entry.id === seriesId);
  if (!show) return null;
  Object.assign(show, patch, { updatedAt: new Date().toISOString() });
  await writeDb(db);
  return show;
}

export async function deleteSeries(seriesId) {
  const db = await readDb();
  const before = db.library.series.length;
  db.library.series = db.library.series.filter((entry) => entry.id !== seriesId);
  await writeDb(db);
  return before !== db.library.series.length;
}

export async function addSeason(seriesId, seasonNumber) {
  const db = await readDb();
  const show = db.library.series.find((entry) => entry.id === seriesId);
  if (!show) return null;
  if (!show.seasons.find((entry) => entry.number === seasonNumber)) {
    show.seasons.push({ number: seasonNumber, episodes: [] });
    show.seasons.sort((a, b) => a.number - b.number);
  }
  await writeDb(db);
  return show;
}

export async function addEpisode(seriesId, seasonNumber, { title, filePath, episodeNumber, subtitles = [], thumbnailPath = "", trailerPath = "" }) {
  const db = await readDb();
  const show = db.library.series.find((entry) => entry.id === seriesId);
  if (!show) return null;
  let season = show.seasons.find((entry) => entry.number === seasonNumber);
  if (!season) {
    season = { number: seasonNumber, episodes: [] };
    show.seasons.push(season);
  }
  const id = makeId("episode", `${seriesId}|${seasonNumber}|${episodeNumber}|${filePath}|${Date.now()}`);
  season.episodes.push({
    id,
    kind: "episode",
    title,
    number: episodeNumber,
    filePath,
    season: seasonNumber,
    seriesId,
    subtitles,
    thumbnailPath,
    trailerPath,
    available: true,
    createdAt: new Date().toISOString(),
  });
  season.episodes.sort((a, b) => (a.number ?? 0) - (b.number ?? 0));
  show.seasons.sort((a, b) => a.number - b.number);
  await writeDb(db);
  return season;
}
