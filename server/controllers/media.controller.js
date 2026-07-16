const path = require('node:path');
const fs = require('node:fs/promises');
const fileService = require('../services/files.service');
const catalogService = require('../services/catalog.service');
const httpService = require('../services/http.service');
const probeService = require('../services/media-probe.service');
const policy = require('../services/playback-policy.service');
const renditionService = require('../services/rendition.service');

const mediaController = {
    files: async (req, res, next) => {
        try {
            return res.status(200).json({ files: await fileService.list(req.query.mode || 'video') });
        } catch (error) {
            return next(error);
        }
    },

    upload: async (req, res, next) => {
        try {
            const category = req.query.category || 'media';
            if (!new Set(['media', 'subtitle', 'image', 'trailer']).has(category)) {
                return res.status(400).json({ error: 'Invalid upload category' });
            }
            const { fileName, fileBuffer } = await httpService.readMultipart(req);
            const outDir = path.resolve(`data/uploads/${category}`);
            await fs.mkdir(outDir, { recursive: true });
            const outPath = httpService.safePath(outDir, `${Date.now()}-${fileName}`);
            await fs.writeFile(outPath, fileBuffer);
            return res.status(200).json({ path: outPath, fileName });
        } catch (error) {
            return next(error);
        }
    },

    folders: async (req, res) => res.status(200).json({ folders: [] }),

    roots: async (req, res, next) => {
        try {
            const roots = [];
            for (let code = 67; code <= 90; code += 1) {
                const drive = `${String.fromCharCode(code)}:/`;
                try {
                    await fs.access(drive);
                    roots.push(drive.replace('/', '\\'));
                } catch { /* drive is unavailable */ }
            }
            if (!roots.length) roots.push(path.parse(process.cwd()).root);
            return res.status(200).json({ roots });
        } catch (error) {
            return next(error);
        }
    },

    listFs: async (req, res, next) => {
        try {
            const targetPath = req.query.path;
            if (!targetPath) return res.status(400).json({ error: 'path is required' });
            const mode = req.query.mode || 'all';
            const entries = await fs.readdir(targetPath, { withFileTypes: true });
            const dirs = [];
            const files = [];
            for (const entry of entries) {
                const full = path.join(targetPath, entry.name);
                if (entry.isDirectory()) {
                    dirs.push({ name: entry.name, path: full, type: 'dir' });
                    continue;
                }
                if (!entry.isFile()) continue;
                const ext = path.extname(entry.name).toLowerCase();
                const isVideo = ['.mp4', '.mkv', '.avi', '.mov', '.m4v', '.webm', '.wmv', '.flv'].includes(ext);
                const isSubtitle = ['.srt', '.vtt'].includes(ext);
                const isImage = ['.jpg', '.jpeg', '.png', '.webp'].includes(ext);
                const allowed = mode === 'all' || (mode === 'video' && isVideo) || (mode === 'subtitle' && isSubtitle) || (mode === 'image' && isImage) || (mode === 'trailer' && isVideo);
                if (!allowed) continue;
                files.push({ name: entry.name, path: full, type: 'file', ext });
            }
            dirs.sort((a, b) => a.name.localeCompare(b.name));
            files.sort((a, b) => a.name.localeCompare(b.name));
            return res.status(200).json({ dirs, files });
        } catch (error) {
            return next(error);
        }
    },

    stream: async (req, res, next) => {
        try {
            const media = await catalogService.media(req.params.id);
            if (!media) return res.status(404).json({ error: 'Media not found' });
            await httpService.stream(req, res, media);
            return undefined;
        } catch (error) {
            return next(error);
        }
    },

    playback: async (req, res, next) => {
        try {
            const media = await catalogService.media(req.params.id);
            if (!media) return res.status(404).json({ error: 'Media not found' });
            const metadata = await probeService.probe(media.path);
            const requested = req.method === 'POST' && req.body.audioStreamIndex !== undefined ? Number(req.body.audioStreamIndex) : undefined;
            const decision = policy.evaluate(metadata, requested);
            const selectedAudio = decision.audio?.index ?? null;
            const base = { probeState: metadata.error ? 'failed' : 'complete', compatibility: { method: decision.method, reason: decision.reason }, duration: metadata.duration || 0, audioTracks: metadata.audio || [], subtitles: metadata.subtitles || [], selectedAudioStreamIndex: selectedAudio };
            if (req.method === 'GET') return res.status(200).json(base);
            if (decision.method === 'reject') return res.status(422).json({ ...base, failure: metadata.error || { code: decision.reason, message: 'Media cannot be played' } });
            if (decision.method === 'direct') return res.status(200).json({ ...base, state: 'complete', playbackUrl: `/api/media/${req.params.id}` });
            const rendition = await renditionService.prepare({ mediaId: req.params.id, source: media.path, metadata, decision });
            return res.status(['playable', 'complete'].includes(rendition.state) ? 200 : 202).json({ ...base, ...rendition, pollingUrl: `/api/media/${req.params.id}/playback/${rendition.renditionId}` });
        } catch (error) {
            return next(error);
        }
    },

    playbackState: async (req, res, next) => {
        try { const state = await renditionService.get(req.params.renditionId); return state ? res.status(200).json(state) : res.status(404).json({ error: 'Rendition not found' }); } catch (error) { return next(error); }
    },

    renditionAsset: async (req, res, next) => {
        try {
            const asset = await renditionService.asset(req.params.renditionId, req.params.fileName);
            if (!asset) return res.status(404).json({ error: 'Rendition asset not found' });
            const ext = path.extname(asset.target); const type = ext === '.m3u8' ? 'application/vnd.apple.mpegurl' : ext === '.mp4' ? 'video/mp4' : 'video/iso.segment';
            res.setHeader('Content-Type', type); res.setHeader('Cache-Control', ext === '.m3u8' ? 'no-cache' : asset.complete ? 'public, max-age=31536000, immutable' : 'no-cache');
            return res.sendFile(asset.target);
        } catch (error) { return next(error); }
    },

    embeddedSubtitle: async (req, res, next) => {
        try {
            const media = await catalogService.media(req.params.id); if (!media) return res.status(404).json({ error: 'Media not found' });
            const target = await probeService.extractSubtitle(media.path, Number(req.params.streamIndex));
            if (!target) return res.status(422).json({ error: 'Embedded subtitle is unsupported' });
            res.setHeader('Content-Type', 'text/vtt; charset=utf-8'); res.setHeader('Cache-Control', 'public, max-age=31536000, immutable'); return res.sendFile(target);
        } catch (error) { return next(error); }
    }
};

module.exports = mediaController;
