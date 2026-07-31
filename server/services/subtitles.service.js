const path = require('node:path');
const fs = require('node:fs/promises');
const dbModel = require('../models/db');
const catalogService = require('./catalog.service');
const utilService = require('./util.service');

const subtitleExts = new Set(['.srt', '.vtt']);

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
                if (entry.isFile() && subtitleExts.has(path.extname(entry.name).toLowerCase())) out.push(full);
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
        let movie = null;
        let show = null;
        let season = null;
        let episode = null;

        movie = (library.movies || []).find((entry) => entry.id === id) || null;
        for (const candidate of library.series || []) {
            for (const candidateSeason of candidate.seasons || []) {
                const candidateEpisode = (candidateSeason.episodes || []).find((entry) => entry.id === id);
                if (!candidateEpisode) continue;
                show = candidate;
                season = candidateSeason;
                episode = candidateEpisode;
            }
        }

        const out = [];
        const seen = new Set();

        const add = (filePath) => {
            const key = utilService.norm(filePath);
            if (seen.has(key)) return;
            seen.add(key);

            const fileName = path.basename(filePath);
            const ext = path.extname(fileName).toLowerCase();
            if (!subtitleExts.has(ext)) return;

            out.push({
                fileName,
                path: filePath,
                ext,
                label: fileName.replace(ext, ''),
                lang: utilService.subtitleLang(fileName)
            });
        };

        const matchesEpisode = (filePath, root = '') => {
            const relative = (root ? path.relative(root, filePath) : filePath).toLowerCase();
            const compactFile = path.basename(filePath, path.extname(filePath)).toLowerCase().replace(/[^a-z0-9]+/g, '');
            const compactMedia = mediaBase.replace(/[^a-z0-9]+/g, '');
            if (compactMedia && compactFile.includes(compactMedia)) return true;
            if (!episode) return false;

            const seasonNumber = Number(season?.number || episode.season || 0);
            const episodeNumber = Number(episode.number || 0);
            const markers = [
                `s${String(seasonNumber).padStart(2, '0')}e${String(episodeNumber).padStart(2, '0')}`,
                `s${seasonNumber}e${episodeNumber}`,
                `${seasonNumber}x${String(episodeNumber).padStart(2, '0')}`,
                `${seasonNumber}x${episodeNumber}`,
                `e${String(episodeNumber).padStart(2, '0')}`,
                `ep${String(episodeNumber).padStart(2, '0')}`,
                `episode ${String(episodeNumber).padStart(2, '0')}`,
                `episode ${episodeNumber}`
            ];
            const normalized = relative.replace(/[^a-z0-9]+/g, ' ');
            return markers.some((marker) => new RegExp(`(^|\\s)${marker}(\\s|$)`, 'i').test(normalized));
        };

        const addSelections = async (selections, directoryMode) => {
            for (const selectedPath of Array.isArray(selections) ? selections : []) {
                const stat = await fs.stat(selectedPath).catch(() => null);
                if (stat?.isFile()) {
                    add(selectedPath);
                    continue;
                }
                if (!stat?.isDirectory()) continue;
                const files = await subtitleService.walkSubs(selectedPath, 8);
                for (const filePath of files) {
                    if (directoryMode === 'all' || matchesEpisode(filePath, selectedPath)) add(filePath);
                }
            }
        };

        const nearby = await subtitleService.walkSubs(dir, 2);
        const nearbyMatches = nearby.filter((filePath) => matchesEpisode(filePath, dir));
        for (const filePath of nearbyMatches) add(filePath);

        if (!nearbyMatches.length) {
            const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
            const videoCount = entries.filter((entry) => entry.isFile() && utilService.videoExts.has(path.extname(entry.name).toLowerCase())).length;
            if (videoCount === 1) for (const filePath of nearby) add(filePath);
        }

        await addSelections(movie?.subtitles, 'all');
        await addSelections(show?.subtitles, 'match');
        await addSelections(season?.subtitles, 'match');
        await addSelections(episode?.subtitles, 'all');

        return out.map((track, idx) => ({ ...track, id: String(idx) }));
    }
};

module.exports = subtitleService;
