import { useEffect, useRef, useState, type RefObject } from "react";
import ReactPlayer from "react-player";
import {
  Play, Pause, Volume2, VolumeX, Maximize, Gauge, RotateCcw, RotateCw, Settings, MessageCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2] as const;
const YT_QUALITY_LABEL: Record<string, string> = {
  auto: "Auto", tiny: "144p", small: "240p", medium: "360p", large: "480p",
  hd720: "720p", hd1080: "1080p", hd1440: "1440p", hd2160: "2160p", highres: "Max",
};

export function useIsFullscreen(ref: RefObject<HTMLElement | null>) {
  const [isFs, setIsFs] = useState(false);
  useEffect(() => {
    if (typeof document === "undefined") return;
    const el = ref.current; if (!el) return;
    const check = () => setIsFs(document.fullscreenElement === el);
    document.addEventListener("fullscreenchange", check);
    return () => document.removeEventListener("fullscreenchange", check);
  }, [ref]);
  return isFs;
}

export function useControlsReveal(playing: boolean) {
  const [visible, setVisible] = useState(true);
  const timerRef = useRef<any>(null);

  function show() {
    setVisible(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    if (playing) {
      timerRef.current = setTimeout(() => setVisible(false), 2500);
    }
  }

  useEffect(() => {
    if (!playing) {
      setVisible(true);
      if (timerRef.current) clearTimeout(timerRef.current);
    } else {
      show();
    }
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [playing]);

  return { visible, show };
}

function fmt(t: number) {
  if (!isFinite(t)) return "0:00";
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
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
  fullscreenTargetRef,
  chatComponent,
  isLive = false,
  chatVisible: externalChatVisible,
  onChatToggle: externalOnChatToggle,
}: Props) {
  const outerWrapRef = useRef<HTMLDivElement>(null);
  const actualFsRef = fullscreenTargetRef ?? outerWrapRef;
  const isFs = useIsFullscreen(actualFsRef);
  
  const [internalChatVisible, setInternalChatVisible] = useState(true);
  const chatVisible = externalChatVisible !== undefined ? externalChatVisible : internalChatVisible;
  const onChatToggle = externalOnChatToggle ?? (() => setInternalChatVisible(!internalChatVisible));
  
  // Show chat button ONLY if it's a live class (not recorded)
  const canShowChat = Boolean(isLive && (chatComponent || externalOnChatToggle));

  if (!src?.trim()) return <VideoUnavailable message="No video link has been added for this class yet." className={className} />;

  return (
    <div
      ref={outerWrapRef}
      className={cn(
        "group relative flex bg-black shadow-elegant overflow-hidden transition-all duration-300",
        isFs
          ? "!aspect-auto h-full w-full !rounded-none"
          : cn("rounded-3xl", !className?.includes("h-full") && "aspect-video"),
        className,
      )}
    >
      <div className="flex-1 relative min-w-0 h-full flex items-center justify-center bg-black overflow-hidden">
        <UnifiedPlayer 
          src={src} 
          poster={poster} 
          title={title} 
          fsElRef={actualFsRef}
          showChatButton={canShowChat}
          chatVisible={chatVisible}
          onChatToggle={onChatToggle}
          isLive={isLive}
        />
      </div>
      
      {/* Inline docked chat if chatComponent is provided and chat is visible */}
      {chatComponent && chatVisible && canShowChat && (
        <div className="w-[300px] sm:w-[350px] lg:w-[380px] shrink-0 border-l border-white/10 h-full flex flex-col bg-[#0f0f0f] animate-in slide-in-from-right duration-200">
          {chatComponent}
        </div>
      )}
    </div>
  );
}

function UnifiedPlayer({
  src,
  poster,
  title,
  fsElRef,
  showChatButton,
  chatVisible,
  onChatToggle,
  isLive,
}: any) {
  const playerRef = useRef<ReactPlayer>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [showSpeed, setShowSpeed] = useState(false);
  const [started, setStarted] = useState(false);
  const [qualities, setQualities] = useState<string[]>([]);
  const [quality, setQuality] = useState<string>("auto");

  const { visible: controlsVisible, show: revealControls } = useControlsReveal(playing);

  // Poll for qualities if it's YouTube
  useEffect(() => {
    if (!started) return;
    const t = setInterval(() => {
      try {
        const p = playerRef.current?.getInternalPlayer();
        if (p?.getAvailableQualityLevels) {
          const lv = p.getAvailableQualityLevels();
          if (lv && lv.length > 0 && qualities.length === 0) {
            setQualities(["auto", ...lv]);
          }
          if (p.getPlaybackQuality) {
            setQuality(p.getPlaybackQuality() ?? "auto");
          }
        }
      } catch {}
    }, 2000);
    return () => clearInterval(t);
  }, [started, qualities]);

  function toggle() { setPlaying(!playing); }
  function seek(delta: number) {
    const cur = time;
    const next = Math.min(Math.max(0, cur + delta), duration);
    playerRef.current?.seekTo(next, "seconds");
    setTime(next);
  }
  function scrubTo(t: number) {
    playerRef.current?.seekTo(t, "seconds");
    setTime(t);
  }
  function toggleMute() { setMuted(!muted); }
  function fullscreen() {
    const el = fsElRef.current; if (!el) return;
    if (document.fullscreenElement) document.exitFullscreen();
    else el.requestFullscreen?.();
  }
  function pickQuality(q: string) {
    try {
      const p = playerRef.current?.getInternalPlayer();
      if (p?.setPlaybackQuality) {
        p.setPlaybackQuality(q === "auto" ? "default" : q);
        setQuality(q);
      }
    } catch {}
  }

  function handleVideoTap() {
    if (!controlsVisible) { revealControls(); return; }
    revealControls();
    toggle();
  }

  return (
    <div ref={wrapRef} className="absolute inset-0 h-full w-full">
      <div className="pointer-events-none absolute inset-0 h-full w-full [&>div]:!h-full [&>div]:!w-full [&>div>iframe]:!h-full [&>div>iframe]:!w-full [&>div>video]:!h-full [&>div>video]:!w-full">
        <ReactPlayer
          ref={playerRef}
          url={src}
          playing={playing}
          muted={muted}
          playbackRate={speed}
          width="100%"
          height="100%"
          controls={false}
          playsinline
          onPlay={() => { setPlaying(true); setStarted(true); }}
          onPause={() => setPlaying(false)}
          onEnded={() => setPlaying(false)}
          onProgress={(s) => setTime(s.playedSeconds)}
          onDuration={(d) => setDuration(d)}
          config={{
            youtube: {
              playerVars: { 
                controls: 0, modestbranding: 1, rel: 0, fs: 0, iv_load_policy: 3, disablekb: 1 
              }
            }
          }}
        />
      </div>

      <div
        className="absolute inset-0 z-10 cursor-pointer"
        onClick={handleVideoTap}
        onPointerMove={revealControls}
        onContextMenu={(e) => e.preventDefault()}
      />

      {/* Floating Chat Toggle Badge for Live Stream in top right */}
      {showChatButton && (
        <button
          onClick={(e) => { e.stopPropagation(); onChatToggle(); }}
          className={cn(
            "absolute top-4 right-4 z-20 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold shadow-lg transition-all duration-200 backdrop-blur active:scale-95",
            controlsVisible ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2 pointer-events-none",
            chatVisible
              ? "bg-red-600/90 text-white hover:bg-red-600"
              : "bg-black/70 text-white/90 border border-white/20 hover:bg-black/90"
          )}
          title={chatVisible ? "Hide Live Chat" : "Show Live Chat"}
        >
          <MessageCircle className="h-3.5 w-3.5" />
          <span>{chatVisible ? "Hide Chat" : "Live Chat"}</span>
          <span className="h-1.5 w-1.5 rounded-full bg-red-400 animate-pulse" />
        </button>
      )}

      <div className="pointer-events-none absolute bottom-[3%] right-[1%] z-10 flex items-center justify-center rounded px-1.5 py-0.5" aria-hidden>
        <span className="select-none text-[8px] font-semibold uppercase tracking-wider text-white/30">Adhyeta</span>
      </div>


      {!started && (
        <>
          {poster && <img src={poster} alt="" className="pointer-events-none absolute inset-0 z-0 h-full w-full object-contain bg-black" />}
          <button
            onClick={(e) => { e.stopPropagation(); toggle(); revealControls(); }}
            aria-label="Play"
            className="absolute inset-0 z-20 m-auto grid h-16 w-16 place-items-center rounded-full bg-gradient-to-br from-primary to-primary-glow text-primary-foreground shadow-elegant backdrop-blur transition hover:scale-105"
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
        showChatButton={showChatButton}
        chatVisible={chatVisible}
        onChatToggle={onChatToggle}
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

function ControlBar({
  playing, muted, time, duration, speed, showSpeed, visible,
  onPlayToggle, onSeek, onScrub, onMuteToggle, onSpeedToggle, onSpeedPick, onFullscreen, onInteract,
  showScrubber = true, showMute = true, showSeekButtons = true,
  qualities, currentQuality, onQualityPick,
  showChatButton, chatVisible, onChatToggle,
}: any) {
  const [showQuality, setShowQuality] = useState(false);
  const [dragTime, setDragTime] = useState<number | null>(null);
  const displayTime = dragTime ?? time;
  return (
    <div
      onClick={(e) => { e.stopPropagation(); onInteract(); }}
      onPointerMove={onInteract}
      className={cn(
        "pointer-events-none absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/90 via-black/50 to-transparent px-3 pb-2.5 pt-8 transition-opacity duration-200",
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
                  className="flex items-center gap-1 rounded-full px-2.5 py-1.5 text-xs font-semibold transition hover:bg-white/15"
                >
                  <Settings className="h-3.5 w-3.5" /> {YT_QUALITY_LABEL[currentQuality ?? "auto"] ?? currentQuality ?? "Auto"}
                </button>
                {showQuality && (
                  <div className="absolute bottom-full right-0 mb-2 grid gap-0.5 rounded-2xl bg-black/95 p-1.5 shadow-xl ring-1 ring-white/10 backdrop-blur">
                    {qualities.map((q: string) => (
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
            
            {showChatButton && (
              <button
                onClick={onChatToggle}
                title={chatVisible ? "Hide Live Chat" : "Open Live Chat"}
                className={cn(
                  "flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-bold transition hover:bg-white/15",
                  chatVisible ? "bg-red-600/90 text-white" : "text-white/80 hover:text-white"
                )}
              >
                <MessageCircle className="h-3.5 w-3.5" />
                <span className="hidden sm:inline text-[11px]">{chatVisible ? "Hide Chat" : "Live Chat"}</span>
              </button>
            )}


            <button onClick={onFullscreen} aria-label="Fullscreen" className="rounded-full p-2 transition hover:bg-white/15">
              <Maximize className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}