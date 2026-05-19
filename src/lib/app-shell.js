const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");


function isVisible(el) {
  const rect = el.getBoundingClientRect();
  const style = window.getComputedStyle(el);
  return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
}

function pickNext(direction) {
  const current = document.activeElement;
  const list = Array.from(document.querySelectorAll(FOCUSABLE)).filter(isVisible);
  if (!list.length) return null;
  if (!current || !list.includes(current)) return list[0];

  const rect = current.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;

  let best = null;
  let bestScore = Number.POSITIVE_INFINITY;
  for (const candidate of list) {
    if (candidate === current) continue;
    const r = candidate.getBoundingClientRect();
    const x = r.left + r.width / 2;
    const y = r.top + r.height / 2;
    const dx = x - cx;
    const dy = y - cy;

    if (direction === "left" && dx >= -4) continue;
    if (direction === "right" && dx <= 4) continue;
    if (direction === "up" && dy >= -4) continue;
    if (direction === "down" && dy <= 4) continue;

    const primary = direction === "left" || direction === "right" ? Math.abs(dx) : Math.abs(dy);
    const secondary = direction === "left" || direction === "right" ? Math.abs(dy) : Math.abs(dx);
    const score = primary * 1000 + secondary;
    if (score < bestScore) {
      best = candidate;
      bestScore = score;
    }
  }
  return best;
}

function handleDpad(event) {
  const key = event.key;
  if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Enter"].includes(key)) return;
  const tag = document.activeElement?.tagName?.toLowerCase();
  if (tag === "input" || tag === "textarea" || document.activeElement?.isContentEditable) return;

  if (key === "Enter") {
    const active = document.activeElement;
    if (active && active !== document.body) {
      event.preventDefault();
      active.click();
    }
    return;
  }

  const map = {
    ArrowLeft: "left",
    ArrowRight: "right",
    ArrowUp: "up",
    ArrowDown: "down",
  };
  const next = pickNext(map[key]);
  if (next) {
    event.preventDefault();
    next.focus();
    return;
  }

  // Gesture-like fallback: if no focus target is found, pan the active scroll region.
  const scroller =
    document.activeElement?.closest?.("[data-dpad-scroll]") ||
    document.querySelector("[data-dpad-scroll]") ||
    document.scrollingElement;
  if (!scroller) return;
  const amount = key === "ArrowUp" || key === "ArrowDown" ? 140 : 220;
  if (key === "ArrowUp") scroller.scrollBy({ top: -amount, behavior: "smooth" });
  if (key === "ArrowDown") scroller.scrollBy({ top: amount, behavior: "smooth" });
  if (key === "ArrowLeft") scroller.scrollBy({ left: -amount, behavior: "smooth" });
  if (key === "ArrowRight") scroller.scrollBy({ left: amount, behavior: "smooth" });
  event.preventDefault();
}

function blockExternalBrowsing(event) {
  const anchor = event.target?.closest?.("a[href]");
  if (!anchor) return;
  const href = anchor.getAttribute("href") || "";
  if (!href || href.startsWith("/") || href.startsWith("#")) return;
  try {
    const target = new URL(anchor.href, window.location.href);
    if (target.origin !== window.location.origin) {
      event.preventDefault();
      event.stopPropagation();
    }
  } catch {
    event.preventDefault();
    event.stopPropagation();
  }
}

function focusFirst() {
  const first = Array.from(document.querySelectorAll(FOCUSABLE)).find(isVisible);
  if (first) first.focus();
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}

export function initAppShell() {
  document.addEventListener("keydown", handleDpad, { passive: false });
  document.addEventListener("click", blockExternalBrowsing, true);
  window.addEventListener("load", focusFirst);
  registerServiceWorker();
}
