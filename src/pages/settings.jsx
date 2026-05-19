import { useState } from "react";
import { apiFetch } from "../lib/api";
import { getServerUrl, setServerUrl } from "../lib/server-config";

export function SettingsPage() {
  const [value, setValue] = useState(getServerUrl());
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

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
    </div>
  );
}

