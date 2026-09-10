import { useState, useMemo, useEffect } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Video,
  FileText,
  Bell,
  User,
  Trophy,
  Clock,
  LogOut,
  Shield,
  MessageCircle,
  Bookmark,
  BookOpen,
  Radio,
  Play,
  ChevronDown,
  Check,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Section } from "@/components/section";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { isClassLiveNow } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";

import { defaultDashboardConfig, type DashboardConfig } from "./admin.dashboard-settings";

const dashboardQuery = queryOptions({
  queryKey: ["dashboard"],
  queryFn: async () => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) return { profile: null, enrollments: [], roles: [], config: defaultDashboardConfig, streak: { current_streak: 0, longest_streak: 0 }, liveClasses: [] };

      const [profile, enrollments, roles, configRow, streakResult, liveClassesRes] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", userId).maybeSingle().then(res => res, () => ({ data: null, error: null })),
        supabase.from("enrollments").select("*, batch:batches(*)").eq("user_id", userId).then(res => res, () => ({ data: [], error: null })),
        supabase.from("user_roles").select("role").eq("user_id", userId).then(res => res, () => ({ data: [], error: null })),
        supabase.from("notifications").select("body").eq("category", "dashboard_config").eq("title", "dashboard_settings").maybeSingle().then(res => res, () => ({ data: null, error: null })),
        supabase.rpc("record_daily_activity" as never).then(res => res.data ?? { current_streak: 0, longest_streak: 0 }, () => ({ current_streak: 0, longest_streak: 0 })),
        supabase.from("live_classes").select("id, batch_id, title, is_live, status, scheduled_at, end_at, duration_minutes, recorded_lecture_id, subject, chapter, faculty, thumbnail_url").then(res => res, () => ({ data: [], error: null })),
      ]);

      let config = defaultDashboardConfig;
      if (configRow?.data?.body) {
        try {
          config = { ...defaultDashboardConfig, ...JSON.parse(configRow.data.body) };
        } catch {
          // fallback
        }
      }

      return {
        profile: profile?.data ?? null,
        enrollments: enrollments?.data ?? [],
        roles: (roles?.data ?? []).map((r: any) => r.role),
        config,
        streak: (streakResult ?? { current_streak: 0, longest_streak: 0 }) as { current_streak: number; longest_streak: number; is_new_day?: boolean; streak_broken?: boolean },
        liveClasses: liveClassesRes?.data ?? [],
      };
    } catch (e) {
      console.error("Dashboard query error:", e);
      return { profile: null, enrollments: [], roles: [], config: defaultDashboardConfig, streak: { current_streak: 0, longest_streak: 0 }, liveClasses: [] };
    }
  },
});

export const Route = createFileRoute("/_authenticated/dashboard")({
  loader: ({ context }) => context.queryClient.ensureQueryData(dashboardQuery),
  component: Dashboard,
});

