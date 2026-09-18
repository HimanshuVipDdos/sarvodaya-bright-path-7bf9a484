import { Link } from "@tanstack/react-router";
import { FileText, BookOpen, Plus, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface MaterialNavSwitcherProps {
  current: "notes" | "dpps";
  onQuickAction?: () => void;
  quickActionLabel?: string;
}

export function MaterialNavSwitcher({
  current,
  onQuickAction,
  quickActionLabel,
}: MaterialNavSwitcherProps) {
  return (
    <div className="mb-6 space-y-3">
      {/* Teacher Guidance Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 sm:p-4 rounded-2xl bg-gradient-to-r from-blue-500/10 via-indigo-500/10 to-purple-500/10 border border-border/60">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-blue-500/15 text-blue-600 dark:text-blue-400">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xs font-bold text-foreground flex items-center gap-1.5">
              <span>Study Materials & Practice Hub</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 font-extrabold uppercase">
                Easy Mode
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Class Notes, PDFs ya DPP assignments upload karne ke liye niche se switch karein.
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
            <span>{quickActionLabel || (current === "notes" ? "Upload Class Notes" : "Upload DPP Sheet")}</span>
          </button>
        )}
      </div>

      {/* Prominent Tab Switcher */}
      <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-muted/60 border border-border/60 max-w-md">
        <Link
          to="/admin/pdfs"
          className={cn(
            "flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-bold transition-all select-none",
            current === "notes"
              ? "bg-background text-foreground shadow-sm border border-border/80"
              : "text-muted-foreground hover:text-foreground hover:bg-background/40"
          )}
        >
          <FileText className={cn("h-3.5 w-3.5", current === "notes" ? "text-indigo-600" : "text-muted-foreground")} />
          <span>📄 Class Notes & PDFs</span>
        </Link>

        <Link
          to="/admin/dpps"
          className={cn(
            "flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-bold transition-all select-none",
            current === "dpps"
              ? "bg-background text-foreground shadow-sm border border-border/80"
              : "text-muted-foreground hover:text-foreground hover:bg-background/40"
          )}
        >
          <BookOpen className={cn("h-3.5 w-3.5", current === "dpps" ? "text-amber-600" : "text-muted-foreground")} />
          <span>📝 DPP Practice Sheets</span>
        </Link>
      </div>
    </div>
  );
}
