import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Gauge, Maximize2, Minimize2, Pause, Play, RotateCcw, RotateCw, Subtitles, Volume2, VolumeX } from "lucide-react";
import Hls from "hls.js";
import { cn } from "../lib/utils";
import { apiFetch, apiUrl, assetUrl } from "../lib/api";
import { useCatalog } from "../lib/catalog-context";
import { SubtitlePanel } from "../components/watch/subtitle-panel";
import { SEEK_COOLDOWN_MS, SEEK_STEPS, actionByX, fmt, isInteractiveTarget } from "../components/watch/player-utils";

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
  const lastTouchAtRef = useRef(0);
  const lastSideTapRef = useRef({ at: 0, zone: "" });
  const hlsRef = useRef(null);

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
  const [resumeAt, setResumeAt] = useState(0);
  const [playback, setPlayback] = useState({ state: "probing", method: "", percentage: null, error: "", url: "", audioTracks: [], selectedAudioStreamIndex: null });
  const [requestedAudio, setRequestedAudio] = useState(undefined);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const aspectModes = ["contain", "cover"];

  const savePlayback = async (useBeacon = false) => {
    if (!item || !durationRef.current) return;
    const payload = { progress: Math.min(1, currentRef.current / durationRef.current), currentTime: currentRef.current, duration: durationRef.current };
    if (useBeacon && navigator.sendBeacon) {
      navigator.sendBeacon(apiUrl(`/api/playback/${item.id}`), new Blob([JSON.stringify(payload)], { type: "application/json" }));
      return;
    }
    await apiFetch(`/api/playback/${item.id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload), keepalive: true });
  };

  const resetHideTimer = () => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    setControlsVisible(true);
    if (playing && !subtitlePanelOpen) hideTimerRef.current = setTimeout(() => setControlsVisible(false), 4000);
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
      else if (trackId.startsWith("emb:")) track.mode = track.label === trackId ? "showing" : "disabled";
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
        } catch { /* cue implementation does not allow timing updates */ }
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
    apiFetch(`/api/subtitles/${item.id}`).then((r) => r.json()).then((p) => {
      const tracks = Array.isArray(p.tracks) ? p.tracks.map((track) => ({ ...track, url: assetUrl(track.url) })) : [];
      setSubtitleTracks(tracks);
      if (tracks.length) setSelectedSubtitleId(`ext:${tracks[0].id}`);
    }).catch(() => setSubtitleTracks([]));
  }, [item?.id]);

  useEffect(() => {
    if (!item) return;
    apiFetch(`/api/playback/${item.id}`)
      .then((r) => r.json())
      .then((p) => {
        const t = Number(p?.playback?.currentTime || 0);
        setResumeAt(Number.isFinite(t) && t > 0 ? t : 0);
      })
      .catch(() => setResumeAt(0));
  }, [item?.id]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (!videoRef.current) return;
      if (subtitlePanelOpen || isInteractiveTarget(event.target)) return;
      if (event.key === "ArrowLeft") { event.preventDefault(); performSeek(-1); }
      if (event.key === "ArrowRight") { event.preventDefault(); performSeek(1); }
      if (event.key === " " || event.key === "Enter") { event.preventDefault(); setPlaying((v) => !v); }
      if (event.key === "ArrowUp" || event.key === "ArrowDown") { event.preventDefault(); setControlsVisible(true); resetHideTimer(); }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [duration]);

  useEffect(() => { applySubtitleSelection(selectedSubtitleId); }, [selectedSubtitleId, subtitleTracks.length, embeddedTrackOptions.length]);
  useEffect(() => { applySubtitleLayoutAndTiming(); }, [subtitleDelay, controlsVisible, subtitlePanelOpen, selectedSubtitleId, current]);
  useEffect(() => { if (subtitlePanelOpen) setSubtitleQuery(""); }, [subtitlePanelOpen]);
  useEffect(() => {
    if (!seekPreview) return undefined;
    const timer = setTimeout(() => setSeekPreview(null), 900);
    return () => clearTimeout(timer);
  }, [seekPreview]);
  useEffect(() => { currentRef.current = current; durationRef.current = duration; }, [current, duration]);
  useEffect(() => { resetHideTimer(); return () => hideTimerRef.current && clearTimeout(hideTimerRef.current); }, [playing, subtitlePanelOpen]);
  useEffect(() => { const v = videoRef.current; if (!v) return; if (playing) v.play().catch(() => setPlaying(false)); else v.pause(); }, [playing, item?.id]);
  useEffect(() => { const v = videoRef.current; if (v) v.muted = muted; }, [muted]);
  useEffect(() => { const v = videoRef.current; if (v) v.playbackRate = playbackSpeed; }, [playbackSpeed]);
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return undefined;
    const syncVolume = () => setMuted(video.muted || video.volume === 0);
    video.addEventListener("volumechange", syncVolume);
    return () => video.removeEventListener("volumechange", syncVolume);
  }, [item?.id]);
  useEffect(() => {
    if (!item) return undefined;
    let cancelled = false; let timer;
    const negotiate = async (audioStreamIndex) => {
      setPlayback((value) => ({ ...value, state: "probing", error: "" }));
      try {
        const response = await apiFetch(`/api/media/${item.id}/playback`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(audioStreamIndex === undefined ? {} : { audioStreamIndex }) });
        const data = await response.json();
        if (!response.ok && response.status !== 202) throw new Error(data.failure?.message || data.error || "Playback preparation failed");
        if (cancelled) return;
        const update = { state: data.state, method: data.compatibility?.method || data.method, percentage: data.percentage, url: data.playbackUrl ? assetUrl(data.playbackUrl) : "", audioTracks: data.audioTracks || [], selectedAudioStreamIndex: data.selectedAudioStreamIndex, renditionId: data.renditionId };
        setEmbeddedTrackOptions((data.subtitles || []).filter((track) => track.supported).map((track) => ({ id: `emb:${track.index}`, label: track.title || `${track.language} subtitles`, url: assetUrl(`/api/media/${item.id}/embedded-subtitles/${track.index}.vtt`), lang: track.language })));
        setPlayback((value) => ({ ...value, ...update }));
        if (!["playable", "complete"].includes(data.state) && data.pollingUrl) timer = setTimeout(() => poll(data.pollingUrl, update), 1000);
      } catch (error) { if (!cancelled) setPlayback((value) => ({ ...value, state: "failed", error: error.message || "Playback failed" })); }
    };
    const poll = async (url, base) => {
      try {
        const response = await apiFetch(url); const data = await response.json(); if (!response.ok) throw new Error(data.error || "Preparation failed");
        if (cancelled) return;
        setPlayback((value) => ({ ...value, ...base, ...data, url: data.playbackUrl ? assetUrl(data.playbackUrl) : value.url, error: data.failure?.message || "" }));
        if (!["playable", "complete", "failed"].includes(data.state)) timer = setTimeout(() => poll(url, base), 1000);
      } catch (error) { if (!cancelled) setPlayback((value) => ({ ...value, state: "failed", error: error.message })); }
    };
    negotiate(requestedAudio);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [item?.id, requestedAudio]);

  useEffect(() => {
    const video = videoRef.current; if (!video || !playback.url) return undefined;
    hlsRef.current?.destroy(); hlsRef.current = null;
    if (/\.m3u8(?:$|\?)/.test(playback.url) && Hls.isSupported()) {
      const hls = new Hls(); hlsRef.current = hls; hls.loadSource(playback.url); hls.attachMedia(video);
      hls.on(Hls.Events.ERROR, (_event, data) => { if (data.fatal) setPlayback((value) => ({ ...value, state: "failed", error: `HLS playback failed: ${data.details}` })); });
    } else video.src = playback.url;
    return () => { hlsRef.current?.destroy(); hlsRef.current = null; video.removeAttribute("src"); video.load(); };
  }, [playback.url]);

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
  const AspectIcon = fitMode === "contain" ? Minimize2 : Maximize2;
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
        if (Date.now() - lastTouchAtRef.current < 450) return;
        if (!videoRef.current) return;
        const action = actionByX(e.clientX, videoRef.current.getBoundingClientRect());
        if (action !== "toggle") return;
        setPlaying((v) => !v);
      }}
      onDoubleClick={(e) => {
        if (isInteractiveTarget(e.target)) return;
        if (!videoRef.current) return;
        const action = actionByX(e.clientX, videoRef.current.getBoundingClientRect());
        if (action === "rewind") performSeek(-1);
        if (action === "forward") performSeek(1);
      }}
      onTouchEnd={(e) => {
        if (isInteractiveTarget(e.target)) return;
        const touch = e.changedTouches?.[0];
        if (!touch || !videoRef.current) return;
        lastTouchAtRef.current = Date.now();
        const action = actionByX(touch.clientX, videoRef.current.getBoundingClientRect());
        if (action === "toggle") setPlaying((v) => !v);
        if (action === "rewind" || action === "forward") {
          const now = Date.now();
          const dbl = lastSideTapRef.current.zone === action && now - lastSideTapRef.current.at < 320;
          lastSideTapRef.current = { at: now, zone: action };
          if (dbl) performSeek(action === "rewind" ? -1 : 1);
        }
      }}
    >
      <div className="relative flex flex-1 items-center justify-center overflow-hidden">
        <video
          ref={videoRef}
          className={cn("absolute inset-0 h-full w-full bg-black", fitMode === "cover" ? "object-cover" : fitMode === "fill" ? "object-fill" : "object-contain")}
          autoPlay
          onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime || 0)}
          onPause={() => { setPlaying(false); savePlayback(false); }}
          onSeeked={() => savePlayback(false)}
          onLoadedMetadata={(e) => {
            const video = e.currentTarget;
            setDuration(video.duration || 0);
            const startAt = resumeAt || Number(item.currentTime || 0);
            if (startAt > 0 && startAt < video.duration) { video.currentTime = startAt; setCurrent(startAt); }
            setTimeout(applySubtitleLayoutAndTiming, 120);
          }}
          onClick={() => {}}
        >
          {subtitleTracks.map((track) => (
            <track key={track.id} src={track.url} kind="subtitles" srcLang={track.lang || "und"} label={`ext:${track.id}`} default={`ext:${track.id}` === selectedSubtitleId} />
          ))}
          {embeddedTrackOptions.map((track) => <track key={track.id} src={track.url} kind="subtitles" srcLang={track.lang || "und"} label={track.id} default={track.id === selectedSubtitleId} />)}
        </video>
        {!playback.url && (
          <div className="absolute inset-0 z-20 grid place-items-center bg-black/90 px-6 text-center">
            <div className="max-w-md">
              {playback.state !== "failed" && <div className="mx-auto mb-4 h-9 w-9 animate-spin rounded-full border-2 border-white/25 border-t-white" />}
              <div className="text-lg font-semibold text-white">{playback.state === "failed" ? "Unable to play this media" : playback.state === "queued" ? "Waiting to prepare" : playback.method === "audio-transcode" ? "Optimizing audio for this device" : playback.method === "full-transcode" ? "Optimizing video for this device" : "Preparing video for this device"}</div>
              {playback.percentage !== null && <div className="mt-2 text-sm text-white/65">{playback.percentage}%</div>}
              {!!playback.error && <div className="mt-3 text-sm text-rose-300">{playback.error}</div>}
              {playback.state === "failed" && <div className="mt-5 flex justify-center gap-2"><button onClick={() => window.location.reload()} className="rounded-md bg-white px-4 py-2 text-sm text-black">Retry</button><Link to={item.seriesId ? `/series/${item.seriesId}` : "/"} className="rounded-md bg-white/10 px-4 py-2 text-sm text-white">Back</Link></div>}
            </div>
          </div>
        )}

        {!playing && (
          <div className="pointer-events-none absolute inset-0 bg-linear-to-t from-black/95 via-black/70 to-black/80">
            <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 px-6 text-center">
              <div className="truncate text-3xl font-semibold text-white md:text-4xl">{item.title}</div>
            </div>
          </div>
        )}
        {!!seekPreview && (
          <div className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 px-6 text-center">
            <div className="mx-auto inline-flex min-w-65 items-center justify-between gap-4 rounded-xl border border-white/25 bg-black/85 px-4 py-3 text-white shadow-2xl backdrop-blur-sm">
              <span className="text-xs text-white/70">{seekPreview.amount > 0 ? "Forward" : "Rewind"} ({seekPreview.step}s)</span>
              <span className="text-lg font-semibold tabular-nums">{fmt(seekPreview.target)}</span>
            </div>
          </div>
        )}

        <div className={cn("absolute inset-0 transition-opacity duration-300", controlsVisible || subtitlePanelOpen ? "opacity-100" : "pointer-events-none opacity-0")}>
          <div className="absolute left-0 right-0 top-0 flex items-center gap-4 bg-linear-to-b from-black/65 to-transparent px-6 py-4">
            <Link aria-label="Back" title="Back" to={item.seriesId ? `/series/${item.seriesId}` : "/"} className="grid h-11 w-11 shrink-0 place-items-center rounded-md bg-white/10 text-white outline-2 outline-offset-2 hover:bg-white/20 focus-visible:outline"><ArrowLeft className="h-5 w-5" /></Link>
            <div className="min-w-0"><div className="truncate text-lg font-semibold text-white">{item.seriesTitle || item.title}</div><div className="truncate text-sm text-white/70">{item.seriesId ? `S${String(item.season || 0).padStart(2, "0")} E${String(item.number || 0).padStart(2, "0")} - ${item.title}` : ""}</div></div>
          </div>
          <div className="absolute bottom-0 left-0 right-0 bg-linear-to-t from-black/90 via-black/65 to-transparent px-6 pb-8 pt-20 md:px-10 md:pb-10">
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
              <div className="flex items-center gap-3">
                <button onClick={() => performSeek(-1)} className="grid h-12 w-12 place-items-center rounded-md bg-white/10" title="Back 10 seconds"><RotateCcw className="h-5 w-5" /></button>
                <button onClick={() => setPlaying((v) => !v)} className="grid h-14 w-14 place-items-center rounded-full bg-white text-black">{playing ? <Pause className="h-6 w-6 fill-current" /> : <Play className="h-6 w-6 fill-current" />}</button>
                <button onClick={() => performSeek(1)} className="grid h-12 w-12 place-items-center rounded-md bg-white/10" title="Forward 10 seconds"><RotateCw className="h-5 w-5" /></button>
              </div>
              <div className="ml-auto flex items-center gap-3">
                <button onClick={() => setMuted((v) => !v)} className="grid h-12 w-12 place-items-center rounded-md bg-white/10 text-white hover:bg-white/20" title={muted ? "Unmute" : "Mute"}>{muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}</button>
                <button aria-label="Audio and subtitles" onClick={() => { const next = !subtitlePanelOpen; setSubtitlePanelOpen(next); if (next) setControlsVisible(true); }} className={cn("grid h-11 w-11 place-items-center rounded-md outline-2 outline-offset-2 focus-visible:outline", subtitlePanelOpen ? "bg-white text-black" : "bg-white/10 text-white hover:bg-white/20")} title="Audio and subtitles"><Subtitles className="h-5 w-5" /></button>
                <label aria-label="Playback speed" title={`Playback speed: ${playbackSpeed}x`} className={cn("relative grid h-11 w-11 place-items-center rounded-md outline-2 outline-offset-2 focus-within:outline", playbackSpeed !== 1 ? "bg-white text-black" : "bg-white/10 text-white")}><Gauge className="h-5 w-5" /><select aria-label="Playback speed" value={playbackSpeed} onChange={(event) => setPlaybackSpeed(Number(event.target.value))} className="absolute inset-0 cursor-pointer opacity-0"><option value={0.5}>0.5x</option><option value={0.75}>0.75x</option><option value={1}>1x</option><option value={1.25}>1.25x</option><option value={1.5}>1.5x</option></select></label>
                <button aria-label="Fit or crop video" onClick={toggleAspectMode} className={cn("grid h-11 w-11 place-items-center rounded-md outline-2 outline-offset-2 hover:bg-white/20 focus-visible:outline", fitMode === "cover" ? "bg-white text-black" : "bg-white/10 text-white")} title={`Aspect: ${fitMode}`}><AspectIcon className="h-5 w-5" /></button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <SubtitlePanel
        open={subtitlePanelOpen}
        query={subtitleQuery}
        setQuery={setSubtitleQuery}
        options={filteredSubtitleOptions}
        selectedId={selectedSubtitleId}
        onSelect={applySubtitleSelection}
        delay={subtitleDelay}
        setDelay={setSubtitleDelay}
        audioTracks={playback.audioTracks}
        selectedAudioStreamIndex={playback.selectedAudioStreamIndex}
        onSelectAudio={(audioStreamIndex) => { const retainedTime = videoRef.current?.currentTime || 0; setResumeAt(retainedTime); setRequestedAudio(audioStreamIndex); setSubtitlePanelOpen(false); }}
        onClose={() => setSubtitlePanelOpen(false)}
      />
    </div>
  );
}

