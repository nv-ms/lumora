import { NavLink, useLocation } from "react-router-dom";
import { Clock, Film, FolderOpen, Home, Settings, Tv } from "lucide-react";
import { cn } from "../lib/utils";
import { useCatalog } from "../lib/catalog-context";
import { SidebarSourcesSkeleton } from "./skeletons";

const nav = [
  { to: "/", label: "Home", icon: Home },
  { to: "/movies", label: "Movies", icon: Film },
  { to: "/series", label: "Series", icon: Tv },
  { to: "/history", label: "History", icon: Clock },
];

export function AppSidebar() {
  const { pathname } = useLocation();
  const { sourceStats, loading } = useCatalog();
  const isActive = (to) => (to === "/" ? pathname === "/" : pathname.startsWith(to));

  return (
    <aside className="hidden md:flex w-60 shrink-0 flex-col border-r border-hairline bg-background">
      <div className="px-6 py-7">
        <div className="text-sm font-semibold tracking-[0.25em] uppercase">Director</div>
        <div className="mt-1 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Local library</div>
      </div>

      <nav className="px-3 space-y-0.5">
        {nav.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.to);

          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                active ? "bg-panel text-foreground" : "text-muted-foreground hover:bg-panel/60 hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </NavLink>
          );
        })}
      </nav>

      <div className="mt-8 px-6">
        <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-3">Sources</div>
        {loading ? (
          <SidebarSourcesSkeleton />
        ) : (
          <div className="space-y-2">
            {sourceStats.map((source) => (
              <div key={source.path} className="flex items-center gap-2 text-xs text-muted-foreground">
                <FolderOpen className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{source.path}</span>
                <span className="ml-auto font-mono text-[10px]">{source.count}</span>
              </div>
            ))}
            {!sourceStats.length && <div className="text-xs text-muted-foreground">No sources configured.</div>}
          </div>
        )}
        <NavLink to="/settings" className="mt-3 inline-block text-[10px] font-mono uppercase tracking-widest text-accent hover:underline">
          Manage Sources
        </NavLink>
      </div>

      <div className="mt-auto p-3 border-t border-hairline">
        <NavLink
          to="/settings"
          className={cn(
            "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
            isActive("/settings") ? "bg-panel text-foreground" : "text-muted-foreground hover:bg-panel/60 hover:text-foreground",
          )}
        >
          <Settings className="h-4 w-4" />
          Settings
        </NavLink>
      </div>
    </aside>
  );
}

