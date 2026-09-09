import { useState, useRef, useEffect, useCallback, type RefObject } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle,
  Play,
  Pause,
  Volume2,
  Volume1,
  VolumeX,
  Maximize,
  Minimize,
  MessageCircle,
  RotateCcw,
  RotateCw,
  ExternalLink,
} from "lucide-react";
import { cn, getStorageUrl } from "@/lib/utils";

export function extractYouTubeId(url: string): string | null {
  if (!url) return null;
  let target = url.trim();
  target = target
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");

  // Direct 11-character video ID
  if (/^[a-zA-Z0-9_-]{11}$/.test(target)) {
    return target;
  }

  // Extract from iframe src if iframe snippet was pasted
  const iframeMatch = target.match(/src=["']([^"']+)["']/i);
  if (iframeMatch && iframeMatch[1]) {
    target = iframeMatch[1];
  }

  // Common YouTube URL regex matching various path/query patterns
  const regExp = /^.*(?:youtu\.be\/|v\/|u\/\w\/|embed\/|live\/|shorts\/|watch\?v=|&v=)([^#&?]*).*/i;
  const match = target.match(regExp);
  if (match && match[1] && match[1].length === 11) {
    return match[1];
  }

  // Fallback URL parser for queries with multiple parameters
  try {
    const parsed = new URL(target.startsWith("http") ? target : `https://${target}`);
    const v = parsed.searchParams.get("v");
    if (v && v.length === 11) {
      return v;
    }
  } catch {
    // ignore
  }

  return null;
}

export function getEmbedableSource(url: string): {
  type: "youtube" | "drive" | "video";
  embedUrl: string;
  rawUrl: string;
  videoId?: string;
} | null {
  if (!url || !url.trim()) return null;
  let target = url.trim();

  // Extract src if iframe string
  const iframeMatch = target.match(/src=["']([^"']+)["']/i);
  if (iframeMatch && iframeMatch[1]) {
    target = iframeMatch[1];
  }

  // Google Drive
  const driveMatch = target.match(/drive\.google\.com\/file\/d\/([^\/\?]+)/i);
  if (driveMatch && driveMatch[1]) {
    return {
      type: "drive",
      embedUrl: `https://drive.google.com/file/d/${driveMatch[1]}/preview`,
      rawUrl: target,
    };
  }

  // YouTube
  const ytId = extractYouTubeId(target);
  if (ytId) {
    return {
      type: "youtube",
      embedUrl: `https://www.youtube.com/embed/${ytId}?autoplay=1&rel=0&modestbranding=1&enablejsapi=1&playsinline=1`,
      rawUrl: `https://www.youtube.com/watch?v=${ytId}`,
      videoId: ytId,
    };
  }

  if (target.includes("youtube.com") || target.includes("youtu.be")) {
    return {
      type: "youtube",
      embedUrl: target.includes("?") ? `${target}&autoplay=1` : `${target}?autoplay=1`,
      rawUrl: target,
    };
  }

  // Direct video file
  const resolved = getStorageUrl(target) || target;
  return {
    type: "video",
    embedUrl: resolved,
    rawUrl: resolved,
  };
}

export function getYouTubeEmbedUrl(url: string): string | null {
  const info = getEmbedableSource(url);
  return info?.type === "youtube" ? info.embedUrl : null;
}

// ---------------------------------------------------------------------------
// YouTube IFrame API loader (singleton — the script + callback only ever get
// set up once, no matter how many players are on the page over time).
// ---------------------------------------------------------------------------
let ytApiPromise: Promise<any> | null = null;
function loadYouTubeIframeApi(): Promise<any> {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  const w = window as any;
  if (w.YT && w.YT.Player) return Promise.resolve(w.YT);
  if (ytApiPromise) return ytApiPromise;
  ytApiPromise = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("YouTube API load timeout")), 10000);
    const prevCallback = w.onYouTubeIframeAPIReady;
    w.onYouTubeIframeAPIReady = () => {
      prevCallback?.();
      clearTimeout(timeout);
      resolve(w.YT);
    };
    if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      tag.onerror = () => {
        clearTimeout(timeout);
        reject(new Error("YouTube API script failed"));
      };
      document.head.appendChild(tag);
    }
  });
  return ytApiPromise;
}

