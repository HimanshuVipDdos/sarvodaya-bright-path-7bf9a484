import { useEffect } from "react";
import { X, PlayCircle, Radio } from "lucide-react";
import { VideoPlayer } from "@/components/video-player";
import { LiveClassPlayer } from "@/components/live-class-player";
import { cn } from "@/lib/utils";

export type TheaterLecture = {
  id: string;
  title: string;
  subtitle: string;
  isLive: boolean;
};

type Props = {
  open: boolean;
  onClose: () => void;
  videoSrc: string;
  poster?: string | null;
  title: string;
  meta?: string;
  description?: string | null;
  /** If set, renders LiveClassPlayer (video + live chat) instead of a plain VideoPlayer. */
  liveClassId?: string;
  lectures: TheaterLecture[];
  activeLectureId?: string;
  onSelectLecture: (id: string) => void;
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
}: Props) {
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

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex flex-col overflow-x-hidden bg-background/95 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      {/* Top bar */}
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border/60 px-4 py-3 sm:px-6">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold sm:text-base">{title}</h2>
          {meta && <div className="truncate text-[11px] text-muted-foreground sm:text-xs">{meta}</div>}
        </div>
        <button
          onClick={onClose}
          aria-label="Close theater"
          className="shrink-0 rounded-full p-2 transition hover:bg-muted"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Body */}
      <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden">
        <div className="grid min-w-0 gap-6 p-4 sm:p-6 lg:grid-cols-3">
          <div className="min-w-0 lg:col-span-2">
            {liveClassId ? (
              <LiveClassPlayer
                src={videoSrc}
                title={title}
                poster={poster ?? undefined}
                liveClassId={liveClassId}
              />
            ) : (
              <VideoPlayer src={videoSrc} title={title} poster={poster ?? undefined} />
            )}

            {description && (
              <p className="mt-4 text-sm text-muted-foreground">{description}</p>
            )}
          </div>

          {/* Playlist sidebar */}
          <div className="glass-strong rounded-3xl p-3 lg:max-h-[calc(100vh-140px)]">
            <div className="px-2 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Lectures ({lectures.length})
            </div>
            <div className="max-h-[420px] space-y-1 overflow-y-auto pr-1 lg:max-h-[calc(100vh-200px)]">
              {lectures.length === 0 && (
                <div className="p-4 text-sm text-muted-foreground">No lectures yet.</div>
              )}
              {lectures.map((l) => (
                <button
                  key={l.id}
                  onClick={() => onSelectLecture(l.id)}
                  className={cn(
                    "flex w-full items-start gap-3 rounded-2xl p-3 text-left transition",
                    activeLectureId === l.id ? "bg-primary/10" : "hover:bg-muted/60",
                  )}
                >
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary-glow text-primary-foreground">
                    {l.isLive ? <Radio className="h-4 w-4" /> : <PlayCircle className="h-4 w-4" />}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{l.title}</div>
                    {l.subtitle && (
                      <div className="truncate text-[11px] text-muted-foreground">{l.subtitle}</div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
