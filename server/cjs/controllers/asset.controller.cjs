const path = require('node:path');
const fs = require('node:fs/promises');
const { getModules } = require('../services/esm-bridge.cjs');

async function getThumbnail(req, res, next) {
  try {
    const { thumbnailsService } = await getModules();
    const filePath = await thumbnailsService.resolveThumbnailPath(req.params.id);
    if (!filePath) return res.status(404).json({ error: 'Thumbnail not found' });
    const ext = path.extname(filePath).toLowerCase();
    const contentType = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
    const buf = await fs.readFile(filePath);
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).send(buf);
  } catch (error) { next(error); }
}

async function setThumbnail(req, res, next) {
  try {
    const { db } = await getModules();
    const dataUrl = req.body?.dataUrl;
    if (!dataUrl || typeof dataUrl !== 'string') return res.status(400).json({ error: 'dataUrl is required' });
    const match = /^data:(image\/(?:jpeg|jpg|png|webp));base64,(.+)$/i.exec(dataUrl);
    if (!match) return res.status(400).json({ error: 'Unsupported image format' });
    const ext = match[1].toLowerCase().includes('png') ? '.png' : match[1].toLowerCase().includes('webp') ? '.webp' : '.jpg';
    const outDir = path.resolve('data/thumbnails');
    await fs.mkdir(outDir, { recursive: true });
    const outPath = path.join(outDir, `${req.params.id}${ext}`);
    await fs.writeFile(outPath, Buffer.from(match[2], 'base64'));
    await db.setThumbnail(req.params.id, outPath);
    res.status(200).json({ ok: true, path: outPath });
  } catch (error) { next(error); }
}

async function listSubtitles(req, res, next) {
  try {
    const { subtitlesService } = await getModules();
    const tracks = await subtitlesService.resolveSubtitlesForMedia(req.params.mediaId);
    res.status(200).json({ tracks: tracks.map((track) => ({ id: track.id, label: track.label, lang: track.lang, ext: track.ext, url: `/api/subtitles/${req.params.mediaId}/${track.id}` })) });
  } catch (error) { next(error); }
}

async function getSubtitleTrack(req, res, next) {
  try {
    const { subtitlesService, mediaUtils } = await getModules();
    const track = (await subtitlesService.resolveSubtitlesForMedia(req.params.mediaId)).find((entry) => entry.id === req.params.trackId);
    if (!track) return res.status(404).json({ error: 'Subtitle track not found' });
    const raw = await fs.readFile(track.path, 'utf8');
    res.setHeader('Content-Type', 'text/vtt; charset=utf-8');
    return res.status(200).send(track.ext === '.vtt' ? raw : mediaUtils.srtToVtt(raw));
  } catch (error) { next(error); }
}

module.exports = { getThumbnail, setThumbnail, listSubtitles, getSubtitleTrack };
