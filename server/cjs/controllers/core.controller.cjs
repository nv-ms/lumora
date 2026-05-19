const bridgeService = require('../services/bridge.service.cjs');

const coreController = {
  async health(req, res) {
    return res.status(200).json({ ok: true });
  },

  async getCatalog(req, res, next) {
    try {
      const { catalogService } = await bridgeService.getModules();
      const catalog = await catalogService.buildCatalogFromLibrary();
      return res.status(200).json({ generatedAt: catalog.generatedAt, sources: catalog.sources, movies: catalog.movies, series: catalog.series });
    } catch (error) {
      return next(error);
    }
  },
};

module.exports = coreController;
