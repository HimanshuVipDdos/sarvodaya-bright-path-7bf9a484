import { useEffect, useRef, useState, type RefObject } from "react";
import {
  Play, Pause, Volume2, VolumeX, Maximize, Gauge, RotateCcw, RotateCw, Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2] as const;
const YT_QUALITY_LABEL: Record<string, string> = {
  auto: "Auto", tiny: "144p", small: "240p", medium: "360p", large: "480p",
  hd720: "720p", hd1080: "1080p", hd1440: "1440p", hd2160: "2160p", highres: "Max",
};

function isDirectVideo(url: string) {
  return /\.(mp4|webm|m4v|mov|ogv)(\?|#|$)/i.test(url);
}

function parseYouTubeId(url: string): string | null {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");
    if (host === "youtu.be") return u.pathname.replace(/^\//, "") || null;
    if (host.endsWith("youtube.com") || host.endsWith("youtube-nocookie.com")) {
      if (u.pathname === "/watch") return u.searchParams.get("v");
      const m = u.pathname.match(/^\/(?:shorts|live|embed)\/([^/]+)/);
      if (m) return m[1];
    }
    return null;
  } catch {
    return null;
  }
}

function parseVimeoId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.replace(/^www\./, "") === "vimeo.com") {
      const vid = u.pathname.replace(/^\//, "");
      if (/^\d+$/.test(vid)) return vid;
    }
    return null;
  } catch { return null; }
}

function toGenericEmbed(url: string): string {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");
    if (host === "drive.google.com") {
      const m = u.pathname.match(/\/file\/d\/([^/]+)/);
      if (m) return `https://drive.google.com/file/d/${m[1]}/preview`;
    }
  } catch {}
  return url;
}

function fmt(t: number) {
  if (!isFinite(t)) return "0:00";
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

// Load YouTube IFrame API once
let ytApiPromise: Promise<any> | null = null;
function loadYouTubeApi(): Promise<any> {
  if (typeof window === "undefined") return Promise.reject();
  const w = window as any;
  if (w.YT && w.YT.Player) return Promise.resolve(w.YT);
  if (ytApiPromise) return ytApiPromise;
  ytApiPromise = new Promise((resolve) => {
    const prev = w.onYouTubeIframeAPIReady;
    w.onYouTubeIframeAPIReady = () => {
      prev?.();
      resolve(w.YT);
    };
    if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
      const s = document.createElement("script");
      s.src = "https://www.youtube.com/iframe_api";
      s.async = true;
      document.head.appendChild(s);
    }
  });
  return ytApiPromise;
}

/** Tracks whether `ref.current` is the element currently in native fullscreen.
 *  Also locks the screen to landscape on entering fullscreen (and unlocks on
 *  exit) so mobile behaves like the YouTube app instead of staying portrait
 *  with a small letterboxed video in the middle of the screen. Silently
 *  no-ops on browsers/devices that don't support the Orientation Lock API
 *  (e.g. iOS Safari) — those users can still rotate their phone manually. */
