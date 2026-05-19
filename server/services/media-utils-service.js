import path from "node:path";

export const MIME = {
  ".mp4": "video/mp4",
  ".mkv": "video/x-matroska",
  ".avi": "video/x-msvideo",
  ".mov": "video/quicktime",
  ".m4v": "video/x-m4v",
  ".webm": "video/webm",
  ".wmv": "video/x-ms-wmv",
  ".flv": "video/x-flv",
};

export const VIDEO_EXTS = new Set(Object.keys(MIME));
export const IMAGE_EXTS = new Set([".jpg", ".jpeg", ".png", ".webp"]);

export function normalizePath(value) {
  return path.resolve(value).replace(/[\\/]+/g, "/").toLowerCase();
}

export function hueFor(seed) {
  let hash = 0;
  for (let idx = 0; idx < seed.length; idx += 1) hash = (hash << 5) - hash + seed.charCodeAt(idx);
  return String(Math.abs(hash) % 360);
}

export function subtitleLangFromName(fileName) {
  const lower = fileName.toLowerCase();
  if (lower.includes(".en.")) return "en";
  if (lower.includes(".es.")) return "es";
  if (lower.includes(".fr.")) return "fr";
  return "und";
}

export function parseEpisode(fileName) {
  const match = /S(\d{1,2})E(\d{1,2})/i.exec(fileName);
  if (!match) return null;
  return { season: Number(match[1]), episode: Number(match[2]) };
}

function escapeVttText(value) {
  return value.replace(/\r/g, "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function toVttTimestamp(srtTime) {
  return srtTime.replace(",", ".");
}

export function srtToVtt(srt) {
  const normalized = srt.replace(/\r/g, "").trim();
  const blocks = normalized.split(/\n\n+/);
  const cues = blocks
    .map((block) => {
      const lines = block.split("\n");
      if (!lines.length) return null;
      const timeLine = lines[0].includes("-->") ? lines[0] : lines[1];
      if (!timeLine || !timeLine.includes("-->")) return null;
      const [startRaw, endRaw] = timeLine.split("-->").map((entry) => entry.trim());
      const textStart = lines[0].includes("-->") ? 1 : 2;
      const text = lines.slice(textStart).join("\n").trim();
      if (!text) return null;
      return `${toVttTimestamp(startRaw)} --> ${toVttTimestamp(endRaw)}\n${escapeVttText(text)}`;
    })
    .filter(Boolean);
  return `WEBVTT\n\n${cues.join("\n\n")}\n`;
}
