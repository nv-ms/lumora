import { Navigate, Route, Routes } from "react-router-dom";
import { AppLayout } from "./components/app-layout";
import { HistoryPage } from "./pages/history";
import { HomePage } from "./pages/home";
import { MoviesPage } from "./pages/movies";
import { SeriesDetailPage } from "./pages/series-detail";
import { SeriesPage } from "./pages/series";
import { SettingsPage } from "./pages/settings";
import { CatalogPage } from "./pages/catalog";
import { WatchPage } from "./pages/watch";
import { CatalogProvider } from "./lib/catalog-context";

export function App() {
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
          <Route path="settings" element={<SettingsPage />} />
          <Route path="watch/:id" element={<WatchPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </CatalogProvider>
  );
}
