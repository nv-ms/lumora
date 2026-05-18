import { Link } from "react-router-dom";
import { continueWatching, recentlyAdded } from "@/lib/mock-library";
import { Poster } from "@/components/poster";

export function HomePage() {
  const items = continueWatching();
  return (
    <div className="p-8">
      <h1 className="text-2xl font-semibold">Home</h1>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
        {items.map((item) => <Link key={item.id} to={`/watch/${item.id}`}><Poster title={item.title} hue={item.poster} /></Link>)}
      </div>
      <h2 className="text-lg font-medium mt-10">Recently added</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
        {recentlyAdded().map((item) => <Link key={item.id} to={item.kind === "series" ? `/series/${item.id}` : `/watch/${item.id}`}><Poster title={item.title} hue={item.poster} /></Link>)}
      </div>
    </div>
  );
}