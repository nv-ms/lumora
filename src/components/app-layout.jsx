import { Outlet, useLocation } from "react-router-dom";
import { Search } from "lucide-react";
import { AppSidebar } from "./app-sidebar";

export function AppLayout() {
  const { pathname } = useLocation();
  const isPlayer = pathname.startsWith("/watch/");

  if (isPlayer) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <Outlet />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full bg-background text-foreground">
      <AppSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 border-b border-hairline flex items-center px-6 gap-4">
          <div className="flex items-center gap-2 h-9 px-3 bg-panel rounded-md w-72 max-w-full">
            <Search className="h-3.5 w-3.5 text-muted-foreground" />
            <input placeholder="Search library" className="bg-transparent text-sm outline-none flex-1 placeholder:text-muted-foreground" />
            <span className="text-[10px] font-mono text-muted-foreground">CMD+K</span>
          </div>
          <div className="ml-auto flex items-center gap-3 text-xs text-muted-foreground font-mono">
            <span className="size-1.5 rounded-full bg-emerald-500" />
            HOST CONNECTED
          </div>
        </header>
        <main className="flex-1 min-w-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
