import { useState, useMemo, useEffect } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, BookOpen, Play, Radio } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn, getStorageUrl, isClassLiveNow } from "@/lib/utils";

const myBatchesQuery = queryOptions({
  queryKey: ["my-batches"],
  queryFn: async () => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) return { enrollments: [], liveClasses: [] };

      // Optional RPC tick to ensure live statuses stay synced
      try {
        await supabase.rpc("tick_live_classes" as never);
      } catch {}

      const [enrollmentsRes, liveClassesRes] = await Promise.all([
        supabase
          .from("enrollments")
          .select("*, batch:batches(*)")
          .eq("user_id", userId),
        supabase
          .from("live_classes")
          .select("id, batch_id, title, is_live, status, scheduled_at, end_at, duration_minutes, recorded_lecture_id")
          .order("scheduled_at", { ascending: false }),
      ]);

      if (enrollmentsRes.error) {
        console.error("myBatches error:", enrollmentsRes.error);
        return { enrollments: [], liveClasses: [] };
      }

      return {
        enrollments: enrollmentsRes.data ?? [],
        liveClasses: liveClassesRes.data ?? [],
      };
    } catch (e) {
      console.error("myBatches catch:", e);
      return { enrollments: [], liveClasses: [] };
    }
  },
});

export const Route = createFileRoute("/_authenticated/my-batches")({
  loader: ({ context }) => context.queryClient.ensureQueryData(myBatchesQuery),
  component: MyBatches,
});

