export function createRouter(routes) {
  return async function route(req, res, url) {
    for (const route of routes) {
      if (route.method !== req.method) continue;
      const match = route.pattern.exec(url.pathname);
      if (!match) continue;
      const params = match.groups || {};
      return route.handler({ req, res, url, params });
    }
    return false;
  };
}