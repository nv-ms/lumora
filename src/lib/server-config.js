const KEY = "lumora:server_url";

export function cleanServerUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  return raw.replace(/\/+$/, "");
}

export function getServerUrl() {
  return cleanServerUrl(localStorage.getItem(KEY) || "");
}

export function setServerUrl(value) {
  const next = cleanServerUrl(value);
  if (!next) localStorage.removeItem(KEY);
  else localStorage.setItem(KEY, next);
  return next;
}

