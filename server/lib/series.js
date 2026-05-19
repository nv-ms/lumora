import path from "node:path";
import { promises as fs } from "node:fs";
import { addEpisode, addSeason } from "../db.js";
import { parseEpisode, VIDEO_EXTS } from "./media-utils.js";

export async function autoCatalogSeriesEpisodes(seriesId, sourceFolder) {
  const files = [];
  async function walk(dir) {
    let entries = [];
    try { entries = await fs.readdir(dir, { withFileTypes: true }); } catch { return; }
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
