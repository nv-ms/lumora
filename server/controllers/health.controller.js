const catalogService = require('../services/catalog.service');

const healthController = {
    health: async (req, res) => {
        return res.status(200).json({ ok: true });
    },

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
