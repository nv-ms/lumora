import { X } from "lucide-react";
import { cn } from "../../lib/utils";

export function SubtitlePanel({
  open,
  query,
  setQuery,
  options,
  selectedId,
  onSelect,
  delay,
  setDelay,
  onClose,
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black/40" onClick={onClose}>
      <aside className="absolute right-0 top-0 flex h-full w-95 min-h-0 flex-col overflow-hidden border-l border-hairline bg-background" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-hairline px-5 py-4">
          <div className="text-sm font-medium">Subtitles</div>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-md hover:bg-panel"><X className="h-4 w-4" /></button>
        </div>
        <div className="border-b border-hairline p-4">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search subtitle..."
            className="h-10 w-full rounded-md border border-hairline bg-panel px-3 text-sm outline-none focus:border-foreground/40"
          />
        </div>
        <div className="min-h-0 flex-1 overflow-auto p-4">
          {!options.length && <div className="text-sm text-muted-foreground">No matches.</div>}
          <div className="space-y-2">
            {options.map((entry) => (
              <button
                key={entry.id}
                onClick={() => onSelect(entry.id)}
                className={cn("w-full truncate rounded-md border px-3 py-2 text-left text-sm", selectedId === entry.id ? "border-foreground bg-panel-2" : "border-hairline bg-panel hover:bg-panel-2")}
                title={entry.label}
              >
                {entry.label}
              </button>
            ))}
          </div>
        </div>
        <div className="border-t border-hairline p-4">
          <div className="text-xs text-muted-foreground">Timing Offset</div>
          <input type="range" min={-8} max={8} step={0.1} value={delay} onChange={(e) => setDelay(Number(e.target.value))} className="mt-2 w-full" />
          <div className="mt-1 text-xs text-muted-foreground">{delay.toFixed(1)}s</div>
        </div>
      </aside>
    </div>
  );
}