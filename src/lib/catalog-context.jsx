import { createContext, useContext, useEffect, useMemo, useState } from "react";

const CatalogContext = createContext(null);

export function CatalogProvider({ children }) {
  const [catalog, setCatalog] = useState({ movies: [], series: [], sources: [], generatedAt: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/catalog");
      if (!response.ok) throw new Error(`Catalog load failed (${response.status})`);
      const data = await response.json();
      setCatalog(data);
    } catch (err) {
      setError(err.message || "Failed to load catalog");
      setCatalog({ movies: [], series: [], sources: [], generatedAt: null });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const value = useMemo(() => {
    const episodes = catalog.series.flatMap((show) =>
      show.seasons.flatMap((season) =>
        season.episodes.map((episode) => ({ ...episode, seriesId: show.id, seriesTitle: show.title, season: season.number })),
      ),
    );

    const allItems = [...catalog.movies, ...episodes];
    const byId = new Map(allItems.map((item) => [item.id, item]));
    const sourceStats = catalog.sources.map((source) => ({
      path: source,
      count: allItems.filter((item) => item.path?.toLowerCase().startsWith(source.toLowerCase())).length,
    }));

    const history = [...allItems]
      .filter((item) => item.lastWatchedAt)
      .sort((a, b) => b.lastWatchedAt.localeCompare(a.lastWatchedAt));

    const continueWatching = history.filter((item) => (item.progress ?? 0) > 0 && (item.progress ?? 0) < 1);
    const recentlyAdded = [...allItems].sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt));

    return {
      loading,
      error,
      refresh,
      generatedAt: catalog.generatedAt,
      sources: catalog.sources,
      sourceStats,
      movies: catalog.movies,
      series: catalog.series,
      episodes,
      history,
      continueWatching,
      recentlyAdded,
      getItem: (id) => byId.get(id),
    };
  }, [catalog, loading, error]);

  return <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>;
}

export function useCatalog() {
  const context = useContext(CatalogContext);
  if (!context) throw new Error("useCatalog must be used within CatalogProvider");
  return context;
}
