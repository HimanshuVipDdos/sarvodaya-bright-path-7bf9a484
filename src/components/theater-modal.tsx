import { useEffect, useState, useMemo } from "react";
import {
  X,
  PlayCircle,
  Radio,
  Video,
  FileText,
  ClipboardList,
  ThumbsUp,
  ThumbsDown,
  Share2,
  Bookmark,
  CheckCircle2,
  GraduationCap,
  MessageCircle,
  Layers,
  Sparkles,
  FolderOpen,
  ChevronRight,
  Download,
  BookOpen,
} from "lucide-react";
import { toast } from "sonner";
import { VideoPlayer } from "@/components/video-player";
import { LiveChat } from "@/components/live-chat";
import { DocumentViewer } from "@/components/document-viewer";
import { cn, getStorageUrl } from "@/lib/utils";
import { Button } from "@/components/ui/button";

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
  const [liked, setLiked] = useState(false);
  const [disliked, setDisliked] = useState(false);
  const [likeCount, setLikeCount] = useState(128);
  const [descExpanded, setDescExpanded] = useState(false);
  const [saved, setSaved] = useState(false);

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

  // Set chat open whenever a live class opens
  useEffect(() => {
    if (open) {
      setChatOpen(isLive);
    }
  }, [open, isLive]);

  // Auto-recommend resources matching the current lecture's subject & chapter
  const { chapterNotes, chapterDpps, chapterLectures } = useMemo(() => {
    const subj = currentLecture?.subject;
    const chapt = currentLecture?.chapter;

    // Filter notes
    const matchedNotes = notes.filter((n) => {
      if (chapt && n.chapter === chapt) return true;
      if (subj && n.subject === subj) return true;
      return false;
    });

    // Filter DPPs
    const matchedDpps = dpp.filter((d) => {
      if (chapt && d.chapter === chapt) return true;
      if (subj && d.subject === subj) return true;
      return false;
    });

    // Filter related lectures from the same chapter
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

  const handleLike = () => {
    if (liked) {
      setLiked(false);
      setLikeCount((c) => c - 1);
    } else {
      setLiked(true);
      setLikeCount((c) => c + 1);
      if (disliked) setDisliked(false);
      toast.success("Added to liked videos");
    }
  };

  const handleDislike = () => {
    setDisliked(!disliked);
    if (liked) {
      setLiked(false);
      setLikeCount((c) => c - 1);
    }
  };

  const handleShare = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
      toast.success("Class link copied to clipboard!");
    } else {
      toast.info("Share this class with your classmates!");
    }
  };

  const handleSave = () => {
    setSaved(!saved);
    toast.success(saved ? "Removed from saved" : "Saved to your study list");
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex flex-col overflow-hidden bg-[#0f0f0f] text-white font-sans"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      {/* Top Header Bar */}
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-white/10 bg-[#121212] px-4 sm:px-6 z-20">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-600 text-white shadow-md shrink-0">
            <GraduationCap className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex items-center gap-2">
            <span className="font-bold text-sm tracking-tight text-white truncate">
              {title}
            </span>
            {isLive ? (
              <span className="inline-flex items-center gap-1 rounded bg-red-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white shrink-0">
                <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                Live
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded bg-blue-600/30 text-blue-400 border border-blue-500/30 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider shrink-0">
                Recorded
              </span>
            )}
          </div>
        </div>

        {/* Right Action Icons: Live Chat Toggle (Only for Live) + Close Button */}
        <div className="flex items-center gap-2 shrink-0">
          {isLive && (
            <button
              onClick={() => setChatOpen(!chatOpen)}
              className={cn(
                "flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold transition",
                chatOpen ? "bg-red-600 text-white" : "bg-white/10 text-slate-300 hover:bg-white/20"
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
            className="flex items-center gap-1 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white hover:bg-white/20 transition active:scale-95"
          >
            <span>Close</span>
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Main Theater View Stage: Left Video, Right Live Chat */}
      <div className="w-full bg-black border-b border-white/10 flex justify-center shrink-0">
        <div className="w-full max-w-[1920px] h-[54vw] max-h-[72vh] min-h-[340px] flex flex-row overflow-hidden relative">
          
          {/* Left Video Container: Smoothly flexes and centers 16:9 player without cropping */}
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

          {/* Right Live Chat Panel: Visible ONLY for Live Classes when chatOpen is true */}
          {isLive && chatOpen && (
            <div className="w-[340px] sm:w-[380px] lg:w-[420px] shrink-0 border-l border-white/10 h-full flex flex-col bg-[#0f0f0f] animate-in slide-in-from-right duration-200 z-10">
              <div className="flex items-center justify-between px-4 py-2 border-b border-white/10 bg-[#141414]">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                  <span className="font-bold text-xs uppercase tracking-wider text-white">Live Discussion</span>
                </div>
                <button
                  onClick={() => setChatOpen(false)}
                  className="p-1 rounded-md hover:bg-white/10 text-slate-400 hover:text-white transition"
                  title="Hide Chat"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="flex-1 min-h-0">
                <LiveChat liveClassId={liveClassId!} canModerate={true} className="h-full" />
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Scrollable Content Area Below Video */}
      <div className="flex-1 overflow-y-auto min-h-0 bg-[#0f0f0f]">
        <div className="mx-auto max-w-6xl p-4 sm:p-6 space-y-6">

          {/* Video Title & Subject/Chapter Breadcrumbs */}
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              {currentLecture?.subject && (
                <span className="inline-flex items-center gap-1 rounded-lg bg-[#6043ED]/20 text-[#A290FB] border border-[#6043ED]/30 px-2.5 py-1 text-xs font-bold">
                  <FolderOpen className="h-3.5 w-3.5" /> {currentLecture.subject}
                </span>
              )}
              {currentLecture?.chapter && (
                <span className="inline-flex items-center gap-1 rounded-lg bg-white/10 text-slate-200 border border-white/10 px-2.5 py-1 text-xs font-bold">
                  {currentLecture.chapter}
                </span>
              )}
              {currentLecture?.lecture_number != null && (
                <span className="rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2.5 py-1 text-xs font-bold">
                  Lecture #{currentLecture.lecture_number}
                </span>
              )}
            </div>

            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight leading-snug">
              {title}
            </h1>
          </div>

          {/* YouTube Channel Row & Action Buttons */}
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-red-600 to-rose-700 text-white font-bold shadow-md">
                SA
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-sm text-white">Sarvodaya Adhyeta</span>
                  <CheckCircle2 className="h-4 w-4 text-blue-400" />
                </div>
                <div className="text-[11px] text-slate-400">Official Batch Content</div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center rounded-full bg-[#272727] border border-white/5 divide-x divide-white/10 text-xs font-medium">
                <button
                  onClick={handleLike}
                  className={cn(
                    "flex items-center gap-1.5 px-3.5 py-2 rounded-l-full hover:bg-white/10 transition",
                    liked ? "text-blue-400" : "text-slate-200"
                  )}
                >
                  <ThumbsUp className="h-4 w-4" />
                  <span>{likeCount}</span>
                </button>
                <button
                  onClick={handleDislike}
                  className={cn(
                    "px-3 py-2 rounded-r-full hover:bg-white/10 transition",
                    disliked ? "text-red-400" : "text-slate-200"
                  )}
                >
                  <ThumbsDown className="h-4 w-4" />
                </button>
              </div>

              <button
                onClick={handleShare}
                className="flex items-center gap-1.5 rounded-full bg-[#272727] border border-white/5 px-3.5 py-2 text-xs font-medium text-slate-200 hover:bg-white/10 transition"
              >
                <Share2 className="h-4 w-4" />
                <span>Share</span>
              </button>

              <button
                onClick={handleSave}
                className={cn(
                  "flex items-center gap-1.5 rounded-full bg-[#272727] border border-white/5 px-3.5 py-2 text-xs font-medium transition hover:bg-white/10",
                  saved ? "text-amber-400" : "text-slate-200"
                )}
              >
                <Bookmark className="h-4 w-4" />
                <span>{saved ? "Saved" : "Save"}</span>
              </button>
            </div>
          </div>

          {/* Description Box */}
          <div className="rounded-2xl bg-[#1e1e1e] p-4 text-xs sm:text-sm text-slate-200 border border-white/5 space-y-2">
            <p className={cn("text-slate-300 leading-relaxed", !descExpanded && "line-clamp-2")}>
              {description || "Join today's class by Sarvodaya Adhyeta. Keep your notebook and pen ready. Practice DPPs and review notes provided below."}
            </p>
            {description && description.length > 120 && (
              <button
                onClick={() => setDescExpanded(!descExpanded)}
                className="font-bold text-white hover:underline block text-xs"
              >
                {descExpanded ? "Show less" : "...more"}
              </button>
            )}
          </div>

          {/* AUTO-RECOMMENDED RESOURCES FOR THIS LECTURE / CHAPTER */}
          <div className="rounded-2xl bg-[#181818] p-4 sm:p-5 border border-white/10 space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-amber-400" />
                <span className="font-bold text-sm text-white">Recommended for this Lecture</span>
              </div>

              {/* Resource Tabs */}
              <div className="flex items-center gap-1.5 overflow-x-auto">
                <button
                  onClick={() => setRecommendTab("recommended")}
                  className={cn(
                    "flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition",
                    recommendTab === "recommended" ? "bg-white text-black shadow-sm" : "text-slate-400 hover:text-white"
                  )}
                >
                  <Sparkles className="h-3.5 w-3.5" /> All Resources
                </button>
                <button
                  onClick={() => setRecommendTab("notes")}
                  className={cn(
                    "flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition",
                    recommendTab === "notes" ? "bg-white text-black shadow-sm" : "text-slate-400 hover:text-white"
                  )}
                >
                  <FileText className="h-3.5 w-3.5" /> Notes ({chapterNotes.length})
                </button>
                <button
                  onClick={() => setRecommendTab("dpp")}
                  className={cn(
                    "flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition",
                    recommendTab === "dpp" ? "bg-white text-black shadow-sm" : "text-slate-400 hover:text-white"
                  )}
                >
                  <ClipboardList className="h-3.5 w-3.5" /> DPP ({chapterDpps.length})
                </button>
                <button
                  onClick={() => setRecommendTab("playlist")}
                  className={cn(
                    "flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition",
                    recommendTab === "playlist" ? "bg-white text-black shadow-sm" : "text-slate-400 hover:text-white"
                  )}
                >
                  <Video className="h-3.5 w-3.5" /> All Lectures ({lectures.length})
                </button>
              </div>
            </div>

            {/* TAB: Recommended Overview */}
            {recommendTab === "recommended" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Notes card */}
                <div className="rounded-xl bg-[#222] p-4 border border-white/5 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-blue-400 flex items-center gap-1.5">
                      <FileText className="h-4 w-4" /> Chapter Notes
                    </span>
                    <span className="text-[10px] text-slate-400">{chapterNotes.length} Files</span>
                  </div>
                  {chapterNotes.length === 0 ? (
                    <div className="text-xs text-slate-500 py-3">No notes uploaded for this chapter yet.</div>
                  ) : (
                    <div className="space-y-2">
                      {chapterNotes.slice(0, 3).map((n) => (
                        <div key={n.id} className="flex items-center justify-between p-2.5 rounded-lg bg-[#282828] text-xs">
                          <span className="truncate flex-1 font-semibold pr-2 text-slate-200">{n.title}</span>
                          {n.file_url && <DocumentViewer url={n.file_url} title={n.title} />}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* DPP card */}
                <div className="rounded-xl bg-[#222] p-4 border border-white/5 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-amber-400 flex items-center gap-1.5">
                      <ClipboardList className="h-4 w-4" /> Practice Sheets / DPP
                    </span>
                    <span className="text-[10px] text-slate-400">{chapterDpps.length} Sheets</span>
                  </div>
                  {chapterDpps.length === 0 ? (
                    <div className="text-xs text-slate-500 py-3">No DPPs uploaded for this chapter yet.</div>
                  ) : (
                    <div className="space-y-2">
                      {chapterDpps.slice(0, 3).map((d) => (
                        <div key={d.id} className="flex items-center justify-between p-2.5 rounded-lg bg-[#282828] text-xs">
                          <span className="truncate flex-1 font-semibold pr-2 text-slate-200">{d.title}</span>
                          {d.file_url && <DocumentViewer url={d.file_url} title={d.title} />}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Next Lectures in this chapter */}
                <div className="col-span-1 md:col-span-2 rounded-xl bg-[#222] p-4 border border-white/5 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-white flex items-center gap-1.5">
                      <Video className="h-4 w-4 text-[#6043ED]" /> Chapter Lectures ({chapterLectures.length})
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {chapterLectures.map((l) => (
                      <button
                        key={l.id}
                        onClick={() => onSelectLecture(l.id)}
                        className={cn(
                          "flex items-start gap-2.5 p-2.5 rounded-lg text-left transition border",
                          activeLectureId === l.id
                            ? "bg-white/10 border-white/20 text-white font-bold"
                            : "bg-[#282828] border-transparent hover:border-white/10 text-slate-300"
                        )}
                      >
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-[#6043ED]/20 text-[#A290FB] font-bold text-xs">
                          {l.isLive ? <Radio className="h-3.5 w-3.5 text-red-500 animate-pulse" /> : l.lecture_number ?? "•"}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-xs font-semibold">{l.title}</div>
                          {l.chapter && <div className="truncate text-[10px] text-slate-400">{l.chapter}</div>}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* TAB: Notes */}
            {recommendTab === "notes" && (
              <div className="space-y-2">
                {chapterNotes.length === 0 ? (
                  <div className="text-xs text-slate-400 py-6 text-center">No notes available for this chapter.</div>
                ) : (
                  chapterNotes.map((n) => (
                    <div key={n.id} className="flex items-center justify-between p-3 bg-[#222] rounded-xl border border-white/5">
                      <div className="flex items-center gap-3 min-w-0">
                        <FileText className="h-5 w-5 text-blue-400 shrink-0" />
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-white truncate">{n.title}</div>
                          {n.chapter && <div className="text-[10px] text-slate-400">{n.chapter}</div>}
                        </div>
                      </div>
                      {n.file_url && <DocumentViewer url={n.file_url} title={n.title} />}
                    </div>
                  ))
                )}
              </div>
            )}

            {/* TAB: DPP */}
            {recommendTab === "dpp" && (
              <div className="space-y-2">
                {chapterDpps.length === 0 ? (
                  <div className="text-xs text-slate-400 py-6 text-center">No DPP available for this chapter.</div>
                ) : (
                  chapterDpps.map((d) => (
                    <div key={d.id} className="flex items-center justify-between p-3 bg-[#222] rounded-xl border border-white/5">
                      <div className="flex items-center gap-3 min-w-0">
                        <ClipboardList className="h-5 w-5 text-amber-400 shrink-0" />
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-white truncate">{d.title}</div>
                          {d.chapter && <div className="text-[10px] text-slate-400">{d.chapter}</div>}
                        </div>
                      </div>
                      {d.file_url && <DocumentViewer url={d.file_url} title={d.title} />}
                    </div>
                  ))
                )}
              </div>
            )}

            {/* TAB: Full Batch Playlist */}
            {recommendTab === "playlist" && (
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {lectures.map((l, i) => (
                  <button
                    key={l.id}
                    onClick={() => onSelectLecture(l.id)}
                    className={cn(
                      "flex items-start gap-3 rounded-xl p-3 text-left transition border",
                      activeLectureId === l.id
                        ? "bg-white/10 border-white/20 text-white font-bold"
                        : "bg-[#222] border-transparent hover:border-white/10 text-slate-300"
                    )}
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-red-600/20 text-red-400 font-bold text-xs">
                      {l.isLive ? <Radio className="h-4 w-4 text-red-500 animate-pulse" /> : i + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-bold text-xs text-white">{l.title}</div>
                      <div className="truncate text-[10px] text-slate-400 mt-0.5">
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