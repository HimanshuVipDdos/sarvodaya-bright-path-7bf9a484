import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import {
  X,
  GraduationCap,
  MessageCircle,
  CheckCircle2,
  FileText,
  Keyboard,
  Eye,
  BookOpen,
  Sparkles,
} from "lucide-react";
import { VideoPlayer } from "@/components/video-player";
import { LiveChat } from "@/components/live-chat";
import { cn } from "@/lib/utils";
import { toEmbeddableDocumentUrl } from "@/lib/document-utils";

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
  isCompleted?: boolean;
  onToggleComplete?: () => void;
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
  notes = [],
  dpp = [],
  currentLecture,
  isCompleted,
  onToggleComplete,
}: Props) {
  const isLive = Boolean(liveClassId || currentLecture?.isLive);
  const [panelMode, setPanelMode] = useState<"chat" | "materials">(isLive ? "chat" : "materials");
  const [panelOpen, setPanelOpen] = useState(isLive);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [viewingDoc, setViewingDoc] = useState<{ url: string; title: string } | null>(null);
  const [materialsTab, setMaterialsTab] = useState<"all" | "notes" | "dpp">("all");

  const modalRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  // Filter materials matching this lecture's chapter or subject, fallback to batch materials
  const currentChapter = currentLecture?.chapter;
  const currentSubject = currentLecture?.subject;

  const relevantNotes = useMemo(() => {
    if (!notes || notes.length === 0) return [];
    if (currentChapter) {
      const match = notes.filter((n) => n.chapter?.trim().toLowerCase() === currentChapter.trim().toLowerCase());
      if (match.length > 0) return match;
    }
    if (currentSubject) {
      const match = notes.filter((n) => n.subject?.trim().toLowerCase() === currentSubject.trim().toLowerCase());
      if (match.length > 0) return match;
    }
    return notes;
  }, [notes, currentChapter, currentSubject]);

  const relevantDpp = useMemo(() => {
    if (!dpp || dpp.length === 0) return [];
    if (currentChapter) {
      const match = dpp.filter((d) => d.chapter?.trim().toLowerCase() === currentChapter.trim().toLowerCase());
      if (match.length > 0) return match;
    }
    if (currentSubject) {
      const match = dpp.filter((d) => d.subject?.trim().toLowerCase() === currentSubject.trim().toLowerCase());
      if (match.length > 0) return match;
    }
    return dpp;
  }, [dpp, currentChapter, currentSubject]);

  const totalMaterials = relevantNotes.length + relevantDpp.length;

  const handleClose = useCallback(() => {
    try {
      const doc = document as any;
      const fsEl =
        doc.fullscreenElement ||
        doc.webkitFullscreenElement ||
        doc.mozFullScreenElement ||
        doc.msFullscreenElement;
      if (fsEl) {
        (
          doc.exitFullscreen ||
          doc.webkitExitFullscreen ||
          doc.mozCancelFullScreen ||
          doc.msExitFullscreen
        )?.call(doc)?.catch?.(() => {});
      }
    } catch {}
    onClose();
  }, [onClose]);

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
        if (viewingDoc) {
          setViewingDoc(null);
        } else if (shortcutsOpen) {
          setShortcutsOpen(false);
        } else {
          handleClose();
        }
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
  }, [open, viewingDoc, shortcutsOpen, handleClose]);

  useEffect(() => {
    if (open) {
      if (isLive) {
        setPanelMode("chat");
        setPanelOpen(true);
      } else {
        setPanelMode("materials");
      }
    }
  }, [open, isLive]);

  if (!open) return null;

  const sidePanelNode = (
    <div className="w-full h-full flex flex-col bg-[#0f0f0f]">
      {/* Side Panel Tabs Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/10 bg-[#181818] shrink-0">
        <div className="flex items-center gap-1">
          {isLive && (
            <button
              onClick={() => setPanelMode("chat")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition",
                panelMode === "chat"
                  ? "bg-red-600 text-white shadow-xs"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-white/5"
              )}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
              <span>Live Chat</span>
            </button>
          )}

          <button
            onClick={() => setPanelMode("materials")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition",
              panelMode === "materials"
                ? "bg-[#6043ED] text-white shadow-xs"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-white/5"
            )}
          >
            <FileText className="h-3.5 w-3.5" />
            <span>Notes & DPP</span>
            {totalMaterials > 0 && (
              <span className="ml-0.5 rounded-full bg-white/20 px-1.5 py-0.2 text-[10px] font-mono">
                {totalMaterials}
              </span>
            )}
          </button>
        </div>

        <button
          onClick={() => setPanelOpen(false)}
          className="p-1 rounded-md hover:bg-white/10 text-white/60 hover:text-white transition"
          title="Close side panel"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Side Panel Content Body */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {panelMode === "chat" ? (
          isLive && (liveClassId || currentLecture?.id) ? (
            <LiveChat liveClassId={(liveClassId || currentLecture?.id)!} canModerate={true} className="h-full rounded-none border-0" />
          ) : (
            <div className="flex h-full flex-col items-center justify-center p-6 text-center text-zinc-400 select-none">
              <MessageCircle className="h-10 w-10 text-zinc-600 mb-3" />
              <p className="text-sm font-semibold text-zinc-200">Live Chat is Offline</p>
              <p className="text-xs text-zinc-400 mt-1 max-w-[240px]">
                Live chat is active only during live lectures. Switch to Notes & DPP to view chapter study materials.
              </p>
            </div>
          )
        ) : (
          /* Materials View (PW Style Notes & DPP Sheet) */
          <div className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold text-zinc-100">Study Materials</h4>
                <p className="text-[11px] text-zinc-400">
                  {currentChapter || currentSubject || "Lecture Resources"}
                </p>
              </div>
              <div className="flex items-center gap-1 bg-white/5 p-0.5 rounded-lg border border-white/10 text-[11px]">
                <button
                  onClick={() => setMaterialsTab("all")}
                  className={cn("px-2 py-0.5 rounded-md font-medium transition", materialsTab === "all" ? "bg-white/15 text-white" : "text-zinc-400")}
                >
                  All ({totalMaterials})
                </button>
                <button
                  onClick={() => setMaterialsTab("notes")}
                  className={cn("px-2 py-0.5 rounded-md font-medium transition", materialsTab === "notes" ? "bg-white/15 text-white" : "text-zinc-400")}
                >
                  Notes ({relevantNotes.length})
                </button>
                <button
                  onClick={() => setMaterialsTab("dpp")}
                  className={cn("px-2 py-0.5 rounded-md font-medium transition", materialsTab === "dpp" ? "bg-white/15 text-white" : "text-zinc-400")}
                >
                  DPP ({relevantDpp.length})
                </button>
              </div>
            </div>

            {totalMaterials === 0 ? (
              <div className="text-center py-12 px-4 rounded-2xl bg-white/5 border border-white/10 text-zinc-400">
                <BookOpen className="h-10 w-10 text-zinc-600 mx-auto mb-2" />
                <p className="text-xs font-semibold text-zinc-300">No Materials Uploaded</p>
                <p className="text-[11px] text-zinc-500 mt-1">
                  Class notes and DPP sheets will appear here once faculty uploads them.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Notes List */}
                {(materialsTab === "all" || materialsTab === "notes") && relevantNotes.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-indigo-400 flex items-center gap-1">
                      <FileText className="h-3 w-3" /> Class Notes ({relevantNotes.length})
                    </div>
                    {relevantNotes.map((item) => (
                      <div
                        key={item.id}
                        className="rounded-xl border border-white/10 bg-white/5 p-3 hover:bg-white/10 transition flex flex-col gap-2"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="font-semibold text-xs text-zinc-200 line-clamp-2">
                            {item.title}
                          </span>
                          <span className="shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                            PDF
                          </span>
                        </div>
                        {item.file_url && (
                          <div className="pt-1 border-t border-white/5">
                            <button
                              onClick={() => setViewingDoc({ url: item.file_url!, title: item.title })}
                              className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition shadow-xs"
                            >
                              <Eye className="h-3.5 w-3.5" />
                              <span>View Notes in App</span>
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* DPP List */}
                {(materialsTab === "all" || materialsTab === "dpp") && relevantDpp.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1">
                      <Sparkles className="h-3 w-3" /> Practice DPP ({relevantDpp.length})
                    </div>
                    {relevantDpp.map((item) => (
                      <div
                        key={item.id}
                        className="rounded-xl border border-white/10 bg-white/5 p-3 hover:bg-white/10 transition flex flex-col gap-2"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="font-semibold text-xs text-zinc-200 line-clamp-2">
                            {item.title}
                          </span>
                          <span className="shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            DPP
                          </span>
                        </div>
                        {item.file_url && (
                          <div className="pt-1 border-t border-white/5">
                            <button
                              onClick={() => setViewingDoc({ url: item.file_url!, title: item.title })}
                              className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold transition shadow-xs"
                            >
                              <Eye className="h-3.5 w-3.5" />
                              <span>Solve DPP in App</span>
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
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
          {/* Notes & DPP Toggle Button */}
          <button
            type="button"
            onClick={() => {
              setPanelMode("materials");
              setPanelOpen(panelMode === "materials" ? !panelOpen : true);
            }}
            title="Class Notes & DPP"
            className={cn(
              "flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold transition shadow-xs border",
              panelOpen && panelMode === "materials"
                ? "bg-[#6043ED] text-white border-[#6043ED]"
                : "bg-white/10 text-zinc-200 hover:bg-white/20 border-white/10"
            )}
          >
            <FileText className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Notes & DPP</span>
            {totalMaterials > 0 && (
              <span className="rounded-full bg-white/20 px-1.5 py-0.2 text-[10px] font-mono font-normal">
                {totalMaterials}
              </span>
            )}
          </button>

          {/* Keyboard Shortcuts Guide Button */}
          <button
            type="button"
            onClick={() => setShortcutsOpen(true)}
            title="Keyboard Shortcuts Guide"
            className="flex items-center gap-1 rounded-full bg-white/10 hover:bg-white/20 text-zinc-200 border border-white/10 px-2.5 py-1 text-xs font-semibold transition active:scale-95 shadow-xs"
          >
            <Keyboard className="h-3.5 w-3.5 text-zinc-300" />
            <span className="hidden md:inline">Shortcuts</span>
          </button>

          {onToggleComplete && (
            <button
              type="button"
              onClick={onToggleComplete}
              title={isCompleted ? "Mark as Incomplete" : "Mark as Complete"}
              className={cn(
                "flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold transition active:scale-95 shadow-xs border",
                isCompleted
                  ? "bg-emerald-600 text-white border-emerald-500 hover:bg-emerald-700"
                  : "bg-white/10 text-zinc-200 hover:bg-emerald-600/80 hover:text-white border-white/10"
              )}
            >
              <CheckCircle2 className="h-3.5 w-3.5 text-white" />
              <span>{isCompleted ? "Completed ✓" : "Mark as Complete"}</span>
            </button>
          )}

          {isLive && (
            <button
              onClick={() => {
                setPanelMode("chat");
                setPanelOpen(panelMode === "chat" ? !panelOpen : true);
              }}
              className={cn(
                "flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold transition shadow-xs",
                panelOpen && panelMode === "chat"
                  ? "bg-red-600 text-white"
                  : "bg-white/10 text-zinc-200 hover:bg-white/20"
              )}
            >
              <MessageCircle className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{panelOpen && panelMode === "chat" ? "Hide Chat" : "Live Chat"}</span>
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

      {/* Main Full-Screen Player Stage (Contains Video + Side Panel in Fullscreen) */}
      <div ref={stageRef} className="flex-1 w-full min-h-0 relative flex flex-row overflow-hidden bg-black">
        <VideoPlayer
          src={videoSrc}
          title={title}
          subtitle={currentLecture?.subject || currentLecture?.chapter || meta || "Sarvodaya Classes"}
          poster={poster ?? undefined}
          isLive={isLive}
          chatVisible={panelOpen}
          onChatToggle={() => setPanelOpen(!panelOpen)}
          chatComponent={sidePanelNode}
          fullscreenTargetRef={stageRef}
          hideTopTitleWhenNotFullscreen={true}
          onClose={handleClose}
          className="h-full w-full rounded-none border-0"
        />

        {/* Keyboard Shortcuts Guide Modal */}
        {shortcutsOpen && (
          <div className="absolute inset-0 z-[220] flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs animate-in fade-in duration-150">
            <div className="w-full max-w-md rounded-2xl bg-zinc-900 border border-white/15 p-6 shadow-2xl text-white">
              <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-4">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-indigo-600/20 text-indigo-400">
                    <Keyboard className="h-5 w-5" />
                  </div>
                  <h3 className="text-base font-bold">Player Keyboard Shortcuts</h3>
                </div>
                <button
                  onClick={() => setShortcutsOpen(false)}
                  className="p-1.5 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-2 text-xs divide-y divide-white/5">
                <div className="flex items-center justify-between py-1.5">
                  <span className="text-zinc-300">Play / Pause</span>
                  <kbd className="px-2 py-0.5 rounded bg-zinc-800 border border-white/15 font-mono text-[11px] text-zinc-200">Space / K</kbd>
                </div>
                <div className="flex items-center justify-between py-1.5">
                  <span className="text-zinc-300">Seek Backward / Forward 10s</span>
                  <kbd className="px-2 py-0.5 rounded bg-zinc-800 border border-white/15 font-mono text-[11px] text-zinc-200">J / L</kbd>
                </div>
                <div className="flex items-center justify-between py-1.5">
                  <span className="text-zinc-300">Seek Backward / Forward 5s</span>
                  <kbd className="px-2 py-0.5 rounded bg-zinc-800 border border-white/15 font-mono text-[11px] text-zinc-200">← / →</kbd>
                </div>
                <div className="flex items-center justify-between py-1.5">
                  <span className="text-zinc-300">Volume Up / Down</span>
                  <kbd className="px-2 py-0.5 rounded bg-zinc-800 border border-white/15 font-mono text-[11px] text-zinc-200">↑ / ↓</kbd>
                </div>
                <div className="flex items-center justify-between py-1.5">
                  <span className="text-zinc-300">Mute / Unmute</span>
                  <kbd className="px-2 py-0.5 rounded bg-zinc-800 border border-white/15 font-mono text-[11px] text-zinc-200">M</kbd>
                </div>
                <div className="flex items-center justify-between py-1.5">
                  <span className="text-zinc-300">Toggle Fullscreen</span>
                  <kbd className="px-2 py-0.5 rounded bg-zinc-800 border border-white/15 font-mono text-[11px] text-zinc-200">F</kbd>
                </div>
                <div className="flex items-center justify-between py-1.5">
                  <span className="text-zinc-300">Speed Slower / Faster</span>
                  <kbd className="px-2 py-0.5 rounded bg-zinc-800 border border-white/15 font-mono text-[11px] text-zinc-200">&lt; / &gt;</kbd>
                </div>
                <div className="flex items-center justify-between py-1.5">
                  <span className="text-zinc-300">Exit / Close</span>
                  <kbd className="px-2 py-0.5 rounded bg-zinc-800 border border-white/15 font-mono text-[11px] text-zinc-200">Esc</kbd>
                </div>
              </div>

              <div className="mt-5 pt-3 border-t border-white/10 text-center">
                <button
                  onClick={() => setShortcutsOpen(false)}
                  className="w-full py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-bold text-xs text-white transition shadow-sm"
                >
                  Got It
                </button>
              </div>
            </div>
          </div>
        )}

        {/* In-Player Document Preview Overlay */}
        {viewingDoc && (
          <div className="absolute inset-0 z-[230] flex flex-col bg-zinc-950/95 backdrop-blur-sm animate-in fade-in duration-150">
            <div className="flex h-12 items-center justify-between border-b border-white/10 px-4 bg-zinc-900 shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <FileText className="h-4 w-4 text-indigo-400 shrink-0" />
                <span className="font-semibold text-sm truncate text-white">{viewingDoc.title}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-zinc-400 hidden sm:inline-flex items-center gap-1 bg-white/5 px-2.5 py-1 rounded-md border border-white/10">
                  <Sparkles className="h-3 w-3 text-indigo-400" />
                  In-App Document Viewer
                </span>
                <button
                  onClick={() => setViewingDoc(null)}
                  className="p-1.5 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition"
                  title="Close Preview (Esc)"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="flex-1 min-h-0 bg-zinc-900">
              <iframe
                src={toEmbeddableDocumentUrl(viewingDoc.url)}
                title={viewingDoc.title}
                className="w-full h-full border-0"
                allow="autoplay"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
