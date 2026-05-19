const path = require('node:path');
const fs = require('node:fs/promises');
const dbModel = require('../models/db');
const catalogService = require('./catalog.service');
const utilService = require('./util.service');

const subtitleService = {
    walkSubs: async (root, maxDepth = 3) => {
        const out = [];
        const q = [{ dir: root, depth: 0 }];
        while (q.length) {
            const node = q.shift();
            let entries = [];
            try { entries = await fs.readdir(node.dir, { withFileTypes: true }); } catch { continue; }
            for (const entry of entries) {
                const full = path.join(node.dir, entry.name);
                if (entry.isFile() && ['.srt', '.vtt'].includes(path.extname(entry.name).toLowerCase())) out.push(full);
                if (entry.isDirectory() && node.depth < maxDepth) q.push({ dir: full, depth: node.depth + 1 });
            }
        }
        return out;
    },

    list: async (id) => {
        const media = await catalogService.media(id);
        if (!media) return [];
        const library = await dbModel.getLibrary();
        const dir = path.dirname(media.path);
        const mediaBase = path.basename(media.path, path.extname(media.path)).toLowerCase();

        const allSubs = await subtitleService.walkSubs(dir, 4);
        const subtitleFiles = allSubs.map((filePath) => path.basename(filePath));

        const matched = subtitleFiles.filter((name) => {
            const lower = name.toLowerCase();
            return lower.startsWith(mediaBase) || lower.includes(mediaBase);
        });

        const out = [];
        const seen = new Set();

        const add = (filePath) => {
            const key = utilService.norm(filePath);
            if (seen.has(key)) return;
            seen.add(key);

            const fileName = path.basename(filePath);
            const ext = path.extname(fileName).toLowerCase();
            if (!['.srt', '.vtt'].includes(ext)) return;

            out.push({
                fileName,
                path: filePath,
                ext,
                label: fileName.replace(ext, ''),
                lang: utilService.subtitleLang(fileName)
            });
        };

        if (matched.length) {
            for (const filePath of allSubs) {
                const name = path.basename(filePath);
                const lower = name.toLowerCase();
                if (lower.startsWith(mediaBase) || lower.includes(mediaBase)) add(filePath);
            }
        } else {
            for (const filePath of allSubs) add(filePath);
        }

        for (const movie of library.movies || []) if (movie.id === id && Array.isArray(movie.subtitles)) for (const subPath of movie.subtitles) add(subPath);
        for (const show of library.series || []) {
            for (const season of show.seasons || []) {
                for (const ep of season.episodes || []) {
                    if (ep.id !== id) continue;
                    if (Array.isArray(show.subtitles)) for (const subPath of show.subtitles) add(subPath);
                    if (Array.isArray(ep.subtitles)) for (const subPath of ep.subtitles) add(subPath);
                }
            }
        }

        return out.map((track, idx) => ({ ...track, id: String(idx) }));
    }
};

module.exports = subtitleService;