function Dashboard() {
  const { data } = useSuspenseQuery(dashboardQuery);
  const isAdmin = ((data?.roles as string[]) ?? []).includes("admin");
  const cfg = data.config ?? defaultDashboardConfig;
  const streak = data.streak ?? { current_streak: 0, longest_streak: 0 };
  const queryClient = useQueryClient();

  // Dynamic real-time timer every 5s
  const [nowTime, setNowTime] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNowTime(Date.now()), 5000);
    return () => clearInterval(timer);
  }, []);

  // Supabase realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel("dashboard-live-sync")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "live_classes" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["dashboard"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // Derive all active live classes and today's scheduled classes across all enrolled batches
  const { liveEnrolledClasses, todayUpcomingClasses } = useMemo(() => {
    const enrolledBatchMap = new Map<string, any>();
    ((data?.enrollments as any[]) ?? []).forEach((e) => {
      const b = Array.isArray(e.batch) ? e.batch[0] : e.batch;
      if (b?.id) enrolledBatchMap.set(b.id, b);
    });

    const liveList: any[] = [];
    const upcomingList: any[] = [];
    const todayStr = new Date().toDateString();

    for (const lc of (data as any)?.liveClasses ?? []) {
      if (!lc.batch_id || !enrolledBatchMap.has(lc.batch_id)) continue;
      const b = enrolledBatchMap.get(lc.batch_id);
      const enhanced = {
        ...lc,
        batchTitle: b.title,
        batchSlug: b.slug || b.id,
        examCategory: b.exam_category,
        batchThumbnail: b.thumbnail_url,
      };

      if (isClassLiveNow(lc, nowTime)) {
        liveList.push(enhanced);
      } else if (
        !lc.recorded_lecture_id &&
        lc.scheduled_at &&
        new Date(lc.scheduled_at).toDateString() === todayStr &&
        new Date(lc.scheduled_at).getTime() > nowTime
      ) {
        upcomingList.push(enhanced);
      }
    }

    liveList.sort((a, b) => new Date(b.scheduled_at || 0).getTime() - new Date(a.scheduled_at || 0).getTime());
    upcomingList.sort((a, b) => new Date(a.scheduled_at || 0).getTime() - new Date(b.scheduled_at || 0).getTime());

    return { liveEnrolledClasses: liveList, todayUpcomingClasses: upcomingList };
  }, [data?.enrollments, (data as any)?.liveClasses, nowTime]);

  // Derive unique enrolled batches
  const enrolledBatches = useMemo(() => {
    const list: any[] = [];
    const seen = new Set<string>();
    ((data?.enrollments as any[]) ?? []).forEach((e: any) => {
      const b = Array.isArray(e.batch) ? e.batch[0] : e.batch;
      if (b?.id && !seen.has(b.id)) {
        seen.add(b.id);
        list.push(b);
      }
    });
    return list;
  }, [data?.enrollments]);

  // Track live status per batch
  const batchLiveStatusMap = useMemo(() => {
    const map = new Map<string, boolean>();
    const classes = (data as any)?.liveClasses ?? [];
    for (const lc of classes) {
      if (lc.batch_id && isClassLiveNow(lc, nowTime)) {
        map.set(lc.batch_id, true);
      }
    }
    return map;
  }, [(data as any)?.liveClasses, nowTime]);

  // Track scheduled today count per batch
  const batchClassCountMap = useMemo(() => {
    const map = new Map<string, { live: number; upcoming: number }>();
    enrolledBatches.forEach((b) => {
      const live = liveEnrolledClasses.filter((c: any) => c.batch_id === b.id).length;
      const upcoming = todayUpcomingClasses.filter((c: any) => c.batch_id === b.id).length;
      map.set(b.id, { live, upcoming });
    });
    return map;
  }, [enrolledBatches, liveEnrolledClasses, todayUpcomingClasses]);

  // Selected batch state
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);

  // Auto-select batch with ongoing live class if available, else first enrolled batch
  const effectiveBatchId = useMemo(() => {
    if (selectedBatchId && enrolledBatches.some((b) => b.id === selectedBatchId)) {
      return selectedBatchId;
    }
    // Auto-select batch that has active live class
    const liveBatch = enrolledBatches.find((b) => batchLiveStatusMap.get(b.id));
    if (liveBatch) return liveBatch.id;
    return enrolledBatches[0]?.id || null;
  }, [selectedBatchId, enrolledBatches, batchLiveStatusMap]);

  const selectedBatch = useMemo(() => {
    return enrolledBatches.find((b) => b.id === effectiveBatchId) || null;
  }, [enrolledBatches, effectiveBatchId]);

  // Check if any other enrolled batch is live right now
  const hasOtherBatchLive = useMemo(() => {
    return enrolledBatches.some(
      (b) => b.id !== effectiveBatchId && batchLiveStatusMap.get(b.id)
    );
  }, [enrolledBatches, effectiveBatchId, batchLiveStatusMap]);

  // Classes for the selected batch
  const currentBatchLiveClasses = useMemo(() => {
    if (!effectiveBatchId) return [];
    return liveEnrolledClasses.filter((c: any) => c.batch_id === effectiveBatchId);
  }, [effectiveBatchId, liveEnrolledClasses]);

  const currentBatchUpcomingClasses = useMemo(() => {
    if (!effectiveBatchId) return [];
    return todayUpcomingClasses.filter((c: any) => c.batch_id === effectiveBatchId);
  }, [effectiveBatchId, todayUpcomingClasses]);

  const hasAnyClassesToday = liveEnrolledClasses.length > 0 || todayUpcomingClasses.length > 0;

  async function handleSignOut() {
    await supabase.auth.signOut();
    toast.success("Signed out");
    window.location.href = "/";
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Optional Top Announcement */}
      {cfg.announcement && (
        <div className="mb-6 rounded-2xl bg-blue-50 border border-blue-100 p-4 text-sm font-medium text-blue-800 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 rounded-full bg-blue-600 animate-pulse" />
            <span>{cfg.announcement}</span>
          </div>
        </div>
      )}

      {/* Top Header Area for Streak/XP + Study Live Indicator */}
      <div className="flex justify-between items-center mb-6 flex-wrap gap-3">
         <div className="flex items-center gap-3">
           <h1 className="text-2xl font-black text-slate-900 tracking-tight">{cfg.greeting || "Study"}</h1>
           {liveEnrolledClasses.length > 0 && (
             <span className="relative overflow-hidden inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-red-600 via-rose-600 to-red-600 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-white live-badge-glow border border-red-300/50 shadow-sm">
               <span className="live-shimmer" />
               <span className="relative flex h-2 w-2">
                 <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-95" />
                 <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
               </span>
               <Radio className="h-3.5 w-3.5 text-white animate-pulse" />
               <span>LIVE CLASS</span>
             </span>
           )}
         </div>

         <div className="flex items-center gap-3">
           {/* Daily Streak */}
           <div
             title={`Best streak: ${streak.longest_streak} days`}
             className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold transition-all ${
               streak.current_streak > 0
                 ? "bg-orange-50 border border-orange-200 text-orange-700"
                 : "bg-slate-100 text-slate-500"
             }`}
           >
             <span className={streak.current_streak > 0 ? "animate-pulse" : ""}>🔥</span>
             {streak.current_streak}
             {streak.current_streak > 0 && (
               <span className="text-[10px] font-bold text-orange-400 hidden sm:inline">day{streak.current_streak !== 1 ? "s" : ""}</span>
             )}
           </div>
           {/* XP placeholder */}
           <div className="flex items-center gap-1.5 bg-slate-100 rounded-full px-3 py-1 text-sm font-semibold text-slate-600">
             <span className="text-blue-500">⚡</span> 0
           </div>
         </div>
      </div>

      {/* SECTION: Batch-Switchable Today's Classes & Live (Directly Above My Learning) */}
      {hasAnyClassesToday && enrolledBatches.length > 0 && (
        <div className="mb-10">
          {/* Batch Selector Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-3 flex-wrap">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="group inline-flex items-center gap-2.5 rounded-2xl border-2 border-slate-200/90 bg-white px-4 py-2 text-sm font-black text-slate-900 shadow-xs hover:border-indigo-300 hover:bg-slate-50/90 transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500/20 active:scale-[0.99]"
                  >
                    {batchLiveStatusMap.get(effectiveBatchId || "") ? (
                      <span className="relative flex h-2.5 w-2.5 shrink-0">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-90" />
                        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-600" />
                      </span>
                    ) : (
                      <BookOpen className="h-4 w-4 text-indigo-600 shrink-0" />
                    )}

                    <span className="truncate max-w-[200px] sm:max-w-[320px]">
                      {selectedBatch?.title || "Select Batch"}
                    </span>

                    {/* Soft Blinking Red Dot on selector if another enrolled batch is live */}
                    {hasOtherBatchLive && (
                      <span
                        className="relative inline-flex items-center gap-1.5 rounded-full bg-red-50 border border-red-200 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-red-600 ml-1"
                        title="Another enrolled batch has an ongoing live class!"
                      >
                        <span className="relative flex h-2 w-2">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-90" />
                          <span className="relative inline-flex h-2 w-2 rounded-full bg-red-600" />
                        </span>
                        <span className="hidden sm:inline">LIVE IN OTHER</span>
                      </span>
                    )}

                    <ChevronDown className="h-4 w-4 text-slate-400 group-hover:text-slate-600 transition-transform duration-200 ml-1" />
                  </button>
                </DropdownMenuTrigger>

                <DropdownMenuContent align="start" className="w-72 sm:w-80 p-2 rounded-2xl shadow-xl border border-slate-200 bg-white z-50">
                  <DropdownMenuLabel className="text-xs font-bold text-slate-400 uppercase tracking-wider px-2 py-1.5">
                    Switch Enrolled Batch
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {enrolledBatches.map((b) => {
                    const isSelected = b.id === effectiveBatchId;
                    const isLive = Boolean(batchLiveStatusMap.get(b.id));
                    const count = batchClassCountMap.get(b.id);
                    return (
                      <DropdownMenuItem
                        key={b.id}
                        onClick={() => setSelectedBatchId(b.id)}
                        className={`flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-colors ${
                          isSelected ? "bg-indigo-50/90 text-indigo-950 font-bold" : "text-slate-700 hover:bg-slate-100/80"
                        }`}
                      >
                        <div className="flex items-center gap-2.5 truncate">
                          {isLive ? (
                            <span className="relative flex h-2.5 w-2.5 shrink-0" title="Class Live Now">
                              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-90" />
                              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-600" />
                            </span>
                          ) : (
                            <span className="h-2 w-2 rounded-full bg-slate-300 shrink-0" />
                          )}
                          <span className="truncate text-xs font-bold">{b.title}</span>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {isLive ? (
                            <span className="relative overflow-hidden inline-flex items-center gap-1 rounded-full bg-red-600 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-white live-badge-glow">
                              <span className="live-shimmer" />
                              LIVE
                            </span>
                          ) : count && count.upcoming > 0 ? (
                            <span className="rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-[10px] font-bold px-2 py-0.5">
                              {count.upcoming} today
                            </span>
                          ) : null}
                          {isSelected && <Check className="h-4 w-4 text-indigo-600 ml-1 shrink-0" />}
                        </div>
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Live Badge for this batch */}
              {currentBatchLiveClasses.length > 0 && (
                <span className="relative overflow-hidden inline-flex items-center gap-1 rounded-full bg-red-600 px-2.5 py-0.5 text-xs font-black uppercase text-white live-badge-glow border border-red-300/40">
                  <span className="live-shimmer" />
                  <Radio className="h-3 w-3" />
                  {currentBatchLiveClasses.length} LIVE
                </span>
              )}
            </div>

            <span className="text-xs font-bold text-slate-400 hidden sm:inline">
              Today's Live & Scheduled Classes
            </span>
          </div>

          {/* Classes for Selected Batch in Sequence */}
          <div className="space-y-6">
            {/* 1. Live Classes First */}
            {currentBatchLiveClasses.length > 0 && (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {currentBatchLiveClasses.map((item: any) => {
                  const start = item.scheduled_at ? new Date(item.scheduled_at) : null;
                  const startStr = start
                    ? start.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                    : null;
                  const end = item.end_at
                    ? new Date(item.end_at)
                    : item.duration_minutes && start
                    ? new Date(start.getTime() + item.duration_minutes * 60000)
                    : null;
                  const endStr = end
                    ? end.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                    : null;
                  const timingText = startStr ? (endStr ? `${startStr} - ${endStr}` : startStr) : null;

                  return (
                    <div
                      key={item.id}
                      className="relative overflow-hidden rounded-2xl bg-white border-2 border-red-500 shadow-[0_0_24px_rgba(239,68,68,0.22)] ring-2 ring-red-500/20 p-5 flex flex-col justify-between transition-all hover:shadow-[0_0_32px_rgba(239,68,68,0.38)] group"
                    >
                      {/* Top ambient glowing strip */}
                      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-red-500 via-rose-500 to-red-600 animate-pulse" />

                      <div>
                        {/* Batch Name & Live Badge Row */}
                        <div className="flex items-center justify-between gap-2 mb-3">
                          <span
                            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-50 border border-indigo-200/90 px-2.5 py-1 text-[11px] font-black uppercase tracking-wide text-indigo-700 max-w-[65%] truncate"
                            title={item.batchTitle}
                          >
                            <BookOpen className="h-3 w-3 shrink-0 text-indigo-600" />
                            <span className="truncate">{item.batchTitle}</span>
                          </span>

                          <span className="relative overflow-hidden shrink-0 inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-red-600 via-rose-600 to-red-600 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-white live-badge-glow border border-red-300/50">
                            <span className="live-shimmer" />
                            <span className="relative flex h-1.5 w-1.5">
                              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-95" />
                              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-white" />
                            </span>
                            <Radio className="h-3 w-3 text-white animate-pulse" />
                            <span>LIVE NOW</span>
                          </span>
                        </div>

                        {/* Class Title */}
                        <h3 className="font-bold text-slate-900 text-base leading-snug line-clamp-2 mb-1.5 group-hover:text-indigo-600 transition-colors">
                          {item.title}
                        </h3>

                        {/* Subject, Chapter & Faculty */}
                        <div className="flex items-center gap-1.5 flex-wrap text-xs text-slate-500 mb-3 font-medium">
                          {item.subject && (
                            <span className="text-slate-800 font-bold">{item.subject}</span>
                          )}
                          {item.chapter && (
                            <>
                              <span className="text-slate-300">•</span>
                              <span className="line-clamp-1">{item.chapter}</span>
                            </>
                          )}
                          {item.faculty && (
                            <>
                              <span className="text-slate-300">•</span>
                              <span className="text-indigo-600 font-semibold">{item.faculty}</span>
                            </>
                          )}
                        </div>

                        {/* Timing */}
                        {timingText && (
                          <div className="mb-4 inline-flex items-center gap-1.5 rounded-md bg-slate-100 px-2.5 py-1 text-[11px] font-mono text-slate-700 font-semibold">
                            <Clock className="h-3 w-3 text-slate-500" />
                            {timingText}
                          </div>
                        )}
                      </div>

                      {/* Direct Join Action */}
                      <Link
                        to="/my-batch/$slug"
                        params={{ slug: item.batchSlug }}
                        search={{ liveClassId: item.id }}
                        className="mt-2 w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-red-600 via-rose-600 to-red-600 px-4 py-2.5 text-xs font-black uppercase tracking-wider text-white shadow-md hover:from-red-700 hover:to-rose-700 transition-all active:scale-[0.98]"
                      >
                        <Radio className="h-3.5 w-3.5 text-white animate-pulse" />
                        <span>Join Live Class</span>
                      </Link>
                    </div>
                  );
                })}
              </div>
            )}

            {/* 2. Today's Scheduled Classes in Sequence */}
            {currentBatchUpcomingClasses.length > 0 && (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {currentBatchUpcomingClasses.map((item: any) => {
                  const start = item.scheduled_at ? new Date(item.scheduled_at) : null;
                  const startStr = start
                    ? start.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                    : "Today";

                  return (
                    <div
                      key={item.id}
                      className="rounded-2xl bg-white border border-slate-200/90 shadow-xs p-5 flex flex-col justify-between hover:shadow-md transition-all group"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-2.5">
                          <span
                            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-700 max-w-[65%] truncate"
                            title={item.batchTitle}
                          >
                            <BookOpen className="h-3 w-3 shrink-0 text-slate-500" />
                            <span className="truncate">{item.batchTitle}</span>
                          </span>
                          <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 border border-amber-200 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                            <Clock className="h-3 w-3 text-amber-600" />
                            Starts at {startStr}
                          </span>
                        </div>

                        <h3 className="font-bold text-slate-900 text-sm leading-snug line-clamp-2 mb-1 group-hover:text-indigo-600 transition-colors">
                          {item.title}
                        </h3>

                        <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                          {item.subject && <span>{item.subject}</span>}
                          {item.faculty && <span>• {item.faculty}</span>}
                        </div>
                      </div>

                      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-slate-400">
                          Scheduled today
                        </span>
                        <Link
                          to="/my-batch/$slug"
                          params={{ slug: item.batchSlug }}
                          className="text-xs font-bold text-indigo-600 hover:text-indigo-700 transition-colors flex items-center gap-1"
                        >
                          View Batch →
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* 3. Empty State if Selected Batch has no classes today */}
            {currentBatchLiveClasses.length === 0 && currentBatchUpcomingClasses.length === 0 && (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-white/70 p-7 text-center flex flex-col items-center justify-center">
                <div className="w-11 h-11 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center mb-3 shadow-xs">
                  <Clock className="h-5 w-5 text-indigo-600" />
                </div>
                <h3 className="font-bold text-slate-800 text-sm sm:text-base mb-1">
                  No classes scheduled today for {selectedBatch?.title}
                </h3>
                <p className="text-xs text-slate-500 max-w-md mb-4">
                  Check back later or access all recorded lectures, notes, and DPPs for this batch.
                </p>
                <div className="flex items-center gap-3 flex-wrap justify-center">
                  {selectedBatch?.slug && (
                    <Link
                      to="/my-batch/$slug"
                      params={{ slug: selectedBatch.slug }}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-700 transition-colors shadow-xs"
                    >
                      <BookOpen className="h-3.5 w-3.5" />
                      <span>Open Batch Lectures</span>
                    </Link>
                  )}
                  {hasOtherBatchLive && (
                    <button
                      type="button"
                      onClick={() => {
                        const liveBatch = enrolledBatches.find((b) => batchLiveStatusMap.get(b.id));
                        if (liveBatch) setSelectedBatchId(liveBatch.id);
                      }}
                      className="inline-flex items-center gap-2 rounded-xl bg-red-50 border border-red-200 px-4 py-2 text-xs font-bold text-red-700 hover:bg-red-100 transition-colors"
                    >
                      <span className="relative flex h-2 w-2">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-90" />
                        <span className="relative inline-flex h-2 w-2 rounded-full bg-red-600" />
                      </span>
                      <span>Switch to Ongoing Live Class</span>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SECTION: My Learning (PW UI 3 Rounded Pastel Cards matching Image 4) */}
      <div className="mb-10">
        <h2 className="text-xl font-bold text-slate-800 mb-4 tracking-tight">My Learning</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {/* Card 1: My Batches (Light Lavender) */}
          <Link
            to="/my-batches"
            className="bg-[#F5F3FF] hover:bg-[#EDE9FE] transition-all rounded-2xl p-5 border border-[#DDD6FE]/70 shadow-xs flex flex-col justify-between group relative overflow-hidden"
          >
            <div>
              <div className="flex items-center justify-between mb-3.5">
                <div className="bg-white w-12 h-12 rounded-xl flex items-center justify-center shadow-xs border border-indigo-100">
                  <BookOpen className="h-6 w-6 text-indigo-600" />
                </div>
                {liveEnrolledClasses.length > 0 && (
                  <span className="relative overflow-hidden inline-flex items-center gap-1.5 rounded-full bg-red-600 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-white live-badge-glow border border-red-300/40">
                    <span className="live-shimmer" />
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-95" />
                      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-white" />
                    </span>
                    <Radio className="h-3 w-3" />
                    {liveEnrolledClasses.length} LIVE
                  </span>
                )}
              </div>
              <h3 className="font-bold text-slate-900 text-base mb-1">
                {(cfg as any).my_batches_title || "My Batches"}
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                {(cfg as any).my_batches_desc || "View list of the batches in which you are enrolled"}
              </p>
            </div>
          </Link>

          {/* Card 2: Recent Learning (Warm Peach) */}
          <Link
            to="/dashboard"
            className="bg-[#FFF7ED] hover:bg-[#FFEDD5] transition-all rounded-2xl p-5 border border-[#FED7AA]/70 shadow-xs flex flex-col justify-between group"
          >
            <div>
              <div className="bg-white w-12 h-12 rounded-xl flex items-center justify-center mb-3.5 shadow-xs border border-orange-100">
                <Clock className="h-6 w-6 text-orange-500" />
              </div>
              <h3 className="font-bold text-slate-900 text-base mb-1">
                {cfg.recent_learning_title || "Recent Learning"}
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                {cfg.recent_learning_desc || "View your past learning history"}
              </p>
            </div>
          </Link>

          {/* Card 3: My Doubts (Soft Mint Green) */}
          <Link
            to="/my-doubts"
            className="bg-[#F0FDF4] hover:bg-[#DCFCE7] transition-all rounded-2xl p-5 border border-[#BBF7D0]/70 shadow-xs flex flex-col justify-between group"
          >
            <div>
              <div className="bg-white w-12 h-12 rounded-xl flex items-center justify-center mb-3.5 shadow-xs border border-emerald-100">
                <MessageCircle className="h-6 w-6 text-emerald-600" />
              </div>
              <h3 className="font-bold text-slate-900 text-base mb-1">
                {cfg.my_doubts_title || "My Doubts"}
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                {cfg.my_doubts_desc || "View the list of your asked doubts in the lectures"}
              </p>
            </div>
          </Link>
        </div>
      </div>

      {/* SECTION: Explore (PW UI Rounded Cards matching Image 4) */}
      <div className="mb-10">
        <h2 className="text-xl font-bold text-slate-800 mb-4 tracking-tight">Explore</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {/* Card 1: PDF Bank */}
          <Link
            to="/free-study-material"
            className="bg-white hover:bg-slate-50/90 transition-all rounded-2xl p-5 border border-slate-200/90 shadow-xs flex flex-col justify-between group"
          >
            <div>
              <div className="bg-blue-50/90 w-12 h-12 rounded-xl flex items-center justify-center mb-3.5 border border-blue-100">
                <FileText className="h-6 w-6 text-blue-600" />
              </div>
              <h3 className="font-bold text-slate-900 text-base mb-1">
                {cfg.pdf_bank_title || "PDF Bank"}
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                {cfg.pdf_bank_desc || "Download your Study PDFs from one place"}
              </p>
            </div>
          </Link>

          {/* Card 2: Bookmarks */}
          <Link
            to="/dashboard"
            className="bg-white hover:bg-slate-50/90 transition-all rounded-2xl p-5 border border-slate-200/90 shadow-xs flex flex-col justify-between group"
          >
            <div>
              <div className="bg-purple-50/90 w-12 h-12 rounded-xl flex items-center justify-center mb-3.5 border border-purple-100">
                <Bookmark className="h-6 w-6 text-purple-600" />
              </div>
              <h3 className="font-bold text-slate-900 text-base mb-1">
                {cfg.bookmarks_title || "Bookmarks"}
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                {cfg.bookmarks_desc || "View the list of your saved questions."}
              </p>
            </div>
          </Link>
        </div>
      </div>

      {/* Promotional Banner Area */}
      <div className="mb-10 w-full overflow-hidden rounded-2xl bg-gradient-to-r from-red-600 to-red-800 relative shadow-sm text-white">
        <div className="absolute inset-0 opacity-20 pointer-events-none" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23ffffff\' fill-opacity=\'1\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")' }} />
        <div className="relative px-6 py-10 sm:px-12 flex flex-col items-center text-center">
           <div className="inline-block bg-yellow-400 text-yellow-900 text-xs font-bold px-3 py-1 rounded-full mb-4 uppercase tracking-widest shadow-sm">
             {cfg.banner_badge || "Enroll Now"}
           </div>
           <h2 className="text-3xl sm:text-4xl font-black uppercase tracking-wider mb-2">
             {cfg.banner_title_prefix || "Introducing"}
           </h2>
           <h3 className="text-4xl sm:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white to-red-200 mb-4">
             {cfg.banner_title_main || "SARVODAYA PRIME"}
           </h3>
           <p className="text-red-100 font-semibold mb-6 max-w-lg">
             {cfg.banner_subtitle || "TEST SERIES • DOUBTS • PREMIUM LECTURES"}
           </p>
           
           <div className="flex items-center gap-4">
              <Link to={cfg.banner_btn_link || "/batches"}>
                <button className="bg-white text-red-700 px-6 py-2.5 rounded-full font-bold shadow-lg hover:scale-105 transition-transform">
                  {cfg.banner_btn_text || "Explore Plan"}
                </button>
              </Link>
           </div>
        </div>
      </div>
      
      <div className="mt-8 text-right">
        <Button variant="ghost" onClick={handleSignOut} className="text-slate-500 hover:text-slate-700">
          <LogOut className="mr-2 h-4 w-4" /> Sign out
        </Button>
      </div>
    </div>
  );
}
