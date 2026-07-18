import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { AppSidebar } from "./app-sidebar";
import { wsUrl } from "../lib/api";

export function AppLayout() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const isPlayer = pathname.startsWith("/watch/");
  const [hostConnected, setHostConnected] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let active = true;
    let socket;
    let retry;
    const connect = () => {
      socket = new WebSocket(wsUrl("/ws"));
      socket.onopen = () => setHostConnected(true);
      socket.onclose = () => {
        if (!active) return;
        setHostConnected(false);
        retry = setTimeout(connect, 3000);
      };
      socket.onerror = () => {
        if (!active) return;
        setHostConnected(false);
        socket.close();
      };
    };
    connect();
    return () => {
      active = false;
      clearTimeout(retry);
      socket?.close();
    };
  }, []);

  if (isPlayer) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <Outlet />
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full bg-background text-foreground overflow-hidden">
      <AppSidebar />
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        <header className="h-14 shrink-0 border-b border-hairline flex items-center px-6 gap-4">
          <div className="flex items-center gap-2 h-9 px-3 bg-panel rounded-md w-72 max-w-full">
            <Search className="h-3.5 w-3.5 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== "Enter") return;
                const q = query.trim();
                navigate(q ? `/search?q=${encodeURIComponent(q)}` : "/search");
              }}
              placeholder="Search library"
              className="bg-transparent text-sm outline-none flex-1 placeholder:text-muted-foreground"
            />
            <span className="text-[10px] font-mono text-muted-foreground">CMD+K</span>
          </div>
          <div className="ml-auto flex items-center gap-3 text-xs text-muted-foreground font-mono">
            <span className={`size-1.5 rounded-full ${hostConnected ? "bg-emerald-500" : "bg-rose-500"}`} />
            {hostConnected ? "Connected" : "Disconnected"}
          </div>
        </header>
        <main data-dpad-scroll className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

