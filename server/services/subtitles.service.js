const path = require('node:path');
const fs = require('node:fs/promises');
const dbModel = require('../models/db');
const catalogService = require('./catalog.service');
const utilService = require('./util.service');

const subtitleService = {
    list: async (id) => {
        const media = await catalogService.media(id);
        if (!media) return [];
        const library = await dbModel.getLibrary();
        const dir = path.dirname(media.path);
        const mediaBase = path.basename(media.path, path.extname(media.path)).toLowerCase();

        const entries = await fs.readdir(dir, { withFileTypes: true });
        const subtitleFiles = entries
            .filter((entry) => entry.isFile())
            .map((entry) => entry.name)
            .filter((name) => ['.srt', '.vtt'].includes(path.extname(name).toLowerCase()));

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

        for (const name of matched.length ? matched : subtitleFiles) add(path.join(dir, name));
        for (const movie of library.movies || []) if (movie.id === id && Array.isArray(movie.subtitles)) for (const subPath of movie.subtitles) add(subPath);
        for (const show of library.series || []) for (const season of show.seasons || []) for (const ep of season.episodes || []) if (ep.id === id && Array.isArray(ep.subtitles)) for (const subPath of ep.subtitles) add(subPath);

        return out.map((track, idx) => ({ ...track, id: String(idx) }));
    }
};

module.exports = subtitleService;
