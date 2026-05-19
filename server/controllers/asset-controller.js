import path from "node:path";
import { promises as fs } from "node:fs";
import { readJsonBody, sendJson } from "../services/http-service.js";
import { resolveThumbnailPath } from "../services/thumbnails-service.js";
import { resolveSubtitlesForMedia } from "../services/subtitles-service.js";
import { srtToVtt } from "../services/media-utils-service.js";
import { dbModel } from "../models/db-model.js";

export async function getThumbnail({ res, params }) {
  const filePath = await resolveThumbnailPath(params.id);
  if (!filePath) return sendJson(res, 404, { error: "Thumbnail not found" });
  const ext = path.extname(filePath).toLowerCase();
  const contentType = ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg";
  const buf = await fs.readFile(filePath);
  res.writeHead(200, { "Content-Type": contentType, "Cache-Control": "no-store" });
  res.end(buf);
}

export async function setThumbnailFromDataUrl({ req, res, params }) {
  const body = await readJsonBody(req);
  if (!body.dataUrl || typeof body.dataUrl !== "string") return sendJson(res, 400, { error: "dataUrl is required" });
  const match = /^data:(image\/(?:jpeg|jpg|png|webp));base64,(.+)$/i.exec(body.dataUrl);
  if (!match) return sendJson(res, 400, { error: "Unsupported image format" });
  const ext = match[1].toLowerCase().includes("png") ? ".png" : match[1].toLowerCase().includes("webp") ? ".webp" : ".jpg";
  const outDir = path.resolve("data/thumbnails");
  await fs.mkdir(outDir, { recursive: true });
  const outPath = path.join(outDir, `${params.id}${ext}`);
  await fs.writeFile(outPath, Buffer.from(match[2], "base64"));
  await dbModel.setThumbnail(params.id, outPath);
  return sendJson(res, 200, { ok: true, path: outPath });
}

export async function listSubtitleTracks({ res, params }) {
  const tracks = await resolveSubtitlesForMedia(params.mediaId);
  return sendJson(res, 200, {
    tracks: tracks.map((track) => ({ id: track.id, label: track.label, lang: track.lang, ext: track.ext, url: `/api/subtitles/${params.mediaId}/${track.id}` })),
  });
}

export async function getSubtitleTrack({ res, params }) {
  const track = (await resolveSubtitlesForMedia(params.mediaId)).find((entry) => entry.id === params.trackId);
  if (!track) return sendJson(res, 404, { error: "Subtitle track not found" });
  const raw = await fs.readFile(track.path, "utf8");
  res.writeHead(200, { "Content-Type": "text/vtt; charset=utf-8" });
  res.end(track.ext === ".vtt" ? raw : srtToVtt(raw));
}
