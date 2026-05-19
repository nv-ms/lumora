import http from "node:http";
import { routes } from "./routes/index.js";
import { sendJson } from "./services/http-service.js";

const PORT = Number(process.env.PORT || 8787);

const app = http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host}`);
  try {
    for (const route of routes) {
      if (route.method !== req.method) continue;
      const match = route.path.exec(url.pathname);
      if (!match) continue;
      await route.handler({ req, res, url, params: match.groups || {} });
      return;
    }
    return sendJson(res, 404, { error: "Not found" });
  } catch (error) {
    return sendJson(res, 500, { error: error.message || "Server error" });
  }
});

app.listen(PORT, () => {
  console.log(`Media server listening on http://localhost:${PORT}`);
});
