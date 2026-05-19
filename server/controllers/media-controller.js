import path from "node:path";
import { promises as fs } from "node:fs";
import { buildCatalogFromLibrary, ensureCachedMedia } from "../services/catalog-service.js";
import { listFilesFromSources, listFoldersFromSources, listPathEntries, getSystemRoots } from "../services/filesystem-service.js";
import { ensureWithin, readMultipartFile, sendJson, streamMedia } from "../services/http-service.js";

export async function getCatalog({ res }) {
  const catalog = await buildCatalogFromLibrary();
  return sendJson(res, 200, { generatedAt: catalog.generatedAt, sources: catalog.sources, movies: catalog.movies, series: catalog.series });
}

export async function getFiles({ res, url }) {
  return sendJson(res, 200, { files: await listFilesFromSources(url.searchParams.get("mode") || "video") });
}

export async function uploadFile({ req, res, url }) {
  const category = url.searchParams.get("category") || "media";
  const valid = new Set(["media", "subtitle", "image", "trailer"]);
  if (!valid.has(category)) return sendJson(res, 400, { error: "Invalid upload category" });
  const { fileName, fileBuffer } = await readMultipartFile(req);
  const outDir = path.resolve(`data/uploads/${category}`);
  await fs.mkdir(outDir, { recursive: true });
  const outPath = ensureWithin(outDir, `${Date.now()}-${fileName}`);
  await fs.writeFile(outPath, fileBuffer);
  return sendJson(res, 200, { path: outPath, fileName });
}

export async function getFolders({ res }) { return sendJson(res, 200, { folders: await listFoldersFromSources() }); }
export async function getFsRoots({ res }) { return sendJson(res, 200, { roots: await getSystemRoots() }); }

export async function getFsList({ res, url }) {
  const targetPath = url.searchParams.get("path");
  if (!targetPath) return sendJson(res, 400, { error: "path is required" });
  const mode = url.searchParams.get("mode") || "all";
  return sendJson(res, 200, await listPathEntries(targetPath, mode));
}

export async function streamMediaById({ req, res, params }) {
  const media = await ensureCachedMedia(params.id);
  if (!media) return sendJson(res, 404, { error: "Media not found" });
  return streamMedia(req, res, media);
}
