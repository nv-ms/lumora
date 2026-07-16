const path = require('node:path');
const fs = require('node:fs/promises');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const ffmpegStatic = require('ffmpeg-static');
const dbModel = require('../models/db');
const catalogService = require('./catalog.service');

const exec = promisify(execFile);

const thumbnailService = {
    findInDir: async (dir, base) => {
        let entries = [];
        try { entries = await fs.readdir(dir, { withFileTypes: true }); } catch { return null; }
        const files = entries.filter((x) => x.isFile()).map((x) => x.name).filter((x) => ['.jpg', '.jpeg', '.png', '.webp'].includes(path.extname(x).toLowerCase()));
        const match = files.find((x) => x.toLowerCase().startsWith(base) || x.toLowerCase().includes(base));
        if (match) return path.join(dir, match);
        for (const name of ['poster.jpg', 'poster.jpeg', 'poster.png', 'cover.jpg', 'cover.jpeg', 'cover.png', 'folder.jpg', 'thumb.jpg', 'thumbnail.jpg']) {
            const full = path.join(dir, name);
            try { await fs.access(full); return full; } catch { /* try next extension */ }
        }
        return null;
    },

    findDeep: async (root, base, maxDepth = 4) => {
        const q = [{ dir: root, depth: 0 }];
        while (q.length) {
            const item = q.shift();
            const hit = await thumbnailService.findInDir(item.dir, base);
            if (hit) return hit;
            if (item.depth >= maxDepth) continue;
            let entries = [];
            try { entries = await fs.readdir(item.dir, { withFileTypes: true }); } catch { continue; }
            for (const entry of entries) if (entry.isDirectory()) q.push({ dir: path.join(item.dir, entry.name), depth: item.depth + 1 });
        }
        return null;
    },

    grabFrame: async (id, mediaPath) => {
        try {
            const outDir = path.resolve('data/thumbnails/auto');
            await fs.mkdir(outDir, { recursive: true });
            const outPath = path.join(outDir, `${id}.jpg`);
            const ffmpegPath = process.env.FFMPEG_PATH || ffmpegStatic;
            await exec(ffmpegPath, ['-y', '-ss', '00:00:03', '-i', mediaPath, '-frames:v', '1', '-vf', 'scale=640:-1', outPath], { windowsHide: true });
            await fs.access(outPath);
            await dbModel.setThumbnail(id, outPath);
            return outPath;
        } catch {
            return null;
        }
    },

    resolve: async (id) => {
        const library = await dbModel.getLibrary();
        const custom = await dbModel.getThumbnail(id);
        if (custom) {
            try { await fs.access(custom); return custom; } catch { /* generate a thumbnail */ }
        }

        let mediaEntry = null;
        let kind = '';
        for (const movie of library.movies || []) if (movie.id === id) { mediaEntry = movie; kind = 'movie'; }
        if (!mediaEntry) {
            for (const show of library.series || []) {
                if (show.id === id) { mediaEntry = show; kind = 'series'; break; }
                for (const season of show.seasons || []) {
                    for (const ep of season.episodes || []) {
                        if (ep.id === id) { mediaEntry = ep; kind = 'episode'; break; }
                    }
                    if (mediaEntry) break;
                }
                if (mediaEntry) break;
            }
        }
        if (!mediaEntry) return null;

        if (mediaEntry.thumbnailPath) {
            try {
                const thumb = path.isAbsolute(mediaEntry.thumbnailPath) ? mediaEntry.thumbnailPath : path.resolve(mediaEntry.thumbnailPath);
                await fs.access(thumb);
                await dbModel.setThumbnail(id, thumb);
                return thumb;
            } catch { /* try the next seek position */ }
        }

        if (kind === 'series') {
            let baseDir = mediaEntry.sourceFolder ? path.resolve(mediaEntry.sourceFolder) : '';
            let firstPlayable = '';
            if (!baseDir && Array.isArray(mediaEntry.seasons)) {
                const firstEp = mediaEntry.seasons.flatMap((s) => s.episodes || []).find((ep) => ep?.filePath);
                if (firstEp?.filePath) baseDir = path.dirname(firstEp.filePath);
                if (firstEp?.filePath) firstPlayable = firstEp.filePath;
            } else if (Array.isArray(mediaEntry.seasons)) {
                const firstEp = mediaEntry.seasons.flatMap((s) => s.episodes || []).find((ep) => ep?.filePath);
                if (firstEp?.filePath) firstPlayable = firstEp.filePath;
            }
            if (!baseDir) return null;
            const direct = await thumbnailService.findInDir(baseDir, String(mediaEntry.title || '').toLowerCase());
            if (direct) { await dbModel.setThumbnail(id, direct); return direct; }
            const deep = await thumbnailService.findDeep(baseDir, String(mediaEntry.title || '').toLowerCase(), 6);
            if (deep) { await dbModel.setThumbnail(id, deep); return deep; }
            if (firstPlayable) return thumbnailService.grabFrame(id, firstPlayable);
            return null;
        }

        const media = await catalogService.media(id);
        if (!media) return null;
        const dir = path.dirname(media.path);
        const base = path.basename(media.path, path.extname(media.path)).toLowerCase();

        const local = await thumbnailService.findInDir(dir, base);
        if (local) { await dbModel.setThumbnail(id, local); return local; }

        const parent = path.dirname(dir);
        if (parent && parent !== dir) {
            const parentHit = await thumbnailService.findInDir(parent, base);
            if (parentHit) { await dbModel.setThumbnail(id, parentHit); return parentHit; }
        }

        const deep = await thumbnailService.findDeep(dir, base, 6);
        if (deep) { await dbModel.setThumbnail(id, deep); return deep; }

        return thumbnailService.grabFrame(id, media.path);
    }
};

module.exports = thumbnailService;
