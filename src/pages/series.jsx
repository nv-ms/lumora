import { Link } from "react-router-dom";
import { series } from "@/lib/mock-library";
import { Poster } from "@/components/poster";
export function SeriesPage() { return <div className="p-8"><h1 className="text-2xl font-semibold">Series</h1><div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">{series.map((s) => <Link key={s.id} to={`/series/${s.id}`}><Poster title={s.title} hue={s.poster} /></Link>)}</div></div>; }