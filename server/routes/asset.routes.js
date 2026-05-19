import {
  getThumbnail,
  setThumbnailFromDataUrl,
  listSubtitleTracks,
  getSubtitleTrack,
} from "../controllers/asset-controller.js";

export const assetRoutes = [
  { method: "GET", path: /^\/api\/thumbnail\/(?<id>[^/]+)$/, handler: getThumbnail },
  { method: "POST", path: /^\/api\/thumbnail\/(?<id>[^/]+)$/, handler: setThumbnailFromDataUrl },
  { method: "GET", path: /^\/api\/subtitles\/(?<mediaId>[^/]+)$/, handler: listSubtitleTracks },
  { method: "GET", path: /^\/api\/subtitles\/(?<mediaId>[^/]+)\/(?<trackId>[^/]+)$/, handler: getSubtitleTrack },
];
