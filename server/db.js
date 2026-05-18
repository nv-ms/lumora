import { promises as fs } from "node:fs";
import path from "node:path";

const DB_FILE = path.resolve("data/catalog-db.json");
const DEFAULT_DB = {
  sources: ["C:/Users/kipto/Downloads/utorrent"],
  playback: {},
};

async function ensureDbFile() {
  try {
    await fs.access(DB_FILE);
  } catch {
    await fs.mkdir(path.dirname(DB_FILE), { recursive: true });
    await fs.writeFile(DB_FILE, JSON.stringify(DEFAULT_DB, null, 2), "utf8");
  }
}

export async function readDb() {
  await ensureDbFile();
  const raw = await fs.readFile(DB_FILE, "utf8");
  const db = JSON.parse(raw);
  return {
    sources: Array.isArray(db.sources) ? db.sources : DEFAULT_DB.sources,
    playback: db.playback && typeof db.playback === "object" ? db.playback : {},
  };
}

export async function writeDb(nextDb) {
  await fs.mkdir(path.dirname(DB_FILE), { recursive: true });
  await fs.writeFile(DB_FILE, JSON.stringify(nextDb, null, 2), "utf8");
}

export async function setSources(sources) {
  const db = await readDb();
  const unique = [...new Set(sources.map((source) => source.trim()).filter(Boolean))];
  db.sources = unique;
  await writeDb(db);
  return unique;
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
