import { getServerUrl } from "./server-config";

export function apiUrl(path) {
  const base = getServerUrl();
  return `${base}${path}`;
}

export function assetUrl(url) {
  if (!url) return "";
  if (/^https?:\/\//i.test(url)) return url;
  return apiUrl(url);
}

export function apiFetch(path, options) {
  return fetch(apiUrl(path), options);
}

