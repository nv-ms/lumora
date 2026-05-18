import { NavLink } from "react-router-dom";
import { Clock, Film, Home, Settings, Tv } from "lucide-react";

const nav = [
  { to: "/", label: "Home", icon: Home },
  { to: "/movies", label: "Movies", icon: Film },
  { to: "/series", label: "Series", icon: Tv },
  { to: "/history", label: "History", icon: Clock },
];

export function AppSidebar() {
  return (
    <aside className="hidden md:flex w-60 shrink-0 flex-col border-r border-hairline bg-background">
      <div className="px-6 py-7 text-sm font-semibold tracking-[0.25em] uppercase">Director</div>
      <nav className="px-3 space-y-1">
        {nav.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink key={item.to} to={item.to} className={({ isActive }) => `flex items-center gap-3 px-3 py-2 rounded-md text-sm ${isActive ? "bg-panel text-foreground" : "text-muted-foreground hover:bg-panel/60 hover:text-foreground"}`}>
              <Icon className="h-4 w-4" />{item.label}
            </NavLink>
          );
        })}
      </nav>
      <div className="mt-auto p-3 border-t border-hairline">
        <NavLink to="/settings" className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-muted-foreground hover:bg-panel/60 hover:text-foreground"><Settings className="h-4 w-4" />Settings</NavLink>
      </div>
    </aside>
  );
}