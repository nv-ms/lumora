import {
  getCatalog,
  getFiles,
  uploadFile,
  getFolders,
  getFsRoots,
  getFsList,
  streamMediaById,
} from "../controllers/media-controller.js";

export const mediaRoutes = [
  { method: "GET", path: /^\/api\/catalog$/, handler: getCatalog },
  { method: "GET", path: /^\/api\/files$/, handler: getFiles },
  { method: "POST", path: /^\/api\/upload$/, handler: uploadFile },
  { method: "GET", path: /^\/api\/folders$/, handler: getFolders },
  { method: "GET", path: /^\/api\/fs\/roots$/, handler: getFsRoots },
  { method: "GET", path: /^\/api\/fs\/list$/, handler: getFsList },
  { method: "GET", path: /^\/api\/media\/(?<id>[^/]+)$/, handler: streamMediaById },
];
