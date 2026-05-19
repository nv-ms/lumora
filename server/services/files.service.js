const path = require('node:path');
const fs = require('node:fs/promises');
const dbModel = require('../models/db');
const utilService = require('./util.service');

const fileService = {
    list: async (mode = 'video') => {
        const data = await dbModel.read();
        const out = [];
        const seen = new Set();

        const allowVideo = mode === 'video' || mode === 'all';
        const allowSubtitle = mode === 'subtitle' || mode === 'all';
        const allowImage = mode === 'image' || mode === 'all';
        const allowTrailer = mode === 'trailer' || mode === 'all';

        const walk = async (dir) => {
            let entries = [];
            try {
                entries = await fs.readdir(dir, { withFileTypes: true });
            } catch {
                return;
            }

            for (const entry of entries) {
                const fullPath = path.join(dir, entry.name);
                if (entry.isDirectory()) {
                    await walk(fullPath);
                    continue;
                }
                if (!entry.isFile()) continue;

                const ext = path.extname(entry.name).toLowerCase();
                const isVideo = utilService.videoExts.has(ext);
                const isSubtitle = ext === '.srt' || ext === '.vtt';
                const isImage = utilService.imageExts.has(ext);
                const allowed =
                    (allowVideo && isVideo) ||
                    (allowSubtitle && isSubtitle) ||
                    (allowImage && isImage) ||
                    (allowTrailer && isVideo);
                if (!allowed) continue;

                const key = utilService.norm(fullPath);
                if (seen.has(key)) continue;
                seen.add(key);

                out.push({
                    path: fullPath,
                    name: entry.name,
                    ext,
                    folder: path.dirname(fullPath)
                });
            }
        };

        for (const source of data.sources) {
            await walk(path.resolve(source));
        }

        out.sort((a, b) => a.path.localeCompare(b.path));
        return out;
    }
};

module.exports = fileService;
