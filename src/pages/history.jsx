import { Link } from "react-router-dom";
import { history } from "@/lib/mock-library";
export function HistoryPage() { return <div className="p-8"><h1 className="text-2xl font-semibold">History</h1><div className="mt-4 space-y-2">{history().map((i) => <Link key={i.id} className="block underline" to={i.kind === "series" ? `/series/${i.id}` : `/watch/${i.id}`}>{i.title}</Link>)}</div></div>; }