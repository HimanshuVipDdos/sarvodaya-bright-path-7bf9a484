import { motion } from "framer-motion";
import { Crown, Trophy, Star, Award } from "lucide-react";
import { cn } from "@/lib/utils";

export interface TopperData {
  id: string;
  student_name: string;
  exam_name: string;
  rank_or_marks?: string | null;
  photo_url?: string | null;
  batch_name?: string | null;
  year?: string | number | null;
  testimonial?: string | null;
}

interface TopperCardProps {
  topper: TopperData;
  index?: number;
}

export function TopperCard({ topper, index = 0 }: TopperCardProps) {
  const isTopRank =
    topper.rank_or_marks &&
    (topper.rank_or_marks.toLowerCase().includes("air 1") ||
      topper.rank_or_marks.toLowerCase().includes("rank 1") ||
      topper.rank_or_marks.toLowerCase().includes("top"));

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.4, delay: Math.min(index * 0.05, 0.35), ease: "easeOut" }}
      className="h-full"
    >
      <div
        className={cn(
          "group relative flex h-full flex-col items-center rounded-2xl p-5 text-center transition-all duration-300",
          "border bg-gradient-to-b from-zinc-900 to-zinc-950/90 backdrop-blur-sm",
          isTopRank
            ? "border-amber-500/50 shadow-[0_0_30px_rgba(245,158,11,0.2)] hover:border-amber-400"
            : "border-white/10 shadow-[0_4px_20px_rgba(0,0,0,0.3)] hover:border-white/20 hover:-translate-y-1"
        )}
      >
        {/* Subtle decorative radial glow behind photo */}
        <div className="absolute top-8 h-24 w-24 rounded-full bg-amber-500/15 blur-xl pointer-events-none group-hover:bg-amber-500/25 transition-colors" />

        {/* Crown Icon for Elite Rankers */}
        <div className="relative mb-3 flex items-center justify-center">
          <div className="absolute -top-3.5 z-10">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-tr from-amber-500 to-amber-300 text-black shadow-lg ring-2 ring-zinc-900">
              <Crown className="h-4 w-4 fill-current" />
            </span>
          </div>

          {/* Student Photo with Metallic Ring */}
          <div
            className={cn(
              "relative h-24 w-24 overflow-hidden rounded-full p-1 transition-transform duration-300 group-hover:scale-105",
              isTopRank
                ? "bg-gradient-to-tr from-amber-400 via-yellow-200 to-amber-600 shadow-[0_0_20px_rgba(245,158,11,0.4)]"
                : "bg-gradient-to-tr from-zinc-600 via-zinc-400 to-zinc-700 shadow-md"
            )}
          >
            <div className="h-full w-full overflow-hidden rounded-full bg-zinc-800">
              {topper.photo_url ? (
                <img
                  src={topper.photo_url}
                  alt={topper.student_name}
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-zinc-800 to-zinc-900 text-2xl font-black text-amber-400">
                  {topper.student_name.charAt(0)}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* AIR Rank / Score Badge */}
        <div className="relative mb-3 inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-amber-500 to-yellow-400 px-3 py-1 text-xs font-black uppercase tracking-wider text-black shadow-md">
          <Trophy className="h-3.5 w-3.5 fill-current" />
          <span>{topper.rank_or_marks || "SELECTED"}</span>
        </div>

        {/* Student Name */}
        <h4 className="text-sm sm:text-base font-bold text-white tracking-tight leading-snug line-clamp-1">
          {topper.student_name}
        </h4>

        {/* Exam Name */}
        <p className="mt-1 text-xs font-semibold text-red-400 uppercase tracking-wider">
          {topper.exam_name}
        </p>

        {/* Batch Name or Year Tag */}
        {topper.batch_name && (
          <p className="mt-2 text-[11px] text-zinc-400 line-clamp-1">
            {topper.batch_name}
          </p>
        )}

        {/* Testimonial Quote if available */}
        {topper.testimonial && (
          <p className="mt-3 text-[11px] italic text-zinc-300/80 line-clamp-2 border-t border-white/5 pt-2">
            "{topper.testimonial}"
          </p>
        )}
      </div>
    </motion.div>
  );
}
