import { health } from "../controllers/health-controller.js";

export const healthRoutes = [
  { method: "GET", path: /^\/api\/health$/, handler: health },
];
