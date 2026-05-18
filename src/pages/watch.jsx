import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Cog,
  Minus,
  Pause,
  Pencil,
  Play,
  Plus,
  Subtitles,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { cn } from "../lib/utils";
import { useCatalog } from "../lib/catalog-context";

const seedSubtitles = [
  { index: 1, start: 12, end: 15, text: "I told you not to come here at night." },
  { index: 2, start: 15.5, end: 18, text: "The warning was clear enough." },
  { index: 3, start: 19, end: 22, text: "We have to leave before dawn." },
];

function fmt(seconds) {
  const minutes = Math.floor((seconds || 0) / 60);
  const secs = Math.floor((seconds || 0) % 60);
  return `${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

export function WatchPage() {
  const { id } = useParams();
  const { getItem } = useCatalog();
  const item = id ? getItem(id) : null;

  const videoRef = useRef(null);
  const hideTimerRef = useRef(null);
  const syncTimerRef = useRef(null);
  const currentRef = useRef(0);
  const durationRef = useRef(0);

  const [playing, setPlaying] = useState(true);
  const [muted, setMuted] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [drawer, setDrawer] = useState("none");
  const [offset, setOffset] = useState(0);
  const [cues, setCues] = useState(seedSubtitles);
  const [editingIdx, setEditingIdx] = useState(null);
  const [controlsVisible, setControlsVisible] = useState(true);

  const syncPlayback = async () => {
    if (!item || !durationRef.current) return;
    await fetch(`/api/playback/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        progress: Math.min(1, currentRef.current / durationRef.current),
        currentTime: currentRef.current,
        duration: durationRef.current,
      }),
    });
  };

  const resetHideTimer = () => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    setControlsVisible(true);
    if (playing && drawer === "none") hideTimerRef.current = setTimeout(() => setControlsVisible(false), 2500);
  };

  useEffect(() => {
    resetHideTimer();
    return () => hideTimerRef.current && clearTimeout(hideTimerRef.current);
  }, [playing, drawer]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (playing) video.play().catch(() => setPlaying(false));
    else video.pause();
  }, [playing, item]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = muted;
  }, [muted]);

  useEffect(() => {
    currentRef.current = current;
    durationRef.current = duration;
  }, [current, duration]);

  useEffect(() => {
    syncTimerRef.current = setInterval(syncPlayback, 5000);
    return () => {
      if (syncTimerRef.current) clearInterval(syncTimerRef.current);
      syncPlayback();
    };
  }, [item?.id]);

  if (!item) {
    return <div className="p-12 text-sm text-muted-foreground">Title not found.</div>;
  }

  const loopT = (current || 0) % 40;
  const adjT = loopT - offset / 1000;
  const activeCue = cues.find((cue) => adjT >= cue.start && adjT <= cue.end);

  return (
    <div className="min-h-screen w-screen bg-black text-foreground flex flex-col" onMouseMove={resetHideTimer}>
      <div className="relative flex-1 flex items-center justify-center overflow-hidden">
        <video
          ref={videoRef}
          src={item.streamUrl}
          className="absolute inset-0 h-full w-full object-contain bg-black"
          autoPlay
          onTimeUpdate={(event) => setCurrent(event.currentTarget.currentTime || 0)}
          onLoadedMetadata={(event) => {
            const video = event.currentTarget;
            setDuration(video.duration || 0);
            if (item.currentTime && item.currentTime < video.duration) video.currentTime = item.currentTime;
          }}
          onClick={() => setPlaying((value) => !value)}
        />

        {activeCue && (
          <div className="absolute bottom-32 left-1/2 -translate-x-1/2 px-4">
            <div className="px-4 py-1.5 bg-black/70 text-white text-lg text-center max-w-3xl">{activeCue.text}</div>
          </div>
        )}

        <div className={cn("absolute inset-0 transition-opacity duration-300", controlsVisible || drawer !== "none" ? "opacity-100" : "opacity-0 pointer-events-none")}>
          <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-6 py-4 bg-gradient-to-b from-black/70 to-transparent">
            <Link to={item.seriesId ? `/series/${item.seriesId}` : "/"} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" />Back
            </Link>
            <div className="text-xs font-mono text-muted-foreground truncate max-w-md">{item.path}</div>
          </div>

          <div className="absolute bottom-0 left-0 right-0 px-8 pb-8 pt-12 bg-gradient-to-t from-black/70 to-transparent">
            <div className="text-sm font-medium">{item.title}</div>
            <div className="mt-4 flex items-center gap-3">
              <span className="font-mono text-xs text-muted-foreground w-12">{fmt(current)}</span>
              <input
                type="range"
                min={0}
                max={duration || 0}
                value={current}
                onChange={(event) => {
                  const value = Number(event.target.value);
                  setCurrent(value);
                  if (videoRef.current) videoRef.current.currentTime = value;
                }}
                className="flex-1 accent-[oklch(0.65_0.17_255)]"
              />
              <span className="font-mono text-xs text-muted-foreground w-12 text-right">{fmt(duration)}</span>
            </div>

            <div className="mt-4 flex items-center gap-6">
              <button onClick={() => setPlaying((value) => !value)} className="h-10 w-10 rounded-full bg-foreground text-background grid place-items-center">
                {playing ? <Pause className="h-4 w-4 fill-current" /> : <Play className="h-4 w-4 fill-current" />}
              </button>
              <button onClick={() => setMuted((value) => !value)} className="text-muted-foreground hover:text-foreground" aria-label="Volume">
                {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              </button>
              <button onClick={() => setDrawer(drawer === "subs" ? "none" : "subs")} className={cn("inline-flex items-center gap-2 text-sm", drawer === "subs" ? "text-foreground" : "text-muted-foreground hover:text-foreground")}>
                <Subtitles className="h-4 w-4" />Subtitles
              </button>
              <button className="text-muted-foreground hover:text-foreground inline-flex items-center gap-2 text-sm"><Cog className="h-4 w-4" />Settings</button>
              <div className="ml-auto text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Auto-hide active</div>
            </div>
          </div>
        </div>
      </div>

      {drawer === "subs" && (
        <aside className="fixed right-0 top-0 h-full w-[380px] bg-panel border-l border-hairline z-50 flex flex-col">
          <div className="px-5 py-4 border-b border-hairline flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">Subtitle editor</div>
              <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">English - SRT</div>
            </div>
            <button onClick={() => setDrawer("none")} className="h-7 w-7 grid place-items-center rounded-md hover:bg-panel-2" aria-label="Close"><X className="h-4 w-4" /></button>
          </div>

          <div className="p-5 border-b border-hairline">
            <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Timing offset</div>
            <div className="mt-3 flex items-center justify-between">
              <button onClick={() => setOffset((value) => value - 250)} className="h-8 w-8 rounded-md bg-background hover:bg-panel-2 ring-1 ring-hairline grid place-items-center"><Minus className="h-3.5 w-3.5" /></button>
              <div className="font-mono text-xl">{offset > 0 ? "+" : ""}{(offset / 1000).toFixed(2)}s</div>
              <button onClick={() => setOffset((value) => value + 250)} className="h-8 w-8 rounded-md bg-background hover:bg-panel-2 ring-1 ring-hairline grid place-items-center"><Plus className="h-3.5 w-3.5" /></button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            <ul className="divide-y divide-hairline">
              {cues.map((cue, index) => {
                const editing = editingIdx === index;
                return (
                  <li key={cue.index} className="px-5 py-3">
                    <div className="flex items-center gap-3 text-[10px] font-mono text-muted-foreground">
                      <span>#{cue.index}</span>
                      {editing ? (
                        <>
                          <input type="number" step={0.1} value={cue.start} onChange={(event) => setCues((entries) => entries.map((entry, entryIndex) => entryIndex === index ? { ...entry, start: Number(event.target.value) } : entry))} className="w-16 bg-background ring-1 ring-hairline rounded px-1.5 py-0.5" />
                          <span>-&gt;</span>
                          <input type="number" step={0.1} value={cue.end} onChange={(event) => setCues((entries) => entries.map((entry, entryIndex) => entryIndex === index ? { ...entry, end: Number(event.target.value) } : entry))} className="w-16 bg-background ring-1 ring-hairline rounded px-1.5 py-0.5" />
                        </>
                      ) : (
                        <span>{fmt(cue.start)} -&gt; {fmt(cue.end)}</span>
                      )}
                      <button onClick={() => setEditingIdx(editing ? null : index)} className="ml-auto text-muted-foreground hover:text-foreground" aria-label="Edit"><Pencil className="h-3 w-3" /></button>
                    </div>
                    {editing ? (
                      <textarea value={cue.text} onChange={(event) => setCues((entries) => entries.map((entry, entryIndex) => entryIndex === index ? { ...entry, text: event.target.value } : entry))} className="mt-2 w-full bg-background ring-1 ring-hairline rounded p-2 text-sm resize-none" rows={2} />
                    ) : (
                      <div className={cn("mt-1.5 text-sm leading-snug", activeCue?.index === cue.index ? "text-accent" : "text-foreground/90")}>{cue.text}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        </aside>
      )}
    </div>
  );
}
