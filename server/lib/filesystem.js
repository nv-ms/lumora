import path from "node:path";
import { promises as fs } from "node:fs";
import { readDb } from "../db.js";
import { IMAGE_EXTS, VIDEO_EXTS, normalizePath } from "./media-utils.js";

export async function listFilesFromSources(mode = "video") {
  const db = await readDb();
  const out = [];
  const seen = new Set();
  const allowVideo = mode === "video" || mode === "all";
  const allowSubtitle = mode === "subtitle" || mode === "all";
  const allowImage = mode === "image" || mode === "all";
  const allowTrailer = mode === "trailer" || mode === "all";

  async function walk(dir) {
    let entries = [];
    try { entries = await fs.readdir(dir, { withFileTypes: true }); } catch { return; }
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
      const isImage = IMAGE_EXTS.has(ext);
      const allowed = (allowVideo && isVideo) || (allowSubtitle && isSubtitle) || (allowImage && isImage) || (allowTrailer && isVideo);
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

export async function listFoldersFromSources() {
  const db = await readDb();
  const out = [];
  const seen = new Set();
  for (const source of db.sources) {
    const root = path.resolve(source);
    let entries = [];
    try { entries = await fs.readdir(root, { withFileTypes: true }); } catch { continue; }
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

export async function getSystemRoots() {
  const roots = [];
  for (let code = 67; code <= 90; code += 1) {
    const drive = `${String.fromCharCode(code)}:/`;
    try {
      await fs.access(drive);
      roots.push(drive.replace("/", "\\"));
    } catch {}
  }
  if (!roots.length) roots.push(path.parse(process.cwd()).root);
  return roots;
}

export async function listPathEntries(targetPath, mode = "all") {
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
    const isImage = IMAGE_EXTS.has(ext);
    const allowed = mode === "all" || (mode === "video" && isVideo) || (mode === "subtitle" && isSubtitle) || (mode === "image" && isImage) || (mode === "trailer" && isVideo);
    if (!allowed) continue;
    files.push({ name: entry.name, path: full, type: "file", ext });
  }
  dirs.sort((a, b) => a.name.localeCompare(b.name));
  files.sort((a, b) => a.name.localeCompare(b.name));
  return { dirs, files };
}
