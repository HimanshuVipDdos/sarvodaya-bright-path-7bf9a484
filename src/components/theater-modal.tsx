import { useEffect, useState, useMemo } from "react";
import {
  X,
  Radio,
  Video,
  FileText,
  ClipboardList,
  Share2,
  CheckCircle2,
  GraduationCap,
  MessageCircle,
  Sparkles,
  FolderOpen,
} from "lucide-react";
import { toast } from "sonner";
import { VideoPlayer } from "@/components/video-player";
import { LiveChat } from "@/components/live-chat";
import { DocumentViewer } from "@/components/document-viewer";
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

type RecommendTab = "recommended" | "playlist" | "notes" | "dpp";

type Props = {
  open: boolean;
  onClose: () => void;
  videoSrc: string;
  poster?: string | null;
  title: string;
  meta?: string;
  description?: string | null;
  liveClassId?: string;
  lectures: TheaterLecture[];
  activeLectureId?: string;
  onSelectLecture: (id: string) => void;
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
  description,
  liveClassId,
  lectures = [],
  activeLectureId,
  onSelectLecture,
  notes = [],
  dpp = [],
  currentLecture,
}: Props) {
  const isLive = Boolean(liveClassId || currentLecture?.isLive);
  const [chatOpen, setChatOpen] = useState(isLive);
  const [recommendTab, setRecommendTab] = useState<RecommendTab>("recommended");
  const [descExpanded, setDescExpanded] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  useEffect(() => {
    if (open) {
      setChatOpen(isLive);
    }
  }, [open, isLive]);

  const { chapterNotes, chapterDpps, chapterLectures } = useMemo(() => {
    const subj = currentLecture?.subject;
    const chapt = currentLecture?.chapter;

    const matchedNotes = notes.filter((n) => {
      if (chapt && n.chapter === chapt) return true;
      if (subj && n.subject === subj) return true;
      return false;
    });

    const matchedDpps = dpp.filter((d) => {
      if (chapt && d.chapter === chapt) return true;
      if (subj && d.subject === subj) return true;
      return false;
    });

    const matchedLectures = lectures.filter((l) => {
      if (chapt && l.chapter === chapt) return true;
      if (subj && l.subject === subj) return true;
      return false;
    });

    return {
      chapterNotes: matchedNotes.length > 0 ? matchedNotes : notes.slice(0, 5),
      chapterDpps: matchedDpps.length > 0 ? matchedDpps : dpp.slice(0, 5),
      chapterLectures: matchedLectures.length > 0 ? matchedLectures : lectures,
    };
  }, [currentLecture, notes, dpp, lectures]);

  if (!open) return null;

  const handleShare = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
      toast.success("Class link copied to clipboard!");
    } else {
      toast.info("Share this class with your classmates!");
    }
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex flex-col overflow-hidden bg-[#F8F9FA] text-slate-900 font-sans"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      {/* Top Header Bar */}
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 sm:px-6 z-20 shadow-xs">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-xs shrink-0">
            <GraduationCap className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex items-center gap-2">
            <span className="font-bold text-sm tracking-tight text-slate-900 truncate">
              {title}
            </span>
            {isLive ? (
              <span className="inline-flex items-center gap-1 rounded bg-red-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white shrink-0">
                <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                Live
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider shrink-0">
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
                chatOpen ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200"
              )}
            >
              <MessageCircle className="h-3.5 w-3.5" />
              <span>{chatOpen ? "Hide Chat" : "Live Chat"}</span>
            </button>
          )}

          <button
            onClick={onClose}
            aria-label="Close theater"
            title="Close player (Esc)"
            className="flex items-center gap-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200 px-3 py-1 text-xs font-semibold hover:bg-slate-200 transition active:scale-95 shadow-xs"
          >
            <span>Close</span>
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Main Theater View Stage: Left Video, Right Live Chat */}
      <div className="w-full bg-slate-950 border-b border-slate-200 flex justify-center shrink-0">
        <div className="w-full max-w-[1920px] h-[54vw] max-h-[72vh] min-h-[340px] flex flex-row overflow-hidden relative">
          
          <div className="flex-1 min-w-0 h-full flex items-center justify-center bg-black relative transition-all duration-300 overflow-hidden">
            <div className="w-full h-full max-w-full max-h-full aspect-video relative flex items-center justify-center">
              <VideoPlayer
                src={videoSrc}
                title={title}
                poster={poster ?? undefined}
                isLive={isLive}
                chatVisible={chatOpen}
                onChatToggle={() => setChatOpen(!chatOpen)}
                className="h-full w-full"
              />
            </div>
          </div>

          {isLive && chatOpen && (
            <div className="w-[340px] sm:w-[380px] lg:w-[420px] shrink-0 border-l border-white/10 h-full flex flex-col bg-[#0f0f0f] animate-in slide-in-from-right duration-200 z-10">
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-[#181818]">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                  <span className="font-bold text-xs uppercase tracking-wider text-white">Live Chat</span>
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
                <LiveChat liveClassId={liveClassId!} canModerate={true} className="h-full rounded-none border-0" />
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Scrollable Content Area Below Video */}
      <div className="flex-1 overflow-y-auto min-h-0 bg-[#F8F9FA]">
        <div className="mx-auto max-w-6xl p-4 sm:p-6 space-y-6">

          <div className="rounded-2xl bg-white p-4 sm:p-5 border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-amber-500" />
                <span className="font-bold text-sm text-slate-900">Recommended Resources & Lectures</span>
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto">
                <button
                  onClick={() => setRecommendTab("recommended")}
                  className={cn(
                    "flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition",
                    recommendTab === "recommended" ? "bg-indigo-600 text-white shadow-xs" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  )}
                >
                  <Sparkles className="h-3.5 w-3.5" /> All Resources
                </button>
                <button
                  onClick={() => setRecommendTab("notes")}
                  className={cn(
                    "flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition",
                    recommendTab === "notes" ? "bg-indigo-600 text-white shadow-xs" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  )}
                >
                  <FileText className="h-3.5 w-3.5" /> Notes ({chapterNotes.length})
                </button>
                <button
                  onClick={() => setRecommendTab("dpp")}
                  className={cn(
                    "flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition",
                    recommendTab === "dpp" ? "bg-indigo-600 text-white shadow-xs" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  )}
                >
                  <ClipboardList className="h-3.5 w-3.5" /> DPP ({chapterDpps.length})
                </button>
                <button
                  onClick={() => setRecommendTab("playlist")}
                  className={cn(
                    "flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition",
                    recommendTab === "playlist" ? "bg-indigo-600 text-white shadow-xs" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  )}
                >
                  <Video className="h-3.5 w-3.5" /> All Lectures ({lectures.length})
                </button>
              </div>
            </div>

            {recommendTab === "recommended" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-xl bg-slate-50 p-4 border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-blue-700 flex items-center gap-1.5">
                      <FileText className="h-4 w-4" /> Chapter Notes
                    </span>
                    <span className="text-[10px] text-slate-500 font-semibold">{chapterNotes.length} Files</span>
                  </div>
                  {chapterNotes.length === 0 ? (
                    <div className="text-xs text-slate-500 py-3">No notes uploaded for this chapter yet.</div>
                  ) : (
                    <div className="space-y-2">
                      {chapterNotes.slice(0, 3).map((n) => (
                        <div key={n.id} className="flex items-center justify-between p-2.5 rounded-lg bg-white border border-slate-200 shadow-2xs text-xs">
                          <span className="truncate flex-1 font-semibold pr-2 text-slate-800">{n.title}</span>
                          {n.file_url && <DocumentViewer url={n.file_url} title={n.title} />}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="rounded-xl bg-slate-50 p-4 border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-amber-700 flex items-center gap-1.5">
                      <ClipboardList className="h-4 w-4" /> Practice Sheets / DPP
                    </span>
                    <span className="text-[10px] text-slate-500 font-semibold">{chapterDpps.length} Sheets</span>
                  </div>
                  {chapterDpps.length === 0 ? (
                    <div className="text-xs text-slate-500 py-3">No DPPs uploaded for this chapter yet.</div>
                  ) : (
                    <div className="space-y-2">
                      {chapterDpps.slice(0, 3).map((d) => (
                        <div key={d.id} className="flex items-center justify-between p-2.5 rounded-lg bg-white border border-slate-200 shadow-2xs text-xs">
                          <span className="truncate flex-1 font-semibold pr-2 text-slate-800">{d.title}</span>
                          {d.file_url && <DocumentViewer url={d.file_url} title={d.title} />}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="col-span-1 md:col-span-2 rounded-xl bg-slate-50 p-4 border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                      <Video className="h-4 w-4 text-indigo-600" /> Chapter Lectures ({chapterLectures.length})
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {chapterLectures.map((l) => (
                      <button
                        key={l.id}
                        onClick={() => onSelectLecture(l.id)}
                        className={cn(
                          "flex items-start gap-2.5 p-2.5 rounded-lg text-left transition border shadow-2xs",
                          activeLectureId === l.id
                            ? "bg-indigo-50 border-indigo-300 text-indigo-950 font-bold"
                            : "bg-white border-slate-200 hover:border-slate-300 text-slate-800"
                        )}
                      >
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-indigo-100 text-indigo-700 font-bold text-xs">
                          {l.isLive ? <Radio className="h-3.5 w-3.5 text-red-600 animate-pulse" /> : l.lecture_number ?? "•"}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-xs font-semibold">{l.title}</div>
                          {l.chapter && <div className="truncate text-[10px] text-slate-500">{l.chapter}</div>}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {recommendTab === "notes" && (
              <div className="space-y-2">
                {chapterNotes.length === 0 ? (
                  <div className="text-xs text-slate-500 py-6 text-center">No notes available for this chapter.</div>
                ) : (
                  chapterNotes.map((n) => (
                    <div key={n.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
                      <div className="flex items-center gap-3 min-w-0">
                        <FileText className="h-5 w-5 text-blue-600 shrink-0" />
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-slate-900 truncate">{n.title}</div>
                          {n.chapter && <div className="text-[10px] text-slate-500">{n.chapter}</div>}
                        </div>
                      </div>
                      {n.file_url && <DocumentViewer url={n.file_url} title={n.title} />}
                    </div>
                  ))
                )}
              </div>
            )}

            {recommendTab === "dpp" && (
              <div className="space-y-2">
                {chapterDpps.length === 0 ? (
                  <div className="text-xs text-slate-500 py-6 text-center">No DPP available for this chapter.</div>
                ) : (
                  chapterDpps.map((d) => (
                    <div key={d.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
                      <div className="flex items-center gap-3 min-w-0">
                        <ClipboardList className="h-5 w-5 text-amber-600 shrink-0" />
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-slate-900 truncate">{d.title}</div>
                          {d.chapter && <div className="text-[10px] text-slate-500">{d.chapter}</div>}
                        </div>
                      </div>
                      {d.file_url && <DocumentViewer url={d.file_url} title={d.title} />}
                    </div>
                  ))
                )}
              </div>
            )}

            {recommendTab === "playlist" && (
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {lectures.map((l, i) => (
                  <button
                    key={l.id}
                    onClick={() => onSelectLecture(l.id)}
                    className={cn(
                      "flex items-start gap-3 rounded-xl p-3 text-left transition border shadow-2xs",
                      activeLectureId === l.id
                        ? "bg-indigo-50 border-indigo-300 text-indigo-950 font-bold"
                        : "bg-white border-slate-200 hover:border-slate-300 text-slate-800"
                    )}
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700 font-bold text-xs">
                      {l.isLive ? <Radio className="h-4 w-4 text-red-600 animate-pulse" /> : i + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-bold text-xs text-slate-900">{l.title}</div>
                      <div className="truncate text-[10px] text-slate-500 mt-0.5">
                        {[l.subject, l.chapter].filter(Boolean).join(" • ") || "Lecture"}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}

          </div>

        </div>
      </div>
    </div>
  );
}
