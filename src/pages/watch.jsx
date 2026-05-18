import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Cog, Pause, Play, Subtitles, Volume2, VolumeX, X } from "lucide-react";
import { cn } from "../lib/utils";
import { useCatalog } from "../lib/catalog-context";

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

  const [playing, setPlaying] = useState(true);
  const [muted, setMuted] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [subtitlePanelOpen, setSubtitlePanelOpen] = useState(false);
  const [subtitleTracks, setSubtitleTracks] = useState([]);
  const [embeddedTrackOptions, setEmbeddedTrackOptions] = useState([]);
  const [selectedSubtitleId, setSelectedSubtitleId] = useState("off");

  const savePlayback = async (useBeacon = false) => {
    if (!item || !durationRef.current) return;
    const payload = {
      progress: Math.min(1, currentRef.current / durationRef.current),
      currentTime: currentRef.current,
      duration: durationRef.current,
    };

    if (useBeacon && navigator.sendBeacon) {
      const blob = new Blob([JSON.stringify(payload)], { type: "application/json" });
      navigator.sendBeacon(`/api/playback/${item.id}`, blob);
      return;
    }

    await fetch(`/api/playback/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true,
    });
  };

  const resetHideTimer = () => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    setControlsVisible(true);
    if (playing && !subtitlePanelOpen) {
      hideTimerRef.current = setTimeout(() => setControlsVisible(false), 2500);
    }
  };

  const applySubtitleSelection = (trackId) => {
    setSelectedSubtitleId(trackId);
    const video = videoRef.current;
    if (!video) return;
    const selectedTrack = subtitleTracks.find((track) => `ext:${track.id}` === trackId);
    const tracks = video.textTracks;
    for (let idx = 0; idx < tracks.length; idx += 1) {
      const track = tracks[idx];
      if (trackId === "off") {
        track.mode = "disabled";
      } else if (trackId.startsWith("emb:")) {
        track.mode = `emb:${idx}` === trackId ? "showing" : "disabled";
      } else {
        track.mode = selectedTrack && track.label === selectedTrack.label ? "showing" : "disabled";
      }
    }
  };

  useEffect(() => {
    if (!item) return;
    fetch(`/api/subtitles/${item.id}`)
      .then((response) => response.json())
      .then((payload) => {
        const tracks = Array.isArray(payload.tracks) ? payload.tracks : [];
        setSubtitleTracks(tracks);
        if (tracks.length) setSelectedSubtitleId(`ext:${tracks[0].id}`);
      })
      .catch(() => setSubtitleTracks([]));
  }, [item?.id]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (!videoRef.current) return;
      if (event.key === "ArrowLeft") {
        videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - 10);
      }
      if (event.key === "ArrowRight") {
        const max = duration || videoRef.current.duration || 0;
        videoRef.current.currentTime = Math.min(max, videoRef.current.currentTime + 10);
      }
      if (event.key === " ") {
        event.preventDefault();
        setPlaying((value) => !value);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [duration]);

  useEffect(() => {
    applySubtitleSelection(selectedSubtitleId);
  }, [selectedSubtitleId, subtitleTracks.length, embeddedTrackOptions.length]);

  useEffect(() => {
    currentRef.current = current;
    durationRef.current = duration;
  }, [current, duration]);

  useEffect(() => {
    resetHideTimer();
    return () => hideTimerRef.current && clearTimeout(hideTimerRef.current);
  }, [playing, subtitlePanelOpen]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (playing) video.play().catch(() => setPlaying(false));
    else video.pause();
  }, [playing, item?.id]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = muted;
  }, [muted]);

  useEffect(() => {
    saveTimerRef.current = setInterval(() => savePlayback(false), 5000);

    const onPageHide = () => savePlayback(true);
    const onVisibility = () => {
      if (document.visibilityState === "hidden") savePlayback(true);
    };

    window.addEventListener("pagehide", onPageHide);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      if (saveTimerRef.current) clearInterval(saveTimerRef.current);
      window.removeEventListener("pagehide", onPageHide);
      document.removeEventListener("visibilitychange", onVisibility);
      savePlayback(true);
    };
  }, [item?.id]);

  if (!item) {
    return <div className="p-12 text-sm text-muted-foreground">Title not found.</div>;
  }

  const activeSubtitleTrack =
    selectedSubtitleId.startsWith("ext:")
      ? subtitleTracks.find((track) => `ext:${track.id}` === selectedSubtitleId)
      : embeddedTrackOptions.find((track) => track.id === selectedSubtitleId);

  return (
    <div className="min-h-screen w-screen bg-black text-foreground flex flex-col" onMouseMove={resetHideTimer}>
      <div className="relative flex-1 flex items-center justify-center overflow-hidden">
        <video
          ref={videoRef}
          src={item.streamUrl}
          className="absolute inset-0 h-full w-full object-contain bg-black"
          autoPlay
          onTimeUpdate={(event) => setCurrent(event.currentTarget.currentTime || 0)}
          onPause={() => {
            setPlaying(false);
            savePlayback(false);
          }}
          onSeeked={() => savePlayback(false)}
          onLoadedMetadata={(event) => {
            const video = event.currentTarget;
            setDuration(video.duration || 0);
            const embedded = [];
            for (let idx = 0; idx < video.textTracks.length; idx += 1) {
              const track = video.textTracks[idx];
              if (track.kind === "subtitles" || track.kind === "captions") {
                embedded.push({ id: `emb:${idx}`, label: track.label || `Embedded ${idx + 1}` });
              }
            }
            setEmbeddedTrackOptions(embedded);
            if (!subtitleTracks.length && embedded.length) setSelectedSubtitleId(embedded[0].id);
            if (item.currentTime && item.currentTime < video.duration) {
              video.currentTime = item.currentTime;
              setCurrent(item.currentTime);
            }
          }}
          onClick={() => setPlaying((value) => !value)}
        >
          {subtitleTracks.map((track) => (
            <track
              key={track.id}
              src={track.url}
              kind="subtitles"
              srcLang={track.lang || "und"}
              label={track.label}
              default={`ext:${track.id}` === selectedSubtitleId}
            />
          ))}
        </video>

        <div className={cn("absolute inset-0 transition-opacity duration-300", controlsVisible || subtitlePanelOpen ? "opacity-100" : "opacity-0 pointer-events-none")}>
          <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-6 py-4 bg-gradient-to-b from-black/65 to-transparent">
            <Link to={item.seriesId ? `/series/${item.seriesId}` : "/"} className="inline-flex items-center gap-2 text-sm text-white/80 hover:text-white">
              <ArrowLeft className="h-4 w-4" />Back
            </Link>
            <div className="text-xs font-mono text-white/70 truncate max-w-md">{item.path}</div>
          </div>

          <div className="absolute bottom-0 left-0 right-0 px-6 md:px-10 pb-8 md:pb-10 pt-20 bg-gradient-to-t from-black/90 via-black/65 to-transparent">
            <div className="text-base md:text-lg font-semibold text-white truncate">{item.title}</div>
            <div className="mt-5 flex items-center gap-3 md:gap-4">
              <span className="font-mono text-sm text-white/80 w-14">{fmt(current)}</span>
              <div className="relative flex-1">
                <div className="h-2 rounded-full bg-white/20 overflow-hidden">
                  <div className="h-full bg-white" style={{ width: `${duration ? (current / duration) * 100 : 0}%` }} />
                </div>
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
                  className="absolute inset-0 w-full opacity-0 cursor-pointer"
                />
              </div>
              <span className="font-mono text-sm text-white/80 w-20 text-right">-{fmt(Math.max(0, duration - current))}</span>
            </div>

            <div className="mt-5 flex items-center gap-5 md:gap-7">
              <button onClick={() => setPlaying((value) => !value)} className="h-14 w-14 rounded-full bg-white text-black grid place-items-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-white">
                {playing ? <Pause className="h-6 w-6 fill-current" /> : <Play className="h-6 w-6 fill-current" />}
              </button>
              <button
                onClick={() => {
                  if (!videoRef.current) return;
                  videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - 10);
                }}
                className="h-12 px-4 rounded-md bg-white/10 text-white hover:bg-white/20 text-sm font-mono focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
              >
                -10s
              </button>
              <button
                onClick={() => {
                  if (!videoRef.current) return;
                  const max = duration || videoRef.current.duration || 0;
                  videoRef.current.currentTime = Math.min(max, videoRef.current.currentTime + 10);
                }}
                className="h-12 px-4 rounded-md bg-white/10 text-white hover:bg-white/20 text-sm font-mono focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
              >
                +10s
              </button>
              <button onClick={() => setMuted((value) => !value)} className="h-12 w-12 rounded-md bg-white/10 text-white hover:bg-white/20 grid place-items-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-white" aria-label="Volume">
                {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
              </button>
              <button
                onClick={() => {
                  const next = !subtitlePanelOpen;
                  setSubtitlePanelOpen(next);
                  if (next) setControlsVisible(true);
                }}
                className={cn(
                  "h-12 px-4 rounded-md inline-flex items-center gap-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-white",
                  subtitlePanelOpen ? "bg-white text-black" : "bg-white/10 text-white hover:bg-white/20",
                )}
              >
                <Subtitles className="h-5 w-5" /> Subtitles
              </button>
              <button className="h-12 px-4 rounded-md bg-white/10 text-white hover:bg-white/20 inline-flex items-center gap-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-white">
                <Cog className="h-5 w-5" /> Settings
              </button>
            </div>
          </div>
        </div>
      </div>

      {subtitlePanelOpen && (
        <aside className="fixed right-0 top-0 h-full w-[360px] bg-panel border-l border-hairline z-50 flex flex-col">
          <div className="px-5 py-4 border-b border-hairline flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">Subtitle Tracks</div>
              <div className="text-[10px] font-mono text-muted-foreground">Detected from media folder</div>
            </div>
            <button onClick={() => setSubtitlePanelOpen(false)} className="h-7 w-7 grid place-items-center rounded-md hover:bg-panel-2" aria-label="Close">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="p-5">
            {!subtitleTracks.length && !embeddedTrackOptions.length && <div className="text-sm text-muted-foreground">No subtitles found (external or embedded).</div>}
            {!!subtitleTracks.length || !!embeddedTrackOptions.length ? (
              <>
                <label className="text-xs text-muted-foreground">Active subtitle</label>
                <select
                  value={selectedSubtitleId}
                  onChange={(event) => applySubtitleSelection(event.target.value)}
                  className="mt-2 w-full h-10 rounded-md bg-background ring-1 ring-hairline px-3 text-sm"
                >
                  <option value="off">Off</option>
                  {subtitleTracks.map((track) => (
                    <option key={`ext:${track.id}`} value={`ext:${track.id}`}>{track.label} (file)</option>
                  ))}
                  {embeddedTrackOptions.map((track) => (
                    <option key={track.id} value={track.id}>{track.label} (embedded)</option>
                  ))}
                </select>
                {activeSubtitleTrack && (
                  <div className="mt-4 text-xs text-muted-foreground break-all">
                    Using: {activeSubtitleTrack.label}
                  </div>
                )}
              </>
            ) : null}
          </div>
        </aside>
      )}
    </div>
  );
}

