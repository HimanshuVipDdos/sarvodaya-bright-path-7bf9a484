import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  X, MessageCircle, ListVideo, Maximize2, Minimize2, PlayCircle,
} from "lucide-react";
import { VideoPlayer } from "@/components/video-player";
import { LiveChat } from "@/components/live-chat";
import { cn } from "@/lib/utils";

export type TheaterLecture = {
  id: string;
  title: string;
  subtitle?: string | null;
  isLive?: boolean;
};

type Props = {
  open: boolean;
  onClose: () => void;
  videoSrc: string;
  poster?: string | null;
  title: string;
  meta?: string | null;
  description?: string | null;
  liveClassId?: string | null;
  lectures?: TheaterLecture[];
  activeLectureId?: string;
  onSelectLecture?: (id: string) => void;
};

export function TheaterModal({
  open, onClose, videoSrc, poster, title, meta, description,
  liveClassId, lectures = [], activeLectureId, onSelectLecture,
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [panel, setPanel] = useState<"none" | "chat" | "list">("none");

  // ---- Auto-hide top bar in fullscreen, YouTube-style ----
  const [topBarVisible, setTopBarVisible] = useState(true);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handler = () => {
      const fs = document.fullscreenElement === rootRef.current;
      setIsFullscreen(fs);
      if (!fs) {
        setPanel((p) => (p === "chat" ? "none" : p));
        setTopBarVisible(true); // always visible outside fullscreen
      }
    };
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  useEffect(() => {
    if (!isFullscreen) return;
    // Reset visibility + timer whenever the user moves/touches inside.
    function activity() {
      setTopBarVisible(true);
      if (hideTimer.current) clearTimeout(hideTimer.current);
      hideTimer.current = setTimeout(() => setTopBarVisible(false), 3000);
    }
    activity(); // show immediately on entering fullscreen
    const el = rootRef.current;
    el?.addEventListener("mousemove", activity);
    el?.addEventListener("touchstart", activity);
    el?.addEventListener("click", activity);
    return () => {
      el?.removeEventListener("mousemove", activity);
      el?.removeEventListener("touchstart", activity);
      el?.removeEventListener("click", activity);
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [isFullscreen]);

  // Lock page scroll while the theater is open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  useEffect(() => {
    if (open) setPanel("none");
  }, [open, videoSrc]);

  function toggleFullscreen() {
    if (!rootRef.current) return;
    if (document.fullscreenElement) document.exitFullscreen();
    else rootRef.current.requestFullscreen?.().catch(() => {});
  }

  function close() {
    if (document.fullscreenElement) document.exitFullscreen();
    onClose();
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={rootRef}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9999] flex flex-col bg-black isolate"
        >
          {/* ===== Top bar — auto-hides in fullscreen after 3s idle ===== */}
          <div
            className={cn(
              "z-30 flex flex-shrink-0 items-center justify-between gap-3 bg-black/90 px-3 py-2 transition-opacity duration-300 sm:px-4",
              isFullscreen && !topBarVisible ? "pointer-events-none opacity-0" : "opacity-100",
            )}
          >
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-white sm:text-base">{title}</div>
              {meta && <div className="truncate text-[11px] text-white/60">{meta}</div>}
            </div>
            <div className="flex flex-shrink-0 items-center gap-1.5">
              {lectures.length > 0 && (
                <IconButton
                  active={panel === "list"}
                  onClick={() => setPanel((p) => (p === "list" ? "none" : "list"))}
                  label="Classes"
                  icon={<ListVideo className="h-4 w-4" />}
                />
              )}
              {liveClassId && isFullscreen && (
                <IconButton
                  active={panel === "chat"}
                  onClick={() => setPanel((p) => (p === "chat" ? "none" : "chat"))}
                  label="Chat"
                  icon={<MessageCircle className="h-4 w-4" />}
                />
              )}
              <IconButton
                onClick={toggleFullscreen}
                label={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
                icon={isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              />
              <IconButton onClick={close} label="Close" icon={<X className="h-4 w-4" />} />
            </div>
          </div>

          {/* ===== Main area ===== */}
          <div
            className={cn(
              "relative flex flex-1 overflow-hidden",
              !isFullscreen && "flex-col lg:flex-row",
            )}
          >
            <div
              className={cn(
                "flex min-h-0 flex-1 items-center justify-center overflow-hidden",
                isFullscreen ? "h-full w-full p-0" : "p-0 sm:p-4",
              )}
            >
              <div className={cn(isFullscreen ? "h-full w-full" : "mx-auto w-full max-w-5xl")}>
                <VideoPlayer
                  key={videoSrc}
                  src={videoSrc}
                  poster={poster ?? undefined}
                  title={title}
                  fullscreenTargetRef={rootRef}
                  className={cn(
                    isFullscreen ? "h-full w-full rounded-none" : "rounded-none sm:rounded-2xl",
                  )}
                />
                {description && !isFullscreen && (
                  <div className="hidden px-1 pt-3 text-sm text-white/70 sm:block">
                    {description}
                  </div>
                )}
              </div>
            </div>

            {!isFullscreen && liveClassId && (
              <div className="flex max-h-[45vh] w-full shrink-0 flex-col border-t border-white/10 bg-neutral-950 lg:h-auto lg:max-h-none lg:w-80 lg:border-l lg:border-t-0">
                <div className="flex items-center justify-between border-b border-white/10 px-3 py-2.5">
                  <span className="text-xs font-semibold uppercase tracking-wider text-white/80">Live Chat</span>
                </div>
                <div className="min-h-0 flex-1 overflow-hidden p-2">
                  <LiveChat liveClassId={liveClassId} className="h-full" />
                </div>
              </div>
            )}

            <AnimatePresence>
              {panel === "list" && (
                <>
                  <motion.button
                    aria-label="Close panel"
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    onClick={() => setPanel("none")}
                    className="absolute inset-0 z-10 bg-black/50"
                  />
                  <motion.div
                    initial={{ x: "-100%" }} animate={{ x: 0 }} exit={{ x: "-100%" }}
                    transition={{ type: "tween", duration: 0.22 }}
                    className="absolute inset-y-0 left-0 z-20 flex w-full max-w-xs flex-col border-r border-white/10 bg-neutral-950 sm:max-w-sm"
                  >
                    <div className="flex items-center justify-between border-b border-white/10 px-3 py-2.5">
                      <span className="text-xs font-semibold uppercase tracking-wider text-white/80">
                        Classes ({lectures.length})
                      </span>
                      <button onClick={() => setPanel("none")} className="rounded-full p-1 text-white/60 hover:bg-white/10 hover:text-white">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="flex-1 space-y-1 overflow-y-auto p-2">
                      {lectures.map((l) => (
                        <button
                          key={l.id}
                          onClick={() => { onSelectLecture?.(l.id); setPanel("none"); }}
                          className={cn(
                            "flex w-full items-start gap-2.5 rounded-xl p-2.5 text-left transition",
                            l.id === activeLectureId ? "bg-primary/20" : "hover:bg-white/5"
                          )}
                        >
                          <PlayCircle className={cn(
                            "mt-0.5 h-4 w-4 shrink-0",
                            l.id === activeLectureId ? "text-primary" : "text-white/40"
                          )} />
                          <div className="min-w-0">
                            <div className={cn(
                              "truncate text-sm font-medium",
                              l.id === activeLectureId ? "text-white" : "text-white/85"
                            )}>
                              {l.title}
                              {l.isLive && (
                                <span className="ml-1.5 rounded-full bg-red-500/20 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-red-400 align-middle">
                                  Live
                                </span>
                              )}
                            </div>
                            {l.subtitle && (
                              <div className="truncate text-[11px] text-white/45">{l.subtitle}</div>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {isFullscreen && panel === "chat" && liveClassId && (
                <>
                  <motion.button
                    aria-label="Close panel"
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    onClick={() => setPanel("none")}
                    className="absolute inset-0 z-10 bg-black/50"
                  />
                  <motion.div
                    initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
                    transition={{ type: "tween", duration: 0.22 }}
                    className="absolute inset-y-0 right-0 z-20 flex w-full max-w-xs flex-col border-l border-white/10 bg-neutral-950 sm:max-w-sm"
                  >
                    <div className="flex items-center justify-between border-b border-white/10 px-3 py-2.5">
                      <span className="text-xs font-semibold uppercase tracking-wider text-white/80">Live Chat</span>
                      <button onClick={() => setPanel("none")} className="rounded-full p-1 text-white/60 hover:bg-white/10 hover:text-white">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="min-h-0 flex-1 overflow-hidden p-2">
                      <LiveChat liveClassId={liveClassId} className="h-full" />
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function IconButton({ onClick, icon, label, active }: { onClick: () => void; icon: React.ReactNode; label: string; active?: boolean }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        "flex items-center gap-1.5 rounded-full px-2.5 py-2 text-xs font-medium text-white/85 transition sm:px-3",
        active ? "bg-primary text-primary-foreground" : "bg-white/10 hover:bg-white/20"
      )}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}
