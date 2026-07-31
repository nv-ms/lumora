const path = require('node:path');
const dbModel = require('../models/db');
const utilService = require('../services/util.service');
const seriesService = require('../services/series.service');

const libraryController = {
    getSources: async (req, res, next) => {
        try {
            const db = await dbModel.read();
            return res.status(200).json({ sources: db.sources });
        } catch (error) {
            return next(error);
        }
    },

    addSource: async (req, res, next) => {
        try {
            if (!req.body.path || typeof req.body.path !== 'string') {
                return res.status(400).json({ error: 'path is required' });
            }
            const db = await dbModel.read();
            const sources = await dbModel.setSources([...db.sources, req.body.path]);
            return res.status(200).json({ sources });
        } catch (error) {
            return next(error);
        }
    },

    deleteSource: async (req, res, next) => {
        try {
            const db = await dbModel.read();
            const sources = await dbModel.setSources(db.sources.filter((entry) => entry !== req.body.path));
            return res.status(200).json({ sources });
        } catch (error) {
            return next(error);
        }
    },

    createMovie: async (req, res, next) => {
        try {
            const body = req.body || {};
            if (!body.title || !body.filePath) {
                return res.status(400).json({ error: 'title and filePath are required' });
            }
            const movie = await dbModel.createMovie({
                title: body.title,
                filePath: body.filePath,
                subtitles: Array.isArray(body.subtitles) ? body.subtitles : [],
                thumbnailPath: body.thumbnailPath || '',
                trailerPath: body.trailerPath || ''
            });
            return res.status(200).json({ movie });
        } catch (error) {
            return next(error);
        }
    },

    updateMovie: async (req, res, next) => {
        try {
            const movie = await dbModel.updateMovie(req.params.movieId, req.body || {});
            if (!movie) return res.status(404).json({ error: 'Movie not found' });
            return res.status(200).json({ movie });
        } catch (error) {
            return next(error);
        }
    },

    deleteMovie: async (req, res, next) => {
        try {
            const ok = await dbModel.deleteMovie(req.params.movieId);
            return res.status(ok ? 200 : 404).json(ok ? { ok: true } : { error: 'Movie not found' });
        } catch (error) {
            return next(error);
        }
    },

    createSeries: async (req, res, next) => {
        try {
            const body = req.body || {};
            if (!body.title) return res.status(400).json({ error: 'title is required' });

            const series = await dbModel.createSeries({
                title: body.title,
                sourceFolder: body.sourceFolder || '',
                subtitles: Array.isArray(body.subtitles) ? body.subtitles : [],
                thumbnailPath: body.thumbnailPath || '',
                trailerPath: body.trailerPath || ''
            });

            let previewEpisodes = [];
            if (Array.isArray(body.episodeFiles) && body.episodeFiles.length) {
                for (const ep of body.episodeFiles) {
                    const parsed = utilService.parseEpisode(path.basename(ep.filePath));
                    const season = Number(ep.seasonNumber || parsed?.season || 1);
                    const number = Number(ep.episodeNumber || parsed?.episode || 0);

                    await dbModel.addSeason(series.id, season);
                    const seasonSubtitles = body.seasonSubtitles?.[season];
                    if (Array.isArray(seasonSubtitles)) {
                        await dbModel.setSeasonSubtitles(series.id, season, seasonSubtitles);
                    }
                    const seasonResult = await dbModel.addEpisode(series.id, season, {
                        title: ep.title || path.basename(ep.filePath, path.extname(ep.filePath)),
                        filePath: ep.filePath,
                        episodeNumber: number,
                        subtitles: Array.isArray(ep.subtitles) ? ep.subtitles : [],
                        thumbnailPath: ep.thumbnailPath || '',
                        trailerPath: ep.trailerPath || ''
                    });
                    const added = seasonResult.episodes.find((entry) => entry.filePath === ep.filePath);
                    if (added) previewEpisodes.push(added);
                }
            } else if (body.autoCatalog && body.sourceFolder) {
                previewEpisodes = await seriesService.autoCatalog(series.id, body.sourceFolder);
            }

            return res.status(200).json({ series, previewEpisodes });
        } catch (error) {
            return next(error);
        }
    },

    updateSeries: async (req, res, next) => {
        try {
            const series = await dbModel.updateSeries(req.params.seriesId, req.body || {});
            if (!series) return res.status(404).json({ error: 'Series not found' });
            return res.status(200).json({ series });
        } catch (error) {
            return next(error);
        }
    },

    deleteSeries: async (req, res, next) => {
        try {
            const ok = await dbModel.deleteSeries(req.params.seriesId);
            return res.status(ok ? 200 : 404).json(ok ? { ok: true } : { error: 'Series not found' });
        } catch (error) {
            return next(error);
        }
    },

    createSeason: async (req, res, next) => {
        try {
            const seasonNumber = Number(req.body?.seasonNumber);
            if (!seasonNumber) return res.status(400).json({ error: 'seasonNumber is required' });
            const series = await dbModel.addSeason(req.params.seriesId, seasonNumber);
            if (!series) return res.status(404).json({ error: 'Series not found' });
            return res.status(200).json({ series });
        } catch (error) {
            return next(error);
        }
    },

    createEpisode: async (req, res, next) => {
        try {
            const body = req.body || {};
            if (!body.title || !body.filePath) {
                return res.status(400).json({ error: 'title and filePath are required' });
            }
            const season = await dbModel.addEpisode(req.params.seriesId, Number(req.params.seasonNumber), {
                title: body.title,
                filePath: body.filePath,
                episodeNumber: Number(body.episodeNumber || 0),
                subtitles: Array.isArray(body.subtitles) ? body.subtitles : [],
                thumbnailPath: body.thumbnailPath || '',
                trailerPath: body.trailerPath || ''
            });
            if (!season) return res.status(404).json({ error: 'Series not found' });
            return res.status(200).json({ season });
        } catch (error) {
            return next(error);
        }
    },

    savePlayback: async (req, res, next) => {
        try {
            const body = req.body || {};
            const requestedDuration = Number(body.duration || 0);
            const requestedCurrentTime = Number(body.currentTime || 0);
            const requestedProgress = Number(body.progress || 0);
            const duration = Number.isFinite(requestedDuration) ? Math.max(0, requestedDuration) : 0;
            const currentTime = Number.isFinite(requestedCurrentTime) ? Math.max(0, Math.min(requestedCurrentTime, duration || requestedCurrentTime)) : 0;
            const progress = Math.max(0, Math.min(1, duration > 0 ? currentTime / duration : (Number.isFinite(requestedProgress) ? requestedProgress : 0)));
            const completed = body.completed === true || progress >= 0.999;
            const playback = await dbModel.setPlayback(req.params.id, {
                progress: completed ? 1 : progress,
                currentTime: completed ? 0 : currentTime,
                duration
            });
            return res.status(200).json({ playback });
        } catch (error) {
            return next(error);
        }
    },

    getPlayback: async (req, res, next) => {
        try {
            const playback = await dbModel.getPlayback(req.params.id);
            return res.status(200).json({ playback });
        } catch (error) {
            return next(error);
        }
    }
};

module.exports = libraryController;
