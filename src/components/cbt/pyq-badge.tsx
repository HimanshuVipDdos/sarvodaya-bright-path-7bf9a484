import { Award, Calendar, Layers, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { PyqMeta, extractPyqMetadata, formatPyqLabel } from "@/lib/cbt-pyq-utils";

interface PyqBadgeProps {
  pyq?: PyqMeta | null;
  rawText?: string;
  topic?: string | null;
  mode?: "compact" | "banner" | "analysis" | "admin";
  className?: string;
}

export function PyqBadge({
  pyq: explicitPyq,
  rawText,
  topic,
  mode = "compact",
  className,
}: PyqBadgeProps) {
  // Extract PYQ if not explicitly passed
  let pyq = explicitPyq;
  if (!pyq && rawText) {
    const extracted = extractPyqMetadata(rawText, topic);
    pyq = extracted.pyq;
  }

  if (!pyq || (!pyq.exam && !pyq.year && !pyq.shift)) {
    return null;
  }

  const label = formatPyqLabel(pyq);

  if (mode === "banner" || mode === "analysis") {
    return (
      <div
        className={cn(
          "inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-amber-500/15 border border-amber-500/30 px-3 py-1.5 text-xs font-bold text-amber-800 dark:text-amber-300 shadow-2xs backdrop-blur-xs select-none",
          className
        )}
      >
        <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-lg bg-amber-500 text-white shadow-2xs">
          <Award className="h-3 w-3" />
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="uppercase tracking-wider text-[10px] font-black text-amber-900 dark:text-amber-200 bg-amber-200/60 dark:bg-amber-900/40 px-1.5 py-0.5 rounded">
            PYQ
          </span>
          <span className="font-extrabold text-amber-950 dark:text-amber-100">
            {pyq.exam || "Official Exam"}
          </span>
          {pyq.year && (
            <span className="flex items-center gap-0.5 text-amber-800 dark:text-amber-300 font-semibold">
              <Calendar className="h-3 w-3 opacity-70" />
              {pyq.year}
            </span>
          )}
          {pyq.shift && (
            <span className="text-[11px] font-medium text-amber-700 dark:text-amber-400 bg-white/60 dark:bg-black/30 px-1.5 py-0.5 rounded-md border border-amber-300/40">
              {pyq.shift}
            </span>
          )}
        </div>
      </div>
    );
  }

  if (mode === "admin") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-full bg-amber-100/80 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-800 px-2.5 py-0.5 text-[10px] font-bold text-amber-900 dark:text-amber-200 shadow-2xs select-none",
          className
        )}
        title={`Previous Year Question: ${label}`}
      >
        <Award className="h-2.5 w-2.5 text-amber-600 dark:text-amber-400 shrink-0" />
        <span>PYQ: {label || "Previous Year"}</span>
      </span>
    );
  }

  // Default "compact" for test-taking screen
  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-300/80 dark:border-amber-800/80 px-2.5 py-1 text-[11px] font-bold text-amber-900 dark:text-amber-200 shadow-2xs select-none",
        className
      )}
    >
      <Award className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
      <span className="font-extrabold tracking-tight">
        PYQ: {label}
      </span>
    </div>
  );
}
