import path from "node:path";
import { createReadStream, promises as fs } from "node:fs";
import { MIME } from "./media-utils.js";

export function sendJson(res, status, payload) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

export function ensureWithin(baseDir, fileName) {
  const safeName = path.basename(fileName).replace(/[^\w.\- ()[\]]+/g, "_");
  return path.join(baseDir, safeName);
}

export async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

export async function readMultipartFile(req) {
  const contentType = req.headers["content-type"] || "";
  const match = /boundary=(.+)$/.exec(contentType);
  if (!match) throw new Error("Invalid multipart request");
  const boundary = `--${match[1]}`;

  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const buffer = Buffer.concat(chunks);
  const raw = buffer.toString("binary");
  const parts = raw.split(boundary).filter((part) => part.includes("Content-Disposition"));
  if (!parts.length) throw new Error("No file payload found");

  const part = parts[0];
  const fileNameMatch = /filename=\"([^\"]+)\"/.exec(part);
  if (!fileNameMatch) throw new Error("No filename found");
  const fileName = fileNameMatch[1];

  const headerEnd = part.indexOf("\r\n\r\n");
  if (headerEnd === -1) throw new Error("Malformed multipart body");
  const dataStart = headerEnd + 4;
  const dataEnd = part.lastIndexOf("\r\n");
  const binaryBody = part.slice(dataStart, dataEnd);
  const fileBuffer = Buffer.from(binaryBody, "binary");

  return { fileName, fileBuffer };
}

export async function streamMedia(req, res, media) {
  const stat = await fs.stat(media.path);
  const total = stat.size;
  const range = req.headers.range;
  const contentType = MIME[path.extname(media.path).toLowerCase()] || "application/octet-stream";

  if (!range) {
    res.writeHead(200, { "Content-Type": contentType, "Content-Length": total, "Accept-Ranges": "bytes", "Content-Disposition": `inline; filename="${media.name}"` });
    createReadStream(media.path).pipe(res);
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
    "Content-Disposition": `inline; filename="${media.name}"`,
  });
  createReadStream(media.path, { start, end }).pipe(res);
}
