import { Link } from "@tanstack/react-router";
import { Radio, Video, Plus, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface LectureLiveSwitcherProps {
  current: "live" | "recorded";
  onQuickAction?: () => void;
  quickActionLabel?: string;
}

export function LectureLiveSwitcher({
  current,
  onQuickAction,
  quickActionLabel,
}: LectureLiveSwitcherProps) {
  return (
    <div className="mb-6 space-y-3">
      {/* Teacher Guidance Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 sm:p-4 rounded-2xl bg-gradient-to-r from-red-500/10 via-purple-500/10 to-indigo-500/10 border border-border/60">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-primary/15 text-primary">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xs font-bold text-foreground flex items-center gap-1.5">
              <span>Teacher Class Hub</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-extrabold uppercase">
                Easy Mode
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Live class schedule karni ho ya recorded lecture upload karna ho — niche se select karein.
            </p>
          </div>
        </div>

        {onQuickAction && (
          <button
            type="button"
            onClick={onQuickAction}
            className="self-start sm:self-auto inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-bold transition shadow-xs cursor-pointer active:scale-95"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>{quickActionLabel || (current === "live" ? "Schedule Live Class" : "Upload Lecture")}</span>
          </button>
        )}
      </div>

      {/* Prominent Tab Switcher */}
      <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-muted/60 border border-border/60 max-w-md">
        <Link
          to="/admin/live-classes"
          className={cn(
            "flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-bold transition-all select-none",
            current === "live"
              ? "bg-background text-foreground shadow-sm border border-border/80"
              : "text-muted-foreground hover:text-foreground hover:bg-background/40"
          )}
        >
          <Radio className={cn("h-3.5 w-3.5", current === "live" ? "text-red-600 animate-pulse" : "text-muted-foreground")} />
          <span>🔴 Live Classes (लाइव)</span>
        </Link>

        <Link
          to="/admin/lectures"
          className={cn(
            "flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-bold transition-all select-none",
            current === "recorded"
              ? "bg-background text-foreground shadow-sm border border-border/80"
              : "text-muted-foreground hover:text-foreground hover:bg-background/40"
          )}
        >
          <Video className={cn("h-3.5 w-3.5", current === "recorded" ? "text-indigo-600" : "text-muted-foreground")} />
          <span>📹 Recorded Lectures (रिकॉर्डेड)</span>
        </Link>
      </div>
    </div>
  );
}
