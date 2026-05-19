import path from "node:path";
import { promises as fs } from "node:fs";
import { getLibrary } from "../db.js";
import { ensureCachedMedia } from "./catalog.js";
import { normalizePath, subtitleLangFromName } from "./media-utils.js";

export async function resolveSubtitlesForMedia(id) {
  const media = await ensureCachedMedia(id);
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
    out.push({ fileName, path: filePath, ext, label: fileName.replace(ext, ""), lang: subtitleLangFromName(fileName) });
  }

  for (const name of matched.length ? matched : subtitleFiles) pushSubtitle(path.join(dir, name));

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