function useIsFullscreen(ref: RefObject<HTMLElement | null>) {
  const [isFs, setIsFs] = useState(false);
  useEffect(() => {
    const handler = () => {
      const fs = document.fullscreenElement === ref.current;
      setIsFs(fs);
      const orientation = (screen as any).orientation;
      if (fs) {
        orientation?.lock?.("landscape").catch(() => {});
      } else {
        orientation?.unlock?.();
      }
    };
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return isFs;
}

/**
 * Controls the show/hide of the control bar.
 * - Always visible while paused / not started.
 * - While playing: visible on interaction, auto-hides after 3s of no interaction.
 * This replaces the old CSS-only `group-hover` reveal, which never triggers on
 * touch devices (mobile users could never see or tap the seek buttons).
 */
function useControlsReveal(playing: boolean) {
  const [visible, setVisible] = useState(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = () => {
    setVisible(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    if (playing) {
      timerRef.current = setTimeout(() => setVisible(false), 3000);
    }
  };

  useEffect(() => {
    if (!playing) {
      setVisible(true);
      if (timerRef.current) clearTimeout(timerRef.current);
    } else {
      show();
    }
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing]);

  return { visible, show };
}

type Props = {
  src: string;
  poster?: string;
  title?: string;
  className?: string;
  /** If provided, fullscreen is requested on this element instead of the
   *  player's own wrapper — used so a chat sidebar next to the video can be
   *  included inside fullscreen too (see live-class-player.tsx). */
  fullscreenTargetRef?: RefObject<HTMLElement | null>;
};

export function VideoPlayer({ src, poster, title, className, fullscreenTargetRef }: Props) {
  const ytId = parseYouTubeId(src);
  if (ytId) return <YouTubePlayer id={ytId} title={title} poster={poster} className={className} fullscreenTargetRef={fullscreenTargetRef} />;
  if (isDirectVideo(src)) return <NativePlayer src={src} poster={poster} title={title} className={className} fullscreenTargetRef={fullscreenTargetRef} />;
  const vimeoId = parseVimeoId(src);
  if (vimeoId) return <VimeoPlayer id={vimeoId} title={title} className={className} />;
  // Other embeds (Drive etc): plain iframe wrapped in matching frame
  return (
    <div
      className={cn(
        "overflow-hidden rounded-3xl bg-black shadow-elegant",
        !className?.includes("h-full") && "aspect-video",
        className,
      )}
    >
      <iframe
        src={toGenericEmbed(src)}
        title={title ?? "Video"}
        className="h-full w-full"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
        allowFullScreen
      />
    </div>
  );
}

/* ---------------- Shared control bar UI ---------------- */
function ControlBar({
  playing, muted, time, duration, speed, showSpeed, visible,
  onPlayToggle, onSeek, onScrub, onMuteToggle, onSpeedToggle, onSpeedPick, onFullscreen, onInteract,
  showScrubber = true, showMute = true, showSeekButtons = true,
  qualities, currentQuality, onQualityPick,
}: {
  playing: boolean; muted: boolean; time: number; duration: number; speed: number; showSpeed: boolean; visible: boolean;
  onPlayToggle: () => void; onSeek: (d: number) => void;
  onScrub: (t: number) => void; onMuteToggle: () => void;
  onSpeedToggle: () => void; onSpeedPick: (s: number) => void; onFullscreen: () => void; onInteract: () => void;
  showScrubber?: boolean; showMute?: boolean; showSeekButtons?: boolean;
  qualities?: string[]; currentQuality?: string; onQualityPick?: (q: string) => void;
}) {
  const [showQuality, setShowQuality] = useState(false);
  const [dragTime, setDragTime] = useState<number | null>(null);
  const displayTime = dragTime ?? time;
  return (
    <div
      onClick={(e) => { e.stopPropagation(); onInteract(); }}
      onPointerMove={onInteract}
      className={cn(
        "pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent px-3 pb-2.5 pt-8 transition-opacity duration-200",
        visible ? "opacity-100" : "opacity-0",
      )}
    >
      <div className="pointer-events-auto flex flex-col gap-2.5">
        {showScrubber && (
          <input
            type="range"
            min={0}
            max={duration || 0}
            step={0.1}
            value={displayTime}
            onChange={(e) => setDragTime(Number(e.target.value))}
            onPointerUp={(e) => {
              const v = Number((e.target as HTMLInputElement).value);
              onScrub(v);
              setDragTime(null);
            }}
            onKeyUp={(e) => {
              const v = Number((e.target as HTMLInputElement).value);
              onScrub(v);
              setDragTime(null);
            }}
            className="h-[3px] w-full cursor-pointer appearance-none rounded-full bg-white/25 accent-primary transition-all hover:h-1.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:hover:scale-125"
            aria-label="Seek"
          />
        )}
        <div className="flex items-center gap-1 text-white">
          <button onClick={onPlayToggle} aria-label={playing ? "Pause" : "Play"} className="rounded-full p-2 transition hover:bg-white/15">
            {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </button>
          {showSeekButtons && (
            <>
              <button onClick={() => onSeek(-10)} aria-label="Back 10s" className="rounded-full p-2 transition hover:bg-white/15">
                <RotateCcw className="h-4 w-4" />
              </button>
              <button onClick={() => onSeek(10)} aria-label="Forward 10s" className="rounded-full p-2 transition hover:bg-white/15">
                <RotateCw className="h-4 w-4" />
              </button>
            </>
          )}
          {showMute && (
            <button onClick={onMuteToggle} aria-label={muted ? "Unmute" : "Mute"} className="rounded-full p-2 transition hover:bg-white/15">
              {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </button>
          )}
          <div className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-medium tabular-nums text-white/85">{fmt(displayTime)} / {fmt(duration)}</div>
          <div className="ml-auto flex items-center gap-1.5">
            {qualities && qualities.length > 0 && onQualityPick && (
              <div className="relative">
                <button
                  onClick={() => setShowQuality((s) => !s)}
                  aria-label="Quality"
                  className="flex items-center gap-1 rounded-full px-2.5 py-1.5 text-xs font-semibold transition hover:bg-white/15"
                >
                  <Settings className="h-3.5 w-3.5" /> {YT_QUALITY_LABEL[currentQuality ?? "auto"] ?? currentQuality ?? "Auto"}
                </button>
                {showQuality && (
                  <div className="absolute bottom-full right-0 mb-2 grid gap-0.5 rounded-2xl bg-black/95 p-1.5 shadow-xl ring-1 ring-white/10 backdrop-blur">
                    {qualities.map((q) => (
                      <button
                        key={q}
                        onClick={() => { onQualityPick(q); setShowQuality(false); }}
                        className={cn(
                          "rounded-lg px-3 py-1.5 text-left text-xs transition hover:bg-white/15",
                          q === currentQuality && "bg-primary/90 font-semibold",
                        )}
                      >
                        {YT_QUALITY_LABEL[q] ?? q}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            <div className="relative">
              <button
                onClick={onSpeedToggle}
                aria-label="Playback speed"
                className="flex items-center gap-1 rounded-full px-2.5 py-1.5 text-xs font-semibold transition hover:bg-white/15"
              >
                <Gauge className="h-3.5 w-3.5" /> {speed}x
              </button>
              {showSpeed && (
                <div className="absolute bottom-full right-0 mb-2 grid gap-0.5 rounded-2xl bg-black/95 p-1.5 shadow-xl ring-1 ring-white/10 backdrop-blur">
                  {SPEEDS.map((s) => (
                    <button
                      key={s}
                      onClick={() => onSpeedPick(s)}
                      className={cn(
                        "rounded-lg px-3 py-1.5 text-left text-xs transition hover:bg-white/15",
                        s === speed && "bg-primary/90 font-semibold",
                      )}
                    >
                      {s}x
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button onClick={onFullscreen} aria-label="Fullscreen" className="rounded-full p-2 transition hover:bg-white/15">
              <Maximize className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------- YouTube Player with fully custom UI (branding hidden) ---------------- */
function YouTubePlayer({ id, title, poster, className, fullscreenTargetRef }: { id: string; title?: string; poster?: string; className?: string; fullscreenTargetRef?: RefObject<HTMLElement | null> }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [showSpeed, setShowSpeed] = useState(false);
  const [started, setStarted] = useState(false);
  const [qualities, setQualities] = useState<string[]>([]);
  const [quality, setQuality] = useState<string>("auto");

  const fsElRef = fullscreenTargetRef ?? wrapRef;
  const isFs = useIsFullscreen(fsElRef);
  const { visible: controlsVisible, show: revealControls } = useControlsReveal(playing);

  useEffect(() => {
    let cancelled = false;
    loadYouTubeApi().then((YT) => {
      if (cancelled || !hostRef.current) return;
      playerRef.current = new YT.Player(hostRef.current, {
        videoId: id,
        width: "100%",
        height: "100%",
        host: "https://www.youtube-nocookie.com",
        playerVars: {
          controls: 0,
          rel: 0,
          modestbranding: 1,
          playsinline: 1,
          iv_load_policy: 3,
          fs: 0,
          disablekb: 1,
          origin: typeof window !== "undefined" ? window.location.origin : undefined,
        },
        events: {
          onReady: (e: any) => {
            try {
              e.target.unMute?.();
              e.target.setVolume?.(100);
              setDuration(e.target.getDuration?.() ?? 0);
              const lv: string[] = e.target.getAvailableQualityLevels?.() ?? [];
              if (lv.length) e.target.setPlaybackQuality?.(lv[0]);
              // YouTube's IFrame API can fall back to a fixed pixel size
              // (e.g. 640x360) instead of honoring width/height:"100%",
              // which overflows narrow mobile screens. Force it to match
              // the actual container right away.
              const box = wrapRef.current?.getBoundingClientRect();
              if (box) e.target.setSize?.(box.width, box.height);
            } catch {}
            setReady(true);
          },
          onStateChange: (e: any) => {
            if (e.data === 1) {
              setPlaying(true);
              setStarted(true);
              try {
                const lv: string[] = e.target.getAvailableQualityLevels?.() ?? [];
                if (lv.length) e.target.setPlaybackQuality?.(lv[0]);
              } catch {}
              let ticks = 0;
              const reassert = setInterval(() => {
                ticks += 1;
                try {
                  const lv2: string[] = e.target.getAvailableQualityLevels?.() ?? [];
                  if (lv2.length) e.target.setPlaybackQuality?.(lv2[0]);
                } catch {}
                if (ticks >= 5) clearInterval(reassert);
              }, 3000);
            }
            else if (e.data === 2 || e.data === 0) setPlaying(false);
            try {
              setDuration(e.target.getDuration?.() ?? 0);
              const lv: string[] = e.target.getAvailableQualityLevels?.() ?? [];
              if (lv.length) setQualities(["auto", ...lv]);
              setQuality(e.target.getPlaybackQuality?.() ?? "auto");
            } catch {}
          },
          onPlaybackQualityChange: (e: any) => {
            try { setQuality(e.target.getPlaybackQuality?.() ?? "auto"); } catch {}
          },
        },
      });
    });
    return () => {
      cancelled = true;
      try { playerRef.current?.destroy?.(); } catch {}
      playerRef.current = null;
    };
  }, [id]);

  // Keep the YouTube iframe's real pixel size locked to its container at
  // all times — not just on load. This is what actually fixes the mobile
  // overflow/letterbox bug: whenever the container resizes (entering/
  // exiting fullscreen, rotating the phone, opening the chat drawer), we
  // re-call setSize so the iframe can never end up wider than the screen.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const box = entries[0]?.contentRect;
      if (!box || !playerRef.current?.setSize) return;
      try { playerRef.current.setSize(box.width, box.height); } catch {}
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!playing) return;
    const t = setInterval(() => {
      try {
        const p = playerRef.current;
        if (!p) return;
        setTime(p.getCurrentTime?.() ?? 0);
      } catch {}
    }, 500);
    return () => clearInterval(t);
  }, [playing]);

  useEffect(() => {
    if (ready && playerRef.current?.setPlaybackRate) {
      try { playerRef.current.setPlaybackRate(speed); } catch {}
    }
  }, [speed, ready]);

  function toggle() {
    const p = playerRef.current; if (!p) return;
    try {
      if (playing) p.pauseVideo?.();
      else p.playVideo?.();
    } catch {}
  }
  function seek(delta: number) {
    const p = playerRef.current; if (!p) return;
    try {
      const cur = p.getCurrentTime?.() ?? 0;
      const dur = p.getDuration?.() ?? 0;
      p.seekTo?.(Math.min(Math.max(0, cur + delta), dur), true);
      setTime(Math.min(Math.max(0, cur + delta), dur));
    } catch {}
  }
  function scrubTo(t: number) {
    const p = playerRef.current; if (!p) return;
    try { p.seekTo?.(t, true); setTime(t); } catch {}
  }
  function toggleMute() {
    const p = playerRef.current; if (!p) return;
    try {
      if (p.isMuted?.()) { p.unMute?.(); setMuted(false); }
      else { p.mute?.(); setMuted(true); }
    } catch {}
  }
  function fullscreen() {
    const el = fsElRef.current; if (!el) return;
    if (document.fullscreenElement) document.exitFullscreen();
    else el.requestFullscreen?.();
  }
  function pickQuality(q: string) {
    const p = playerRef.current; if (!p) return;
    try {
      if (q === "auto") p.setPlaybackQuality?.("default");
      else p.setPlaybackQuality?.(q);
      setQuality(q);
    } catch {}
  }

  function handleVideoTap() {
    // First tap only reveals controls (mobile-safe); a tap while controls
    // are already visible toggles play/pause, same as before.
    if (!controlsVisible) { revealControls(); return; }
    revealControls();
    toggle();
  }

  return (
    <div
      ref={wrapRef}
      className={cn(
        "group relative overflow-hidden bg-black shadow-elegant",
        isFs
          ? "!aspect-auto h-full w-full !rounded-none"
          : cn("rounded-3xl", !className?.includes("h-full") && "aspect-video"),
        className,
      )}
    >
      <div
        ref={hostRef}
        title={title}
        className="pointer-events-none absolute inset-0 h-full w-full [&>iframe]:absolute [&>iframe]:inset-0 [&>iframe]:h-full [&>iframe]:w-full"
      />
      <div
        className="absolute inset-0"
        onClick={handleVideoTap}
        onPointerMove={revealControls}
        onContextMenu={(e) => e.preventDefault()}
      />
      <div
        className="pointer-events-none absolute bottom-[3%] right-[1%] z-10 flex items-center justify-center rounded-md bg-black/70 shadow-sm backdrop-blur-sm"
        style={{ width: "10%", height: "8%", maxWidth: 96, maxHeight: 32 }}
        aria-hidden
      >
        <span className="select-none truncate px-1 text-[9px] font-semibold uppercase tracking-wider text-white/70">
          Adhyeta
        </span>
      </div>
      {!started && (
        <>
          {poster && (
            <img src={poster} alt="" className="pointer-events-none absolute inset-0 h-full w-full object-contain bg-black" />
          )}
          <button
            onClick={(e) => { e.stopPropagation(); toggle(); revealControls(); }}
            aria-label="Play"
            className="absolute inset-0 m-auto grid h-16 w-16 place-items-center rounded-full bg-white/90 text-primary shadow-elegant backdrop-blur transition hover:scale-105"
          >
            <Play className="h-7 w-7 translate-x-0.5" />
          </button>
        </>
      )}

      <ControlBar
        playing={playing} muted={muted} time={time} duration={duration}
        speed={speed} showSpeed={showSpeed} visible={controlsVisible}
        onPlayToggle={toggle}
        onSeek={seek}
        onScrub={scrubTo}
        onMuteToggle={toggleMute}
        onSpeedToggle={() => setShowSpeed((s) => !s)}
        onSpeedPick={(s) => { setSpeed(s); setShowSpeed(false); }}
        onFullscreen={fullscreen}
        onInteract={revealControls}
        qualities={qualities}
        currentQuality={quality}
        onQualityPick={pickQuality}
      />
    </div>
  );
}

/* ---------------- Vimeo player (custom controls via postMessage) ---------------- */
function VimeoPlayer({ id, title, className }: { id: string; title?: string; className?: string }) {
  const src = `https://player.vimeo.com/video/${id}?title=0&byline=0&portrait=0&badge=0`;
  return (
    <div
      className={cn(
        "overflow-hidden rounded-3xl bg-black shadow-elegant",
        !className?.includes("h-full") && "aspect-video",
        className,
      )}
    >
      <iframe
        src={src}
        title={title ?? "Video"}
        className="h-full w-full"
        allow="autoplay; fullscreen; picture-in-picture"
        allowFullScreen
      />
    </div>
  );
}

/* ---------------- Native <video> player ---------------- */
function NativePlayer({ src, poster, title, className, fullscreenTargetRef }: Props) {
  const ref = useRef<HTMLVideoElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [showSpeed, setShowSpeed] = useState(false);

  const fsElRef = fullscreenTargetRef ?? wrapRef;
  const isFs = useIsFullscreen(fsElRef);
  const { visible: controlsVisible, show: revealControls } = useControlsReveal(playing);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    v.playbackRate = speed;
  }, [speed]);

  function toggle() {
    const v = ref.current;
    if (!v) return;
    if (v.paused) { v.play(); setPlaying(true); }
    else { v.pause(); setPlaying(false); }
  }
  function seek(delta: number) {
    const v = ref.current;
    if (!v) return;
    v.currentTime = Math.min(Math.max(0, v.currentTime + delta), v.duration || 0);
  }
  function scrubTo(t: number) {
    const v = ref.current;
    if (!v) return;
    v.currentTime = t;
    setTime(t);
  }
  function toggleMute() {
    const v = ref.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
  }
  function fullscreen() {
    const el = fsElRef.current;
    if (!el) return;
    if (document.fullscreenElement) document.exitFullscreen();
    else el.requestFullscreen?.();
  }

  function handleVideoTap() {
    if (!controlsVisible) { revealControls(); return; }
    revealControls();
    toggle();
  }

  return (
    <div
      ref={wrapRef}
      className={cn(
        "group relative overflow-hidden bg-black shadow-elegant",
        isFs
          ? "!aspect-auto h-full w-full !rounded-none"
          : cn("rounded-3xl", !className?.includes("h-full") && "aspect-video"),
        className,
      )}
    >
      <video
        ref={ref}
        src={src}
        poster={poster}
        title={title}
        className="h-full w-full object-contain bg-black"
        onClick={handleVideoTap}
        onPointerMove={revealControls}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        playsInline
      />
      {!playing && (
        <button
          onClick={() => { toggle(); revealControls(); }}
          aria-label="Play"
          className="absolute inset-0 m-auto grid h-16 w-16 place-items-center rounded-full bg-white/90 text-primary shadow-elegant backdrop-blur transition hover:scale-105"
        >
          <Play className="h-7 w-7 translate-x-0.5" />
        </button>
      )}

      <ControlBar
        playing={playing} muted={muted} time={time} duration={duration}
        speed={speed} showSpeed={showSpeed} visible={controlsVisible}
        onPlayToggle={toggle}
        onSeek={seek}
        onScrub={scrubTo}
        onMuteToggle={toggleMute}
        onSpeedToggle={() => setShowSpeed((s) => !s)}
        onSpeedPick={(s) => { setSpeed(s); setShowSpeed(false); }}
        onFullscreen={fullscreen}
        onInteract={revealControls}
      />
    </div>
  );
}