function MyBatches() {
  const { data } = useSuspenseQuery(myBatchesQuery);
  const enrollments = data.enrollments;
  const liveClasses = data.liveClasses;
  const queryClient = useQueryClient();

  // Dynamic real-time timer every 5s so when scheduled time hits, it turns Live instantly
  const [nowTime, setNowTime] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNowTime(Date.now()), 5000);
    return () => clearInterval(timer);
  }, []);

  // Supabase realtime subscription for instant updates when teacher starts/ends class
  useEffect(() => {
    const channel = supabase
      .channel("my-batches-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "live_classes" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["my-batches"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // Derive which batches currently have an active live class
  const liveBatchMap = useMemo(() => {
    const map = new Map<string, any>();
    (liveClasses || []).forEach((lc: any) => {
      if (!lc.batch_id) return;
      if (isClassLiveNow(lc, nowTime)) {
        if (!map.has(lc.batch_id)) {
          map.set(lc.batch_id, lc);
        }
      }
    });
    return map;
  }, [liveClasses, nowTime]);

  const liveBatchCount = liveBatchMap.size;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Back link */}
      <Link
        to="/dashboard"
        className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-800 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Study
      </Link>

      <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">My Batches</h1>
          {liveBatchCount > 0 && (
            <p className="text-xs font-bold text-red-600 mt-1 flex items-center gap-1.5 animate-pulse">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-red-600" />
              </span>
              {liveBatchCount} {liveBatchCount === 1 ? "batch has a" : "batches have"} Live Class running right now!
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
          {liveBatchCount > 0 && (
            <span className="relative overflow-hidden rounded-full bg-red-600 px-3 py-1 text-xs font-black text-white live-badge-glow border border-red-300/40 flex items-center gap-1.5">
              <span className="live-shimmer" />
              <Radio className="h-3.5 w-3.5" />
              {liveBatchCount} LIVE NOW
            </span>
          )}
          {enrollments.length > 0 && (
            <span className="rounded-full bg-indigo-50 border border-indigo-200 px-3 py-1 text-xs font-bold text-indigo-700">
              {enrollments.length} Enrolled
            </span>
          )}
        </div>
      </div>

      {enrollments.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-indigo-50 border border-indigo-100">
            <BookOpen className="h-9 w-9 text-indigo-400" />
          </div>
          <h2 className="mb-2 text-lg font-bold text-slate-800">No batches yet</h2>
          <p className="mb-6 max-w-xs text-sm text-slate-500">
            You are not enrolled in any batch yet. Browse our batches and enroll to start learning.
          </p>
          <Link
            to="/batches"
            className="rounded-full bg-indigo-600 px-6 py-2.5 text-sm font-bold text-white shadow-md hover:bg-indigo-700 transition-colors"
          >
            Explore Batches
          </Link>
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {enrollments.map((e: any) => {
            const b = Array.isArray(e.batch) ? e.batch[0] : e.batch;
            if (!b) return null;
            const liveClass = liveBatchMap.get(b.id);
            const isLive = Boolean(liveClass);

            return (
              <Link
                key={e.id}
                to="/my-batch/$slug"
                params={{ slug: b.slug || b.id }}
                className={cn(
                  "group flex flex-col overflow-hidden rounded-2xl bg-white transition-all duration-300 relative",
                  isLive
                    ? "border-2 border-red-500 shadow-[0_0_24px_rgba(239,68,68,0.22)] ring-2 ring-red-500/30 hover:shadow-[0_0_32px_rgba(239,68,68,0.38)] -translate-y-0.5"
                    : "border border-slate-200/90 shadow-sm hover:shadow-lg hover:-translate-y-0.5"
                )}
              >
                {/* Top ambient glowing red line when Live */}
                {isLive && (
                  <div className="h-1 w-full bg-gradient-to-r from-red-500 via-rose-500 to-red-600 animate-pulse" />
                )}

                {/* Thumbnail */}
                <div className="relative aspect-[16/9] w-full overflow-hidden bg-slate-100">
                  {b.thumbnail_url ? (
                    <img
                      src={getStorageUrl(b.thumbnail_url) || b.thumbnail_url}
                      alt={b.title}
                      loading="lazy"
                      decoding="async"
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center bg-gradient-to-br from-indigo-50 to-slate-100 border-b border-slate-100">
                      <BookOpen className="h-10 w-10 text-indigo-300" />
                    </div>
                  )}

                  {/* CHAMKTA HUA LIVE BADGE */}
                  {isLive && (
                    <div className="absolute top-2.5 right-2.5 z-10">
                      <div className="relative overflow-hidden flex items-center gap-1.5 rounded-full bg-gradient-to-r from-red-600 via-rose-600 to-red-600 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-white live-badge-glow border border-red-300/50">
                        <span className="live-shimmer" />
                        <span className="relative flex h-2 w-2">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-95" />
                          <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
                        </span>
                        <Radio className="h-3.5 w-3.5 text-white animate-pulse" />
                        <span className="drop-shadow-sm">LIVE CLASS</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Card Body */}
                <div className="flex flex-1 flex-col p-4">
                  <div className="flex items-center justify-between mb-1.5">
                    {b.exam_category && (
                      <div className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-600">
                        {b.exam_category}
                      </div>
                    )}
                    {isLive && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase text-red-600 animate-pulse tracking-wide">
                        <span className="h-1.5 w-1.5 rounded-full bg-red-600 inline-block animate-ping" />
                        In Progress
                      </span>
                    )}
                  </div>

                  <h3 className="mb-1 line-clamp-2 text-sm font-bold text-slate-900 leading-snug group-hover:text-indigo-600 transition-colors">
                    {b.title}
                  </h3>
                  {isLive && liveClass?.title ? (
                    <p className="mb-2 line-clamp-1 text-[11px] font-bold text-red-600 flex items-center gap-1">
                      <Radio className="h-3 w-3 shrink-0" />
                      Live: {liveClass.title}
                    </p>
                  ) : b.subtitle ? (
                    <p className="mb-2 line-clamp-2 text-[11px] text-slate-500 leading-relaxed">
                      {b.subtitle}
                    </p>
                  ) : null}

                  <div className="mt-auto flex items-center justify-between border-t border-slate-100/80 pt-3">
                    <span className="rounded-full border border-emerald-200/70 bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700">
                      Enrolled
                    </span>
                    {isLive ? (
                      <span className="flex items-center gap-1.5 text-xs font-black text-red-600 animate-pulse">
                        <span className="relative flex h-2 w-2">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
                          <span className="relative inline-flex h-2 w-2 rounded-full bg-red-600" />
                        </span>
                        <Radio className="h-3.5 w-3.5 text-red-600" />
                        Join Live Now
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs font-bold text-indigo-600 group-hover:text-indigo-700 transition-colors">
                        <Play className="h-3.5 w-3.5" /> Resume
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}