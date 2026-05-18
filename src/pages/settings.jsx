import { useState } from "react";
import { FolderOpen, RefreshCw, Trash2 } from "lucide-react";
import { useCatalog } from "../lib/catalog-context";
import { ListSkeleton } from "../components/skeletons";

export function SettingsPage() {
  const { sourceStats, refresh, loading } = useCatalog();
  const [path, setPath] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const addSource = async () => {
    if (!path.trim()) return;
    setBusy(true);
    setMessage("");
    setError("");
    const response = await fetch("/api/sources", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: path.trim() }),
    });
    if (!response.ok) {
      setError("Failed to add source.");
      setBusy(false);
      return;
    }
    setPath("");
    await refresh();
    setMessage("Source added.");
    setBusy(false);
  };

  const removeSource = async (source) => {
    setBusy(true);
    setMessage("");
    setError("");
    const response = await fetch(`/api/sources?path=${encodeURIComponent(source)}`, { method: "DELETE" });
    if (!response.ok) {
      setError("Failed to remove source.");
      setBusy(false);
      return;
    }
    await refresh();
    setMessage("Source removed.");
    setBusy(false);
  };

  return (
    <div className="px-8 py-10 max-w-3xl">
      <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
      <p className="text-sm text-muted-foreground mt-1">Catalog sources are stored in a local JSON DB and scanned dynamically.</p>

      <section className="mt-10">
        <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-4">Library sources</div>
        {loading ? (
          <ListSkeleton rows={4} />
        ) : (
          <div className="space-y-2">
            {sourceStats.map((source) => (
              <div key={source.path} className="flex items-center gap-3 px-3 py-2.5 bg-panel rounded-md">
                <FolderOpen className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-mono flex-1 truncate">{source.path}</span>
                <span className="text-[10px] font-mono text-muted-foreground">{source.count} items</span>
                <button onClick={() => removeSource(source.path)} className="text-muted-foreground hover:text-foreground" aria-label="Remove" disabled={busy}>
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
            {!sourceStats.length && <div className="text-sm text-muted-foreground">No sources configured.</div>}
          </div>
        )}

        <div className="mt-3 flex gap-2">
          <input
            value={path}
            onChange={(event) => setPath(event.target.value)}
            placeholder="C:/path/to/media"
            className="h-9 flex-1 px-3 rounded-md bg-panel text-sm outline-none"
          />
          <button onClick={addSource} className="h-9 px-4 text-sm rounded-md bg-foreground text-background font-medium" disabled={busy}>Add</button>
          <button onClick={async () => { setBusy(true); setError(""); setMessage(""); await refresh(); setMessage("Catalog rescanned."); setBusy(false); }} className="h-9 px-4 text-sm rounded-md bg-panel hover:bg-panel-2 inline-flex items-center gap-2" disabled={busy}>
            <RefreshCw className="h-3.5 w-3.5" /> Rescan
          </button>
        </div>
        {busy && <div className="mt-2 text-xs text-muted-foreground">Processing...</div>}
        {message && <div className="mt-2 text-xs text-emerald-400">{message}</div>}
        {error && <div className="mt-2 text-xs text-red-400">{error}</div>}
      </section>
    </div>
  );
}
