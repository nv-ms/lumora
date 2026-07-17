export const SEEK_STEPS = [10, 20, 30];
export const SEEK_COOLDOWN_MS = 1200;

export function fmt(seconds) {
  const minutes = Math.floor((seconds || 0) / 60);
  const secs = Math.floor((seconds || 0) % 60);
  return `${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

export function isInteractiveTarget(target) {
  if (!(target instanceof Element)) return false;
  return !!target.closest("button, a, input, select, textarea, [role='button']");
}

export function actionByX(clientX, rect) {
  const ratio = (clientX - rect.left) / rect.width;
  if (ratio < 1 / 3) return "rewind";
  if (ratio > 2 / 3) return "forward";
  return "toggle";
}
