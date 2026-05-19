import { useEffect, useMemo, useState } from "react";

const LAST_PATH_KEY = "stream_weaver:last_picker_path";
const LAST_PATH_MODE_KEY = "stream_weaver:last_picker_path_by_mode";

function normalizeParent(p) {
  if (!p) return "";
  const cleaned = p.replace(/[\\/]+$/, "");
  const idx = Math.max(cleaned.lastIndexOf("/"), cleaned.lastIndexOf("\\"));
  return idx <= 0 ? cleaned : cleaned.slice(0, idx + 1);
}

export function PathPickerModal({ open, title, mode, onClose, onPick, multi = false }) {
  const [roots, setRoots] = useState([]);
  const [currentPath, setCurrentPath] = useState("");
  const [dirs, setDirs] = useState([]);
  const [files, setFiles] = useState([]);
  const [selected, setSelected] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const selectedSet = useMemo(() => new Set(selected), [selected]);

  useEffect(() => {
    if (!open) return;
    setSelected([]);
    setError("");
    (async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/fs/roots");
        const data = await res.json();
        const list = Array.isArray(data.roots) ? data.roots : [];
        setRoots(list);
        const modeKey = mode || "all";
        const byModeRaw = localStorage.getItem(LAST_PATH_MODE_KEY);
        const byMode = byModeRaw ? JSON.parse(byModeRaw) : {};
        const remembered = byMode?.[modeKey] || localStorage.getItem(LAST_PATH_KEY) || "";
        setCurrentPath(remembered || list[0] || "");
      } catch {
        setError("Failed to load roots.");
      } finally {
        setLoading(false);
      }
    })();
  }, [open]);

  useEffect(() => {
    if (!open || !currentPath) return;
    localStorage.setItem(LAST_PATH_KEY, currentPath);
    const modeKey = mode || "all";
    const byModeRaw = localStorage.getItem(LAST_PATH_MODE_KEY);
    const byMode = byModeRaw ? JSON.parse(byModeRaw) : {};
    byMode[modeKey] = currentPath;
    localStorage.setItem(LAST_PATH_MODE_KEY, JSON.stringify(byMode));
  }, [open, currentPath, mode]);

  useEffect(() => {
    if (!open || !currentPath) return;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const url = `/api/fs/list?path=${encodeURIComponent(currentPath)}&mode=${encodeURIComponent(mode || "all")}`;
        const res = await fetch(url);
        const data = await res.json();
        setDirs(Array.isArray(data.dirs) ? data.dirs : []);
        setFiles(Array.isArray(data.files) ? data.files : []);
      } catch {
        setError("Failed to list path.");
      } finally {
        setLoading(false);
      }
    })();
  }, [open, currentPath, mode]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-60 bg-black/70 p-4 md:p-6" onClick={onClose}>
      <div className="mx-auto h-full w-full max-w-4xl overflow-hidden rounded-2xl border border-hairline bg-background shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex h-16 items-center justify-between border-b border-hairline px-5">
          <h3 className="text-base font-semibold">{title}</h3>
          <button onClick={onClose} className="h-10 rounded-md bg-panel px-4 text-sm hover:bg-panel-2">Close</button>
        </div>
        <div className="flex h-[calc(100%-4rem)] min-h-0 flex-col p-5">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <select value={currentPath} onChange={(e) => setCurrentPath(e.target.value)} className="h-10 min-w-55 rounded-md bg-panel px-3 text-sm">
              {roots.map((root) => <option key={root} value={root}>{root}</option>)}
            </select>
            <button onClick={() => setCurrentPath((p) => normalizeParent(p))} className="h-10 rounded-md bg-panel px-3 text-sm hover:bg-panel-2">Up</button>
            <div className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{currentPath}</div>
          </div>

          <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-hidden md:grid-cols-2">
            <div className="min-h-0 min-w-0 overflow-hidden rounded-md border border-hairline">
              <div className="border-b border-hairline px-3 py-2 text-xs text-muted-foreground">Folders</div>
              <div className="h-[calc(100%-33px)] overflow-auto p-2">
                {dirs.map((d) => (
                  <button key={d.path} onClick={() => setCurrentPath(d.path)} className="mb-1 block w-full rounded px-2 py-2 text-left text-sm hover:bg-panel">
                    {d.name}
                  </button>
                ))}
                {!dirs.length && <div className="px-2 py-2 text-xs text-muted-foreground">No folders</div>}
              </div>
            </div>
            <div className="min-h-0 min-w-0 overflow-hidden rounded-md border border-hairline">
              <div className="border-b border-hairline px-3 py-2 text-xs text-muted-foreground">{multi ? "Files (multi select)" : "Files"}</div>
              <div className="h-[calc(100%-33px)] overflow-auto p-2">
                {files.map((f) => {
                  const active = selectedSet.has(f.path);
                  return (
                    <button
                      key={f.path}
                      onClick={() => {
                        if (!multi) return setSelected([f.path]);
                        setSelected((prev) => active ? prev.filter((p) => p !== f.path) : [...prev, f.path]);
                      }}
                      className={`mb-1 block w-full truncate rounded px-2 py-2 text-left text-sm ${active ? "bg-panel-2" : "hover:bg-panel"}`}
                      title={f.name}
                    >
                      {f.name}
                    </button>
                  );
                })}
                {!files.length && <div className="px-2 py-2 text-xs text-muted-foreground">No matching files</div>}
              </div>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between">
            <div className="text-xs text-red-400">{error}</div>
            <div className="flex items-center gap-2">
              {loading && <span className="text-xs text-muted-foreground">Loading...</span>}
              <button onClick={() => onPick(multi ? selected : selected[0] || "")} disabled={!selected.length} className="h-10 rounded-md bg-foreground px-4 text-sm text-background disabled:opacity-50">Select</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
