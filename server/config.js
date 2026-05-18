import { promises as fs } from "node:fs";
import path from "node:path";

const SOURCES_FILE = path.resolve("data/sources.json");
const DEFAULT_SOURCES = ["C:/Users/kipto/Downloads/utorrent"];

async function ensureSourcesFile() {
  try {
    await fs.access(SOURCES_FILE);
  } catch {
    await fs.mkdir(path.dirname(SOURCES_FILE), { recursive: true });
    await fs.writeFile(
      SOURCES_FILE,
      JSON.stringify({ sources: DEFAULT_SOURCES }, null, 2),
      "utf8",
    );
  }
}

export async function readSources() {
  await ensureSourcesFile();
  const raw = await fs.readFile(SOURCES_FILE, "utf8");
  const parsed = JSON.parse(raw);
  return Array.isArray(parsed.sources) ? parsed.sources : DEFAULT_SOURCES;
}

export async function writeSources(sources) {
  const unique = [...new Set(sources.map((source) => source.trim()).filter(Boolean))];
  await fs.mkdir(path.dirname(SOURCES_FILE), { recursive: true });
  await fs.writeFile(SOURCES_FILE, JSON.stringify({ sources: unique }, null, 2), "utf8");
  return unique;
}
