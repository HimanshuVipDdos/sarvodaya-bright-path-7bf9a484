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
} from "lucide-react";
import { toast } from "sonner";
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
      embedUrl: `https://www.youtube.com/embed/${ytId}?autoplay=1&controls=0&disablekb=1&modestbranding=1&rel=0&iv_load_policy=3&playsinline=1&enablejsapi=1&fs=0`,
      rawUrl: `https://www.youtube.com/watch?v=${ytId}`,
      videoId: ytId,
    };
  }

  if (target.includes("youtube.com") || target.includes("youtu.be")) {
    return {
      type: "youtube",
      embedUrl: target.includes("?")
        ? `${target}&autoplay=1&controls=0&disablekb=1&modestbranding=1&rel=0&iv_load_policy=3&playsinline=1&enablejsapi=1&fs=0`
        : `${target}?autoplay=1&controls=0&disablekb=1&modestbranding=1&rel=0&iv_load_policy=3&playsinline=1&enablejsapi=1&fs=0`,
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

function loadYouTubeIframeApi(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject();
  const w = window as any;
  if (w.YT && w.YT.Player) return Promise.resolve();
  if (w.__ytApiPromise) return w.__ytApiPromise;

  w.__ytApiPromise = new Promise<void>((resolve) => {
    const existing = document.getElementById("yt-iframe-api");
    if (!existing) {
      const tag = document.createElement("script");
      tag.id = "yt-iframe-api";
      tag.src = "https://www.youtube.com/iframe_api";
      document.head.appendChild(tag);
    }
    const prevHandler = w.onYouTubeIframeAPIReady;
    w.onYouTubeIframeAPIReady = () => {
      if (typeof prevHandler === "function") prevHandler();
      resolve();
    };
    const checkInterval = setInterval(() => {
      if (w.YT && w.YT.Player) {
        clearInterval(checkInterval);
        resolve();
      }
    }, 150);
    setTimeout(() => {
      clearInterval(checkInterval);
      resolve();
    }, 4000);
  });
  return w.__ytApiPromise;
}

/**
 * Custom YouTube Player matching the reference screenshot:
 * - Direct iframe with controls=0 (native YouTube controls can never bleed through)
 * - Top-left: Circular translucent Chat toggle button + Lecture Title + Subtitle
 * - Top-right: Digital clock (10:01)
 * - Center: Red circular Play/Pause button
 * - Bottom: Seek bar, Play/Pause, Volume, -10s Rewind, +10s Forward, Remaining time (-1:42:49), Speed (1x), Fullscreen, and tiny YouTube logo
 */
function CustomYouTubePlayer({
  videoId,
  title,
  subtitle = "IIT School",
  canShowChat,
  chatOpen,
  onChatToggle,
  isLive = false,
}: {
  videoId: string;
  title?: string;
  subtitle?: string;
  canShowChat: boolean;
  chatOpen: boolean;
  onChatToggle?: () => void;
  isLive?: boolean;
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const seekbarRef = useRef<HTMLDivElement>(null);
  const ytPlayerRef = useRef<any>(null);
  const hideControlsTimer = useRef<number | null>(null);
  const timeTickerRef = useRef<number | null>(null);
  const seekingRef = useRef(false);

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
  const [isEnded, setIsEnded] = useState(false);

  // Send postMessage command to YouTube iframe
  const sendCommand = useCallback((func: string, args: any[] = []) => {
    try {
      if (ytPlayerRef.current && typeof ytPlayerRef.current[func] === "function") {
        ytPlayerRef.current[func](...args);
      }
    } catch {}

    try {
      iframeRef.current?.contentWindow?.postMessage(
        JSON.stringify({ event: "command", func, args }),
        "*"
      );
    } catch {}
  }, []);

  const handleSeekFromPointer = (clientX: number) => {
    if (!seekbarRef.current) return;
    const rect = seekbarRef.current.getBoundingClientRect();
    if (rect.width <= 0) return;
    const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const target = duration > 0 ? pct * duration : 0;
    setSeekPreview(target);
    setCurrentTime(target);
    sendCommand("seekTo", [target, true]);
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    seekingRef.current = true;
    setSeeking(true);
    handleSeekFromPointer(e.clientX);
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {}
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (seekingRef.current) {
      handleSeekFromPointer(e.clientX);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (seekingRef.current) {
      seekingRef.current = false;
      setSeeking(false);
      handleSeekFromPointer(e.clientX);
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {}
    }
  };

  // Listen for YouTube postMessage events (onReady, infoDelivery, stateChange)
  useEffect(() => {
    const handleMsg = (e: MessageEvent) => {
      try {
        const d = typeof e.data === "string" ? JSON.parse(e.data) : e.data;
        if (!d) return;

        if (d.event === "onReady" || d.event === "ready") {
          setReady(true);
          try {
            iframeRef.current?.contentWindow?.postMessage(JSON.stringify({ event: "listening" }), "*");
          } catch {}
        }

        if (d.event === "infoDelivery" && d.info) {
          setReady(true);
          if (typeof d.info.currentTime === "number" && !seeking) {
            setCurrentTime(d.info.currentTime);
          }
          if (typeof d.info.duration === "number" && d.info.duration > 0) {
            setDuration(d.info.duration);
          }
          if (typeof d.info.playerState === "number") {
            // 1 = playing, 2 = paused, 0 = ended, 3 = buffering
            setPlaying(d.info.playerState === 1);
            if (d.info.playerState === 1) {
              setReady(true);
              setIsEnded(false);
            } else if (d.info.playerState === 0) {
              setIsEnded(true);
            }
          }
        }

        if (d.event === "onError") {
          if (d.data === 101 || d.data === 150) {
            setEmbeddingDisabled(true);
          }
        }
      } catch {}
    };

    window.addEventListener("message", handleMsg);
    return () => window.removeEventListener("message", handleMsg);
  }, [seeking]);

  const initYTPlayer = useCallback(() => {
    setReady(true);
    try {
      iframeRef.current?.contentWindow?.postMessage(JSON.stringify({ event: "listening" }), "*");
    } catch {}

    const w = typeof window !== "undefined" ? (window as any) : null;
    if (w && w.YT && w.YT.Player && iframeRef.current) {
      try {
        ytPlayerRef.current = new w.YT.Player(iframeRef.current, {
          events: {
            onReady: (e: any) => {
              setReady(true);
              const d = e.target.getDuration?.();
              if (d) setDuration(d);
              const state = e.target.getPlayerState?.();
              if (typeof state === "number") {
                setPlaying(state === 1);
              }
            },
            onStateChange: (e: any) => {
              setPlaying(e.data === 1);
              if (e.data === 1) setIsEnded(false);
              else if (e.data === 0) setIsEnded(true);
              const d = e.target.getDuration?.();
              if (d) setDuration(d);
            },
            onError: (e: any) => {
              if (e?.data === 101 || e?.data === 150) {
                setEmbeddingDisabled(true);
              }
            },
          },
        });
      } catch {}
    }
  }, []);

  useEffect(() => {
    let unmounted = false;
    loadYouTubeIframeApi().then(() => {
      if (!unmounted && iframeRef.current) {
        initYTPlayer();
      }
    });
    return () => {
      unmounted = true;
    };
  }, [initYTPlayer]);

  const handleIframeLoad = () => {
    initYTPlayer();
  };

  // Continuously poll duration & currentTime, and send listening handshake
  useEffect(() => {
    const pollInterval = window.setInterval(() => {
      try {
        iframeRef.current?.contentWindow?.postMessage(JSON.stringify({ event: "listening" }), "*");
      } catch {}

      try {
        if (ytPlayerRef.current) {
          if (!seekingRef.current && typeof ytPlayerRef.current.getCurrentTime === "function") {
            const t = ytPlayerRef.current.getCurrentTime();
            if (typeof t === "number" && !isNaN(t)) {
              setCurrentTime(t);
            }
          }
          if (typeof ytPlayerRef.current.getDuration === "function") {
            const d = ytPlayerRef.current.getDuration();
            if (typeof d === "number" && d > 0 && !isNaN(d)) {
              setDuration(d);
            }
          }
        }
      } catch {}
    }, 250);

    return () => clearInterval(pollInterval);
  }, []);

  // Fullscreen change detection
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
    if (playing) {
      sendCommand("pauseVideo");
      setPlaying(false);
    } else {
      sendCommand("playVideo");
      setPlaying(true);
    }
    resetHideTimer();
  };

  const seekTo = (t: number) => {
    const targetTime = Math.max(0, Math.min(duration || 0, t));
    sendCommand("seekTo", [targetTime, true]);
    setCurrentTime(targetTime);
  };

  const seekBy = (deltaSeconds: number) => {
    const targetTime = Math.max(0, Math.min(duration || 0, currentTime + deltaSeconds));
    seekTo(targetTime);
    resetHideTimer();
  };

  const toggleMute = () => {
    if (muted) {
      sendCommand("unMute");
      setMuted(false);
    } else {
      sendCommand("mute");
      setMuted(true);
    }
    resetHideTimer();
  };

  const onVolumeChange = (v: number) => {
    setVolume(v);
    sendCommand("setVolume", [v]);
    if (v === 0) {
      sendCommand("mute");
      setMuted(true);
    } else if (muted) {
      sendCommand("unMute");
      setMuted(false);
    }
    resetHideTimer();
  };

  const setSpeed = (r: number) => {
    setRate(r);
    sendCommand("setPlaybackRate", [r]);
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

  const originParam = typeof window !== "undefined" ? encodeURIComponent(window.location.origin) : "";
  const embedSrc = `https://www.youtube.com/embed/${videoId}?autoplay=1&controls=0&disablekb=1&modestbranding=1&rel=0&iv_load_policy=3&playsinline=1&enablejsapi=1&fs=0${originParam ? `&origin=${originParam}` : ""}`;

  if (embeddingDisabled) {
    return (
      <div className="relative flex h-full w-full flex-col items-center justify-center bg-zinc-950 p-6 text-center text-white select-none">
        <AlertTriangle className="h-10 w-10 text-amber-400 mb-3" />
        <h3 className="text-base font-bold text-white">Playback Restricted by Creator</h3>
        <p className="mt-1 max-w-md text-xs text-white/70">
          This video has embedding restrictions enabled by the instructor.
        </p>
        <p className="mt-4 text-xs text-white/60">
          Please contact your instructor or batch admin to verify playback permissions.
        </p>
      </div>
    );
  }

  return (
    <div
      ref={wrapRef}
      onContextMenu={(e) => e.preventDefault()}
      className="relative h-full w-full bg-black select-none overflow-hidden group"
      onMouseMove={resetHideTimer}
      onClick={(e) => {
        if (e.target === wrapRef.current || (e.target as HTMLElement).closest(".yt-click-surface")) {
          togglePlay();
        }
      }}
    >
      {/* Real YouTube iframe with controls=0 permanently enforced & cropped edges */}
      <iframe
        ref={iframeRef}
        src={embedSrc}
        title={title || "Video Lecture"}
        onLoad={handleIframeLoad}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
        className="pointer-events-none absolute -inset-x-[2%] -inset-y-[4%] h-[108%] w-[104%] border-0"
      />

      {/* Transparent surface over the iframe to catch clicks & toggle play/pause */}
      <div className="yt-click-surface absolute inset-0 cursor-pointer" onClick={togglePlay} />

      {/* Smart Pause Mask: Completely blocks YouTube's "More videos" carousel & thumbnail cards on pause */}
      {!playing && ready && !isEnded && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-44 sm:h-52 bg-gradient-to-t from-black via-black/95 to-transparent" />
      )}

      {/* End of Lecture Overlay — prevents YouTube's 12-grid suggestions */}
      {isEnded && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/90 text-white p-6 text-center select-none">
          <h3 className="text-lg font-bold">Lecture Completed</h3>
          <p className="text-xs text-white/70 mt-1">You have reached the end of this lecture.</p>
          <button
            type="button"
            onClick={() => {
              setIsEnded(false);
              seekBy(-duration);
              togglePlay();
            }}
            className="mt-4 flex items-center gap-2 rounded-full bg-red-600 hover:bg-red-700 text-white px-5 py-2 text-xs font-bold transition shadow-lg active:scale-95"
          >
            <RotateCcw className="h-4 w-4" />
            <span>Replay Lecture</span>
          </button>
        </div>
      )}

      {/* Top Bar: Title/Subtitle + Live Clock */}
      <div
        className={cn(
          "absolute inset-x-0 top-0 z-20 flex items-start justify-between bg-gradient-to-b from-black/80 via-black/40 to-transparent p-3 sm:p-4 transition-opacity duration-300",
          controlsVisible || !playing ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
      >
        <div className="min-w-0 flex flex-col justify-center pr-3">
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

        <div className="shrink-0 flex items-center gap-2 pl-2">
          <LiveClock />
        </div>
      </div>

      {/* Center Red Circular Play/Pause Button */}
      <AnimatePresence>
        {(!playing || controlsVisible) && (
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
      {!ready && playing && (
        <div className="absolute inset-0 z-10 flex items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-3 border-white/20 border-t-red-600" />
        </div>
      )}

      {/* Bottom Control Bar */}
      <div
        className={cn(
          "absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black via-black/85 to-transparent px-3 pb-2.5 pt-10 sm:px-4 transition-opacity duration-300",
          controlsVisible || !playing ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Scrubber / Seek Bar matching reference screenshot */}
        <div
          ref={seekbarRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className="relative w-full py-2 cursor-pointer select-none group/seek touch-none"
        >
          <div className="relative h-1 group-hover/seek:h-1.5 w-full rounded-full bg-white/25 transition-all">
            <div
              className="absolute left-0 top-0 h-full rounded-full bg-white"
              style={{ width: `${duration > 0 ? Math.min(100, Math.max(0, (displayTime / duration) * 100)) : 0}%` }}
            />
            <div
              className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 h-3 w-3 sm:h-3.5 sm:w-3.5 rounded-full bg-white shadow-md transition-transform group-hover/seek:scale-125"
              style={{ left: `${duration > 0 ? Math.min(100, Math.max(0, (displayTime / duration) * 100)) : 0}%` }}
            />
          </div>
        </div>

        <div className="mt-1 flex items-center justify-between gap-2 text-white">
          <div className="flex items-center gap-1 sm:gap-2">
            <button
              type="button"
              onClick={togglePlay}
              aria-label={playing ? "Pause" : "Play"}
              className="rounded-full p-1.5 hover:bg-white/15 transition active:scale-95"
            >
              {playing ? <Pause className="h-4 w-4 fill-current" /> : <Play className="h-4 w-4 fill-current" />}
            </button>

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
            {/* Live Chat Toggle Button — strictly visible only for Live classes */}
            {isLive && canShowChat && onChatToggle && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onChatToggle();
                }}
                title={chatOpen ? "Hide Live Chat" : "Open Live Chat"}
                aria-label="Toggle Live Chat"
                className={cn(
                  "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold transition active:scale-95 shadow-sm",
                  chatOpen
                    ? "bg-red-600 text-white shadow-red-600/30 ring-1 ring-red-400/40"
                    : "bg-white/15 text-white hover:bg-white/25"
                )}
              >
                <MessageCircle className="h-3.5 w-3.5" />
                <span className="text-[11px] font-bold">Chat</span>
              </button>
            )}

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
              aria-label={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
              className="rounded-full p-1.5 hover:bg-white/15 transition active:scale-95"
            >
              {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
            </button>

            {/* Non-clickable subtle YouTube branding badge — prevents URL leakage in paid batches */}
            <div
              className="flex items-center gap-1 opacity-60 select-none pl-0.5 pointer-events-none cursor-default"
            >
              <svg className="h-2.5 w-3.5 fill-red-600 shrink-0" viewBox="0 0 24 24">
                <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
              </svg>
              <span className="text-[10px] font-bold text-white/90 tracking-tighter">YouTube</span>
            </div>
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
  isLive = false,
}: {
  src: string;
  poster?: string;
  title?: string;
  subtitle?: string;
  canShowChat: boolean;
  chatOpen: boolean;
  onChatToggle?: () => void;
  isLive?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const seekbarRef = useRef<HTMLDivElement>(null);
  const hideControlsTimer = useRef<number | null>(null);
  const seekingRef = useRef(false);

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

  const handleSeekFromPointer = (clientX: number) => {
    if (!seekbarRef.current) return;
    const rect = seekbarRef.current.getBoundingClientRect();
    if (rect.width <= 0) return;
    const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const target = duration > 0 ? pct * duration : 0;
    setSeekPreview(target);
    setCurrentTime(target);
    if (videoRef.current) {
      videoRef.current.currentTime = target;
    }
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    seekingRef.current = true;
    setSeeking(true);
    handleSeekFromPointer(e.clientX);
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {}
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (seekingRef.current) {
      handleSeekFromPointer(e.clientX);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (seekingRef.current) {
      seekingRef.current = false;
      setSeeking(false);
      handleSeekFromPointer(e.clientX);
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {}
    }
  };

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
      onContextMenu={(e) => e.preventDefault()}
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

      {/* Top Bar: Title/Subtitle + Live Clock */}
      <div
        className={cn(
          "absolute inset-x-0 top-0 z-20 flex items-start justify-between bg-gradient-to-b from-black/80 via-black/40 to-transparent p-3 sm:p-4 transition-opacity duration-300",
          controlsVisible || !playing ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
      >
        <div className="min-w-0 flex flex-col justify-center pr-3">
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

        <div className="shrink-0 flex items-center gap-2 pl-2">
          <LiveClock />
        </div>
      </div>

      {/* Center Red Circular Play/Pause Button */}
      <AnimatePresence>
        {(!playing || controlsVisible) && (
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

      {/* Bottom Control Bar */}
      <div
        className={cn(
          "absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black via-black/85 to-transparent px-3 pb-2.5 pt-10 sm:px-4 transition-opacity duration-300",
          controlsVisible || !playing ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Scrubber / Seek Bar matching reference screenshot */}
        <div
          ref={seekbarRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className="relative w-full py-2 cursor-pointer select-none group/seek touch-none"
        >
          <div className="relative h-1 group-hover/seek:h-1.5 w-full rounded-full bg-white/25 transition-all">
            <div
              className="absolute left-0 top-0 h-full rounded-full bg-white"
              style={{ width: `${duration > 0 ? Math.min(100, Math.max(0, (displayTime / duration) * 100)) : 0}%` }}
            />
            <div
              className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 h-3 w-3 sm:h-3.5 sm:w-3.5 rounded-full bg-white shadow-md transition-transform group-hover/seek:scale-125"
              style={{ left: `${duration > 0 ? Math.min(100, Math.max(0, (displayTime / duration) * 100)) : 0}%` }}
            />
          </div>
        </div>

        <div className="mt-1 flex items-center justify-between gap-2 text-white">
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
            {/* Live Chat Toggle Button — strictly visible only for Live classes */}
            {isLive && canShowChat && onChatToggle && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onChatToggle();
                }}
                title={chatOpen ? "Hide Live Chat" : "Open Live Chat"}
                aria-label="Toggle Live Chat"
                className={cn(
                  "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold transition active:scale-95 shadow-sm",
                  chatOpen
                    ? "bg-red-600 text-white shadow-red-600/30 ring-1 ring-red-400/40"
                    : "bg-white/15 text-white hover:bg-white/25"
                )}
              >
                <MessageCircle className="h-3.5 w-3.5" />
                <span className="text-[11px] font-bold">Chat</span>
              </button>
            )}

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

  const canShowChat = Boolean(chatComponent || externalOnChatToggle);

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
        ) : embedInfo.type === "youtube" && embedInfo.videoId ? (
          <CustomYouTubePlayer
            key={embedInfo.videoId}
            videoId={embedInfo.videoId}
            title={title}
            subtitle={subtitle}
            canShowChat={canShowChat}
            chatOpen={chatVisible}
            onChatToggle={handleChatToggle}
            isLive={isLive}
          />
        ) : embedInfo.type === "youtube" ? (
          <iframe
            key={embedInfo.embedUrl}
            src={embedInfo.embedUrl}
            title={title || "Video Lecture"}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            className="w-full h-full border-0"
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
            isLive={isLive}
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

