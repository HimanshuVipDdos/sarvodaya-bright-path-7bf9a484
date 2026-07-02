import { useEffect, useRef, useState } from "react";
import {
  Play, Pause, Volume2, VolumeX, Maximize, Gauge, RotateCcw, RotateCw,
} from "lucide-react";
import { cn } from "@/lib/utils";

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2] as const;

function isDirectVideo(url: string) {
  return /\.(mp4|webm|m4v|mov|ogv)(\?|#|$)/i.test(url);
}

function parseYouTubeId(url: string): string | null {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");
    if (host === "youtu.be") return u.pathname.replace(/^\//, "") || null;
    if (host.endsWith("youtube.com")) {
      if (u.pathname === "/watch") return u.searchParams.get("v");
      const m = u.pathname.match(/^\/(?:shorts|live|embed)\/([^/]+)/);
      if (m) return m[1];
    }
    return null;
  } catch {
    return null;
  }
}

function toEmbedUrl(url: string): string {
  const id = parseYouTubeId(url);
  if (id) return `https://www.youtube.com/embed/${id}`;
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");
    if (host === "vimeo.com") {
      const vid = u.pathname.replace(/^\//, "");
      if (/^\d+$/.test(vid)) return `https://player.vimeo.com/video/${vid}`;
    }
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

type Props = {
  src: string;
  poster?: string;
  title?: string;
  className?: string;
};

export function VideoPlayer({ src, poster, title, className }: Props) {
  const ytId = parseYouTubeId(src);
  if (ytId) return <YouTubePlayer id={ytId} title={title} className={className} />;
  if (isDirectVideo(src)) return <NativePlayer src={src} poster={poster} title={title} className={className} />;
  // Other embeds (Vimeo, Drive): plain iframe
  return (
    <div className={cn("aspect-video overflow-hidden rounded-3xl glass-strong bg-black", className)}>
      <iframe
        src={toEmbedUrl(src)}
        title={title ?? "Video"}
        className="h-full w-full"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
        allowFullScreen
      />
    </div>
  );
}

/* ---------------- YouTube Player with speed control ---------------- */
function YouTubePlayer({ id, title, className }: { id: string; title?: string; className?: string }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);
  const [ready, setReady] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [showSpeed, setShowSpeed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadYouTubeApi().then((YT) => {
      if (cancelled || !hostRef.current) return;
      playerRef.current = new YT.Player(hostRef.current, {
        videoId: id,
        playerVars: {
          rel: 0,
          modestbranding: 1,
          playsinline: 1,
          // Do NOT set mute=1 — user wants sound
        },
        events: {
          onReady: () => setReady(true),
        },
      });
    });
    return () => {
      cancelled = true;
      try { playerRef.current?.destroy?.(); } catch {}
      playerRef.current = null;
    };
  }, [id]);

  useEffect(() => {
    if (ready && playerRef.current?.setPlaybackRate) {
      try { playerRef.current.setPlaybackRate(speed); } catch {}
    }
  }, [speed, ready]);

  function fullscreen() {
    const el = wrapRef.current;
    if (!el) return;
    if (document.fullscreenElement) document.exitFullscreen();
    else el.requestFullscreen?.();
  }

  return (
    <div
      ref={wrapRef}
      className={cn(
        "group relative aspect-video overflow-hidden rounded-3xl bg-black shadow-elegant",
        className,
      )}
    >
      <div ref={hostRef} title={title} className="h-full w-full" />
      {/* Speed + fullscreen overlay (YouTube provides native play/volume) */}
      <div className="pointer-events-none absolute right-3 top-3 flex items-center gap-2 opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
        <div className="pointer-events-auto relative">
          <button
            onClick={() => setShowSpeed((s) => !s)}
            aria-label="Playback speed"
            className="flex items-center gap-1 rounded-full bg-black/70 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur hover:bg-black/85"
          >
            <Gauge className="h-3.5 w-3.5" /> {speed}x
          </button>
          {showSpeed && (
            <div className="absolute right-0 top-full mt-2 grid gap-0.5 rounded-2xl bg-black/90 p-1.5 backdrop-blur">
              {SPEEDS.map((s) => (
                <button
                  key={s}
                  onClick={() => { setSpeed(s); setShowSpeed(false); }}
                  className={cn(
                    "rounded-lg px-4 py-1 text-left text-xs text-white hover:bg-white/15",
                    s === speed && "bg-white/20 font-semibold",
                  )}
                >
                  {s}x
                </button>
              ))}
            </div>
          )}
        </div>
        <button
          onClick={fullscreen}
          aria-label="Fullscreen"
          className="pointer-events-auto rounded-full bg-black/70 p-2 text-white backdrop-blur hover:bg-black/85"
        >
          <Maximize className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

/* ---------------- Native <video> player ---------------- */
function NativePlayer({ src, poster, title, className }: Props) {
  const ref = useRef<HTMLVideoElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [showSpeed, setShowSpeed] = useState(false);

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
  function onScrub(e: React.ChangeEvent<HTMLInputElement>) {
    const v = ref.current;
    if (!v) return;
    v.currentTime = Number(e.target.value);
    setTime(v.currentTime);
  }
  function toggleMute() {
    const v = ref.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
  }
  function fullscreen() {
    const el = wrapRef.current;
    if (!el) return;
    if (document.fullscreenElement) document.exitFullscreen();
    else el.requestFullscreen?.();
  }

  return (
    <div
      ref={wrapRef}
      className={cn(
        "group relative aspect-video overflow-hidden rounded-3xl bg-black shadow-elegant",
        className,
      )}
    >
      <video
        ref={ref}
        src={src}
        poster={poster}
        title={title}
        className="h-full w-full"
        onClick={toggle}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        playsInline
      />
      {!playing && (
        <button
          onClick={toggle}
          aria-label="Play"
          className="absolute inset-0 m-auto grid h-16 w-16 place-items-center rounded-full bg-white/90 text-primary shadow-elegant backdrop-blur transition hover:scale-105"
        >
          <Play className="h-7 w-7 translate-x-0.5" />
        </button>
      )}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-3 opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
        <div className="pointer-events-auto flex flex-col gap-2">
          <input
            type="range"
            min={0}
            max={duration || 0}
            step={0.1}
            value={time}
            onChange={onScrub}
            className="h-1 w-full cursor-pointer appearance-none rounded-full bg-white/30 accent-primary [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white"
            aria-label="Seek"
          />
          <div className="flex items-center gap-2 text-white">
            <button onClick={toggle} aria-label={playing ? "Pause" : "Play"} className="rounded-full p-1.5 hover:bg-white/15">
              {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </button>
            <button onClick={() => seek(-10)} aria-label="Back 10s" className="rounded-full p-1.5 hover:bg-white/15">
              <RotateCcw className="h-4 w-4" />
            </button>
            <button onClick={() => seek(10)} aria-label="Forward 10s" className="rounded-full p-1.5 hover:bg-white/15">
              <RotateCw className="h-4 w-4" />
            </button>
            <button onClick={toggleMute} aria-label={muted ? "Unmute" : "Mute"} className="rounded-full p-1.5 hover:bg-white/15">
              {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </button>
            <div className="text-xs tabular-nums text-white/80">{fmt(time)} / {fmt(duration)}</div>
            <div className="ml-auto flex items-center gap-2">
              <div className="relative">
                <button
                  onClick={() => setShowSpeed((s) => !s)}
                  aria-label="Playback speed"
                  className="flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold hover:bg-white/15"
                >
                  <Gauge className="h-3.5 w-3.5" /> {speed}x
                </button>
                {showSpeed && (
                  <div className="absolute bottom-full right-0 mb-2 grid gap-0.5 rounded-2xl bg-black/90 p-1.5 backdrop-blur">
                    {SPEEDS.map((s) => (
                      <button
                        key={s}
                        onClick={() => { setSpeed(s); setShowSpeed(false); }}
                        className={cn(
                          "rounded-lg px-3 py-1 text-left text-xs hover:bg-white/15",
                          s === speed && "bg-white/20 font-semibold",
                        )}
                      >
                        {s}x
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button onClick={fullscreen} aria-label="Fullscreen" className="rounded-full p-1.5 hover:bg-white/15">
                <Maximize className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
