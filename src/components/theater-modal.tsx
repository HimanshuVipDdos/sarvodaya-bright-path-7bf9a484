import { useEffect, useState } from "react";
import { X, PlayCircle, Radio, Video, FileText, ClipboardList } from "lucide-react";
import { VideoPlayer } from "@/components/video-player";
import { LiveClassPlayer } from "@/components/live-class-player";
import { DocumentViewer } from "@/components/document-viewer";
import { cn } from "@/lib/utils";

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

type SidebarTab = "lectures" | "notes" | "dpp";

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
  /** Batch's notes / DPP materials, shown as sidebar tabs so a student never
   *  has to leave the player screen to find them — PW-style. */
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
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>("lectures");
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

  // Land back on the Lectures tab each time the theater is (re)opened.
  useEffect(() => {
    if (open) setSidebarTab("lectures");
  }, [open]);

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

          {/* Playlist / notes / DPP sidebar */}
          <div className="glass-strong flex flex-col rounded-3xl p-3 lg:max-h-[calc(100vh-140px)]">
            <div className="flex shrink-0 gap-1 rounded-2xl bg-muted/50 p-1">
              <SidebarTabButton
                active={sidebarTab === "lectures"} onClick={() => setSidebarTab("lectures")}
                icon={Video} label="Lectures" count={lectures.length}
              />
              <SidebarTabButton
                active={sidebarTab === "notes"} onClick={() => setSidebarTab("notes")}
                icon={FileText} label="Notes" count={notes.length}
              />
              <SidebarTabButton
                active={sidebarTab === "dpp"} onClick={() => setSidebarTab("dpp")}
                icon={ClipboardList} label="DPP" count={dpp.length}
              />
            </div>

            {sidebarTab === "lectures" && (
              <div className="mt-2 max-h-[420px] space-y-1 overflow-y-auto pr-1 lg:max-h-[calc(100vh-220px)]">
                {lectures.length === 0 && (
                  <div className="p-4 text-sm text-muted-foreground">No lectures yet.</div>
                )}
                {lectures.map((l, i) => (
                  <button
                    key={l.id}
                    onClick={() => onSelectLecture(l.id)}
                    className={cn(
                      "flex w-full items-start gap-3 rounded-2xl p-3 text-left transition",
                      activeLectureId === l.id ? "bg-primary/10" : "hover:bg-muted/60",
                    )}
                  >
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary-glow text-primary-foreground">
                      {l.isLive ? <Radio className="h-4 w-4" /> : <span className="text-xs font-bold">{i + 1}</span>}
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
            )}

            {sidebarTab === "notes" && (
              <SidebarMaterialList items={notes} empty="No notes uploaded for this batch yet." icon={FileText} />
            )}
            {sidebarTab === "dpp" && (
              <SidebarMaterialList items={dpp} empty="No DPP uploaded for this batch yet." icon={ClipboardList} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function SidebarTabButton({
  active, onClick, icon: Icon, label, count,
}: { active: boolean; onClick: () => void; icon: typeof Video; label: string; count: number }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-1 items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-xs font-medium transition",
        active ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted",
      )}
    >
      <Icon className="h-3.5 w-3.5" /> {label}
      {count > 0 && (
        <span className={cn(
          "rounded-full px-1.5 text-[10px]",
          active ? "bg-primary-foreground/20" : "bg-muted-foreground/10",
        )}>{count}</span>
      )}
    </button>
  );
}

function SidebarMaterialList({
  items, empty, icon: Icon,
}: { items: TheaterMaterial[]; empty: string; icon: typeof FileText }) {
  return (
    <div className="mt-2 max-h-[420px] space-y-1 overflow-y-auto pr-1 lg:max-h-[calc(100vh-220px)]">
      {items.length === 0 && <div className="p-4 text-sm text-muted-foreground">{empty}</div>}
      {items.map((m) => (
        <div key={m.id} className="flex items-start gap-3 rounded-2xl p-3 hover:bg-muted/60">
          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary-glow text-primary-foreground">
            <Icon className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{m.title}</div>
            {m.subtitle && <div className="truncate text-[11px] text-muted-foreground">{m.subtitle}</div>}
            {m.file_url && (
              <div className="mt-1.5">
                <DocumentViewer url={m.file_url} title={m.title} />
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
