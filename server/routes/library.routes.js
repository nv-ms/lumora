import {
  getSources,
  addSource,
  deleteSource,
  createMovieEntry,
  patchMovie,
  removeMovie,
  createSeriesEntry,
  patchSeries,
  removeSeries,
  createSeason,
  createEpisode,
  patchPlayback,
} from "../controllers/library-controller.js";

export const libraryRoutes = [
  { method: "GET", path: /^\/api\/sources$/, handler: getSources },
  { method: "POST", path: /^\/api\/sources\/add$/, handler: addSource },
  { method: "POST", path: /^\/api\/sources\/delete$/, handler: deleteSource },

  { method: "POST", path: /^\/api\/library\/movie$/, handler: createMovieEntry },
  { method: "POST", path: /^\/api\/library\/movie\/(?<movieId>[^/]+)\/update$/, handler: patchMovie },
  { method: "POST", path: /^\/api\/library\/movie\/(?<movieId>[^/]+)\/delete$/, handler: removeMovie },

  { method: "POST", path: /^\/api\/library\/series$/, handler: createSeriesEntry },
  { method: "POST", path: /^\/api\/library\/series\/(?<seriesId>[^/]+)\/update$/, handler: patchSeries },
  { method: "POST", path: /^\/api\/library\/series\/(?<seriesId>[^/]+)\/delete$/, handler: removeSeries },
  { method: "POST", path: /^\/api\/library\/series\/(?<seriesId>[^/]+)\/season$/, handler: createSeason },
  { method: "POST", path: /^\/api\/library\/series\/(?<seriesId>[^/]+)\/season\/(?<seasonNumber>\d+)\/episode$/, handler: createEpisode },

  { method: "POST", path: /^\/api\/playback\/(?<id>[^/]+)$/, handler: patchPlayback },
];
