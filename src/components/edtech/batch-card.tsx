import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { BookOpen, Radio, Users, CheckCircle2, ArrowRight, Sparkles, Clock } from "lucide-react";
import { cn, getStorageUrl } from "@/lib/utils";

export interface BatchCardData {
  id: string;
  slug: string;
  title: string;
  exam_category: string;
  fees_inr: number;
  original_fees_inr?: number | null;
  thumbnail_url?: string | null;
  is_featured?: boolean;
  language?: string;
  validity?: string;
  faculty_names?: string[];
  features?: string[] | null;
  _isLive?: boolean;
}

interface BatchCardProps {
  batch: BatchCardData;
  index?: number;
  featured?: boolean;
}

export function BatchCard({ batch, index = 0, featured = false }: BatchCardProps) {
  const discount =
    batch.original_fees_inr && batch.original_fees_inr > batch.fees_inr
      ? Math.round(((batch.original_fees_inr - batch.fees_inr) / batch.original_fees_inr) * 100)
      : 0;

  const isFree = batch.fees_inr === 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{ duration: 0.4, delay: Math.min(index * 0.04, 0.3), ease: "easeOut" }}
      className="h-full"
    >
      <div
        className={cn(
          "group relative flex h-full flex-col overflow-hidden rounded-2xl border transition-all duration-300",
          "bg-zinc-900/90 dark:bg-zinc-950/90 backdrop-blur-sm",
          batch._isLive
            ? "border-red-500/80 shadow-[0_0_28px_rgba(239,68,68,0.28)] ring-2 ring-red-500/30"
            : featured
            ? "border-amber-500/40 shadow-[0_0_24px_rgba(245,158,11,0.18)] hover:border-amber-500/70"
            : "border-white/10 hover:border-white/25 shadow-[0_4px_24px_rgba(0,0,0,0.25)] hover:shadow-[0_8px_32px_rgba(0,0,0,0.4)] hover:-translate-y-1"
        )}
      >
        {/* Top ambient live strip */}
        {batch._isLive && (
          <div className="h-1 w-full bg-gradient-to-r from-red-500 via-rose-500 to-red-600 animate-pulse" />
        )}

        {/* Thumbnail Section (16:9) */}
        <div className="relative aspect-video w-full overflow-hidden bg-zinc-800">
          {batch.thumbnail_url ? (
            <img
              src={getStorageUrl(batch.thumbnail_url) || batch.thumbnail_url}
              alt={batch.title}
              loading="lazy"
              onError={(e) => {
                e.currentTarget.style.display = "none";
                if (e.currentTarget.parentElement) {
                  e.currentTarget.parentElement.classList.add(
                    "bg-gradient-to-br",
                    "from-zinc-900",
                    "via-zinc-800",
                    "to-red-950/40"
                  );
                }
              }}
              className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-zinc-900 via-zinc-850 to-red-950/40 p-4 text-center">
              <span className="text-3xl">🎯</span>
              <span className="mt-2 text-xs font-black uppercase tracking-widest text-zinc-400">
                {batch.exam_category}
              </span>
            </div>
          )}

          {/* Vignette Overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/80 via-transparent to-black/40 pointer-events-none" />

          {/* Top Floating Badges */}
          <div className="absolute inset-x-0 top-0 flex items-start justify-between p-3 pointer-events-none">
            <div className="flex flex-wrap items-center gap-1.5">
              {batch._isLive ? (
                <div className="flex items-center gap-1.5 rounded-full bg-red-600 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-white shadow-lg ring-2 ring-red-400/40 animate-pulse">
                  <span className="h-1.5 w-1.5 rounded-full bg-white" />
                  <Radio className="h-3 w-3" />
                  <span>LIVE NOW</span>
                </div>
              ) : batch.is_featured ? (
                <div className="flex items-center gap-1 rounded-full bg-gradient-to-r from-amber-500 to-amber-600 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-black shadow-md">
                  <Sparkles className="h-3 w-3 fill-current" />
                  <span>STAR BATCH</span>
                </div>
              ) : null}

              <span className="rounded-full bg-black/60 backdrop-blur-md border border-white/10 px-2.5 py-0.5 text-[10px] font-bold text-zinc-300">
                {batch.language || "Hinglish"}
              </span>
            </div>

            {discount > 0 && (
              <span className="rounded-full bg-emerald-500 text-black px-2 py-0.5 text-[10px] font-black tracking-wide shadow-md">
                {discount}% OFF
              </span>
            )}
          </div>
        </div>

        {/* Card Body */}
        <div className="flex flex-1 flex-col p-4 sm:p-5">
          {/* Category & Validity strip */}
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-red-400">
              {batch.exam_category}
            </span>
            <span className="text-[11px] font-medium text-zinc-400 flex items-center gap-1">
              <Clock className="h-3 w-3 text-zinc-500" />
              {batch.validity || "Full Year Access"}
            </span>
          </div>

          {/* Batch Title */}
          <h3 className="line-clamp-2 text-base sm:text-lg font-bold text-white tracking-tight leading-snug mb-3 group-hover:text-red-400 transition-colors">
            {batch.title}
          </h3>

          {/* Key Feature Bullets (EdTech PW Style) */}
          <ul className="mb-4 space-y-1.5 text-xs text-zinc-300">
            <li className="flex items-center gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
              <span>Daily Live Classes + Full HD Recordings</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
              <span>Comprehensive DPPs & Lecture Notes (PDF)</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
              <span>Full Length CBT Mock Tests with AIR Ranking</span>
            </li>
          </ul>

          {/* Price & Action Row */}
          <div className="mt-auto pt-4 border-t border-white/10 flex items-center justify-between gap-3">
            <div className="flex flex-col">
              <div className="flex items-baseline gap-2">
                <span className="text-xl sm:text-2xl font-black text-white">
                  {isFree ? "FREE" : `₹${batch.fees_inr.toLocaleString("en-IN")}`}
                </span>
                {batch.original_fees_inr && batch.original_fees_inr > batch.fees_inr && (
                  <span className="text-xs text-zinc-400 line-through">
                    ₹{batch.original_fees_inr.toLocaleString("en-IN")}
                  </span>
                )}
              </div>
              <span className="text-[10px] text-zinc-400">Inclusive of all taxes</span>
            </div>

            <div className="flex items-center gap-2">
              <Link
                to="/batches/$slug"
                params={{ slug: batch.slug }}
                className={cn(
                  "flex items-center gap-1 rounded-xl px-4 py-2.5 text-xs font-black tracking-wide transition-all active:scale-95 shadow-lg",
                  batch._isLive
                    ? "bg-red-600 hover:bg-red-500 text-white shadow-red-600/30 ring-2 ring-red-400/40"
                    : "bg-red-600 hover:bg-red-500 text-white shadow-red-600/25 hover:shadow-red-600/40"
                )}
              >
                <span>{batch._isLive ? "Join Live" : "Explore"}</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
