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
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Section } from "@/components/section";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { isClassLiveNow } from "@/lib/utils";

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
        supabase.from("live_classes").select("id, batch_id, title, is_live, status, scheduled_at, end_at, duration_minutes, recorded_lecture_id").then(res => res, () => ({ data: [], error: null })),
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

  // Find any active live class in student's enrolled batches
  const activeLiveClass = useMemo(() => {
    const enrolledBatchMap = new Map<string, any>();
    ((data?.enrollments as any[]) ?? []).forEach((e) => {
      const b = Array.isArray(e.batch) ? e.batch[0] : e.batch;
      if (b?.id) enrolledBatchMap.set(b.id, b);
    });

    for (const lc of (data as any)?.liveClasses ?? []) {
      if (!lc.batch_id || !enrolledBatchMap.has(lc.batch_id)) continue;
      if (isClassLiveNow(lc, nowTime)) {
        const b = enrolledBatchMap.get(lc.batch_id);
        return {
          ...lc,
          batchTitle: b.title,
          batchSlug: b.slug || b.id,
        };
      }
    }
    return null;
  }, [data?.enrollments, (data as any)?.liveClasses, nowTime]);

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

      {/* Top Header Area for Streak/XP */}
      <div className="flex justify-between items-center mb-6">
         <h1 className="text-xl font-bold text-slate-800">{cfg.greeting || "Study"}</h1>
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

      {/* ACTIVE LIVE CLASS BANNER */}
      {activeLiveClass && (
        <Link
          to="/my-batch/$slug"
          params={{ slug: activeLiveClass.batchSlug }}
          className="mb-8 block group"
        >
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-red-600 via-rose-600 to-red-700 p-4 sm:p-5 text-white shadow-[0_0_25px_rgba(239,68,68,0.35)] ring-2 ring-red-400/60 transition-all hover:scale-[1.01] hover:shadow-[0_0_35px_rgba(239,68,68,0.5)]">
            <span className="live-shimmer" />
            <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-xs text-white shadow-inner">
                  <Radio className="h-6 w-6 animate-pulse" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-0.5 text-[10px] font-black uppercase text-red-600 shadow-xs">
                      <span className="h-1.5 w-1.5 rounded-full bg-red-600 animate-ping" />
                      LIVE CLASS NOW
                    </span>
                    <span className="text-xs font-bold text-red-100">
                      {activeLiveClass.batchTitle}
                    </span>
                  </div>
                  <h4 className="text-base sm:text-lg font-bold text-white mt-1 line-clamp-1">
                    {activeLiveClass.title}
                  </h4>
                </div>
              </div>
              <span className="shrink-0 rounded-full bg-white px-5 py-2 text-xs font-black text-red-600 shadow-md transition-transform group-hover:scale-105 flex items-center gap-1.5">
                Join Live Class Now →
              </span>
            </div>
          </div>
        </Link>
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
                {activeLiveClass && (
                  <span className="relative overflow-hidden inline-flex items-center gap-1.5 rounded-full bg-red-600 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-white live-badge-glow border border-red-300/40">
                    <span className="live-shimmer" />
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-95" />
                      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-white" />
                    </span>
                    <Radio className="h-3 w-3" />
                    LIVE NOW
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
