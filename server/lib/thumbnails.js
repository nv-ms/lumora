import path from "node:path";
import { promises as fs } from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { getLibrary, getThumbnail, setThumbnail } from "../db.js";
import { ensureCachedMedia } from "./catalog.js";
import { IMAGE_EXTS } from "./media-utils.js";

const execFileAsync = promisify(execFile);

async function findImageInDir(dir, mediaBase) {
  let entries = [];
  try { entries = await fs.readdir(dir, { withFileTypes: true }); } catch { return null; }
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
    try { await fs.access(full); return full; } catch {}
  }
  return null;
}

async function findImageRecursively(rootDir, mediaBase, maxDepth = 3) {
  const queue = [{ dir: rootDir, depth: 0 }];
  while (queue.length) {
    const { dir, depth } = queue.shift();
    const hit = await findImageInDir(dir, mediaBase);
    if (hit) return hit;
    if (depth >= maxDepth) continue;
    let entries = [];
    try { entries = await fs.readdir(dir, { withFileTypes: true }); } catch { continue; }
    for (const entry of entries) if (entry.isDirectory()) queue.push({ dir: path.join(dir, entry.name), depth: depth + 1 });
  }
  return null;
}

async function generateWithFfmpeg(id, mediaPath) {
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
}

function findLibraryEntry(library, id) {
  for (const movie of library.movies || []) if (movie.id === id) return { entry: movie, kind: "movie" };
  for (const show of library.series || []) {
    if (show.id === id) return { entry: show, kind: "series" };
    for (const season of show.seasons || []) {
      for (const ep of season.episodes || []) if (ep.id === id) return { entry: ep, kind: "episode" };
    }
  }
  return { entry: null, kind: "" };
}

export async function resolveThumbnailPath(id) {
  const library = await getLibrary();
  const customPath = await getThumbnail(id);
  if (customPath) {
    try { await fs.access(customPath); return customPath; } catch {}
  }

  const { entry: mediaEntry, kind } = findLibraryEntry(library, id);
  if (!mediaEntry) return null;

  if (mediaEntry.thumbnailPath) {
    try {
      const explicitThumb = path.isAbsolute(mediaEntry.thumbnailPath) ? mediaEntry.thumbnailPath : path.resolve(mediaEntry.thumbnailPath);
      await fs.access(explicitThumb);
      await setThumbnail(id, explicitThumb);
      return explicitThumb;
    } catch {}
  }

  if (kind === "series") {
    let baseDir = mediaEntry.sourceFolder ? path.resolve(mediaEntry.sourceFolder) : "";
    if (!baseDir && Array.isArray(mediaEntry.seasons)) {
      const firstEp = mediaEntry.seasons.flatMap((s) => s.episodes || []).find((ep) => ep?.filePath);
      if (firstEp?.filePath) baseDir = path.dirname(firstEp.filePath);
    }
    if (!baseDir) return null;
    const titleBase = String(mediaEntry.title || "").toLowerCase();
    const direct = await findImageInDir(baseDir, titleBase);
    if (direct) {
      await setThumbnail(id, direct);
      return direct;
    }
    const deep = await findImageRecursively(baseDir, titleBase, 6);
    if (deep) {
      await setThumbnail(id, deep);
      return deep;
    }
    return null;
  }

  const media = await ensureCachedMedia(id);
  if (!media) return null;

  const dir = path.dirname(media.path);
  const mediaBase = path.basename(media.path, path.extname(media.path)).toLowerCase();
  const local = await findImageInDir(dir, mediaBase);
  if (local) {
    await setThumbnail(id, local);
    return local;
  }

  const parent = path.dirname(dir);
  if (parent && parent !== dir) {
    const parentHit = await findImageInDir(parent, mediaBase);
    if (parentHit) {
      await setThumbnail(id, parentHit);
      return parentHit;
    }
  }

  const recursive = await findImageRecursively(dir, mediaBase, 6);
  if (recursive) {
    await setThumbnail(id, recursive);
    return recursive;
  }

  return generateWithFfmpeg(id, media.path);
}
