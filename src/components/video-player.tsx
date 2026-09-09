import { useState, useRef, useEffect, useCallback, type RefObject } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ReactPlayer from "react-player";
import {
  AlertTriangle,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  MessageCircle,
  Gauge,
} from "lucide-react";
import { cn, getStorageUrl } from "@/lib/utils";

export function extractYouTubeId(url: string): string | null {
  if (!url) return null;
  let target = url.trim();
  const iframeMatch = target.match(/src=["']([^"']+)["']/i);
  if (iframeMatch && iframeMatch[1]) {
    target = iframeMatch[1];
  }
  const regExp = /^.*(?:youtu\.be\/|v\/|u\/\w\/|embed\/|live\/|shorts\/|watch\?v=|&v=)([^#&?]*).*/i;
  const match = target.match(regExp);
  if (match && match[1] && match[1].length === 11) {
    return match[1];
  }
  return null;
}

export function getEmbedableSource(url: string): { type: "youtube" | "drive" | "video"; embedUrl: string; rawUrl: string; videoId?: string } | null {
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
      tag.onerror = () => { clearTimeout(timeout); reject(new Error("YouTube API script failed")); };
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
 * Our own player chrome (play/pause, seek bar, volume, speed, fullscreen,
 * chat toggle) driven by the real YouTube IFrame Player API underneath —
 * the video itself still streams straight from YouTube, but YouTube's own
 * default UI (big logo button, suggested-videos panel, channel watermark,
 * etc.) is turned off via `controls:0`. YouTube's branding rules mean a
 * small "YouTube" mark stays visible in the corner — that part can't be
 * removed — everything else is ours.
 */
function CustomYouTubePlayer({
  videoId,
  title,
  onError,
  canShowChat,
  chatOpen,
  onChatToggle,
}: {
  videoId: string;
  title?: string;
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

  useEffect(() => {
    let cancelled = false;
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
            ...(typeof window !== "undefined" ? { origin: window.location.origin } : {}),
          },
          events: {
            onReady: (e: any) => {
              if (cancelled) return;
              setReady(true);
              setDuration(e.target.getDuration?.() || 0);
              e.target.playVideo?.();
            },
            onStateChange: (e: any) => {
              if (cancelled) return;
              // 1 = playing, 2 = paused, 0 = ended
              setPlaying(e.data === 1);
              if (e.data === 1) setDuration(e.target.getDuration?.() || 0);
            },
            onError: () => {
              if (cancelled) return;
              onError();
            },
          },
        });
      })
      .catch(() => {
        if (!cancelled) onError();
      });
    return () => {
      cancelled = true;
      try { playerRef.current?.destroy?.(); } catch { /* noop */ }
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
        if (d) setDuration(d);
      } catch { /* player not ready yet */ }
    }, 400);
    return () => { if (pollRef.current) window.clearInterval(pollRef.current); };
  }, [ready, seeking]);

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
    return () => { if (hideControlsTimer.current) window.clearTimeout(hideControlsTimer.current); };
  }, [resetHideTimer]);

  const togglePlay = () => {
    const p = playerRef.current;
    if (!p) return;
    if (playing) p.pauseVideo?.(); else p.playVideo?.();
    resetHideTimer();
  };

  const toggleMute = () => {
    const p = playerRef.current;
    if (!p) return;
    if (muted) { p.unMute?.(); setMuted(false); } else { p.mute?.(); setMuted(true); }
  };

  const onVolumeChange = (v: number) => {
    setVolume(v);
    const p = playerRef.current;
    if (!p) return;
    p.setVolume?.(v);
    if (v === 0) { p.mute?.(); setMuted(true); } else if (muted) { p.unMute?.(); setMuted(false); }
  };

  const setSpeed = (r: number) => {
    setRate(r);
    playerRef.current?.setPlaybackRate?.(r);
    setShowSpeedMenu(false);
  };

  const toggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen?.();
    else wrapRef.current?.requestFullscreen?.();
  };

  const seekTo = (t: number) => {
    playerRef.current?.seekTo?.(t, true);
    setCurrentTime(t);
  };

  const displayTime = seeking ? seekPreview : currentTime;

  return (
    <div
      ref={wrapRef}
      className="relative h-full w-full bg-black select-none"
      onMouseMove={resetHideTimer}
      onClick={(e) => { if (e.target === wrapRef.current || (e.target as HTMLElement).closest(".yt-click-surface")) togglePlay(); }}
    >
      <div ref={mountRef} className="pointer-events-none absolute inset-0 h-full w-full" />
      {/* Transparent surface over the iframe so our own click-to-toggle-play works
          (the underlying YT iframe would otherwise swallow the click) */}
      <div className="yt-click-surface absolute inset-0 cursor-pointer" onClick={togglePlay} />

      {/* Top bar: title + chat toggle */}
      <div
        className={cn(
          "absolute inset-x-0 top-0 z-10 flex items-start justify-between bg-gradient-to-b from-black/70 to-transparent p-3 sm:p-4 transition-opacity duration-300",
          controlsVisible ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
      >
        <div className="min-w-0 pr-3">
          {title && <p className="truncate text-sm font-semibold text-white drop-shadow-sm">{title}</p>}
        </div>
        {canShowChat && (
          <button
            onClick={(e) => { e.stopPropagation(); onChatToggle?.(); }}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium backdrop-blur transition",
              chatOpen ? "bg-white text-black" : "bg-black/60 text-white hover:bg-black/80"
            )}
          >
            <MessageCircle className="h-3.5 w-3.5" /> Chat
          </button>
        )}
      </div>

      {/* Center play/pause button — shown paused, or briefly on tap */}
      <AnimatePresence>
        {(!playing || controlsVisible) && ready && (
          <motion.button
            key="center-btn"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.15 }}
            onClick={(e) => { e.stopPropagation(); togglePlay(); }}
            className="absolute left-1/2 top-1/2 z-10 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-black shadow-lg transition hover:scale-105 hover:bg-white"
          >
            {playing ? <Pause className="h-6 w-6 fill-current" /> : <Play className="h-6 w-6 fill-current pl-0.5" />}
          </motion.button>
        )}
      </AnimatePresence>

      {!ready && (
        <div className="absolute inset-0 z-10 flex items-center justify-center">
          <div className="h-9 w-9 animate-spin rounded-full border-2 border-white/30 border-t-white" />
        </div>
      )}

      {/* Bottom control bar */}
      <div
        className={cn(
          "absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/85 to-transparent px-3 pb-2 pt-6 sm:px-4 transition-opacity duration-300",
          controlsVisible ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Seek bar */}
        <input
          type="range"
          min={0}
          max={duration || 0}
          step={0.1}
          value={displayTime}
          onChange={(e) => { setSeeking(true); setSeekPreview(Number(e.target.value)); }}
          onMouseUp={(e) => { seekTo(Number((e.target as HTMLInputElement).value)); setSeeking(false); }}
          onTouchEnd={(e) => { seekTo(Number((e.target as HTMLInputElement).value)); setSeeking(false); }}
          className="yt-seek h-1 w-full cursor-pointer appearance-none rounded-full bg-white/25 accent-red-600"
          style={{
            background: duration
              ? `linear-gradient(to right, #ef4444 ${(displayTime / duration) * 100}%, rgba(255,255,255,0.25) ${(displayTime / duration) * 100}%)`
              : undefined,
          }}
        />

        <div className="mt-2 flex items-center justify-between gap-2 text-white">
          <div className="flex items-center gap-2 sm:gap-3">
            <button onClick={togglePlay} className="rounded-full p-1.5 hover:bg-white/10 transition">
              {playing ? <Pause className="h-4 w-4 fill-current" /> : <Play className="h-4 w-4 fill-current" />}
            </button>

            <div className="hidden items-center gap-1.5 sm:flex">
              <button onClick={toggleMute} className="rounded-full p-1.5 hover:bg-white/10 transition">
                {muted || volume === 0 ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              </button>
              <input
                type="range"
                min={0}
                max={100}
                value={muted ? 0 : volume}
                onChange={(e) => onVolumeChange(Number(e.target.value))}
                className="h-1 w-16 cursor-pointer appearance-none rounded-full bg-white/25 accent-white"
              />
            </div>

            <span className="text-[11px] font-medium tabular-nums text-white/90">
              {formatTime(displayTime)} / {formatTime(duration)}
            </span>
          </div>

          <div className="flex items-center gap-1 sm:gap-2">
            <div className="relative">
              <button
                onClick={() => setShowSpeedMenu((v) => !v)}
                className="flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold hover:bg-white/10 transition"
              >
                <Gauge className="h-3.5 w-3.5" /> {rate}x
              </button>
              {showSpeedMenu && (
                <div className="absolute bottom-9 right-0 z-20 flex flex-col rounded-lg bg-black/90 py-1 shadow-lg">
                  {SPEED_OPTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => setSpeed(s)}
                      className={cn(
                        "px-4 py-1.5 text-left text-xs whitespace-nowrap hover:bg-white/10 transition",
                        s === rate ? "text-red-500 font-bold" : "text-white"
                      )}
                    >
                      {s}x
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button onClick={toggleFullscreen} className="rounded-full p-1.5 hover:bg-white/10 transition">
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

  // Direct video files go through ReactPlayer (cookpete/react-player), with a
  // plain <video> tag as a safety-net fallback if it ever errors.
  //
  // YouTube uses our own custom-skinned player (CustomYouTubePlayer, built on
  // the real YouTube IFrame Player API) so the controls look like our site,
  // not YouTube's stock UI. If the IFrame API ever fails to load or the
  // player itself errors, we drop straight to a plain YouTube iframe embed
  // as a guaranteed-play fallback — the class always plays, worst case with
  // YouTube's own default controls instead of ours.
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
      // One-time fade-in on mount — a single cheap opacity transition, not a
      // continuous loop, so it adds a premium feel without costing anything
      // once it's finished.
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className={cn(
        "group relative flex bg-black overflow-hidden transition-all duration-300 w-full h-full rounded-2xl border border-slate-800 shadow-xl",
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
          <ReactPlayer
            key={embedInfo.embedUrl}
            src={embedInfo.embedUrl}
            playing
            controls
            playsInline
            width="100%"
            height="100%"
            style={{ backgroundColor: "black" }}
            onError={() => setPlaybackFailed(true)}
          />
        )}
      </div>

      {chatComponent && chatVisible && canShowChat && (
        <div className="w-[300px] sm:w-[350px] lg:w-[380px] shrink-0 border-l border-slate-200 h-full flex flex-col bg-white animate-in slide-in-from-right duration-200">
          {chatComponent}
        </div>
      )}
    </motion.div>
  );
}

function VideoUnavailable({ message, className }: { message: string; className?: string }) {
  return (
    <div className={cn("flex aspect-video flex-col items-center justify-center gap-3 rounded-2xl bg-slate-900 p-6 text-center text-sm text-slate-300 border border-slate-800", className)}>
      <AlertTriangle className="h-8 w-8 text-amber-400" />
      <p>{message}</p>
    </div>
  );
}
