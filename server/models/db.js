const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const storagePath = require('../storage');

const dbFile = storagePath('catalog-db.json');
const baseDb = {
    sources: [],
    playback: {},
    thumbnails: {},
    library: { movies: [], series: [] }
};

const dbModel = {
    ensure: async () => {
        try {
            await fs.access(dbFile);
        } catch {
            await fs.mkdir(path.dirname(dbFile), { recursive: true });
            await fs.writeFile(dbFile, JSON.stringify(baseDb, null, 2), 'utf8');
        }
    },
    cleanLibrary: (library) => {
        const movies = Array.isArray(library?.movies) ? library.movies : [];
        const series = Array.isArray(library?.series) ? library.series : [];
        for (const movie of movies) {
            if (!movie.id) movie.id = dbModel.makeId('movie', `${movie.title}|${movie.filePath}`);
        }
        for (const show of series) {
            if (!show.id) show.id = dbModel.makeId('series', `${show.title}|${show.sourceFolder}`);
            for (const season of show.seasons || []) {
                for (const episode of season.episodes || []) {
                    if (!episode.id) episode.id = dbModel.makeId('episode', `${show.id}|${season.number}|${episode.number}|${episode.filePath}`);
                    episode.seriesId = show.id;
                    episode.season = season.number;
                }
            }
        }
        return { movies, series };
    },
    read: async () => {
        await dbModel.ensure();
        const raw = await fs.readFile(dbFile, 'utf8');
        const data = JSON.parse(raw);
        return {
            sources: Array.isArray(data.sources) ? data.sources : baseDb.sources,
            playback: data.playback && typeof data.playback === 'object' ? data.playback : {},
            thumbnails: data.thumbnails && typeof data.thumbnails === 'object' ? data.thumbnails : {},
            library: dbModel.cleanLibrary(data.library)
        };
    },
    write: async (data) => {
        await fs.mkdir(path.dirname(dbFile), { recursive: true });
        await fs.writeFile(dbFile, JSON.stringify(data, null, 2), 'utf8');
    },
    makeId: (prefix, seed) => `${prefix}-${crypto.createHash('sha1').update(seed).digest('hex').slice(0, 12)}`,
    setSources: async (sources) => {
        const data = await dbModel.read();
        data.sources = [...new Set(sources.map((source) => source.trim()).filter(Boolean))];
        await dbModel.write(data);
        return data.sources;
    },
    setPlayback: async (id, payload) => {
        const data = await dbModel.read();
        data.playback[id] = {
            ...(data.playback[id] || {}),
            ...payload,
            lastWatchedAt: new Date().toISOString()
        };
        await dbModel.write(data);
        return data.playback[id];
    },
    getPlayback: async (id) => {
        const data = await dbModel.read();
        return data.playback[id] || null;
    },
    setThumbnail: async (id, filePath) => {
        const data = await dbModel.read();
        data.thumbnails[id] = filePath;
        await dbModel.write(data);
        return filePath;
    },
    getThumbnail: async (id) => {
        const data = await dbModel.read();
        return data.thumbnails[id];
    },
    getLibrary: async () => {
        const data = await dbModel.read();
        return data.library;
    },
    createMovie: async ({ title, filePath, subtitles = [], thumbnailPath = '', trailerPath = '' }) => {
        const data = await dbModel.read();
        const id = dbModel.makeId('movie', `${title}|${filePath}|${Date.now()}`);
        const movie = {
            id,
            kind: 'movie',
            title,
            filePath,
            subtitles,
            thumbnailPath,
            trailerPath,
            available: true,
            createdAt: new Date().toISOString()
        };
        data.library.movies.push(movie);
        await dbModel.write(data);
        return movie;
    },
    updateMovie: async (movieId, patch) => {
        const data = await dbModel.read();
        const movie = data.library.movies.find((entry) => entry.id === movieId);
        if (!movie) return null;
        Object.assign(movie, patch, { updatedAt: new Date().toISOString() });
        await dbModel.write(data);
        return movie;
    },
    deleteMovie: async (movieId) => {
        const data = await dbModel.read();
        const before = data.library.movies.length;
        data.library.movies = data.library.movies.filter((entry) => entry.id !== movieId);
        await dbModel.write(data);
        return before !== data.library.movies.length;
    },
    createSeries: async ({ title, sourceFolder = '', subtitles = [], thumbnailPath = '', trailerPath = '' }) => {
        const data = await dbModel.read();
        const id = dbModel.makeId('series', `${title}|${sourceFolder}|${Date.now()}`);
        const series = {
            id,
            kind: 'series',
            title,
            sourceFolder,
            subtitles,
            thumbnailPath,
            trailerPath,
            available: true,
            seasons: [],
            createdAt: new Date().toISOString()
        };
        data.library.series.push(series);
        await dbModel.write(data);
        return series;
    },

    updateSeries: async (seriesId, patch) => {
        const data = await dbModel.read();
        const series = data.library.series.find((entry) => entry.id === seriesId);
        if (!series) return null;
        Object.assign(series, patch, { updatedAt: new Date().toISOString() });
        await dbModel.write(data);
        return series;
    },
    deleteSeries: async (seriesId) => {
        const data = await dbModel.read();
        const before = data.library.series.length;
        data.library.series = data.library.series.filter((entry) => entry.id !== seriesId);
        await dbModel.write(data);
        return before !== data.library.series.length;
    },
    addSeason: async (seriesId, seasonNumber) => {
        const data = await dbModel.read();
        const series = data.library.series.find((entry) => entry.id === seriesId);
        if (!series) return null;
        if (!series.seasons.find((entry) => entry.number === seasonNumber)) {
            series.seasons.push({ number: seasonNumber, episodes: [] });
            series.seasons.sort((a, b) => a.number - b.number);
        }
        await dbModel.write(data);
        return series;
    },
    addEpisode: async (seriesId, seasonNumber, payload) => {
        const data = await dbModel.read();
        const series = data.library.series.find((entry) => entry.id === seriesId);
        if (!series) return null;

        let season = series.seasons.find((entry) => entry.number === seasonNumber);
        if (!season) {
            season = { number: seasonNumber, episodes: [] };
            series.seasons.push(season);
        }

        const id = dbModel.makeId('episode', `${seriesId}|${seasonNumber}|${payload.episodeNumber}|${payload.filePath}|${Date.now()}`);
        season.episodes.push({
            id,
            kind: 'episode',
            title: payload.title,
            number: payload.episodeNumber,
            filePath: payload.filePath,
            season: seasonNumber,
            seriesId,
            subtitles: payload.subtitles || [],
            thumbnailPath: payload.thumbnailPath || '',
            trailerPath: payload.trailerPath || '',
            available: true,
            createdAt: new Date().toISOString()
        });

        season.episodes.sort((a, b) => (a.number ?? 0) - (b.number ?? 0));
        series.seasons.sort((a, b) => a.number - b.number);
        await dbModel.write(data);
        return season;
    }
};

module.exports = dbModel;
