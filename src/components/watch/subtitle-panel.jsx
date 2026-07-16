import { useState } from "react";
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
  audioTracks = [],
  selectedAudioStreamIndex,
  onSelectAudio,
  onClose,
}) {
  const [tab, setTab] = useState(audioTracks.length > 1 ? "audio" : "subtitles");
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black/40" onClick={onClose}>
      <aside className="absolute right-0 top-0 flex h-full w-95 min-h-0 flex-col overflow-hidden border-l border-hairline bg-background" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-hairline px-5 py-4">
          <div className="text-sm font-medium">Audio &amp; Subtitles</div>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-md hover:bg-panel"><X className="h-4 w-4" /></button>
        </div>
        <div className="flex gap-2 border-b border-hairline p-4">
          <button autoFocus onClick={() => setTab("audio")} className={cn("rounded-md px-4 py-2 text-sm outline-2 outline-offset-2 focus-visible:outline", tab === "audio" ? "bg-foreground text-background" : "bg-panel")}>Audio</button>
          <button onClick={() => setTab("subtitles")} className={cn("rounded-md px-4 py-2 text-sm outline-2 outline-offset-2 focus-visible:outline", tab === "subtitles" ? "bg-foreground text-background" : "bg-panel")}>Subtitles</button>
        </div>
        {tab === "subtitles" && <div className="border-b border-hairline p-4">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search subtitle..."
            className="h-10 w-full rounded-md border border-hairline bg-panel px-3 text-sm outline-none focus:border-foreground/40"
          />
        </div>}
        <div className="min-h-0 flex-1 overflow-auto p-4">
          <div className="space-y-2">
            {tab === "audio" && audioTracks.map((track) => (
              <button key={track.index} onClick={() => onSelectAudio(track.index)} className={cn("w-full truncate rounded-md border px-3 py-3 text-left text-sm outline-2 outline-offset-2 focus-visible:outline", selectedAudioStreamIndex === track.index ? "border-foreground bg-panel-2" : "border-hairline bg-panel hover:bg-panel-2")}> 
                {track.title || track.language || `Audio ${track.index}`} · {track.channels || 2}ch
              </button>
            ))}
            {tab === "subtitles" && !options.length && <div className="text-sm text-muted-foreground">No matches.</div>}
            {tab === "subtitles" && options.map((entry) => (
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
        {tab === "subtitles" && <div className="border-t border-hairline p-4">
          <div className="text-xs text-muted-foreground">Timing Offset</div>
          <input type="range" min={-8} max={8} step={0.1} value={delay} onChange={(e) => setDelay(Number(e.target.value))} className="mt-2 w-full" />
          <div className="mt-1 text-xs text-muted-foreground">{delay.toFixed(1)}s</div>
        </div>}
      </aside>
    </div>
  );
}
