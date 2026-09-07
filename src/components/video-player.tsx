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
  const plainId = url.trim();
  // Permit the video ID itself in admin fields as well as a full YouTube URL.
  if (/^[a-zA-Z0-9_-]{11}$/.test(plainId)) return plainId;
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
      // Google Drive's older share formats also need converting to preview.
      const id = u.searchParams.get("id");
      if (id && (u.pathname === "/open" || u.pathname === "/uc")) {
        return `https://drive.google.com/file/d/${id}/preview`;
      }
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
  if (!src?.trim()) return <VideoUnavailable message="No video link has been added for this class yet." className={className} />;
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

function VideoUnavailable({ message, className, openUrl }: { message: string; className?: string; openUrl?: string }) {
  return (
    <div className={cn("flex aspect-video flex-col items-center justify-center gap-3 rounded-3xl bg-black p-6 text-center text-sm text-white/80", className)}>
      <p>{message}</p>
      {openUrl && <a href={openUrl} target="_blank" rel="noreferrer" className="rounded-full bg-white px-4 py-2 text-xs font-semibold text-black">Open video in a new tab</a>}
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

/* ---------------- YouTube Player — native controls, barely-visible YT branding ---------------- */
function YouTubePlayer({ id, title, poster, className, fullscreenTargetRef }: { id: string; title?: string; poster?: string; className?: string; fullscreenTargetRef?: RefObject<HTMLElement | null> }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [started, setStarted] = useState(false);
  const [embedError, setEmbedError] = useState(false);

  const fsElRef = fullscreenTargetRef ?? wrapRef;
  const isFs = useIsFullscreen(fsElRef);

  // Native embed URL — controls=1 gives the thin native bar (exactly like the reference image)
  // modestbranding=1 removes the YouTube logo from the control bar (only keeps the tiny watermark)
  const embedSrc =
    `https://www.youtube.com/embed/${id}` +
    `?controls=1&modestbranding=1&rel=0&iv_load_policy=3&playsinline=1&autoplay=1&enablejsapi=1`;

  function handlePlay() {
    setStarted(true);
    // Auto fullscreen on first click
    try {
      const el = fsElRef.current;
      if (el && !document.fullscreenElement) {
        el.requestFullscreen?.().catch(() => {});
      }
    } catch {}
  }

  if (embedError) {
    return (
      <VideoUnavailable
        className={className}
        message="This YouTube video cannot be played here. Open it in YouTube instead."
        openUrl={`https://www.youtube.com/watch?v=${id}`}
      />
    );
  }

  return (
    <div
      ref={wrapRef}
      className={cn(
        "group relative overflow-hidden bg-black",
        isFs
          ? "!aspect-auto h-full w-full !rounded-none"
          : cn("rounded-2xl", !className?.includes("h-full") && "aspect-video"),
        className,
      )}
    >
      {!started ? (
        <>
          {/* Poster / thumbnail */}
          {poster ? (
            <img
              src={poster}
              alt={title ?? ""}
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : (
            <div
              className="absolute inset-0"
              style={{
                backgroundImage: `url(https://i.ytimg.com/vi/${id}/maxresdefault.jpg), url(https://i.ytimg.com/vi/${id}/hqdefault.jpg)`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
            />
          )}
          {/* Gradient scrim for readability */}
          <div className="pointer-events-none absolute inset-0 bg-black/30" />
          {/* Title at top */}
          {title && (
            <div className="pointer-events-none absolute inset-x-0 top-0 bg-gradient-to-b from-black/70 to-transparent px-4 py-3">
              <p className="line-clamp-1 text-sm font-semibold text-white drop-shadow">{title}</p>
            </div>
          )}
          {/* Big red play button — exactly like YouTube */}
          <button
            onClick={handlePlay}
            aria-label="Play video"
            className="absolute"
            style={{ top: "50%", left: "50%", transform: "translate(-50%, -50%)" }}
          >
            <div className="flex h-[68px] w-[68px] items-center justify-center rounded-full bg-red-600 shadow-2xl transition-all hover:scale-110 hover:bg-red-700 active:scale-95">
              <Play className="h-8 w-8 translate-x-0.5 text-white" />
            </div>
          </button>
        </>
      ) : (
        /* Native YouTube iframe — fills container completely */
        <iframe
          src={embedSrc}
          title={title ?? "Video"}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
          allowFullScreen
          className="absolute inset-0 h-full w-full border-0"
          onError={() => setEmbedError(true)}
        />
      )}
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
  const [loadError, setLoadError] = useState(false);

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
    if (v.paused) {
      v.play().then(() => {
        setPlaying(true);
        // Auto-enter fullscreen as soon as playback starts
        try {
          const fsEl = fsElRef.current;
          if (fsEl && !document.fullscreenElement) {
            fsEl.requestFullscreen?.().catch(() => {});
          }
        } catch {}
      }).catch(() => setPlaying(false));
    } else {
      v.pause();
      setPlaying(false);
    }
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
        onError={() => setLoadError(true)}
        playsInline
      />
      {loadError && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-black/90 p-6 text-center text-sm text-white/80">
          <p>This video link could not be played here. Check that it is a public, direct MP4/WebM link.</p>
          <a href={src} target="_blank" rel="noreferrer" className="rounded-full bg-white px-4 py-2 text-xs font-semibold text-black">Open video in a new tab</a>
        </div>
      )}
      {!playing && (
        <button
          onClick={() => { toggle(); revealControls(); }}
          aria-label="Play"
          className="absolute inset-0 m-auto grid h-16 w-16 place-items-center rounded-full bg-gradient-to-br from-primary to-primary-glow text-primary-foreground shadow-elegant backdrop-blur transition hover:scale-105"
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
