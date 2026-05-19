import { healthRoutes } from "./health.routes.js";
import { mediaRoutes } from "./media.routes.js";
import { libraryRoutes } from "./library.routes.js";
import { assetRoutes } from "./asset.routes.js";

export const routes = [
  ...healthRoutes,
  ...mediaRoutes,
  ...libraryRoutes,
  ...assetRoutes,
];
