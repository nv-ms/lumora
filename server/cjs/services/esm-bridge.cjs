let cache = null;

async function getModules() {
  if (cache) return cache;
  const db = await import('../../db.js');
  const catalogService = await import('../../services/catalog-service.js');
  const filesystemService = await import('../../services/filesystem-service.js');
  const httpService = await import('../../services/http-service.js');
  const mediaUtils = await import('../../services/media-utils-service.js');
  const seriesService = await import('../../services/series-service.js');
  const subtitlesService = await import('../../services/subtitles-service.js');
  const thumbnailsService = await import('../../services/thumbnails-service.js');
  cache = { db, catalogService, filesystemService, httpService, mediaUtils, seriesService, subtitlesService, thumbnailsService };
  return cache;
}

module.exports = { getModules };
