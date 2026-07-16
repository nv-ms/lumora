const catalogService = require('../services/catalog.service');
const transcoderHealth = require('../services/transcoder-health.service');
const renditionService = require('../services/rendition.service');

const healthController = {
    health: async (req, res) => {
        const playback = transcoderHealth.get();
        return res.status(200).json({ ok: playback.ok, playback });
    },

    cacheStats: async (req, res, next) => { try { return res.status(200).json(await renditionService.stats()); } catch (error) { return next(error); } },
    cacheLimit: async (req, res, next) => {
        try { const value = Number(req.body?.limitBytes); if (!Number.isSafeInteger(value) || value < 0) return res.status(400).json({ error: 'limitBytes must be a non-negative integer' }); return res.status(200).json(await renditionService.setLimit(value)); } catch (error) { return next(error); }
    },
    cacheClear: async (req, res, next) => { try { return res.status(200).json(await renditionService.clear()); } catch (error) { return next(error); } },

    catalog: async (req, res, next) => {
        try {
            const out = await catalogService.build();
            return res.status(200).json({
                generatedAt: out.generatedAt,
                sources: out.sources,
                movies: out.movies,
                series: out.series
            });
        } catch (error) {
            return next(error);
        }
    }
};

module.exports = healthController;
