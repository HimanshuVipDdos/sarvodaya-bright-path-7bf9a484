import { useEffect, useState } from "react";
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
} from "lucide-react";
import { toast } from "sonner";
import { VideoPlayer } from "@/components/video-player";
import { LiveChat } from "@/components/live-chat";
import { DocumentViewer } from "@/components/document-viewer";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export type TheaterLecture = {
  id: string;
  title: string;
  subtitle: string;
  isLive: boolean;
};

export type TheaterMaterial = {
  id: string;
  title: string;
  subtitle: string;
  file_url: string | null;
};

type RightPanelTab = "chat" | "playlist" | "notes" | "dpp";

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
  lectures,
  activeLectureId,
  onSelectLecture,
  notes = [],
  dpp = [],
}: Props) {
  const [rightTab, setRightTab] = useState<RightPanelTab>(liveClassId ? "chat" : "playlist");
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

  // Set default right tab based on liveClassId
  useEffect(() => {
    if (open) {
      setRightTab(liveClassId ? "chat" : "playlist");
    }
  }, [open, liveClassId]);

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
      className="fixed inset-0 z-[200] flex flex-col overflow-hidden bg-[#0f0f0f] text-white"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      {/* YouTube Style Top Bar with Crisp Cross (X) Close Button */}
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-white/10 bg-[#121212] px-4 sm:px-6">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-600 text-white shadow-md shrink-0">
            <GraduationCap className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-black text-sm tracking-tight text-white sm:text-base">
                Sarvodaya Adhyeta
              </span>
              {liveClassId && (
                <span className="inline-flex items-center gap-1 rounded bg-red-600 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                  <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                  Live
                </span>
              )}
            </div>
            {meta && <div className="truncate text-xs text-slate-400">{meta}</div>}
          </div>
        </div>

        {/* Prominent Cross Button */}
        <div className="flex items-center gap-2">
          <button
            onClick={onClose}
            aria-label="Close theater"
            title="Close player (Esc)"
            className="flex items-center gap-1 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/20 transition active:scale-95"
          >
            <span className="hidden sm:inline">Close</span>
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Main YouTube Layout Grid */}
      <div className="flex-1 overflow-y-auto min-h-0">
        <div className="mx-auto max-w-[1780px] p-3 sm:p-5 lg:p-6">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] xl:grid-cols-[1fr_420px] gap-6 items-start">
            
            {/* LEFT COLUMN: Video + Info + Channel + Description + Batch Materials */}
            <div className="min-w-0 space-y-4">
              {/* 16:9 Video Player Container */}
              <div className="w-full aspect-video rounded-2xl overflow-hidden bg-black shadow-2xl border border-white/10 relative">
                <VideoPlayer src={videoSrc} title={title} poster={poster ?? undefined} chatComponent={liveClassId ? <LiveChat liveClassId={liveClassId} /> : undefined} />
              </div>

              {/* Video Title */}
              <h1 className="text-lg sm:text-2xl font-black text-white tracking-tight leading-snug">
                {title}
              </h1>

              {/* YouTube Channel Row & Action Buttons */}
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-4">
                {/* Channel / Institute Details */}
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-red-600 to-rose-700 text-white font-bold shadow-md">
                    SA
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-sm text-white">Sarvodaya Adhyeta</span>
                      <CheckCircle2 className="h-4 w-4 text-blue-400" />
                    </div>
                    <div className="text-[11px] text-slate-400">Kasganj, Uttar Pradesh</div>
                  </div>
                  <span className="ml-2 rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-bold text-emerald-400 border border-emerald-500/30">
                    Enrolled
                  </span>
                </div>

                {/* YouTube Style Action Buttons */}
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Like / Dislike Pill */}
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

                  {/* Share */}
                  <button
                    onClick={handleShare}
                    className="flex items-center gap-1.5 rounded-full bg-[#272727] border border-white/5 px-3.5 py-2 text-xs font-medium text-slate-200 hover:bg-white/10 transition"
                  >
                    <Share2 className="h-4 w-4" />
                    <span>Share</span>
                  </button>

                  {/* Save */}
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

              {/* YouTube Style Description Box */}
              <div className="rounded-2xl bg-[#212121] p-4 text-xs sm:text-sm text-slate-200 border border-white/5 space-y-2">
                <div className="flex flex-wrap items-center gap-2 font-bold text-white text-xs">
                  {liveClassId ? (
                    <span className="rounded bg-red-600 px-2 py-0.5 text-white">Live Stream</span>
                  ) : (
                    <span className="rounded bg-blue-600 px-2 py-0.5 text-white">Recorded Class</span>
                  )}
                  {meta && <span>{meta}</span>}
                </div>

                <p className={cn("text-slate-300 leading-relaxed", !descExpanded && "line-clamp-2")}>
                  {description || "Join today's class by Sarvodaya Adhyeta. Keep your notebook and pen ready. Ask your doubts in the live chat."}
                </p>

                {description && description.length > 100 && (
                  <button
                    onClick={() => setDescExpanded(!descExpanded)}
                    className="font-bold text-white hover:underline block text-xs"
                  >
                    {descExpanded ? "Show less" : "...more"}
                  </button>
                )}
              </div>

              {/* Batch Content Tabs below Video */}
              <div className="rounded-2xl bg-[#181818] p-4 border border-white/5 space-y-4">
                <div className="flex items-center gap-2 border-b border-white/10 pb-3 overflow-x-auto">
                  <button
                    onClick={() => setRightTab("playlist")}
                    className={cn(
                      "flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-bold transition",
                      rightTab === "playlist" ? "bg-white text-black" : "text-slate-400 hover:text-white"
                    )}
                  >
                    <Video className="h-4 w-4" /> Lectures ({lectures.length})
                  </button>
                  <button
                    onClick={() => setRightTab("notes")}
                    className={cn(
                      "flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-bold transition",
                      rightTab === "notes" ? "bg-white text-black" : "text-slate-400 hover:text-white"
                    )}
                  >
                    <FileText className="h-4 w-4" /> Notes ({notes.length})
                  </button>
                  <button
                    onClick={() => setRightTab("dpp")}
                    className={cn(
                      "flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-bold transition",
                      rightTab === "dpp" ? "bg-white text-black" : "text-slate-400 hover:text-white"
                    )}
                  >
                    <ClipboardList className="h-4 w-4" /> DPP ({dpp.length})
                  </button>
                  {liveClassId && (
                    <button
                      onClick={() => setRightTab("chat")}
                      className={cn(
                        "flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-bold transition ml-auto",
                        rightTab === "chat" ? "bg-red-600 text-white" : "text-red-400 hover:text-red-300"
                      )}
                    >
                      <MessageCircle className="h-4 w-4" /> View Chat
                    </button>
                  )}
                </div>

                {/* Tab Content */}
                {rightTab === "playlist" && (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {lectures.map((l, i) => (
                      <button
                        key={l.id}
                        onClick={() => onSelectLecture(l.id)}
                        className={cn(
                          "flex items-start gap-3 rounded-xl p-3 text-left transition border",
                          activeLectureId === l.id
                            ? "bg-white/10 border-white/20 text-white"
                            : "bg-[#212121] border-transparent hover:border-white/10 text-slate-300"
                        )}
                      >
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-red-600/20 text-red-400 font-bold text-xs">
                          {l.isLive ? <Radio className="h-4 w-4 text-red-500 animate-pulse" /> : i + 1}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-bold text-xs text-white">{l.title}</div>
                          {l.subtitle && <div className="truncate text-[10px] text-slate-400 mt-0.5">{l.subtitle}</div>}
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {rightTab === "notes" && (
                  <div className="space-y-2">
                    {notes.length === 0 && (
                      <div className="text-xs text-slate-400 py-4 text-center">No notes uploaded yet.</div>
                    )}
                    {notes.map((n) => (
                      <div key={n.id} className="flex items-center justify-between p-3 bg-[#212121] rounded-xl">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <FileText className="h-5 w-5 text-blue-400 shrink-0" />
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-white truncate">{n.title}</div>
                            {n.subtitle && <div className="text-[10px] text-slate-400">{n.subtitle}</div>}
                          </div>
                        </div>
                        {n.file_url && <DocumentViewer url={n.file_url} title={n.title} />}
                      </div>
                    ))}
                  </div>
                )}

                {rightTab === "dpp" && (
                  <div className="space-y-2">
                    {dpp.length === 0 && (
                      <div className="text-xs text-slate-400 py-4 text-center">No DPP uploaded yet.</div>
                    )}
                    {dpp.map((d) => (
                      <div key={d.id} className="flex items-center justify-between p-3 bg-[#212121] rounded-xl">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <ClipboardList className="h-5 w-5 text-amber-400 shrink-0" />
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-white truncate">{d.title}</div>
                            {d.subtitle && <div className="text-[10px] text-slate-400">{d.subtitle}</div>}
                          </div>
                        </div>
                        {d.file_url && <DocumentViewer url={d.file_url} title={d.title} />}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* RIGHT COLUMN: YouTube Style Dedicated Full Height Live Chat */}
            <div className="w-full lg:sticky lg:top-4">
              {liveClassId ? (
                <div className="h-[560px] sm:h-[620px] lg:h-[calc(100vh-100px)]">
                  <LiveChat
                    liveClassId={liveClassId}
                    canModerate={true}
                    className="h-full"
                  />
                </div>
              ) : (
                /* For recorded classes without live chat, show the full playlist right here */
                <div className="rounded-2xl border border-white/10 bg-[#181818] p-4 space-y-3 h-[560px] lg:h-[calc(100vh-100px)] flex flex-col">
                  <div className="flex items-center justify-between border-b border-white/10 pb-3">
                    <div className="flex items-center gap-2">
                      <Layers className="h-4 w-4 text-red-500" />
                      <span className="font-bold text-sm text-white">Batch Lectures</span>
                    </div>
                    <span className="text-xs text-slate-400">{lectures.length} Videos</span>
                  </div>

                  <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                    {lectures.map((l, i) => (
                      <button
                        key={l.id}
                        onClick={() => onSelectLecture(l.id)}
                        className={cn(
                          "flex w-full items-start gap-3 rounded-xl p-3 text-left transition border",
                          activeLectureId === l.id
                            ? "bg-white/10 border-white/20 text-white"
                            : "bg-[#212121] border-transparent hover:border-white/10 text-slate-300"
                        )}
                      >
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-red-600/20 text-red-400 font-bold text-xs mt-0.5">
                          {l.isLive ? <Radio className="h-3.5 w-3.5 text-red-500 animate-pulse" /> : i + 1}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-bold text-xs text-white">{l.title}</div>
                          {l.subtitle && <div className="truncate text-[10px] text-slate-400 mt-0.5">{l.subtitle}</div>}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}


