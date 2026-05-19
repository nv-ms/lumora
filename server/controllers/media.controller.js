const path = require('node:path');
const fs = require('node:fs/promises');
const fileService = require('../services/files.service');
const catalogService = require('../services/catalog.service');
const httpService = require('../services/http.service');

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
                } catch {}
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
    }
};

module.exports = mediaController;
