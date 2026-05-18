import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Maximize2, Minimize2, MoveHorizontal, Pause, Play, Subtitles, Volume2, VolumeX, X } from "lucide-react";
import { cn } from "../lib/utils";
import { useCatalog } from "../lib/catalog-context";

const SEEK_STEPS = [10, 20, 30];
const SEEK_COOLDOWN_MS = 1200;

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
  const saveTimerRef = useRef(null);
  const currentRef = useRef(0);
  const durationRef = useRef(0);
  const seekRef = useRef({ at: 0, step: 0 });
  const cueBaseRef = useRef(new Map());

  const [playing, setPlaying] = useState(true);
  const [muted, setMuted] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [subtitlePanelOpen, setSubtitlePanelOpen] = useState(false);
  const [subtitleTracks, setSubtitleTracks] = useState([]);
  const [embeddedTrackOptions, setEmbeddedTrackOptions] = useState([]);
  const [selectedSubtitleId, setSelectedSubtitleId] = useState("off");
  const [subtitleDelay, setSubtitleDelay] = useState(0);
  const [fitMode, setFitMode] = useState("contain");
  const [subtitleQuery, setSubtitleQuery] = useState("");
  const [seekPreview, setSeekPreview] = useState(null);
  const aspectModes = ["contain", "cover", "fill"];

  const isInteractiveTarget = (target) => {
    if (!(target instanceof Element)) return false;
    return !!target.closest("button, a, input, select, textarea, [role='button']");
  };

  const actionByX = (clientX, rect) => {
    const ratio = (clientX - rect.left) / rect.width;
    if (ratio < 1 / 3) return "rewind";
    if (ratio > 2 / 3) return "forward";
    return "toggle";
  };

  const savePlayback = async (useBeacon = false) => {
    if (!item || !durationRef.current) return;
    const payload = { progress: Math.min(1, currentRef.current / durationRef.current), currentTime: currentRef.current, duration: durationRef.current };
    if (useBeacon && navigator.sendBeacon) {
      navigator.sendBeacon(`/api/playback/${item.id}`, new Blob([JSON.stringify(payload)], { type: "application/json" }));
      return;
    }
    await fetch(`/api/playback/${item.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload), keepalive: true });
  };

  const resetHideTimer = () => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    setControlsVisible(true);
    if (playing && !subtitlePanelOpen) hideTimerRef.current = setTimeout(() => setControlsVisible(false), 2500);
  };

  const performSeek = (direction) => {
    const video = videoRef.current;
    if (!video) return;
    const now = Date.now();
    if (now - seekRef.current.at > SEEK_COOLDOWN_MS) seekRef.current.step = 0;
    else seekRef.current.step = Math.min(seekRef.current.step + 1, SEEK_STEPS.length - 1);
    seekRef.current.at = now;
    const amount = SEEK_STEPS[seekRef.current.step] * direction;
    const max = duration || video.duration || 0;
    const nextTime = Math.max(0, Math.min(max, video.currentTime + amount));
    setSeekPreview({ amount, target: nextTime, at: Date.now(), step: SEEK_STEPS[seekRef.current.step] });
    video.currentTime = nextTime;
    setCurrent(video.currentTime);
  };

  const applySubtitleSelection = (trackId) => {
    setSelectedSubtitleId(trackId);
    const video = videoRef.current;
    if (!video) return;
    const selectedTrack = subtitleTracks.find((track) => `ext:${track.id}` === trackId);
    for (let idx = 0; idx < video.textTracks.length; idx += 1) {
      const track = video.textTracks[idx];
      if (trackId === "off") track.mode = "disabled";
      else if (trackId.startsWith("emb:")) track.mode = `emb:${idx}` === trackId ? "showing" : "disabled";
      else track.mode = selectedTrack && track.label === `ext:${selectedTrack.id}` ? "showing" : "disabled";
    }
  };

  const applySubtitleLayoutAndTiming = () => {
    const video = videoRef.current;
    if (!video) return;
    const bottomOffset = controlsVisible || subtitlePanelOpen ? 24 : 10;
    const line = Math.max(55, Math.min(96, 100 - bottomOffset));
    for (let i = 0; i < video.textTracks.length; i += 1) {
      const track = video.textTracks[i];
      if (!track.cues) continue;
      for (let j = 0; j < track.cues.length; j += 1) {
        const cue = track.cues[j];
        const key = `${i}:${j}`;
        if (!cueBaseRef.current.has(key)) cueBaseRef.current.set(key, { start: cue.startTime, end: cue.endTime });
        const base = cueBaseRef.current.get(key);
        cue.snapToLines = false;
        cue.line = line;
        try {
          cue.startTime = Math.max(0, base.start + subtitleDelay);
          cue.endTime = Math.max(cue.startTime + 0.05, base.end + subtitleDelay);
        } catch {}
      }
    }
  };

  const toggleAspectMode = () => {
    setFitMode((currentMode) => {
      const idx = aspectModes.indexOf(currentMode);
      return aspectModes[(idx + 1) % aspectModes.length];
    });
  };

  useEffect(() => {
    if (!item) return;
    fetch(`/api/subtitles/${item.id}`).then((r) => r.json()).then((p) => {
      const tracks = Array.isArray(p.tracks) ? p.tracks : [];
      setSubtitleTracks(tracks);
      if (tracks.length) setSelectedSubtitleId(`ext:${tracks[0].id}`);
    }).catch(() => setSubtitleTracks([]));
  }, [item?.id]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (!videoRef.current) return;
      if (event.key === "ArrowLeft") { event.preventDefault(); performSeek(-1); }
      if (event.key === "ArrowRight") { event.preventDefault(); performSeek(1); }
      if (event.key === " ") { event.preventDefault(); setPlaying((v) => !v); }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [duration]);

  useEffect(() => { applySubtitleSelection(selectedSubtitleId); }, [selectedSubtitleId, subtitleTracks.length, embeddedTrackOptions.length]);
  useEffect(() => { applySubtitleLayoutAndTiming(); }, [subtitleDelay, controlsVisible, subtitlePanelOpen, selectedSubtitleId, current]);
  useEffect(() => {
    if (!seekPreview) return undefined;
    const timer = setTimeout(() => setSeekPreview(null), 900);
    return () => clearTimeout(timer);
  }, [seekPreview]);
  useEffect(() => { currentRef.current = current; durationRef.current = duration; }, [current, duration]);
  useEffect(() => { resetHideTimer(); return () => hideTimerRef.current && clearTimeout(hideTimerRef.current); }, [playing, subtitlePanelOpen]);
  useEffect(() => { const v = videoRef.current; if (!v) return; if (playing) v.play().catch(() => setPlaying(false)); else v.pause(); }, [playing, item?.id]);
  useEffect(() => { const v = videoRef.current; if (v) v.muted = muted; }, [muted]);

  useEffect(() => {
    saveTimerRef.current = setInterval(() => savePlayback(false), 5000);
    const onPageHide = () => savePlayback(true);
    const onVisibility = () => { if (document.visibilityState === "hidden") savePlayback(true); };
    window.addEventListener("pagehide", onPageHide);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      if (saveTimerRef.current) clearInterval(saveTimerRef.current);
      window.removeEventListener("pagehide", onPageHide);
      document.removeEventListener("visibilitychange", onVisibility);
      savePlayback(true);
    };
  }, [item?.id]);

  if (!item) return <div className="p-12 text-sm text-muted-foreground">Title not found.</div>;
  const AspectIcon = fitMode === "contain" ? Minimize2 : fitMode === "cover" ? Maximize2 : MoveHorizontal;
  const subtitleOptions = [
    { id: "off", label: "Off" },
    ...subtitleTracks.map((track) => ({ id: `ext:${track.id}`, label: track.label })),
    ...embeddedTrackOptions.map((track) => ({ id: track.id, label: track.label })),
  ];
  const filteredSubtitleOptions = subtitleOptions.filter((entry) => entry.label.toLowerCase().includes(subtitleQuery.trim().toLowerCase()));

  return (
    <div
      className="flex min-h-screen w-screen flex-col bg-black text-foreground"
      onMouseMove={resetHideTimer}
      onClick={(e) => {
        if (isInteractiveTarget(e.target)) return;
        if (!videoRef.current) return;
        const action = actionByX(e.clientX, videoRef.current.getBoundingClientRect());
        if (action === "rewind") performSeek(-1);
        if (action === "forward") performSeek(1);
        if (action === "toggle") setPlaying((v) => !v);
      }}
      onTouchEnd={(e) => {
        if (isInteractiveTarget(e.target)) return;
        const touch = e.changedTouches?.[0];
        if (!touch || !videoRef.current) return;
        const action = actionByX(touch.clientX, videoRef.current.getBoundingClientRect());
        if (action === "rewind") performSeek(-1);
        if (action === "forward") performSeek(1);
        if (action === "toggle") setPlaying((v) => !v);
      }}
    >
      <div className="relative flex flex-1 items-center justify-center overflow-hidden">
        <video
          ref={videoRef}
          src={item.streamUrl}
          className={cn("absolute inset-0 h-full w-full bg-black", fitMode === "cover" ? "object-cover" : fitMode === "fill" ? "object-fill" : "object-contain")}
          autoPlay
          onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime || 0)}
          onPause={() => { setPlaying(false); savePlayback(false); }}
          onSeeked={() => savePlayback(false)}
          onLoadedMetadata={(e) => {
            const video = e.currentTarget;
            setDuration(video.duration || 0);
            const embedded = [];
            for (let idx = 0; idx < video.textTracks.length; idx += 1) {
              const track = video.textTracks[idx];
              if (track.kind === "subtitles" || track.kind === "captions") embedded.push({ id: `emb:${idx}`, label: track.label || `Embedded ${idx + 1}` });
            }
            setEmbeddedTrackOptions(embedded);
            if (!subtitleTracks.length && embedded.length) setSelectedSubtitleId(embedded[0].id);
            if (item.currentTime && item.currentTime < video.duration) { video.currentTime = item.currentTime; setCurrent(item.currentTime); }
            setTimeout(applySubtitleLayoutAndTiming, 120);
          }}
          onClick={() => {}}
          onDoubleClick={(e) => e.preventDefault()}
          onTouchEnd={() => {}}
        >
          {subtitleTracks.map((track) => (
            <track key={track.id} src={track.url} kind="subtitles" srcLang={track.lang || "und"} label={`ext:${track.id}`} default={`ext:${track.id}` === selectedSubtitleId} />
          ))}
        </video>

        {!playing && (
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/95 via-black/70 to-black/80">
            <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 px-6 text-center">
              <div className="truncate text-3xl font-semibold text-white md:text-4xl">{item.title}</div>
            </div>
          </div>
        )}
        {!!seekPreview && (
          <div className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 px-6 text-center">
            <div className="mx-auto inline-flex min-w-[260px] items-center justify-between gap-4 rounded-xl border border-white/25 bg-black/85 px-4 py-3 text-white shadow-2xl backdrop-blur-sm">
              <span className="text-xs text-white/70">{seekPreview.amount > 0 ? "Forward" : "Rewind"} ({seekPreview.step}s)</span>
              <span className="text-lg font-semibold tabular-nums">{fmt(seekPreview.target)}</span>
            </div>
          </div>
        )}

        <div className={cn("absolute inset-0 transition-opacity duration-300", controlsVisible || subtitlePanelOpen ? "opacity-100" : "pointer-events-none opacity-0")}>
          <div className="absolute left-0 right-0 top-0 flex items-center justify-between bg-gradient-to-b from-black/65 to-transparent px-6 py-4">
            <Link to={item.seriesId ? `/series/${item.seriesId}` : "/"} className="inline-flex items-center gap-2 text-sm text-white/80 hover:text-white"><ArrowLeft className="h-4 w-4" />Back</Link>
            <div className="max-w-md truncate text-xs text-white/70">{item.path}</div>
          </div>
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/65 to-transparent px-6 pb-8 pt-20 md:px-10 md:pb-10">
            <div className="truncate text-base font-semibold text-white md:text-lg">{item.title}</div>
            <div className="mt-5 flex items-center gap-3 md:gap-4">
              <span className="w-14 text-sm text-white/80">{fmt(current)}</span>
              <div className="relative flex-1">
                <div className="h-2 overflow-hidden rounded-full bg-white/20"><div className="h-full bg-white" style={{ width: `${duration ? (current / duration) * 100 : 0}%` }} /></div>
                <input type="range" min={0} max={duration || 0} value={current} onChange={(e) => { const v = Number(e.target.value); setCurrent(v); if (videoRef.current) videoRef.current.currentTime = v; }} className="absolute inset-0 w-full cursor-pointer opacity-0" />
              </div>
              <span className="w-20 text-right text-sm text-white/80">-{fmt(Math.max(0, duration - current))}</span>
            </div>
            <div className="mt-5 flex items-center gap-5 md:gap-7">
              <button onClick={() => setPlaying((v) => !v)} className="grid h-14 w-14 place-items-center rounded-full bg-white text-black">{playing ? <Pause className="h-6 w-6 fill-current" /> : <Play className="h-6 w-6 fill-current" />}</button>
              <div className="ml-auto flex items-center gap-3">
                <button onClick={() => setMuted((v) => !v)} className="grid h-12 w-12 place-items-center rounded-md bg-white/10 text-white hover:bg-white/20" title={muted ? "Unmute" : "Mute"}>{muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}</button>
                <button onClick={() => { const next = !subtitlePanelOpen; setSubtitlePanelOpen(next); if (next) setControlsVisible(true); }} className={cn("grid h-12 w-12 place-items-center rounded-md", subtitlePanelOpen ? "bg-white text-black" : "bg-white/10 text-white hover:bg-white/20")} title="Subtitles"><Subtitles className="h-5 w-5" /></button>
                <button onClick={toggleAspectMode} className="grid h-12 w-12 place-items-center rounded-md bg-white/10 text-white hover:bg-white/20" title={`Aspect: ${fitMode}`}><AspectIcon className="h-5 w-5" /></button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {subtitlePanelOpen && (
        <div className="fixed inset-0 z-50 bg-black/40" onClick={() => setSubtitlePanelOpen(false)}>
          <aside className="absolute right-0 top-0 flex h-full w-[380px] min-h-0 flex-col overflow-hidden border-l border-hairline bg-background" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-hairline px-5 py-4">
              <div className="text-sm font-medium">Subtitles</div>
              <button onClick={() => setSubtitlePanelOpen(false)} className="grid h-8 w-8 place-items-center rounded-md hover:bg-panel"><X className="h-4 w-4" /></button>
            </div>
            <div className="border-b border-hairline p-4">
              <input
                value={subtitleQuery}
                onChange={(e) => setSubtitleQuery(e.target.value)}
                placeholder="Search subtitle..."
                className="h-10 w-full rounded-md border border-hairline bg-panel px-3 text-sm outline-none focus:border-foreground/40"
              />
            </div>
            <div className="min-h-0 flex-1 overflow-auto p-4">
              {!filteredSubtitleOptions.length && <div className="text-sm text-muted-foreground">No matches.</div>}
              <div className="space-y-2">
                {filteredSubtitleOptions.map((entry) => (
                  <button
                    key={entry.id}
                    onClick={() => applySubtitleSelection(entry.id)}
                    className={cn("w-full truncate rounded-md border px-3 py-2 text-left text-sm", selectedSubtitleId === entry.id ? "border-foreground bg-panel-2" : "border-hairline bg-panel hover:bg-panel-2")}
                    title={entry.label}
                  >
                    {entry.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="border-t border-hairline p-4">
              <div className="text-xs text-muted-foreground">Timing Offset</div>
              <input type="range" min={-8} max={8} step={0.1} value={subtitleDelay} onChange={(e) => setSubtitleDelay(Number(e.target.value))} className="mt-2 w-full" />
              <div className="mt-1 text-xs text-muted-foreground">{subtitleDelay.toFixed(1)}s</div>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
