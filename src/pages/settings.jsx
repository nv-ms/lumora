import { useEffect, useState } from "react";
import { apiFetch } from "../lib/api";
import { getServerUrl, setServerUrl } from "../lib/server-config";

export function SettingsPage() {
  const [value, setValue] = useState(getServerUrl());
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [health, setHealth] = useState(null);
  const [cache, setCache] = useState(null);
  const [limitGiB, setLimitGiB] = useState("50");

  const refreshDiagnostics = async () => {
    const [healthResponse, cacheResponse] = await Promise.all([apiFetch("/api/health"), apiFetch("/api/media-cache")]);
    const healthData = await healthResponse.json(); const cacheData = await cacheResponse.json();
    setHealth(healthData.playback); setCache(cacheData); setLimitGiB(String(Math.round(cacheData.limitBytes / 1024 ** 3)));
  };
  useEffect(() => { refreshDiagnostics().catch(() => {}); }, []);

  const save = () => {
    const next = setServerUrl(value);
    setValue(next);
    setStatus("Saved. Reloading...");
    setTimeout(() => window.location.reload(), 300);
  };

  const test = async () => {
    setStatus("");
    setError("");
    try {
      const response = await apiFetch("/api/health");
      if (!response.ok) throw new Error(`Health failed (${response.status})`);
      setStatus("Connected.");
    } catch (err) {
      setError(err.message || "Connection failed.");
    }
  };

  return (
    <div className="max-w-3xl px-8 py-10">
      <h1 className="text-2xl font-semibold">Settings</h1>
      <p className="mt-2 text-sm text-muted-foreground">Server connection</p>

      <div className="mt-6 rounded-xl border border-hairline bg-panel p-5">
        <label className="mb-2 block text-sm">Server URL</label>
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="http://localhost:8787"
          className="h-11 w-full rounded-md border border-hairline bg-background px-3 text-sm outline-none focus:border-foreground/50"
        />
        <div className="mt-4 flex items-center gap-2">
          <button onClick={test} className="h-10 rounded-md bg-panel-2 px-4 text-sm hover:bg-panel">Test</button>
          <button onClick={save} className="h-10 rounded-md bg-foreground px-4 text-sm text-background">Save</button>
        </div>
        {!!status && <div className="mt-3 text-xs text-emerald-400">{status}</div>}
        {!!error && <div className="mt-3 text-xs text-rose-400">{error}</div>}
      </div>

      <div className="mt-6 rounded-xl border border-hairline bg-panel p-5">
        <h2 className="text-sm font-medium">Playback engine</h2>
        <div className="mt-3 text-xs text-muted-foreground">FFmpeg: {health?.ok ? "Ready" : health?.checked ? "Missing required capabilities" : "Checking…"}</div>
        {!!health?.capabilities && <div className="mt-2 text-xs text-muted-foreground">{Object.entries(health.capabilities).map(([name, ready]) => `${name}: ${ready ? "yes" : "no"}`).join(" · ")}</div>}
        <div className="mt-5 text-xs text-muted-foreground">Generated cache: {cache ? `${(cache.sizeBytes / 1024 ** 3).toFixed(2)} GiB · ${cache.renditions} renditions` : "Loading…"}</div>
        <label className="mt-4 mb-2 block text-sm">Cache limit (GiB)</label>
        <div className="flex gap-2">
          <input type="number" min="0" value={limitGiB} onChange={(e) => setLimitGiB(e.target.value)} className="h-10 w-32 rounded-md border border-hairline bg-background px-3 text-sm" />
          <button onClick={async () => { await apiFetch("/api/media-cache/limit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ limitBytes: Math.round(Number(limitGiB) * 1024 ** 3) }) }); await refreshDiagnostics(); }} className="h-10 rounded-md bg-panel-2 px-4 text-sm">Apply</button>
          <button onClick={async () => { await apiFetch("/api/media-cache/clear", { method: "POST" }); await refreshDiagnostics(); }} className="h-10 rounded-md bg-panel-2 px-4 text-sm text-rose-300">Clear inactive</button>
        </div>
      </div>
    </div>
  );
}
