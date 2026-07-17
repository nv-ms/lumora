const KEY = "stream_weaver_watch_state";

export function getWatchMap() {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function setWatchState(id, payload) {
  const map = getWatchMap();
  map[id] = {
    ...map[id],
    ...payload,
    lastWatchedAt: new Date().toISOString(),
  };
  localStorage.setItem(KEY, JSON.stringify(map));
}
