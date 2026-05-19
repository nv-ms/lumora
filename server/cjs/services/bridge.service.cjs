const bridgeService = {
  cache: null,
  async getModules() {
    if (bridgeService.cache) return bridgeService.cache;
    const db = await import('../../db.js');
    const catalogService = await import('../../services/catalog-service.js');
    const filesystemService = await import('../../services/filesystem-service.js');
    const httpService = await import('../../services/http-service.js');
    const mediaUtilsService = await import('../../services/media-utils-service.js');
    const seriesService = await import('../../services/series-service.js');
    const subtitlesService = await import('../../services/subtitles-service.js');
    const thumbnailsService = await import('../../services/thumbnails-service.js');
    bridgeService.cache = { db, catalogService, filesystemService, httpService, mediaUtilsService, seriesService, subtitlesService, thumbnailsService };
    return bridgeService.cache;
  },
};

module.exports = bridgeService;
