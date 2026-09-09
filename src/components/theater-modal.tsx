import { useEffect, useState, useRef } from "react";
import {
  X,
  GraduationCap,
  MessageCircle,
} from "lucide-react";
import { VideoPlayer } from "@/components/video-player";
import { LiveChat } from "@/components/live-chat";
import { cn } from "@/lib/utils";

export type TheaterLecture = {
  id: string;
  title: string;
  subtitle?: string;
  isLive?: boolean;
  video_url?: string | null;
  youtube_url?: string | null;
  thumbnail_url?: string | null;
  subject?: string | null;
  chapter?: string | null;
  lecture_number?: number | null;
  description?: string | null;
};

export type TheaterMaterial = {
  id: string;
  title: string;
  subtitle?: string;
  file_url: string | null;
  subject?: string | null;
  chapter?: string | null;
  material_type?: string | null;
};

type Props = {
  open: boolean;
  onClose: () => void;
  videoSrc: string;
  poster?: string | null;
  title: string;
  meta?: string;
  description?: string | null;
  liveClassId?: string;
  lectures?: TheaterLecture[];
  activeLectureId?: string;
  onSelectLecture?: (id: string) => void;
  notes?: TheaterMaterial[];
  dpp?: TheaterMaterial[];
  currentLecture?: any;
};

export function TheaterModal({
  open,
  onClose,
  videoSrc,
  poster,
  title,
  meta,
  description: _description,
  liveClassId,
  lectures: _lectures = [],
  activeLectureId: _activeLectureId,
  onSelectLecture: _onSelectLecture,
  notes: _notes = [],
  dpp: _dpp = [],
  currentLecture,
}: Props) {
  const isLive = Boolean(liveClassId || currentLecture?.isLive);
  const [chatOpen, setChatOpen] = useState(isLive);
  const modalRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  // Auto request full screen on open in 1 click (like 2nd image)
  useEffect(() => {
    if (!open) return;

    const enterFs = () => {
      try {
        const doc = document as any;
        const fsEl =
          doc.fullscreenElement ||
          doc.webkitFullscreenElement ||
          doc.mozFullScreenElement ||
          doc.msFullscreenElement;
        if (!fsEl && stageRef.current) {
          const el = stageRef.current as any;
          const fn =
            el.requestFullscreen ||
            el.webkitRequestFullscreen ||
            el.mozRequestFullScreen ||
            el.msRequestFullscreen;
          fn?.call(el)?.catch?.(() => {});
        }
      } catch {}
    };

    enterFs();
    const timer = setTimeout(enterFs, 50);

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleClose();
      }
    };
    document.addEventListener("keydown", onKey);

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      clearTimeout(timer);
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (open) {
      setChatOpen(isLive);
    }
  }, [open, isLive]);

  if (!open) return null;

  const handleClose = () => {
    const doc = document as any;
    const fsEl = doc.fullscreenElement || doc.webkitFullscreenElement || doc.mozFullScreenElement || doc.msFullscreenElement;
    if (fsEl) {
      (doc.exitFullscreen || doc.webkitExitFullscreen || doc.mozCancelFullScreen || doc.msExitFullscreen)?.call(doc)?.catch?.(() => {});
    }
    onClose();
  };

  const chatNode = (
    <div className="w-full h-full flex flex-col bg-[#0f0f0f]">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-[#181818] shrink-0">
        <div className="flex items-center gap-2">
          <span className={cn("h-2 w-2 rounded-full", isLive ? "bg-red-500 animate-pulse" : "bg-zinc-500")} />
          <span className="font-bold text-xs uppercase tracking-wider text-white">
            {isLive ? "Live Chat" : "Discussion & Chat"}
          </span>
        </div>
        <button
          onClick={() => setChatOpen(false)}
          className="p-1 rounded-md hover:bg-white/10 text-white/60 hover:text-white transition"
          title="Hide Chat"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="flex-1 min-h-0">
        {isLive && (liveClassId || currentLecture?.id) ? (
          <LiveChat liveClassId={(liveClassId || currentLecture?.id)!} canModerate={true} className="h-full rounded-none border-0" />
        ) : (
          <div className="flex h-full flex-col items-center justify-center p-6 text-center text-zinc-400 select-none">
            <MessageCircle className="h-10 w-10 text-zinc-600 mb-3" />
            <p className="text-sm font-semibold text-zinc-200">Live Chat is Offline</p>
            <p className="text-xs text-zinc-400 mt-1 max-w-[240px]">
              Live chat is active only during live lectures.
            </p>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div
      ref={modalRef}
      className="fixed inset-0 z-[200] flex flex-col w-screen h-screen overflow-hidden bg-black text-white font-sans select-none"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Top Header Bar */}
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-white/10 bg-zinc-950/95 px-3 sm:px-5 z-30 shadow-md">
        <div className="flex items-center gap-2.5 min-w-0 pr-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-xs shrink-0">
            <GraduationCap className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex items-center gap-2">
            <span className="font-semibold text-xs sm:text-sm tracking-tight text-zinc-100 truncate">
              {title}
            </span>
            {isLive ? (
              <span className="inline-flex items-center gap-1 rounded bg-red-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white shrink-0">
                <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                Live
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded bg-white/10 text-zinc-300 border border-white/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider shrink-0">
                Recorded
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {isLive && (
            <button
              onClick={() => setChatOpen(!chatOpen)}
              className={cn(
                "flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold transition shadow-xs",
                chatOpen
                  ? "bg-red-600 text-white"
                  : "bg-white/10 text-zinc-200 hover:bg-white/20"
              )}
            >
              <MessageCircle className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{chatOpen ? "Hide Chat" : "Live Chat"}</span>
            </button>
          )}

          <button
            onClick={handleClose}
            aria-label="Close player"
            title="Close player (Esc)"
            className="flex items-center gap-1 rounded-full bg-white/10 hover:bg-red-600/90 text-zinc-200 hover:text-white border border-white/10 px-3 py-1 text-xs font-semibold transition active:scale-95 shadow-xs"
          >
            <span>Close</span>
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Main Full-Screen Player Stage (Contains Video + Live Chat in Fullscreen) */}
      <div ref={stageRef} className="flex-1 w-full min-h-0 relative flex flex-row overflow-hidden bg-black">
        <VideoPlayer
          src={videoSrc}
          title={title}
          subtitle={currentLecture?.subject || currentLecture?.chapter || meta || "Sarvodaya Classes"}
          poster={poster ?? undefined}
          isLive={isLive}
          chatVisible={chatOpen}
          onChatToggle={() => setChatOpen(!chatOpen)}
          chatComponent={chatNode}
          fullscreenTargetRef={stageRef}
          hideTopTitleWhenNotFullscreen={true}
          onClose={handleClose}
          className="h-full w-full rounded-none border-0"
        />
      </div>
    </div>
  );
}
