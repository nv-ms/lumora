const path = require('node:path');
const fs = require('node:fs/promises');
const dbModel = require('../models/db');
const utilService = require('./util.service');
const probeService = require('./media-probe.service');

const catalogService = {
    cache: { generatedAt: null, sources: [], movies: [], series: [], map: new Map() },

    row: async (base, playback) => {
        const stat = await fs.stat(base.filePath).catch(() => null);
        return {
            id: base.id,
            kind: base.kind,
            title: base.title,
            number: base.number,
            season: base.season,
            seriesId: base.seriesId,
            path: base.filePath,
            extension: path.extname(base.filePath).toLowerCase(),
            size: stat?.size || 0,
            modifiedAt: stat?.mtime?.toISOString() || base.updatedAt || base.createdAt || '',
            poster: utilService.hue(base.filePath),
            streamUrl: `/api/media/${base.id}`,
            thumbnailUrl: `/api/thumbnail/${base.id}`,
            subtitles: Array.isArray(base.subtitles) ? base.subtitles : [],
            trailerPath: base.trailerPath || '',
            available: base.available !== false && stat !== null,
            progress: playback?.progress,
            lastWatchedAt: playback?.lastWatchedAt,
            currentTime: playback?.currentTime,
            duration: playback?.duration
        };
    },

    build: async () => {
        const data = await dbModel.read();
        const library = await dbModel.getLibrary();
        const map = new Map();
        const movies = [];
        const series = [];

        for (const movie of library.movies) {
            const row = await catalogService.row(movie, data.playback[movie.id]);
            movies.push(row);
            if (row.available) map.set(row.id, { path: row.path, name: path.basename(row.path) });
        }

        for (const show of library.series) {
            const seasons = [];
            for (const season of show.seasons || []) {
                const episodes = [];
                for (const episode of season.episodes || []) {
                    const row = await catalogService.row(episode, data.playback[episode.id]);
                    episodes.push(row);
                    if (row.available) map.set(row.id, { path: row.path, name: path.basename(row.path) });
                }
                episodes.sort((a, b) => (a.number ?? 0) - (b.number ?? 0));
                seasons.push({ number: season.number, episodes });
            }
            seasons.sort((a, b) => a.number - b.number);
            series.push({
                id: show.id,
                kind: 'series',
                title: show.title,
                poster: utilService.hue(show.title),
                seasons,
                sourceFolder: show.sourceFolder || '',
                subtitles: Array.isArray(show.subtitles) ? show.subtitles : [],
                trailerPath: show.trailerPath || '',
                available: show.available !== false,
                thumbnailUrl: `/api/thumbnail/${show.id}`,
                path: show.sourceFolder || ''
            });
        }

        movies.sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt));
        series.sort((a, b) => a.title.localeCompare(b.title));

        catalogService.cache = {
            generatedAt: new Date().toISOString(),
            sources: data.sources,
            movies,
            series,
            map
        };

        for (const media of map.values()) probeService.probe(media.path).catch(() => {});

        return catalogService.cache;
    },

    media: async (id) => {
        if (!catalogService.cache.map.has(id)) {
            await catalogService.build();
        }
        return catalogService.cache.map.get(id);
    }
};

module.exports = catalogService;
