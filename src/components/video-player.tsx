import { useState, useRef, useEffect, useCallback, type RefObject } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle,
  Play,
  Pause,
  Link2,
  Volume2,
  Volume1,
  VolumeX,
  Maximize,
  Minimize,
  MessageCircle,
  RotateCcw,
  RotateCw,
  Check,
  Zap,
  Settings,
  X,
} from "lucide-react";
import { toast } from "sonner";
import Hls from "hls.js";
import { useVideoFullscreen } from "@/hooks/use-video-fullscreen";
import { cn, getStorageUrl } from "@/lib/utils";
import { resolveVideoStream, type ResolvedStream } from "@/lib/stream-resolver";

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

const SPEED_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.25, 2.5];

const STORAGE_KEY_SPEED = "sarvodaya_lecture_speed";
const STORAGE_KEY_VOLUME = "sarvodaya_lecture_volume";

function getStoredSpeed(): number {
  if (typeof window === "undefined") return 1;
  try {
    const val = parseFloat(localStorage.getItem(STORAGE_KEY_SPEED) || "1");
    return SPEED_OPTIONS.includes(val) ? val : 1;
  } catch {
    return 1;
  }
}

function getStoredVolume(): number {
  if (typeof window === "undefined") return 100;
  try {
    const val = parseInt(localStorage.getItem(STORAGE_KEY_VOLUME) || "100", 10);
    return !isNaN(val) && val >= 0 && val <= 100 ? val : 100;
  } catch {
    return 100;
  }
}

const QUALITY_OPTIONS = [
  { label: "1080p HD", ytQuality: "hd1080", height: 1080 },
  { label: "720p HD", ytQuality: "hd720", height: 720 },
  { label: "480p", ytQuality: "large", height: 480 },
  { label: "360p", ytQuality: "medium", height: 360 },
  { label: "240p", ytQuality: "small", height: 240 },
  { label: "Auto", ytQuality: "auto", height: -1 },
];

const STORAGE_KEY_QUALITY = "sarvodaya_lecture_quality";

