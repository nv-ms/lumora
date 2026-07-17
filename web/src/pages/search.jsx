import { Link, useSearchParams } from "react-router-dom";
import { Poster } from "../components/poster";
import { useCatalog } from "../lib/catalog-context";

export function SearchPage() {
  const [params] = useSearchParams();
  const { movies, episodes, loading, error } = useCatalog();
  const q = (params.get("q") || "").trim().toLowerCase();
  const items = [...movies, ...episodes];
  const results = q
    ? items.filter((item) => `${item.title} ${item.path || ""} ${item.seriesTitle || ""}`.toLowerCase().includes(q))
    : [];

  if (loading) return <div className="p-8 text-sm text-muted-foreground">Loading...</div>;
  if (error) return <div className="p-8 text-sm text-red-400">{error}</div>;

  return (
    <div className="px-8 py-8">
      <h1 className="text-2xl font-semibold">Search</h1>
      <p className="mt-1 text-sm text-muted-foreground">{q ? `${results.length} result(s) for "${q}"` : "Type in the top search bar and press Enter."}</p>
      {!!q && (
        <div className="mt-6 grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {results.map((item) => (
            <Link key={item.id} to={item.kind === "episode" ? `/watch/${item.id}` : `/watch/${item.id}`} className="group">
              <Poster title={item.title} hue={item.poster} thumbnailUrl={item.thumbnailUrl} />
              <div className="mt-2 truncate text-sm font-medium">{item.title}</div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}