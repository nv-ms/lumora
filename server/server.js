import { createReadStream } from "node:fs";
import { promises as fs } from "node:fs";
import http from "node:http";
import path from "node:path";
import { buildCatalog } from "./catalog.js";
import { readDb, setSources, updatePlayback } from "./db.js";

const PORT = Number(process.env.PORT || 8787);
const MIME = {
  ".mp4": "video/mp4",
  ".mkv": "video/x-matroska",
  ".avi": "video/x-msvideo",
  ".mov": "video/quicktime",
  ".m4v": "video/x-m4v",
  ".webm": "video/webm",
  ".wmv": "video/x-ms-wmv",
  ".flv": "video/x-flv",
};

let cache = { generatedAt: null, sources: [], movies: [], series: [], fileMap: new Map() };

async function refreshCatalog() {
  const db = await readDb();
  cache = await buildCatalog(db.sources, db.playback);
  return cache;
}

function sendJson(res, status, payload) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

async function streamMedia(req, res, id) {
  if (!cache.fileMap.has(id)) await refreshCatalog();
  const file = cache.fileMap.get(id);
  if (!file) return sendJson(res, 404, { error: "Media not found" });

  const stat = await fs.stat(file.path);
  const total = stat.size;
  const range = req.headers.range;
  const contentType = MIME[path.extname(file.path).toLowerCase()] || "application/octet-stream";

  if (!range) {
    res.writeHead(200, {
      "Content-Type": contentType,
      "Content-Length": total,
      "Accept-Ranges": "bytes",
      "Content-Disposition": `inline; filename="${file.name}"`,
    });
    createReadStream(file.path).pipe(res);
    return;
  }

  const match = /bytes=(\d+)-(\d*)/.exec(range);
  if (!match) {
    res.writeHead(416, { "Content-Range": `bytes */${total}` });
    res.end();
    return;
  }

  const start = Number(match[1]);
  const end = match[2] ? Number(match[2]) : total - 1;
  if (start >= total || end >= total) {
    res.writeHead(416, { "Content-Range": `bytes */${total}` });
    res.end();
    return;
  }

  res.writeHead(206, {
    "Content-Type": contentType,
    "Content-Length": end - start + 1,
    "Accept-Ranges": "bytes",
    "Content-Range": `bytes ${start}-${end}/${total}`,
    "Content-Disposition": `inline; filename="${file.name}"`,
  });
  createReadStream(file.path, { start, end }).pipe(res);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host}`);

  try {
    if (url.pathname === "/api/health") return sendJson(res, 200, { ok: true });

    if (url.pathname === "/api/catalog" && req.method === "GET") {
      const catalog = await refreshCatalog();
      return sendJson(res, 200, { generatedAt: catalog.generatedAt, sources: catalog.sources, movies: catalog.movies, series: catalog.series });
    }

    if (url.pathname === "/api/sources" && req.method === "GET") {
      const db = await readDb();
      return sendJson(res, 200, { sources: db.sources });
    }

    if (url.pathname === "/api/sources" && req.method === "POST") {
      const body = await readJsonBody(req);
      if (!body.path || typeof body.path !== "string") return sendJson(res, 400, { error: "path is required" });
      const db = await readDb();
      const sources = await setSources([...db.sources, body.path]);
      return sendJson(res, 200, { sources });
    }

    if (url.pathname === "/api/sources" && req.method === "DELETE") {
      const target = url.searchParams.get("path");
      const db = await readDb();
      const sources = await setSources(db.sources.filter((entry) => entry !== target));
      return sendJson(res, 200, { sources });
    }

    if (url.pathname.startsWith("/api/playback/") && req.method === "PATCH") {
      const id = url.pathname.split("/").pop();
      const body = await readJsonBody(req);
      const playback = await updatePlayback(id, {
        progress: Number(body.progress || 0),
        currentTime: Number(body.currentTime || 0),
        duration: Number(body.duration || 0),
      });
      return sendJson(res, 200, { playback });
    }

    if (url.pathname.startsWith("/api/media/") && req.method === "GET") {
      const id = url.pathname.split("/").pop();
      return streamMedia(req, res, id);
    }

    sendJson(res, 404, { error: "Not found" });
  } catch (error) {
    sendJson(res, 500, { error: error.message || "Server error" });
  }
});

server.listen(PORT, () => {
  console.log(`Media server listening on http://localhost:${PORT}`);
});