function getStoredQuality(): string {
  if (typeof window === "undefined") return "1080p HD";
  try {
    return localStorage.getItem(STORAGE_KEY_QUALITY) || "1080p HD";
  } catch {
    return "1080p HD";
  }
}

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
  return (
    <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/40 border border-white/15 backdrop-blur-md text-[11px] font-mono font-medium text-white/90 shadow-xs">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
      {timeStr}
    </span>
  );
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
  fullscreenTargetRef,
  initialTime = 0,
  hideTopTitleWhenNotFullscreen = false,
  onClose,
  onTimeProgress,
}: {
  videoId: string;
  title?: string;
  subtitle?: string;
  canShowChat: boolean;
  chatOpen: boolean;
  onChatToggle?: () => void;
  isLive?: boolean;
  fullscreenTargetRef?: RefObject<HTMLElement | null>;
  initialTime?: number;
  hideTopTitleWhenNotFullscreen?: boolean;
  onClose?: () => void;
  onTimeProgress?: (time: number) => void;
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const seekbarRef = useRef<HTMLDivElement>(null);
  const ytPlayerRef = useRef<any>(null);
  const hideControlsTimer = useRef<number | null>(null);
  const timeTickerRef = useRef<number | null>(null);
  const seekingRef = useRef(false);
  const hasSeekedLiveRef = useRef(false);

  const targetFullscreenRef = (fullscreenTargetRef || wrapRef) as RefObject<HTMLElement | null>;
  const { isFullscreen, isPseudoFullscreen, toggleFullscreen } = useVideoFullscreen({
    containerRef: targetFullscreenRef,
    lockOrientationOnMobile: true,
  });

  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(() => getStoredVolume());
  const [muted, setMuted] = useState(false);
  const [rate, setRate] = useState(() => getStoredSpeed());
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [quality, setQuality] = useState(() => getStoredQuality());
  const [showQualityMenu, setShowQualityMenu] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [seeking, setSeeking] = useState(false);
  const [seekPreview, setSeekPreview] = useState(0);
  const [showRemainingTime, setShowRemainingTime] = useState(true);
  const [embeddingDisabled, setEmbeddingDisabled] = useState(false);
  const [isEnded, setIsEnded] = useState(false);

  // HUD Action Feedback
  const [hud, setHud] = useState<{ id: number; text: string; icon?: React.ReactNode } | null>(null);
  const hudTimerRef = useRef<number | null>(null);

  const showHud = useCallback((text: string, icon?: React.ReactNode) => {
    if (hudTimerRef.current) window.clearTimeout(hudTimerRef.current);
    setHud({ id: Date.now(), text, icon });
    hudTimerRef.current = window.setTimeout(() => {
      setHud(null);
    }, 1100);
  }, []);

  // Hover Tooltip on Seekbar
  const [hoverTooltip, setHoverTooltip] = useState<{ visible: boolean; x: number; time: number }>({
    visible: false,
    x: 0,
    time: 0,
  });

  // Double-tap / double-click gesture feedback
  const [seekRipple, setSeekRipple] = useState<"left" | "right" | null>(null);
  const clickTimerRef = useRef<number | null>(null);
  const lastClickTimeRef = useRef(0);

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
              onTimeProgress?.(t);
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
  }, [onTimeProgress]);

  // Live class auto-sync on load: start seekbar at live edge
  useEffect(() => {
    if (isLive && duration > 0 && !hasSeekedLiveRef.current) {
      hasSeekedLiveRef.current = true;
      sendCommand("seekTo", [duration, true]);
      setCurrentTime(duration);
    }
  }, [isLive, duration, sendCommand]);

  const lagSeconds = isLive && duration > 0 ? Math.max(0, duration - currentTime) : 0;
  const isAtLiveEdge = isLive ? lagSeconds <= 8 : true;

  const handleGoLive = useCallback(() => {
    if (duration > 0) {
      sendCommand("seekTo", [duration, true]);
      try {
        ytPlayerRef.current?.seekTo?.(duration, true);
      } catch {}
      setCurrentTime(duration);
      sendCommand("setPlaybackRate", [1]);
      sendCommand("playVideo", []);
      setRate(1);
      showHud("Live Edge", <span className="h-2 w-2 rounded-full bg-red-500 animate-ping" />);
    }
  }, [duration, sendCommand, showHud]);

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

  const togglePlay = useCallback(() => {
    if (playing) {
      sendCommand("pauseVideo");
      setPlaying(false);
      showHud("Paused", <Pause className="h-3.5 w-3.5 text-zinc-300 fill-current" />);
    } else {
      sendCommand("playVideo");
      setPlaying(true);
      showHud("Playing", <Play className="h-3.5 w-3.5 text-red-500 fill-current" />);
    }
    resetHideTimer();
  }, [playing, sendCommand, resetHideTimer, showHud]);

  const seekTo = (t: number) => {
    const targetTime = Math.max(0, Math.min(duration || 0, t));
    sendCommand("seekTo", [targetTime, true]);
    setCurrentTime(targetTime);
  };

  const seekBy = useCallback((deltaSeconds: number) => {
    const targetTime = Math.max(0, Math.min(duration || 0, currentTime + deltaSeconds));
    seekTo(targetTime);
    resetHideTimer();
    showHud(
      deltaSeconds > 0 ? "+10s Forward" : "-10s Rewind",
      deltaSeconds > 0 ? <RotateCw className="h-3.5 w-3.5 text-emerald-400" /> : <RotateCcw className="h-3.5 w-3.5 text-emerald-400" />
    );
  }, [currentTime, duration, resetHideTimer, showHud]);

  const toggleMute = useCallback(() => {
    if (muted) {
      sendCommand("unMute");
      setMuted(false);
      showHud(`Volume: ${volume}%`, <Volume2 className="h-3.5 w-3.5 text-blue-400" />);
    } else {
      sendCommand("mute");
      setMuted(true);
      showHud("Muted", <VolumeX className="h-3.5 w-3.5 text-red-400" />);
    }
    resetHideTimer();
  }, [muted, volume, sendCommand, resetHideTimer, showHud]);

  const onVolumeChange = useCallback((v: number) => {
    setVolume(v);
    try {
      localStorage.setItem(STORAGE_KEY_VOLUME, String(v));
    } catch {}
    sendCommand("setVolume", [v]);
    if (v === 0) {
      sendCommand("mute");
      setMuted(true);
      showHud("Muted", <VolumeX className="h-3.5 w-3.5 text-red-400" />);
    } else {
      if (muted) {
        sendCommand("unMute");
        setMuted(false);
      }
      showHud(`Volume: ${v}%`, <Volume2 className="h-3.5 w-3.5 text-blue-400" />);
    }
    resetHideTimer();
  }, [muted, sendCommand, resetHideTimer, showHud]);

  const setSpeed = useCallback((r: number) => {
    setRate(r);
    try {
      localStorage.setItem(STORAGE_KEY_SPEED, String(r));
    } catch {}
    sendCommand("setPlaybackRate", [r]);
    try {
      ytPlayerRef.current?.setPlaybackRate?.(r);
    } catch {}
    setShowSpeedMenu(false);
    resetHideTimer();
    showHud(`${r}x Speed`, <Zap className="h-3.5 w-3.5 text-amber-400" />);
  }, [sendCommand, resetHideTimer, showHud]);

  const stepSpeed = useCallback((direction: "up" | "down") => {
    const currentIndex = SPEED_OPTIONS.findIndex((s) => s === rate);
    let nextIndex: number;
    if (direction === "up") {
      nextIndex = currentIndex < SPEED_OPTIONS.length - 1 ? currentIndex + 1 : currentIndex;
    } else {
      nextIndex = currentIndex > 0 ? currentIndex - 1 : 0;
    }
    const nextSpeed = SPEED_OPTIONS[nextIndex];
    if (nextSpeed !== rate) {
      setSpeed(nextSpeed);
    }
  }, [rate, setSpeed]);

  const setVideoQuality = useCallback((opt: typeof QUALITY_OPTIONS[number]) => {
    setQuality(opt.label);
    try {
      localStorage.setItem(STORAGE_KEY_QUALITY, opt.label);
    } catch {}
    if (opt.ytQuality !== "auto") {
      sendCommand("setPlaybackQuality", [opt.ytQuality]);
      sendCommand("setPlaybackQualityRange", [opt.ytQuality, opt.ytQuality]);
      try {
        ytPlayerRef.current?.setPlaybackQuality?.(opt.ytQuality);
        ytPlayerRef.current?.setPlaybackQualityRange?.(opt.ytQuality, opt.ytQuality);
      } catch {}
    } else {
      sendCommand("setPlaybackQuality", ["default"]);
      try {
        ytPlayerRef.current?.setPlaybackQuality?.("default");
      } catch {}
    }
    setShowQualityMenu(false);
    resetHideTimer();
    showHud(`Quality: ${opt.label}`, <Settings className="h-3.5 w-3.5 text-indigo-400" />);
  }, [sendCommand, resetHideTimer, showHud]);

  // Click & Double-Click handler on video surface
  const handleSurfaceClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target.closest("button") || target.closest("input") || target.closest(".speed-menu-container") || target.closest(".quality-menu-container")) {
      return;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const pct = rect.width > 0 ? clickX / rect.width : 0.5;
    const now = Date.now();

    if (now - lastClickTimeRef.current < 280) {
      if (clickTimerRef.current) {
        window.clearTimeout(clickTimerRef.current);
        clickTimerRef.current = null;
      }
      lastClickTimeRef.current = 0;

      if (pct < 0.35) {
        seekBy(-10);
        setSeekRipple("left");
        setTimeout(() => setSeekRipple(null), 550);
      } else if (pct > 0.65) {
        seekBy(10);
        setSeekRipple("right");
        setTimeout(() => setSeekRipple(null), 550);
      } else {
        toggleFullscreen();
      }
      return;
    }

    lastClickTimeRef.current = now;
    if (clickTimerRef.current) window.clearTimeout(clickTimerRef.current);
    clickTimerRef.current = window.setTimeout(() => {
      togglePlay();
      clickTimerRef.current = null;
    }, 240);
  };

  const handleSeekbarHover = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!seekbarRef.current || duration <= 0) return;
    const rect = seekbarRef.current.getBoundingClientRect();
    if (rect.width <= 0) return;
    const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    const time = (x / rect.width) * duration;
    setHoverTooltip({ visible: true, x, time });
  };

  const handleSeekbarLeave = () => {
    setHoverTooltip((prev) => ({ ...prev, visible: false }));
  };

  // Click outside menus to auto-close
  useEffect(() => {
    if (!showSpeedMenu && !showQualityMenu) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest(".speed-menu-container")) setShowSpeedMenu(false);
      if (!target.closest(".quality-menu-container")) setShowQualityMenu(false);
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setShowSpeedMenu(false);
        setShowQualityMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEsc);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEsc);
    };
  }, [showSpeedMenu, showQualityMenu]);

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

      if (e.code === "Space" || e.key === "k" || e.key === "K") {
        e.preventDefault();
        togglePlay();
      } else if (e.code === "ArrowLeft" || e.key === "j" || e.key === "J") {
        e.preventDefault();
        seekBy(-10);
      } else if (e.code === "ArrowRight" || e.key === "l" || e.key === "L") {
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
      } else if (e.key === ">" || (e.shiftKey && e.key === ".")) {
        e.preventDefault();
        stepSpeed("up");
      } else if (e.key === "<" || (e.shiftKey && e.key === ",")) {
        e.preventDefault();
        stepSpeed("down");
      } else if (e.key === "c" || e.key === "C") {
        if (canShowChat && onChatToggle) {
          e.preventDefault();
          onChatToggle();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [togglePlay, seekBy, volume, onVolumeChange, toggleMute, toggleFullscreen, stepSpeed, canShowChat, onChatToggle]);

  const displayTime = seeking ? seekPreview : currentTime;
  const remainingTime = Math.max(0, duration - displayTime);

  const originParam = typeof window !== "undefined" ? encodeURIComponent(window.location.origin) : "";
  const embedSrc = `https://www.youtube.com/embed/${videoId}?autoplay=1&controls=0&disablekb=1&modestbranding=1&rel=0&iv_load_policy=3&playsinline=1&enablejsapi=1&fs=0${initialTime && initialTime > 0 ? `&start=${Math.floor(initialTime)}` : ""}${originParam ? `&origin=${originParam}` : ""}`;

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
      className={cn(
        "relative h-full w-full bg-black select-none overflow-hidden group",
        isPseudoFullscreen && "fixed inset-0 z-[9999] w-screen h-screen"
      )}
      onMouseMove={resetHideTimer}
    >
      {/* Real YouTube iframe with controls=0 permanently enforced (full uncropped frame) */}
      <iframe
        ref={iframeRef}
        src={embedSrc}
        title={title || "Video Lecture"}
        onLoad={handleIframeLoad}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
        className="pointer-events-none absolute inset-0 h-full w-full border-0"
      />

      {/* Transparent surface over the iframe to catch clicks & gestures */}
      <div className="yt-click-surface absolute inset-0 cursor-pointer" onClick={handleSurfaceClick} />

      {/* Double Tap / Click Ripple Feedback */}
      <AnimatePresence>
        {seekRipple === "left" && (
          <motion.div
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.15 }}
            transition={{ duration: 0.35 }}
            className="pointer-events-none absolute left-8 sm:left-14 top-1/2 -translate-y-1/2 z-25 flex flex-col items-center justify-center h-20 w-20 sm:h-24 sm:w-24 rounded-full bg-black/70 border border-white/20 backdrop-blur-md text-white font-bold text-xs shadow-2xl"
          >
            <RotateCcw className="h-6 w-6 sm:h-8 sm:w-8 mb-1 text-emerald-400" />
            <span className="text-[11px] font-mono font-bold">10s</span>
          </motion.div>
        )}
        {seekRipple === "right" && (
          <motion.div
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.15 }}
            transition={{ duration: 0.35 }}
            className="pointer-events-none absolute right-8 sm:right-14 top-1/2 -translate-y-1/2 z-25 flex flex-col items-center justify-center h-20 w-20 sm:h-24 sm:w-24 rounded-full bg-black/70 border border-white/20 backdrop-blur-md text-white font-bold text-xs shadow-2xl"
          >
            <RotateCw className="h-6 w-6 sm:h-8 sm:w-8 mb-1 text-emerald-400" />
            <span className="text-[11px] font-mono font-bold">10s</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Permanent top edge blackout: 100% blocks YouTube's title, avatar, Watch Later & Share icons */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-11 bg-black" />
      <div className="pointer-events-none absolute inset-x-0 top-11 z-10 h-6 bg-gradient-to-b from-black to-transparent" />



      {/* Action Feedback HUD */}
      <AnimatePresence>
        {hud && (
          <motion.div
            key={hud.id}
            initial={{ opacity: 0, scale: 0.85, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: -6 }}
            transition={{ duration: 0.15 }}
            className="pointer-events-none absolute top-14 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-black/85 border border-white/20 backdrop-blur-xl text-white text-xs font-semibold shadow-2xl tracking-wide"
          >
            {hud.icon}
            <span>{hud.text}</span>
          </motion.div>
        )}
      </AnimatePresence>

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
          {(isFullscreen || !hideTopTitleWhenNotFullscreen) && title && (
            <h2 className="truncate text-xs sm:text-sm font-bold text-white drop-shadow-md tracking-tight leading-tight">
              {title}
            </h2>
          )}
          {(isFullscreen || !hideTopTitleWhenNotFullscreen) && subtitle && (
            <p className="truncate text-[10px] sm:text-[11px] font-normal text-white/75 drop-shadow-sm leading-tight mt-0.5">
              {subtitle}
            </p>
          )}
        </div>

        <div className="shrink-0 flex items-center gap-2 pl-2">
          <LiveClock />
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              title="Close Player (Esc)"
              aria-label="Close Player"
              className="rounded-full p-1.5 hover:bg-white/20 text-white/80 hover:text-white transition active:scale-95"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Center Red Circular Play/Pause Button */}
      <AnimatePresence>
        {(!playing || controlsVisible) && (
          <motion.button
            key="center-play-btn"
            type="button"
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.85 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            onClick={(e) => {
              e.stopPropagation();
              togglePlay();
            }}
            aria-label={playing ? "Pause" : "Play"}
            className="absolute left-1/2 top-1/2 z-20 flex h-14 w-14 sm:h-16 sm:w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-gradient-to-tr from-red-600 to-rose-500 hover:from-red-500 hover:to-rose-400 text-white shadow-[0_8px_30px_rgba(225,29,72,0.45)] ring-4 ring-white/20 hover:ring-white/40 transition-all duration-200 hover:scale-110 active:scale-95 cursor-pointer backdrop-blur-xs"
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
          "absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black via-black/85 to-transparent px-3 pb-3 pt-12 sm:px-5 transition-opacity duration-300 backdrop-blur-[1px]",
          controlsVisible || !playing ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Floating Return to Live button if student scrubbed back in live class */}
        {isLive && !isAtLiveEdge && (
          <div className="flex justify-center mb-1.5">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleGoLive();
              }}
              className="flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-red-600 hover:bg-red-500 text-white text-xs font-bold shadow-lg animate-pulse ring-2 ring-white/30 transition active:scale-95 cursor-pointer"
            >
              <span className="h-2 w-2 rounded-full bg-white animate-ping" />
              <span>Go Live</span>
              <span className="text-[10px] font-normal opacity-85">(-{formatTime(lagSeconds)})</span>
            </button>
          </div>
        )}

        {/* Modern Scrubber / Seek Bar with hover timestamp tooltip */}
        <div
          ref={seekbarRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onMouseMove={handleSeekbarHover}
          onMouseLeave={handleSeekbarLeave}
          className="relative w-full py-2.5 cursor-pointer select-none group/seek touch-none"
        >
          {hoverTooltip.visible && duration > 0 && (
            <div
              className="pointer-events-none absolute -top-8 -translate-x-1/2 z-30 px-2 py-0.5 rounded-md bg-zinc-950/95 border border-white/20 text-[11px] font-mono font-medium text-white shadow-lg backdrop-blur-md whitespace-nowrap"
              style={{ left: `${Math.max(20, Math.min(hoverTooltip.x, (seekbarRef.current?.getBoundingClientRect().width || 100) - 20))}px` }}
            >
              {formatTime(hoverTooltip.time)}
            </div>
          )}
          <div className="relative h-1 group-hover/seek:h-1.5 w-full rounded-full bg-white/20 backdrop-blur-xs transition-all">
            <div
              className="absolute left-0 top-0 h-full rounded-full bg-gradient-to-r from-red-600 via-rose-500 to-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]"
              style={{ width: `${duration > 0 ? Math.min(100, Math.max(0, (displayTime / duration) * 100)) : 0}%` }}
            />
            <div
              className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 h-3.5 w-3.5 rounded-full bg-white shadow-md ring-2 ring-red-500/50 transition-transform group-hover/seek:scale-125"
              style={{ left: `${duration > 0 ? Math.min(100, Math.max(0, (displayTime / duration) * 100)) : 0}%` }}
            />
          </div>
        </div>

        <div className="mt-1.5 flex items-center justify-between gap-2 text-white">
          <div className="flex items-center gap-1 sm:gap-2">
            <button
              type="button"
              onClick={togglePlay}
              aria-label={playing ? "Pause" : "Play"}
              className="rounded-full p-2 hover:bg-white/15 text-white transition active:scale-95"
            >
              {playing ? <Pause className="h-4 w-4 fill-current" /> : <Play className="h-4 w-4 fill-current" />}
            </button>

            {/* Live Indicator / Go Live Button */}
            {isLive && (
              isAtLiveEdge ? (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-600 text-white text-[11px] font-bold shadow-xs select-none">
                  <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                  <span>LIVE</span>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleGoLive}
                  title="Jump to live edge"
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-600 hover:bg-red-500 text-white text-[11px] font-bold animate-pulse shadow-md transition active:scale-95 cursor-pointer ring-1 ring-white/40"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-white animate-ping" />
                  <span>🔴 Go Live</span>
                </button>
              )
            )}

            {/* Share / Link Icon */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (navigator.clipboard) {
                  navigator.clipboard.writeText(window.location.href);
                  toast.success("Class link copied to clipboard!");
                }
              }}
              title="Copy class link"
              aria-label="Copy class link"
              className="rounded-full p-2 hover:bg-white/15 text-white/90 hover:text-white transition active:scale-95"
            >
              <Link2 className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-1 group/vol">
              <button
                type="button"
                onClick={toggleMute}
                aria-label={muted ? "Unmute" : "Mute"}
                className="rounded-full p-2 hover:bg-white/15 text-white transition"
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
                className="hidden sm:block h-1 w-16 cursor-pointer appearance-none rounded-full bg-white/30 accent-red-500 transition-opacity"
              />
            </div>

            <button
              type="button"
              onClick={() => seekBy(-10)}
              title="Rewind 10 seconds"
              className="relative flex h-8 w-8 items-center justify-center rounded-full text-white/90 hover:text-white hover:bg-white/15 transition active:scale-95"
            >
              <RotateCcw className="h-4 w-4" />
              <span className="absolute text-[7px] font-extrabold leading-none select-none">10</span>
            </button>

            <button
              type="button"
              onClick={() => seekBy(10)}
              title="Forward 10 seconds"
              className="relative flex h-8 w-8 items-center justify-center rounded-full text-white/90 hover:text-white hover:bg-white/15 transition active:scale-95"
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
                  "flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold backdrop-blur-md transition active:scale-95 border",
                  chatOpen
                    ? "bg-red-600 text-white border-red-500 shadow-[0_0_12px_rgba(239,68,68,0.4)]"
                    : "bg-white/10 text-white/90 hover:bg-white/20 border-white/15"
                )}
              >
                <MessageCircle className="h-3.5 w-3.5" />
                <span className="text-[11px] font-bold">Chat</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setShowRemainingTime((v) => !v)}
              className="flex items-center px-2.5 py-1 rounded-full bg-black/40 border border-white/10 text-[11px] font-mono tabular-nums text-white/90 hover:text-white hover:bg-black/60 transition shadow-2xs"
            >
              {showRemainingTime ? (
                `-${formatTime(remainingTime)}`
              ) : (
                `${formatTime(displayTime)} / ${formatTime(duration)}`
              )}
            </button>

            {/* Quality Selector (Max 1080p) */}
            <div className="relative quality-menu-container">
              <button
                type="button"
                onClick={() => {
                  setShowQualityMenu((v) => !v);
                  setShowSpeedMenu(false);
                }}
                className={cn(
                  "rounded-full px-2 py-1 text-[11px] font-bold border transition tabular-nums shadow-2xs flex items-center gap-1",
                  showQualityMenu
                    ? "bg-red-600 text-white border-red-500"
                    : "bg-black/40 hover:bg-white/15 text-white/90 hover:text-white border-white/10 hover:border-white/20"
                )}
                title="Adjust Video Quality (Max 1080p)"
              >
                <Settings className="h-3 w-3" />
                <span>{quality.replace(" HD", "")}</span>
              </button>
              {showQualityMenu && (
                <div className="absolute bottom-10 right-0 z-30 flex flex-col rounded-xl bg-zinc-950/95 border border-white/15 py-1.5 shadow-2xl backdrop-blur-xl ring-1 ring-black/50 max-h-56 overflow-y-auto w-36 divide-y divide-white/5 scrollbar-thin">
                  <div className="px-3 py-1 text-[10px] font-bold text-white/50 uppercase tracking-wider">
                    Quality (Max 1080)
                  </div>
                  <div className="py-0.5">
                    {QUALITY_OPTIONS.map((opt) => (
                      <button
                        key={opt.label}
                        type="button"
                        onClick={() => setVideoQuality(opt)}
                        className={cn(
                          "w-full px-3.5 py-1.5 text-left text-xs font-medium flex items-center justify-between transition hover:bg-white/10",
                          opt.label === quality ? "bg-red-600/25 text-red-400 font-bold" : "text-white/80 hover:text-white"
                        )}
                      >
                        <span>{opt.label}</span>
                        {opt.label === quality && <Check className="h-3.5 w-3.5 text-red-400 shrink-0" />}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Speed Selector (Max 2.5x) */}
            <div className="relative speed-menu-container">
              <button
                type="button"
                onClick={() => {
                  setShowSpeedMenu((v) => !v);
                  setShowQualityMenu(false);
                }}
                className={cn(
                  "rounded-full px-2.5 py-1 text-[11px] font-bold border transition tabular-nums shadow-2xs",
                  showSpeedMenu
                    ? "bg-red-600 text-white border-red-500"
                    : "bg-black/40 hover:bg-white/15 text-white/90 hover:text-white border-white/10 hover:border-white/20"
                )}
                title="Playback Speed (Max 2.5x)"
              >
                {rate}x
              </button>
              {showSpeedMenu && (
                <div className="absolute bottom-10 right-0 z-30 flex flex-col rounded-xl bg-zinc-950/95 border border-white/15 py-1.5 shadow-2xl backdrop-blur-xl ring-1 ring-black/50 max-h-56 overflow-y-auto w-36 divide-y divide-white/5 scrollbar-thin">
                  <div className="px-3 py-1 text-[10px] font-bold text-white/50 uppercase tracking-wider">
                    Playback Speed
                  </div>
                  <div className="py-0.5">
                    {SPEED_OPTIONS.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setSpeed(s)}
                        className={cn(
                          "w-full px-3.5 py-1.5 text-left text-xs font-medium flex items-center justify-between transition hover:bg-white/10",
                          s === rate ? "bg-red-600/25 text-red-400 font-bold" : "text-white/80 hover:text-white"
                        )}
                      >
                        <span>{s === 1 ? "1x (Normal)" : `${s}x`}</span>
                        {s === rate && <Check className="h-3.5 w-3.5 text-red-400 shrink-0" />}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={toggleFullscreen}
              aria-label={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
              className="rounded-full p-2 hover:bg-white/15 text-white transition active:scale-95"
            >
              {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
            </button>
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
  fullscreenTargetRef,
  streamType,
  onError,
  onTimeProgress,
  initialTime = 0,
  hideTopTitleWhenNotFullscreen = false,
  onClose,
}: {
  src: string;
  poster?: string;
  title?: string;
  subtitle?: string;
  canShowChat: boolean;
  chatOpen: boolean;
  onChatToggle?: () => void;
  isLive?: boolean;
  fullscreenTargetRef?: RefObject<HTMLElement | null>;
  streamType?: "hls" | "mp4";
  onError?: (err: string) => void;
  onTimeProgress?: (time: number) => void;
  initialTime?: number;
  hideTopTitleWhenNotFullscreen?: boolean;
  onClose?: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const seekbarRef = useRef<HTMLDivElement>(null);
  const hideControlsTimer = useRef<number | null>(null);
  const seekingRef = useRef(false);
  const hlsRef = useRef<Hls | null>(null);
  const hasSeekedLiveRef = useRef(false);

  const targetFullscreenRef = (fullscreenTargetRef || wrapRef) as RefObject<HTMLElement | null>;
  const { isFullscreen, isPseudoFullscreen, toggleFullscreen } = useVideoFullscreen({
    containerRef: targetFullscreenRef,
    videoRef,
    lockOrientationOnMobile: true,
  });

  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(() => getStoredVolume());
  const [muted, setMuted] = useState(false);
  const [rate, setRate] = useState(() => getStoredSpeed());
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [quality, setQuality] = useState(() => getStoredQuality());
  const [showQualityMenu, setShowQualityMenu] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [seeking, setSeeking] = useState(false);
  const [seekPreview, setSeekPreview] = useState(0);
  const [showRemainingTime, setShowRemainingTime] = useState(true);

  // Live class auto-sync on load: seek to duration / live edge
  useEffect(() => {
    if (isLive && duration > 0 && !hasSeekedLiveRef.current) {
      hasSeekedLiveRef.current = true;
      const v = videoRef.current;
      if (v) {
        let target = duration;
        if (v.seekable && v.seekable.length > 0) {
          target = v.seekable.end(v.seekable.length - 1);
        }
        v.currentTime = target;
        setCurrentTime(target);
      }
    }
  }, [isLive, duration]);

  const lagSeconds = isLive && duration > 0 ? Math.max(0, duration - currentTime) : 0;
  const isAtLiveEdge = isLive ? lagSeconds <= 8 : true;

  const handleGoLive = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    let target = duration;
    if (v.seekable && v.seekable.length > 0) {
      target = v.seekable.end(v.seekable.length - 1);
    }
    v.currentTime = target;
    setCurrentTime(target);
    v.playbackRate = 1;
    setRate(1);
    v.play().catch(() => {});
    showHud("Live Edge", <span className="h-2 w-2 rounded-full bg-red-500 animate-ping" />);
  }, [duration, showHud]);

  // HUD Action Feedback
  const [hud, setHud] = useState<{ id: number; text: string; icon?: React.ReactNode } | null>(null);
  const hudTimerRef = useRef<number | null>(null);

  const showHud = useCallback((text: string, icon?: React.ReactNode) => {
    if (hudTimerRef.current) window.clearTimeout(hudTimerRef.current);
    setHud({ id: Date.now(), text, icon });
    hudTimerRef.current = window.setTimeout(() => {
      setHud(null);
    }, 1100);
  }, []);

  // Hover Tooltip on Seekbar
  const [hoverTooltip, setHoverTooltip] = useState<{ visible: boolean; x: number; time: number }>({
    visible: false,
    x: 0,
    time: 0,
  });

  // Double-tap / double-click gesture feedback
  const [seekRipple, setSeekRipple] = useState<"left" | "right" | null>(null);
  const clickTimerRef = useRef<number | null>(null);
  const lastClickTimeRef = useRef(0);

  // HLS stream engine setup
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;

    let hls: Hls | null = null;
    const isHls = streamType === "hls" || src.includes(".m3u8") || src.includes("/manifest/hls");

    if (isHls) {
      if (Hls.isSupported()) {
        hls = new Hls({
          enableWorker: true,
          lowLatencyMode: false,
          backBufferLength: 90,
        });
        hlsRef.current = hls;
        hls.loadSource(src);
        hls.attachMedia(video);

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          setReady(true);
          if (initialTime && initialTime > 0) {
            video.currentTime = initialTime;
          }
          if (videoRef.current && rate !== 1) {
            videoRef.current.playbackRate = rate;
          }
          video.play().catch(() => {});
        });

        hls.on(Hls.Events.ERROR, (_evt, data) => {
          if (data.fatal) {
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                hls?.startLoad();
                break;
              case Hls.ErrorTypes.MEDIA_ERROR:
                hls?.recoverMediaError();
                break;
              default:
                onError?.("Fatal HLS playback error");
                break;
            }
          }
        });
      } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
        video.src = src;
        if (initialTime && initialTime > 0) {
          video.currentTime = initialTime;
        }
      } else {
        onError?.("HLS not supported in this browser");
      }
    } else {
      video.src = src;
      if (initialTime && initialTime > 0) {
        video.currentTime = initialTime;
      }
    }

    return () => {
      if (hls) {
        hls.destroy();
        hlsRef.current = null;
      }
    };
  }, [src, streamType, initialTime, rate, onError]);

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

  const resetHideTimer = useCallback(() => {
    setControlsVisible(true);
    if (hideControlsTimer.current) window.clearTimeout(hideControlsTimer.current);
    hideControlsTimer.current = window.setTimeout(() => {
      setControlsVisible((v) => (playing ? false : v));
    }, 2800);
  }, [playing]);

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      v.play().catch(() => {});
      showHud("Playing", <Play className="h-3.5 w-3.5 text-red-500 fill-current" />);
    } else {
      v.pause();
      showHud("Paused", <Pause className="h-3.5 w-3.5 text-zinc-300 fill-current" />);
    }
    resetHideTimer();
  }, [resetHideTimer, showHud]);

  const seekTo = (t: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = Math.max(0, Math.min(duration || 0, t));
    setCurrentTime(v.currentTime);
  };

  const seekBy = useCallback((deltaSeconds: number) => {
    const v = videoRef.current;
    if (!v) return;
    seekTo(v.currentTime + deltaSeconds);
    resetHideTimer();
    showHud(
      deltaSeconds > 0 ? "+10s Forward" : "-10s Rewind",
      deltaSeconds > 0 ? <RotateCw className="h-3.5 w-3.5 text-emerald-400" /> : <RotateCcw className="h-3.5 w-3.5 text-emerald-400" />
    );
  }, [duration, resetHideTimer, showHud]);

  const toggleMute = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
    if (v.muted) {
      showHud("Muted", <VolumeX className="h-3.5 w-3.5 text-red-400" />);
    } else {
      showHud(`Volume: ${volume}%`, <Volume2 className="h-3.5 w-3.5 text-blue-400" />);
    }
    resetHideTimer();
  }, [volume, resetHideTimer, showHud]);

  const onVolumeChange = useCallback((vol: number) => {
    const v = videoRef.current;
    setVolume(vol);
    try {
      localStorage.setItem(STORAGE_KEY_VOLUME, String(vol));
    } catch {}
    if (!v) return;
    v.volume = vol / 100;
    if (vol === 0) {
      v.muted = true;
      setMuted(true);
      showHud("Muted", <VolumeX className="h-3.5 w-3.5 text-red-400" />);
    } else {
      if (muted) {
        v.muted = false;
        setMuted(false);
      }
      showHud(`Volume: ${vol}%`, <Volume2 className="h-3.5 w-3.5 text-blue-400" />);
    }
    resetHideTimer();
  }, [muted, resetHideTimer, showHud]);

  const setSpeed = useCallback((r: number) => {
    const v = videoRef.current;
    setRate(r);
    if (v) v.playbackRate = r;
    try {
      localStorage.setItem(STORAGE_KEY_SPEED, String(r));
    } catch {}
    setShowSpeedMenu(false);
    resetHideTimer();
    showHud(`${r}x Speed`, <Zap className="h-3.5 w-3.5 text-amber-400" />);
  }, [resetHideTimer, showHud]);

  const stepSpeed = useCallback((direction: "up" | "down") => {
    const currentIndex = SPEED_OPTIONS.findIndex((s) => s === rate);
    let nextIndex: number;
    if (direction === "up") {
      nextIndex = currentIndex < SPEED_OPTIONS.length - 1 ? currentIndex + 1 : currentIndex;
    } else {
      nextIndex = currentIndex > 0 ? currentIndex - 1 : 0;
    }
    const nextSpeed = SPEED_OPTIONS[nextIndex];
    if (nextSpeed !== rate) {
      setSpeed(nextSpeed);
    }
  }, [rate, setSpeed]);

  const setVideoQuality = useCallback((opt: typeof QUALITY_OPTIONS[number]) => {
    setQuality(opt.label);
    try {
      localStorage.setItem(STORAGE_KEY_QUALITY, opt.label);
    } catch {}
    if (hlsRef.current && hlsRef.current.levels && hlsRef.current.levels.length > 0) {
      if (opt.height === -1) {
        hlsRef.current.currentLevel = -1;
      } else {
        const idx = hlsRef.current.levels.findIndex((l) => l.height === opt.height);
        if (idx !== -1) {
          hlsRef.current.currentLevel = idx;
        }
      }
    }
    setShowQualityMenu(false);
    resetHideTimer();
    showHud(`Quality: ${opt.label}`, <Settings className="h-3.5 w-3.5 text-indigo-400" />);
  }, [resetHideTimer, showHud]);

  const handleSurfaceClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target.closest("button") || target.closest("input") || target.closest(".speed-menu-container") || target.closest(".quality-menu-container")) {
      return;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const pct = rect.width > 0 ? clickX / rect.width : 0.5;
    const now = Date.now();

    if (now - lastClickTimeRef.current < 280) {
      if (clickTimerRef.current) {
        window.clearTimeout(clickTimerRef.current);
        clickTimerRef.current = null;
      }
      lastClickTimeRef.current = 0;

      if (pct < 0.35) {
        seekBy(-10);
        setSeekRipple("left");
        setTimeout(() => setSeekRipple(null), 550);
      } else if (pct > 0.65) {
        seekBy(10);
        setSeekRipple("right");
        setTimeout(() => setSeekRipple(null), 550);
      } else {
        toggleFullscreen();
      }
      return;
    }

    lastClickTimeRef.current = now;
    if (clickTimerRef.current) window.clearTimeout(clickTimerRef.current);
    clickTimerRef.current = window.setTimeout(() => {
      togglePlay();
      clickTimerRef.current = null;
    }, 240);
  };

  const handleSeekbarHover = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!seekbarRef.current || duration <= 0) return;
    const rect = seekbarRef.current.getBoundingClientRect();
    if (rect.width <= 0) return;
    const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    const time = (x / rect.width) * duration;
    setHoverTooltip({ visible: true, x, time });
  };

  const handleSeekbarLeave = () => {
    setHoverTooltip((prev) => ({ ...prev, visible: false }));
  };

  // Click outside menus to auto-close
  useEffect(() => {
    if (!showSpeedMenu && !showQualityMenu) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest(".speed-menu-container")) setShowSpeedMenu(false);
      if (!target.closest(".quality-menu-container")) setShowQualityMenu(false);
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setShowSpeedMenu(false);
        setShowQualityMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEsc);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEsc);
    };
  }, [showSpeedMenu, showQualityMenu]);

  // Keyboard controls for CustomHtml5Player
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

      if (e.code === "Space" || e.key === "k" || e.key === "K") {
        e.preventDefault();
        togglePlay();
      } else if (e.code === "ArrowLeft" || e.key === "j" || e.key === "J") {
        e.preventDefault();
        seekBy(-10);
      } else if (e.code === "ArrowRight" || e.key === "l" || e.key === "L") {
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
      } else if (e.key === ">" || (e.shiftKey && e.key === ".")) {
        e.preventDefault();
        stepSpeed("up");
      } else if (e.key === "<" || (e.shiftKey && e.key === ",")) {
        e.preventDefault();
        stepSpeed("down");
      } else if (e.key === "c" || e.key === "C") {
        if (canShowChat && onChatToggle) {
          e.preventDefault();
          onChatToggle();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [togglePlay, seekBy, volume, onVolumeChange, toggleMute, toggleFullscreen, stepSpeed, canShowChat, onChatToggle]);

  const displayTime = seeking ? seekPreview : currentTime;
  const remainingTime = Math.max(0, duration - displayTime);

  return (
    <div
      ref={wrapRef}
      onContextMenu={(e) => e.preventDefault()}
      className={cn(
        "relative h-full w-full bg-black select-none overflow-hidden group",
        isPseudoFullscreen && "fixed inset-0 z-[9999] w-screen h-screen"
      )}
      onMouseMove={resetHideTimer}
      onClick={handleSurfaceClick}
    >
      <video
        ref={videoRef}
        poster={poster}
        playsInline
        autoPlay
        onLoadedMetadata={() => {
          setReady(true);
          if (videoRef.current) {
            setDuration(videoRef.current.duration);
            if (initialTime && initialTime > 0) {
              videoRef.current.currentTime = initialTime;
            }
          }
        }}
        onTimeUpdate={() => {
          if (!seeking && videoRef.current) {
            const t = videoRef.current.currentTime;
            setCurrentTime(t);
            onTimeProgress?.(t);
          }
        }}
        onError={() => onError?.("HTML5 video error")}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        className="h-full w-full object-contain bg-black"
      />

      {/* Gesture Ripple Animations (Double tap left/right) */}
      <AnimatePresence>
        {seekRipple === "left" && (
          <motion.div
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="pointer-events-none absolute left-12 top-1/2 -translate-y-1/2 z-30 flex flex-col items-center justify-center h-24 w-24 rounded-full bg-black/60 border border-white/20 text-white backdrop-blur-md"
          >
            <RotateCcw className="h-7 w-7" />
            <span className="text-xs font-bold mt-1">10s</span>
          </motion.div>
        )}
        {seekRipple === "right" && (
          <motion.div
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="pointer-events-none absolute right-12 top-1/2 -translate-y-1/2 z-30 flex flex-col items-center justify-center h-24 w-24 rounded-full bg-black/60 border border-white/20 text-white backdrop-blur-md"
          >
            <RotateCw className="h-7 w-7" />
            <span className="text-xs font-bold mt-1">10s</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Action Feedback HUD Toast */}
      <AnimatePresence>
        {hud && (
          <motion.div
            key={hud.id}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="pointer-events-none absolute top-14 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-black/85 border border-white/20 backdrop-blur-xl text-white text-xs font-semibold shadow-2xl tracking-wide"
          >
            {hud.icon}
            <span>{hud.text}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top Bar: Title/Subtitle + Live Clock */}
      <div
        className={cn(
          "absolute inset-x-0 top-0 z-20 flex items-start justify-between bg-gradient-to-b from-black/80 via-black/40 to-transparent p-3 sm:p-4 transition-opacity duration-300",
          controlsVisible || !playing ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
      >
        <div className="min-w-0 flex flex-col justify-center pr-3">
          {(isFullscreen || !hideTopTitleWhenNotFullscreen) && title && (
            <h2 className="truncate text-xs sm:text-sm font-bold text-white drop-shadow-md tracking-tight leading-tight">
              {title}
            </h2>
          )}
          {(isFullscreen || !hideTopTitleWhenNotFullscreen) && subtitle && (
            <p className="truncate text-[10px] sm:text-[11px] font-normal text-white/75 drop-shadow-sm leading-tight mt-0.5">
              {subtitle}
            </p>
          )}
        </div>

        <div className="shrink-0 flex items-center gap-2 pl-2">
          <LiveClock />
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              title="Close Player (Esc)"
              aria-label="Close Player"
              className="rounded-full p-1.5 hover:bg-white/20 text-white/80 hover:text-white transition active:scale-95"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Center Red Circular Play/Pause Button */}
      <AnimatePresence>
        {(!playing || controlsVisible) && (
          <motion.button
            key="center-play-btn"
            type="button"
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.85 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            onClick={(e) => {
              e.stopPropagation();
              togglePlay();
            }}
            aria-label={playing ? "Pause" : "Play"}
            className="absolute left-1/2 top-1/2 z-20 flex h-14 w-14 sm:h-16 sm:w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-gradient-to-tr from-red-600 to-rose-500 hover:from-red-500 hover:to-rose-400 text-white shadow-[0_8px_30px_rgba(225,29,72,0.45)] ring-4 ring-white/20 hover:ring-white/40 transition-all duration-200 hover:scale-110 active:scale-95 cursor-pointer backdrop-blur-xs"
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
          "absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black via-black/85 to-transparent px-3 pb-3 pt-12 sm:px-5 transition-opacity duration-300 backdrop-blur-[1px]",
          controlsVisible || !playing ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Floating Return to Live button if student scrubbed back in live class */}
        {isLive && !isAtLiveEdge && (
          <div className="flex justify-center mb-1.5">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleGoLive();
              }}
              className="flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-red-600 hover:bg-red-500 text-white text-xs font-bold shadow-lg animate-pulse ring-2 ring-white/30 transition active:scale-95 cursor-pointer"
            >
              <span className="h-2 w-2 rounded-full bg-white animate-ping" />
              <span>Go Live</span>
              <span className="text-[10px] font-normal opacity-85">(-{formatTime(lagSeconds)})</span>
            </button>
          </div>
        )}

        {/* Modern Scrubber / Seek Bar */}
        <div
          ref={seekbarRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onMouseMove={handleSeekbarHover}
          onMouseLeave={handleSeekbarLeave}
          className="relative w-full py-2.5 cursor-pointer select-none group/seek touch-none"
        >
          {/* Hover Time Tooltip */}
          {hoverTooltip.visible && (
            <div
              className="pointer-events-none absolute -top-8 -translate-x-1/2 rounded-md bg-black/90 border border-white/20 px-2 py-0.5 text-[10px] font-mono font-bold text-white shadow-lg backdrop-blur-xs"
              style={{ left: `${hoverTooltip.x}px` }}
            >
              {formatTime(hoverTooltip.time)}
            </div>
          )}
          <div className="relative h-1 group-hover/seek:h-1.5 w-full rounded-full bg-white/20 backdrop-blur-xs transition-all">
            <div
              className="absolute left-0 top-0 h-full rounded-full bg-gradient-to-r from-red-600 via-rose-500 to-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]"
              style={{ width: `${duration > 0 ? Math.min(100, Math.max(0, (displayTime / duration) * 100)) : 0}%` }}
            />
            <div
              className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 h-3.5 w-3.5 rounded-full bg-white shadow-md ring-2 ring-red-500/50 transition-transform group-hover/seek:scale-125"
              style={{ left: `${duration > 0 ? Math.min(100, Math.max(0, (displayTime / duration) * 100)) : 0}%` }}
            />
          </div>
        </div>

        <div className="mt-1.5 flex items-center justify-between gap-2 text-white">
          <div className="flex items-center gap-1 sm:gap-2">
            <button
              type="button"
              onClick={togglePlay}
              className="rounded-full p-2 hover:bg-white/15 text-white transition active:scale-95"
            >
              {playing ? <Pause className="h-4 w-4 fill-current" /> : <Play className="h-4 w-4 fill-current" />}
            </button>

            {/* Live Indicator / Go Live Button */}
            {isLive && (
              isAtLiveEdge ? (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-600 text-white text-[11px] font-bold shadow-xs select-none">
                  <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                  <span>LIVE</span>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleGoLive}
                  title="Jump to live edge"
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-600 hover:bg-red-500 text-white text-[11px] font-bold animate-pulse shadow-md transition active:scale-95 cursor-pointer ring-1 ring-white/40"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-white animate-ping" />
                  <span>🔴 Go Live</span>
                </button>
              )
            )}

            {/* Share / Link Icon */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (navigator.clipboard) {
                  navigator.clipboard.writeText(window.location.href);
                  toast.success("Class link copied to clipboard!");
                }
              }}
              title="Copy class link"
              aria-label="Copy class link"
              className="rounded-full p-2 hover:bg-white/15 text-white/90 hover:text-white transition active:scale-95"
            >
              <Link2 className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-1 group/vol">
              <button
                type="button"
                onClick={toggleMute}
                className="rounded-full p-2 hover:bg-white/15 text-white transition"
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
                className="hidden sm:block h-1 w-16 cursor-pointer appearance-none rounded-full bg-white/30 accent-red-500 transition-opacity"
              />
            </div>

            <button
              type="button"
              onClick={() => seekBy(-10)}
              title="Rewind 10 seconds"
              className="relative flex h-8 w-8 items-center justify-center rounded-full text-white/90 hover:text-white hover:bg-white/15 transition active:scale-95"
            >
              <RotateCcw className="h-4 w-4" />
              <span className="absolute text-[7px] font-extrabold leading-none select-none">10</span>
            </button>

            <button
              type="button"
              onClick={() => seekBy(10)}
              title="Forward 10 seconds"
              className="relative flex h-8 w-8 items-center justify-center rounded-full text-white/90 hover:text-white hover:bg-white/15 transition active:scale-95"
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
                  "flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold backdrop-blur-md transition active:scale-95 border",
                  chatOpen
                    ? "bg-red-600 text-white border-red-500 shadow-[0_0_12px_rgba(239,68,68,0.4)]"
                    : "bg-white/10 text-white/90 hover:bg-white/20 border-white/15"
                )}
              >
                <MessageCircle className="h-3.5 w-3.5" />
                <span className="text-[11px] font-bold">Chat</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setShowRemainingTime((v) => !v)}
              className="flex items-center px-2.5 py-1 rounded-full bg-black/40 border border-white/10 text-[11px] font-mono tabular-nums text-white/90 hover:text-white hover:bg-black/60 transition shadow-2xs"
            >
              {showRemainingTime ? (
                `-${formatTime(remainingTime)}`
              ) : (
                `${formatTime(displayTime)} / ${formatTime(duration)}`
              )}
            </button>

            {/* Quality Selector (Max 1080p) */}
            <div className="relative quality-menu-container">
              <button
                type="button"
                onClick={() => {
                  setShowQualityMenu((v) => !v);
                  setShowSpeedMenu(false);
                }}
                className={cn(
                  "rounded-full px-2.5 py-1 text-[11px] font-bold border transition tabular-nums shadow-2xs flex items-center gap-1",
                  showQualityMenu
                    ? "bg-red-600 text-white border-red-500"
                    : "bg-black/40 hover:bg-white/15 text-white/90 hover:text-white border-white/10 hover:border-white/20"
                )}
                title="Video Quality (Max 1080p)"
              >
                <Settings className="h-3 w-3" />
                <span>{quality}</span>
              </button>
              {showQualityMenu && (
                <div className="absolute bottom-10 right-0 z-30 flex flex-col rounded-xl bg-zinc-950/95 border border-white/15 py-1.5 shadow-2xl backdrop-blur-xl ring-1 ring-black/50 max-h-56 overflow-y-auto w-36 divide-y divide-white/5 scrollbar-thin">
                  <div className="px-3 py-1 text-[10px] font-bold text-white/50 uppercase tracking-wider">
                    Max Quality
                  </div>
                  <div className="py-0.5">
                    {QUALITY_OPTIONS.map((opt) => (
                      <button
                        key={opt.label}
                        type="button"
                        onClick={() => setVideoQuality(opt)}
                        className={cn(
                          "w-full px-3.5 py-1.5 text-left text-xs font-medium flex items-center justify-between transition hover:bg-white/10",
                          opt.label === quality ? "bg-red-600/25 text-red-400 font-bold" : "text-white/80 hover:text-white"
                        )}
                      >
                        <span>{opt.label}</span>
                        {opt.label === quality && <Check className="h-3.5 w-3.5 text-red-400 shrink-0" />}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Speed Selector (Max 2.5x) */}
            <div className="relative speed-menu-container">
              <button
                type="button"
                onClick={() => {
                  setShowSpeedMenu((v) => !v);
                  setShowQualityMenu(false);
                }}
                className={cn(
                  "rounded-full px-2.5 py-1 text-[11px] font-bold border transition tabular-nums shadow-2xs",
                  showSpeedMenu
                    ? "bg-red-600 text-white border-red-500"
                    : "bg-black/40 hover:bg-white/15 text-white/90 hover:text-white border-white/10 hover:border-white/20"
                )}
                title="Playback Speed (Max 2.5x)"
              >
                {rate}x
              </button>
              {showSpeedMenu && (
                <div className="absolute bottom-10 right-0 z-30 flex flex-col rounded-xl bg-zinc-950/95 border border-white/15 py-1.5 shadow-2xl backdrop-blur-xl ring-1 ring-black/50 max-h-56 overflow-y-auto w-36 divide-y divide-white/5 scrollbar-thin">
                  <div className="px-3 py-1 text-[10px] font-bold text-white/50 uppercase tracking-wider">
                    Playback Speed
                  </div>
                  <div className="py-0.5">
                    {SPEED_OPTIONS.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setSpeed(s)}
                        className={cn(
                          "w-full px-3.5 py-1.5 text-left text-xs font-medium flex items-center justify-between transition hover:bg-white/10",
                          s === rate ? "bg-red-600/25 text-red-400 font-bold" : "text-white/80 hover:text-white"
                        )}
                      >
                        <span>{s === 1 ? "1x (Normal)" : `${s}x`}</span>
                        {s === rate && <Check className="h-3.5 w-3.5 text-red-400 shrink-0" />}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={toggleFullscreen}
              aria-label={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
              className="rounded-full p-2 hover:bg-white/15 text-white transition active:scale-95"
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
  hideTopTitleWhenNotFullscreen?: boolean;
  onClose?: () => void;
};

export function VideoPlayer({
  src,
  poster,
  title,
  subtitle,
  className,
  fullscreenTargetRef,
  chatComponent,
  isLive = false,
  chatVisible: externalChatVisible,
  onChatToggle: externalOnChatToggle,
  hideTopTitleWhenNotFullscreen = false,
  onClose,
}: Props) {
  const outerWrapRef = useRef<HTMLDivElement>(null);
  const [internalChatVisible, setInternalChatVisible] = useState(true);
  const chatVisible = externalChatVisible !== undefined ? externalChatVisible : internalChatVisible;
  const handleChatToggle = externalOnChatToggle ?? (() => setInternalChatVisible((v) => !v));

  const canShowChat = Boolean(chatComponent || externalOnChatToggle);

  const embedInfo = getEmbedableSource(src);

  // Direct Stream Extraction state (0.00% YouTube UI via native HTML5 video / HLS)
  const [resolvedStream, setResolvedStream] = useState<ResolvedStream | null>(null);
  const [streamResolveStatus, setStreamResolveStatus] = useState<"idle" | "resolving" | "resolved" | "fallback">("idle");
  const [fallbackTime, setFallbackTime] = useState<number>(0);

  useEffect(() => {
    if (embedInfo?.type !== "youtube" || !embedInfo.videoId) {
      setStreamResolveStatus("idle");
      setResolvedStream(null);
      return;
    }

    let isCancelled = false;
    setStreamResolveStatus("resolving");

    resolveVideoStream(embedInfo.videoId, 2800)
      .then((stream) => {
        if (isCancelled) return;
        setResolvedStream(stream);
        setStreamResolveStatus("resolved");
      })
      .catch((err) => {
        if (isCancelled) return;
        console.warn("[VideoPlayer] Direct stream resolution fallback to YouTube player:", err?.message || err);
        setStreamResolveStatus("fallback");
      });

    return () => {
      isCancelled = true;
    };
  }, [embedInfo?.videoId]);

  if (!src?.trim()) {
    return <VideoUnavailable message="No video link has been added for this class yet." className={className} />;
  }

  if (!embedInfo) {
    return <VideoUnavailable message="Invalid video URL format." className={className} />;
  }

  const effectiveFullscreenRef = (fullscreenTargetRef || outerWrapRef) as RefObject<HTMLElement | null>;

  return (
    <motion.div
      ref={outerWrapRef}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className={cn(
        "group relative flex flex-row bg-black overflow-hidden transition-all duration-300 w-full h-full rounded-2xl border border-zinc-800 shadow-xl",
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
          streamResolveStatus === "resolved" && resolvedStream ? (
            <CustomHtml5Player
              key={`stream-${resolvedStream.streamUrl}`}
              src={resolvedStream.streamUrl}
              streamType={resolvedStream.type}
              poster={poster}
              title={title || resolvedStream.title}
              subtitle={subtitle}
              canShowChat={canShowChat}
              chatOpen={chatVisible}
              onChatToggle={handleChatToggle}
              isLive={isLive}
              initialTime={fallbackTime}
              onTimeProgress={(t) => setFallbackTime(t)}
              onError={(err) => {
                console.warn("[VideoPlayer] Direct stream playback failed mid-stream, falling back to YouTube:", err);
                setStreamResolveStatus("fallback");
              }}
              fullscreenTargetRef={effectiveFullscreenRef}
              hideTopTitleWhenNotFullscreen={hideTopTitleWhenNotFullscreen}
              onClose={onClose}
            />
          ) : streamResolveStatus === "resolving" ? (
            <div className="relative flex h-full w-full flex-col items-center justify-center bg-black p-6 text-center text-white select-none">
              <div className="h-10 w-10 animate-spin rounded-full border-2 border-red-500 border-t-transparent mb-3" />
              <p className="text-xs font-semibold text-white/90">Starting clean video stream…</p>
            </div>
          ) : (
            <CustomYouTubePlayer
              key={embedInfo.videoId}
              videoId={embedInfo.videoId}
              title={title}
              subtitle={subtitle}
              canShowChat={canShowChat}
              chatOpen={chatVisible}
              onChatToggle={handleChatToggle}
              isLive={isLive}
              initialTime={fallbackTime}
              onTimeProgress={(t) => setFallbackTime(t)}
              fullscreenTargetRef={effectiveFullscreenRef}
              hideTopTitleWhenNotFullscreen={hideTopTitleWhenNotFullscreen}
              onClose={onClose}
            />
          )
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
            fullscreenTargetRef={effectiveFullscreenRef}
            hideTopTitleWhenNotFullscreen={hideTopTitleWhenNotFullscreen}
            onClose={onClose}
          />
        )}
      </div>

      {chatComponent && chatVisible && canShowChat && (
        <div className="w-[320px] sm:w-[360px] md:w-[400px] shrink-0 border-l border-white/10 h-full flex flex-col bg-[#0f0f0f] animate-in slide-in-from-right duration-200 z-30 shadow-2xl">
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

