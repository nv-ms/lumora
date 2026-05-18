import { NavLink, useLocation } from "react-router-dom";
import { Clock, Film, Home, Settings, TableProperties, Tv } from "lucide-react";
import { cn } from "../lib/utils";

const nav = [
  { to: "/", label: "Home", icon: Home },
  { to: "/movies", label: "Movies", icon: Film },
  { to: "/series", label: "Series", icon: Tv },
  { to: "/history", label: "History", icon: Clock },
  { to: "/catalog", label: "Catalog", icon: TableProperties },
];

export function AppSidebar() {
  const { pathname } = useLocation();
  const isActive = (to) => (to === "/" ? pathname === "/" : pathname.startsWith(to));

  return (
    <aside className="hidden md:flex w-60 shrink-0 flex-col border-r border-hairline bg-background overflow-hidden">
      <div className="px-6 py-7">
        <div className="text-sm font-semibold uppercase">Director</div>
        <div className="mt-1 text-[10px] font-mono uppercase text-muted-foreground">Local library</div>
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



