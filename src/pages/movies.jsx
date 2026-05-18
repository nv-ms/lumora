import { Link } from "react-router-dom";
import { movies } from "@/lib/mock-library";
import { Poster } from "@/components/poster";
export function MoviesPage() { return <div className="p-8"><h1 className="text-2xl font-semibold">Movies</h1><div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">{movies.map((m) => <Link key={m.id} to={`/watch/${m.id}`}><Poster title={m.title} hue={m.poster} /></Link>)}</div></div>; }