function formatTime(seconds: number) {
  if (!isFinite(seconds) || seconds < 0) return "0:00";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const mm = h > 0 ? String(m).padStart(2, "0") : String(m);
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

const SPEED_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

/**
 * Real-time digital clock (e.g. "10:01") shown on top-right of player,
 * matching smartboard lecture setups.
 */
function LiveClock() {
  const [timeStr, setTimeStr] = useState("");

  useEffect(() => {
    const update = () => {
      const d = new Date();
      const hh = String(d.getHours()).padStart(2, "0");
      const mm = String(d.getMinutes()).padStart(2, "0");
      setTimeStr(`${hh}:${mm}`);
    };
    update();
    const interval = setInterval(update, 10000);
    return () => clearInterval(interval);
  }, []);

  if (!timeStr) return null;
  return <span className="text-xs sm:text-sm font-medium text-white/90 tabular-nums drop-shadow">{timeStr}</span>;
}

/**
 * Custom YouTube Player matching the uploaded screenshot:
 * - Top-left: Circular translucent Chat toggle button + Lecture Title + Subtitle
 * - Top-right: Digital clock (10:01)
 * - Center: Red circular Play/Pause button
 * - Bottom: Seek bar, Play/Pause, Volume, -10s Rewind, +10s Forward, Remaining time (-1:42:49), Speed (1x), Fullscreen, and tiny YouTube logo
 */
function CustomYouTubePlayer({
  videoId,
  title,
  subtitle = "IIT School",
  onError,
  canShowChat,
  chatOpen,
  onChatToggle,
}: {
  videoId: string;
  title?: string;
  subtitle?: string;
  onError: () => void;
  canShowChat: boolean;
  chatOpen: boolean;
  onChatToggle?: () => void;
}) {
  const mountRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);
  const pollRef = useRef<number | null>(null);
  const hideControlsTimer = useRef<number | null>(null);

  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(100);
  const [muted, setMuted] = useState(false);
  const [rate, setRate] = useState(1);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [seeking, setSeeking] = useState(false);
  const [seekPreview, setSeekPreview] = useState(0);
  const [showRemainingTime, setShowRemainingTime] = useState(true);
  const [embeddingDisabled, setEmbeddingDisabled] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setEmbeddingDisabled(false);

    loadYouTubeIframeApi()
      .then((YT) => {
        if (cancelled || !mountRef.current) return;
        playerRef.current = new YT.Player(mountRef.current, {
          videoId,
          playerVars: {
            autoplay: 1,
            controls: 0,
            disablekb: 1,
            modestbranding: 1,
            rel: 0,
            iv_load_policy: 3,
            fs: 0,
            playsinline: 1,
            enablejsapi: 1,
            origin: typeof window !== "undefined" ? window.location.origin : undefined,
            widget_referrer: typeof window !== "undefined" ? window.location.origin : undefined,
          },
          events: {
            onReady: (e: any) => {
              if (cancelled) return;
              setReady(true);
              setDuration(e.target.getDuration?.() || 0);
              try {
                e.target.playVideo?.();
              } catch {
                // browser autoplay policy handled by center play button
              }
            },
            onStateChange: (e: any) => {
              if (cancelled) return;
              // 1 = playing, 2 = paused, 0 = ended
              setPlaying(e.data === 1);
              if (e.data === 1) {
                setDuration(e.target.getDuration?.() || 0);
              }
            },
            onError: (e: any) => {
              if (cancelled) return;
              // 101 or 150 = embedding disabled by owner
              if (e?.data === 101 || e?.data === 150) {
                setEmbeddingDisabled(true);
              } else {
                onError();
              }
            },
          },
        });
      })
      .catch(() => {
        if (!cancelled) onError();
      });

    return () => {
      cancelled = true;
      try {
        playerRef.current?.destroy?.();
      } catch {
        /* noop */
      }
      playerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId]);

  // Poll current time while playing (YT API has no continuous timeupdate event)
  useEffect(() => {
    if (!ready) return;
    pollRef.current = window.setInterval(() => {
      const p = playerRef.current;
      if (!p || seeking) return;
      try {
        setCurrentTime(p.getCurrentTime?.() || 0);
        const d = p.getDuration?.() || 0;
        if (d && d !== duration) setDuration(d);
      } catch {
        /* player not ready yet */
      }
    }, 300);
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
    };
  }, [ready, seeking, duration]);

  useEffect(() => {
    const handler = () => setIsFullscreen(document.fullscreenElement === wrapRef.current);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  const resetHideTimer = useCallback(() => {
    setControlsVisible(true);
    if (hideControlsTimer.current) window.clearTimeout(hideControlsTimer.current);
    hideControlsTimer.current = window.setTimeout(() => {
      setControlsVisible((v) => (playing ? false : v));
    }, 2800);
  }, [playing]);

  useEffect(() => {
    resetHideTimer();
    return () => {
      if (hideControlsTimer.current) window.clearTimeout(hideControlsTimer.current);
    };
  }, [resetHideTimer]);

  const togglePlay = () => {
    const p = playerRef.current;
    if (!p) return;
    try {
      if (playing) {
        p.pauseVideo?.();
      } else {
        p.playVideo?.();
      }
    } catch {
      // noop
    }
    resetHideTimer();
  };

  const seekTo = (t: number) => {
    const targetTime = Math.max(0, Math.min(duration || 0, t));
    playerRef.current?.seekTo?.(targetTime, true);
    setCurrentTime(targetTime);
  };

  const seekBy = (deltaSeconds: number) => {
    const p = playerRef.current;
    if (!p) return;
    const curr = p.getCurrentTime?.() || currentTime;
    seekTo(curr + deltaSeconds);
    resetHideTimer();
  };

  const toggleMute = () => {
    const p = playerRef.current;
    if (!p) return;
    if (muted) {
      p.unMute?.();
      setMuted(false);
    } else {
      p.mute?.();
      setMuted(true);
    }
    resetHideTimer();
  };

  const onVolumeChange = (v: number) => {
    setVolume(v);
    const p = playerRef.current;
    if (!p) return;
    p.setVolume?.(v);
    if (v === 0) {
      p.mute?.();
      setMuted(true);
    } else if (muted) {
      p.unMute?.();
      setMuted(false);
    }
    resetHideTimer();
  };

  const setSpeed = (r: number) => {
    setRate(r);
    playerRef.current?.setPlaybackRate?.(r);
    setShowSpeedMenu(false);
    resetHideTimer();
  };

  const toggleFullscreen = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen?.();
    } else {
      wrapRef.current?.requestFullscreen?.();
    }
    resetHideTimer();
  };

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      if (
        activeEl?.tagName === "INPUT" ||
        activeEl?.tagName === "TEXTAREA" ||
        (activeEl as HTMLElement)?.isContentEditable
      ) {
        return;
      }

      if (e.code === "Space") {
        e.preventDefault();
        togglePlay();
      } else if (e.code === "ArrowLeft") {
        e.preventDefault();
        seekBy(-10);
      } else if (e.code === "ArrowRight") {
        e.preventDefault();
        seekBy(10);
      } else if (e.code === "ArrowUp") {
        e.preventDefault();
        onVolumeChange(Math.min(100, volume + 10));
      } else if (e.code === "ArrowDown") {
        e.preventDefault();
        onVolumeChange(Math.max(0, volume - 10));
      } else if (e.key === "m" || e.key === "M") {
        e.preventDefault();
        toggleMute();
      } else if (e.key === "f" || e.key === "F") {
        e.preventDefault();
        toggleFullscreen();
      } else if (e.key === "c" || e.key === "C") {
        if (canShowChat && onChatToggle) {
          e.preventDefault();
          onChatToggle();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [togglePlay, seekBy, volume, onVolumeChange, toggleMute, toggleFullscreen, canShowChat, onChatToggle]);

  const displayTime = seeking ? seekPreview : currentTime;
  const remainingTime = Math.max(0, duration - displayTime);

  if (embeddingDisabled) {
    return (
      <div className="relative flex h-full w-full flex-col items-center justify-center bg-zinc-950 p-6 text-center text-white select-none">
        <AlertTriangle className="h-10 w-10 text-amber-400 mb-3" />
        <h3 className="text-base font-bold text-white">Playback Restricted by Creator</h3>
        <p className="mt-1 max-w-md text-xs text-white/70">
          This YouTube video owner has disabled external website embedding. You can still watch this lecture directly on YouTube.
        </p>
        <a
          href={`https://www.youtube.com/watch?v=${videoId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-flex items-center gap-2 rounded-full bg-red-600 px-5 py-2 text-xs font-semibold text-white shadow-lg hover:bg-red-700 transition active:scale-95"
        >
          <ExternalLink className="h-4 w-4" /> Watch on YouTube
        </a>
      </div>
    );
  }

  return (
    <div
      ref={wrapRef}
      className="relative h-full w-full bg-black select-none overflow-hidden group"
      onMouseMove={resetHideTimer}
      onClick={(e) => {
        if (e.target === wrapRef.current || (e.target as HTMLElement).closest(".yt-click-surface")) {
          togglePlay();
        }
      }}
    >
      {/* YouTube iframe container */}
      <div ref={mountRef} className="pointer-events-none absolute inset-0 h-full w-full" />

      {/* Transparent surface over the iframe to catch clicks & toggle play/pause */}
      <div className="yt-click-surface absolute inset-0 cursor-pointer" onClick={togglePlay} />

      {/* Top Bar: Circular Chat Toggle (Top Left) + Title/Subtitle + Live Clock (Top Right) */}
      <div
        className={cn(
          "absolute inset-x-0 top-0 z-20 flex items-start justify-between bg-gradient-to-b from-black/80 via-black/40 to-transparent p-3 sm:p-4 transition-opacity duration-300",
          controlsVisible ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
      >
        <div className="flex items-center gap-3 min-w-0 pr-3">
          {/* Circular Chat Toggle Button matching screenshot */}
          {canShowChat && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onChatToggle?.();
              }}
              title={chatOpen ? "Hide Live Chat" : "Open Live Chat"}
              aria-label="Toggle Live Chat"
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition backdrop-blur-md shadow-md",
                chatOpen
                  ? "bg-red-600 border-red-400 text-white shadow-red-600/30 ring-2 ring-red-400/40"
                  : "bg-black/50 border-white/25 text-white hover:bg-black/80 hover:border-white/50"
              )}
            >
              <MessageCircle className="h-4 w-4" />
            </button>
          )}

          {/* Lecture Title & Subtitle */}
          <div className="min-w-0 flex flex-col justify-center">
            {title && (
              <h2 className="truncate text-xs sm:text-sm font-bold text-white drop-shadow-md tracking-tight leading-tight">
                {title}
              </h2>
            )}
            {subtitle && (
              <p className="truncate text-[10px] sm:text-[11px] font-normal text-white/75 drop-shadow-sm leading-tight mt-0.5">
                {subtitle}
              </p>
            )}
          </div>
        </div>

        {/* Top Right: Real-time clock (10:01) */}
        <div className="shrink-0 flex items-center gap-2 pl-2">
          <LiveClock />
        </div>
      </div>

      {/* Center Red Circular Play/Pause Button */}
      <AnimatePresence>
        {(!playing || controlsVisible) && ready && (
          <motion.button
            key="center-play-btn"
            type="button"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.15 }}
            onClick={(e) => {
              e.stopPropagation();
              togglePlay();
            }}
            aria-label={playing ? "Pause" : "Play"}
            className="absolute left-1/2 top-1/2 z-20 flex h-14 w-14 sm:h-16 sm:w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-[#e53935] hover:bg-[#d32f2f] text-white shadow-xl shadow-red-600/30 transition-transform duration-200 hover:scale-110 active:scale-95 cursor-pointer"
          >
            {playing ? (
              <Pause className="h-7 w-7 fill-current" />
            ) : (
              <Play className="h-7 w-7 fill-current translate-x-0.5" />
            )}
          </motion.button>
        )}
      </AnimatePresence>

      {/* Loading Spinner */}
      {!ready && (
        <div className="absolute inset-0 z-10 flex items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-3 border-white/20 border-t-red-600" />
        </div>
      )}

      {/* Bottom Control Bar */}
      <div
        className={cn(
          "absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/90 via-black/50 to-transparent px-3 pb-2 pt-6 sm:px-4 transition-opacity duration-300",
          controlsVisible ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Scrubber / Seek Bar */}
        <div className="relative group/seek w-full py-1">
          <input
            type="range"
            min={0}
            max={duration || 0}
            step={0.1}
            value={displayTime}
            onChange={(e) => {
              setSeeking(true);
              setSeekPreview(Number(e.target.value));
            }}
            onMouseUp={(e) => {
              seekTo(Number((e.target as HTMLInputElement).value));
              setSeeking(false);
            }}
            onTouchEnd={(e) => {
              seekTo(Number((e.target as HTMLInputElement).value));
              setSeeking(false);
            }}
            className="yt-seek h-1 group-hover/seek:h-1.5 w-full cursor-pointer appearance-none rounded-full bg-white/25 accent-red-600 transition-all"
            style={{
              background: duration
                ? `linear-gradient(to right, #ef4444 ${(displayTime / duration) * 100}%, rgba(255,255,255,0.25) ${(displayTime / duration) * 100}%)`
                : undefined,
            }}
          />
        </div>

        {/* Controls Row */}
        <div className="mt-1.5 flex items-center justify-between gap-2 text-white">
          {/* Left Controls: Play/Pause, Volume, -10s Rewind, +10s Forward */}
          <div className="flex items-center gap-1 sm:gap-2">
            {/* Play/Pause */}
            <button
              type="button"
              onClick={togglePlay}
              aria-label={playing ? "Pause" : "Play"}
              className="rounded-full p-1.5 hover:bg-white/15 transition active:scale-95"
            >
              {playing ? <Pause className="h-4 w-4 fill-current" /> : <Play className="h-4 w-4 fill-current" />}
            </button>

            {/* Volume + Slider */}
            <div className="flex items-center gap-1 group/vol">
              <button
                type="button"
                onClick={toggleMute}
                aria-label={muted ? "Unmute" : "Mute"}
                className="rounded-full p-1.5 hover:bg-white/15 transition"
              >
                {muted || volume === 0 ? (
                  <VolumeX className="h-4 w-4 text-red-400" />
                ) : volume < 50 ? (
                  <Volume1 className="h-4 w-4" />
                ) : (
                  <Volume2 className="h-4 w-4" />
                )}
              </button>
              <input
                type="range"
                min={0}
                max={100}
                value={muted ? 0 : volume}
                onChange={(e) => onVolumeChange(Number(e.target.value))}
                className="hidden sm:block h-1 w-14 cursor-pointer appearance-none rounded-full bg-white/30 accent-white transition-opacity"
              />
            </div>

            {/* Rewind 10 Seconds */}
            <button
              type="button"
              onClick={() => seekBy(-10)}
              title="Rewind 10 seconds"
              aria-label="Rewind 10 seconds"
              className="relative flex h-7 w-7 items-center justify-center rounded-full text-white/90 hover:text-white hover:bg-white/15 transition active:scale-95"
            >
              <RotateCcw className="h-4 w-4" />
              <span className="absolute text-[7px] font-extrabold leading-none select-none">10</span>
            </button>

            {/* Forward 10 Seconds */}
            <button
              type="button"
              onClick={() => seekBy(10)}
              title="Forward 10 seconds"
              aria-label="Forward 10 seconds"
              className="relative flex h-7 w-7 items-center justify-center rounded-full text-white/90 hover:text-white hover:bg-white/15 transition active:scale-95"
            >
              <RotateCw className="h-4 w-4" />
              <span className="absolute text-[7px] font-extrabold leading-none select-none">10</span>
            </button>
          </div>

          {/* Right Controls: Remaining Time, Speed, Fullscreen, Tiny YouTube logo */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Time display: clicking toggles remaining (-1:42:49) vs elapsed / total */}
            <button
              type="button"
              onClick={() => setShowRemainingTime((v) => !v)}
              title="Toggle elapsed / remaining time"
              className="text-[11px] sm:text-xs font-mono tabular-nums text-white/90 hover:text-white transition"
            >
              {showRemainingTime ? (
                `-${formatTime(remainingTime)}`
              ) : (
                `${formatTime(displayTime)} / ${formatTime(duration)}`
              )}
            </button>

            {/* Playback Speed */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowSpeedMenu((v) => !v)}
                className="rounded-full px-2 py-0.5 text-[11px] font-bold text-white/90 hover:text-white hover:bg-white/15 transition tabular-nums"
              >
                {rate}x
              </button>
              {showSpeedMenu && (
                <div className="absolute bottom-8 right-0 z-30 flex flex-col rounded-xl bg-zinc-900/95 border border-white/10 py-1 shadow-2xl backdrop-blur-md">
                  {SPEED_OPTIONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setSpeed(s)}
                      className={cn(
                        "px-4 py-1.5 text-left text-xs whitespace-nowrap transition",
                        s === rate ? "bg-red-600/20 text-red-500 font-bold" : "text-white/80 hover:bg-white/10 hover:text-white"
                      )}
                    >
                      {s}x
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Fullscreen Toggle */}
            <button
              type="button"
              onClick={toggleFullscreen}
              aria-label={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
              className="rounded-full p-1.5 hover:bg-white/15 transition active:scale-95"
            >
              {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
            </button>

            {/* Tiny discreet YouTube logo matching screenshot */}
            <a
              href={`https://www.youtube.com/watch?v=${videoId}`}
              target="_blank"
              rel="noopener noreferrer"
              title="Watch on YouTube"
              className="flex items-center gap-1 opacity-70 hover:opacity-100 transition-opacity pl-0.5 select-none"
            >
              <svg className="h-2.5 w-3.5 fill-red-600 shrink-0" viewBox="0 0 24 24">
                <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
              </svg>
              <span className="text-[10px] font-bold text-white/90 tracking-tighter">YouTube</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Custom HTML5 Video Player for direct video files (MP4, WebM, etc.),
 * sharing the EXACT same layout, clock, center red button, and controls as YouTube.
 */
function CustomHtml5Player({
  src,
  poster,
  title,
  subtitle = "IIT School",
  canShowChat,
  chatOpen,
  onChatToggle,
}: {
  src: string;
  poster?: string;
  title?: string;
  subtitle?: string;
  canShowChat: boolean;
  chatOpen: boolean;
  onChatToggle?: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const hideControlsTimer = useRef<number | null>(null);

  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(100);
  const [muted, setMuted] = useState(false);
  const [rate, setRate] = useState(1);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [seeking, setSeeking] = useState(false);
  const [seekPreview, setSeekPreview] = useState(0);
  const [showRemainingTime, setShowRemainingTime] = useState(true);

  useEffect(() => {
    const handler = () => setIsFullscreen(document.fullscreenElement === wrapRef.current);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  const resetHideTimer = useCallback(() => {
    setControlsVisible(true);
    if (hideControlsTimer.current) window.clearTimeout(hideControlsTimer.current);
    hideControlsTimer.current = window.setTimeout(() => {
      setControlsVisible((v) => (playing ? false : v));
    }, 2800);
  }, [playing]);

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      v.play().catch(() => {});
    } else {
      v.pause();
    }
    resetHideTimer();
  };

  const seekTo = (t: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = Math.max(0, Math.min(duration || 0, t));
    setCurrentTime(v.currentTime);
  };

  const seekBy = (deltaSeconds: number) => {
    const v = videoRef.current;
    if (!v) return;
    seekTo(v.currentTime + deltaSeconds);
    resetHideTimer();
  };

  const toggleMute = () => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
    resetHideTimer();
  };

  const onVolumeChange = (vol: number) => {
    const v = videoRef.current;
    setVolume(vol);
    if (!v) return;
    v.volume = vol / 100;
    if (vol === 0) {
      v.muted = true;
      setMuted(true);
    } else if (muted) {
      v.muted = false;
      setMuted(false);
    }
    resetHideTimer();
  };

  const setSpeed = (r: number) => {
    const v = videoRef.current;
    setRate(r);
    if (v) v.playbackRate = r;
    setShowSpeedMenu(false);
    resetHideTimer();
  };

  const toggleFullscreen = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen?.();
    } else {
      wrapRef.current?.requestFullscreen?.();
    }
    resetHideTimer();
  };

  const displayTime = seeking ? seekPreview : currentTime;
  const remainingTime = Math.max(0, duration - displayTime);

  return (
    <div
      ref={wrapRef}
      className="relative h-full w-full bg-black select-none overflow-hidden group"
      onMouseMove={resetHideTimer}
      onClick={togglePlay}
    >
      <video
        ref={videoRef}
        src={src}
        poster={poster}
        playsInline
        autoPlay
        onLoadedMetadata={() => {
          setReady(true);
          if (videoRef.current) setDuration(videoRef.current.duration);
        }}
        onTimeUpdate={() => {
          if (!seeking && videoRef.current) {
            setCurrentTime(videoRef.current.currentTime);
          }
        }}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        className="h-full w-full object-contain bg-black"
      />

      {/* Top Bar: Circular Chat Toggle (Top Left) + Title/Subtitle + Live Clock (Top Right) */}
      <div
        className={cn(
          "absolute inset-x-0 top-0 z-20 flex items-start justify-between bg-gradient-to-b from-black/80 via-black/40 to-transparent p-3 sm:p-4 transition-opacity duration-300",
          controlsVisible ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
      >
        <div className="flex items-center gap-3 min-w-0 pr-3">
          {canShowChat && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onChatToggle?.();
              }}
              title={chatOpen ? "Hide Live Chat" : "Open Live Chat"}
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition backdrop-blur-md shadow-md",
                chatOpen
                  ? "bg-red-600 border-red-400 text-white shadow-red-600/30 ring-2 ring-red-400/40"
                  : "bg-black/50 border-white/25 text-white hover:bg-black/80 hover:border-white/50"
              )}
            >
              <MessageCircle className="h-4 w-4" />
            </button>
          )}

          <div className="min-w-0 flex flex-col justify-center">
            {title && (
              <h2 className="truncate text-xs sm:text-sm font-bold text-white drop-shadow-md tracking-tight leading-tight">
                {title}
              </h2>
            )}
            {subtitle && (
              <p className="truncate text-[10px] sm:text-[11px] font-normal text-white/75 drop-shadow-sm leading-tight mt-0.5">
                {subtitle}
              </p>
            )}
          </div>
        </div>

        <div className="shrink-0 flex items-center gap-2 pl-2">
          <LiveClock />
        </div>
      </div>

      {/* Center Red Circular Play/Pause Button */}
      <AnimatePresence>
        {(!playing || controlsVisible) && ready && (
          <motion.button
            key="center-play-btn"
            type="button"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.15 }}
            onClick={(e) => {
              e.stopPropagation();
              togglePlay();
            }}
            aria-label={playing ? "Pause" : "Play"}
            className="absolute left-1/2 top-1/2 z-20 flex h-14 w-14 sm:h-16 sm:w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-[#e53935] hover:bg-[#d32f2f] text-white shadow-xl shadow-red-600/30 transition-transform duration-200 hover:scale-110 active:scale-95 cursor-pointer"
          >
            {playing ? (
              <Pause className="h-7 w-7 fill-current" />
            ) : (
              <Play className="h-7 w-7 fill-current translate-x-0.5" />
            )}
          </motion.button>
        )}
      </AnimatePresence>

      {/* Bottom Controls */}
      <div
        className={cn(
          "absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/90 via-black/50 to-transparent px-3 pb-2 pt-6 sm:px-4 transition-opacity duration-300",
          controlsVisible ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative group/seek w-full py-1">
          <input
            type="range"
            min={0}
            max={duration || 0}
            step={0.1}
            value={displayTime}
            onChange={(e) => {
              setSeeking(true);
              setSeekPreview(Number(e.target.value));
            }}
            onMouseUp={(e) => {
              seekTo(Number((e.target as HTMLInputElement).value));
              setSeeking(false);
            }}
            onTouchEnd={(e) => {
              seekTo(Number((e.target as HTMLInputElement).value));
              setSeeking(false);
            }}
            className="yt-seek h-1 group-hover/seek:h-1.5 w-full cursor-pointer appearance-none rounded-full bg-white/25 accent-red-600 transition-all"
            style={{
              background: duration
                ? `linear-gradient(to right, #ef4444 ${(displayTime / duration) * 100}%, rgba(255,255,255,0.25) ${(displayTime / duration) * 100}%)`
                : undefined,
            }}
          />
        </div>

        <div className="mt-1.5 flex items-center justify-between gap-2 text-white">
          <div className="flex items-center gap-1 sm:gap-2">
            <button
              type="button"
              onClick={togglePlay}
              className="rounded-full p-1.5 hover:bg-white/15 transition active:scale-95"
            >
              {playing ? <Pause className="h-4 w-4 fill-current" /> : <Play className="h-4 w-4 fill-current" />}
            </button>

            <div className="flex items-center gap-1 group/vol">
              <button
                type="button"
                onClick={toggleMute}
                className="rounded-full p-1.5 hover:bg-white/15 transition"
              >
                {muted || volume === 0 ? (
                  <VolumeX className="h-4 w-4 text-red-400" />
                ) : (
                  <Volume2 className="h-4 w-4" />
                )}
              </button>
              <input
                type="range"
                min={0}
                max={100}
                value={muted ? 0 : volume}
                onChange={(e) => onVolumeChange(Number(e.target.value))}
                className="hidden sm:block h-1 w-14 cursor-pointer appearance-none rounded-full bg-white/30 accent-white transition-opacity"
              />
            </div>

            <button
              type="button"
              onClick={() => seekBy(-10)}
              title="Rewind 10 seconds"
              className="relative flex h-7 w-7 items-center justify-center rounded-full text-white/90 hover:text-white hover:bg-white/15 transition active:scale-95"
            >
              <RotateCcw className="h-4 w-4" />
              <span className="absolute text-[7px] font-extrabold leading-none select-none">10</span>
            </button>

            <button
              type="button"
              onClick={() => seekBy(10)}
              title="Forward 10 seconds"
              className="relative flex h-7 w-7 items-center justify-center rounded-full text-white/90 hover:text-white hover:bg-white/15 transition active:scale-95"
            >
              <RotateCw className="h-4 w-4" />
              <span className="absolute text-[7px] font-extrabold leading-none select-none">10</span>
            </button>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => setShowRemainingTime((v) => !v)}
              className="text-[11px] sm:text-xs font-mono tabular-nums text-white/90 hover:text-white transition"
            >
              {showRemainingTime ? (
                `-${formatTime(remainingTime)}`
              ) : (
                `${formatTime(displayTime)} / ${formatTime(duration)}`
              )}
            </button>

            <div className="relative">
              <button
                type="button"
                onClick={() => setShowSpeedMenu((v) => !v)}
                className="rounded-full px-2 py-0.5 text-[11px] font-bold text-white/90 hover:text-white hover:bg-white/15 transition tabular-nums"
              >
                {rate}x
              </button>
              {showSpeedMenu && (
                <div className="absolute bottom-8 right-0 z-30 flex flex-col rounded-xl bg-zinc-900/95 border border-white/10 py-1 shadow-2xl backdrop-blur-md">
                  {SPEED_OPTIONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setSpeed(s)}
                      className={cn(
                        "px-4 py-1.5 text-left text-xs whitespace-nowrap transition",
                        s === rate ? "bg-red-600/20 text-red-500 font-bold" : "text-white/80 hover:bg-white/10 hover:text-white"
                      )}
                    >
                      {s}x
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={toggleFullscreen}
              className="rounded-full p-1.5 hover:bg-white/15 transition active:scale-95"
            >
              {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

type Props = {
  src: string;
  poster?: string;
  title?: string;
  subtitle?: string;
  className?: string;
  fullscreenTargetRef?: RefObject<HTMLElement | null>;
  chatComponent?: React.ReactNode;
  isLive?: boolean;
  chatVisible?: boolean;
  onChatToggle?: () => void;
};

export function VideoPlayer({
  src,
  poster,
  title,
  subtitle,
  className,
  chatComponent,
  isLive = false,
  chatVisible: externalChatVisible,
  onChatToggle: externalOnChatToggle,
}: Props) {
  const outerWrapRef = useRef<HTMLDivElement>(null);
  const [internalChatVisible, setInternalChatVisible] = useState(true);
  const chatVisible = externalChatVisible !== undefined ? externalChatVisible : internalChatVisible;
  const handleChatToggle = externalOnChatToggle ?? (() => setInternalChatVisible((v) => !v));

  const canShowChat = Boolean(isLive && (chatComponent || externalOnChatToggle));

  const [playbackFailed, setPlaybackFailed] = useState(false);
  useEffect(() => {
    setPlaybackFailed(false);
  }, [src]);

  if (!src?.trim()) {
    return <VideoUnavailable message="No video link has been added for this class yet." className={className} />;
  }

  const embedInfo = getEmbedableSource(src);

  if (!embedInfo) {
    return <VideoUnavailable message="Invalid video URL format." className={className} />;
  }

  return (
    <motion.div
      ref={outerWrapRef}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className={cn(
        "group relative flex bg-black overflow-hidden transition-all duration-300 w-full h-full rounded-2xl border border-zinc-800 shadow-xl",
        className
      )}
    >
      <div className="flex-1 relative min-w-0 h-full w-full flex items-center justify-center bg-black overflow-hidden">
        {embedInfo.type === "drive" ? (
          <iframe
            src={embedInfo.embedUrl}
            title={title || "Video Lecture"}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            className="w-full h-full border-0"
          />
        ) : embedInfo.type === "youtube" && (playbackFailed || !embedInfo.videoId) ? (
          <iframe
            key={embedInfo.embedUrl}
            src={embedInfo.embedUrl}
            title={title || "Video Lecture"}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            className="w-full h-full border-0"
          />
        ) : embedInfo.type === "youtube" ? (
          <CustomYouTubePlayer
            key={embedInfo.videoId}
            videoId={embedInfo.videoId!}
            title={title}
            subtitle={subtitle}
            onError={() => setPlaybackFailed(true)}
            canShowChat={canShowChat}
            chatOpen={chatVisible}
            onChatToggle={handleChatToggle}
          />
        ) : playbackFailed ? (
          <video
            src={embedInfo.embedUrl}
            poster={poster}
            controls
            autoPlay
            playsInline
            className="w-full h-full object-contain bg-black"
          />
        ) : (
          <CustomHtml5Player
            key={embedInfo.embedUrl}
            src={embedInfo.embedUrl}
            poster={poster}
            title={title}
            subtitle={subtitle}
            canShowChat={canShowChat}
            chatOpen={chatVisible}
            onChatToggle={handleChatToggle}
          />
        )}
      </div>

      {chatComponent && chatVisible && canShowChat && (
        <div className="w-[300px] sm:w-[350px] lg:w-[380px] shrink-0 border-l border-zinc-800 h-full flex flex-col bg-zinc-950 animate-in slide-in-from-right duration-200">
          {chatComponent}
        </div>
      )}
    </motion.div>
  );
}

function VideoUnavailable({ message, className }: { message: string; className?: string }) {
  return (
    <div
      className={cn(
        "flex aspect-video flex-col items-center justify-center gap-3 rounded-2xl bg-zinc-900 p-6 text-center text-sm text-zinc-300 border border-zinc-800",
        className
      )}
    >
      <AlertTriangle className="h-8 w-8 text-amber-400" />
      <p>{message}</p>
    </div>
  );
}

