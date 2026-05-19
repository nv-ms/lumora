import { useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AppLayout } from "./components/app-layout";
import { HistoryPage } from "./pages/history";
import { HomePage } from "./pages/home";
import { MoviesPage } from "./pages/movies";
import { SeriesDetailPage } from "./pages/series-detail";
import { SeriesPage } from "./pages/series";
import { SettingsPage } from "./pages/settings";
import { CatalogPage } from "./pages/catalog";
import { CatalogDetailPage } from "./pages/catalog-detail";
import { WatchPage } from "./pages/watch";
import { SearchPage } from "./pages/search";
import { CatalogProvider } from "./lib/catalog-context";
import { apiFetch } from "./lib/api";
import { getServerUrl, setServerUrl } from "./lib/server-config";

function ConnectPage() {
  const [url, setUrl] = useState(getServerUrl());
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const connect = async () => {
    setLoading(true);
    setError("");
    try {
      setServerUrl(url);
      const response = await apiFetch("/api/health");
      if (!response.ok) throw new Error(`Health failed (${response.status})`);
      window.location.reload();
    } catch (err) {
      setError(err.message || "Could not connect");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6 text-foreground">
      <div className="w-full max-w-xl rounded-2xl border border-hairline bg-panel p-6">
        <h1 className="text-2xl font-semibold">Connect to Lumora Server</h1>
        <p className="mt-2 text-sm text-muted-foreground">Enter the server URL to start.</p>
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="http://localhost:8787"
          className="mt-5 h-11 w-full rounded-md border border-hairline bg-background px-3 text-sm outline-none focus:border-foreground/50"
        />
        <div className="mt-4 flex justify-end">
          <button onClick={connect} disabled={loading || !url.trim()} className="h-10 rounded-md bg-foreground px-4 text-sm text-background disabled:opacity-50">
            {loading ? "Connecting..." : "Connect"}
          </button>
        </div>
        {!!error && <div className="mt-3 text-xs text-rose-400">{error}</div>}
      </div>
    </div>
  );
}

export function App() {
  const url = getServerUrl();
  if (!url) return <ConnectPage />;

  return (
    <CatalogProvider>
      <Routes>
        <Route path="/" element={<AppLayout />}>
          <Route index element={<HomePage />} />
          <Route path="movies" element={<MoviesPage />} />
          <Route path="series" element={<SeriesPage />} />
          <Route path="series/:id" element={<SeriesDetailPage />} />
          <Route path="history" element={<HistoryPage />} />
          <Route path="catalog" element={<CatalogPage />} />
          <Route path="catalog/:type/:id" element={<CatalogDetailPage />} />
          <Route path="search" element={<SearchPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="watch/:id" element={<WatchPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </CatalogProvider>
  );
}
