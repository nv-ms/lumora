import { Outlet, useLocation } from "react-router-dom";
import { Search } from "lucide-react";
import { AppSidebar } from "./app-sidebar";

export function AppLayout() {
  const { pathname } = useLocation();
  if (pathname.startsWith("/watch/")) return <Outlet />;

  return (
    <div className="flex min-h-screen w-full bg-background text-foreground">
      <AppSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 border-b border-hairline flex items-center px-6 gap-4">
          <div className="flex items-center gap-2 h-9 px-3 bg-panel rounded-md w-72 max-w-full">
            <Search className="h-3.5 w-3.5 text-muted-foreground" />
            <input placeholder="Search library" className="bg-transparent text-sm outline-none flex-1 placeholder:text-muted-foreground" />
          </div>
        </header>
        <main className="flex-1 min-w-0"><Outlet /></main>
      </div>
    </div>
  );
}