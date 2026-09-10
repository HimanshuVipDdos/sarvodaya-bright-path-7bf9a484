import { useState, useMemo, useEffect } from "react";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import {
  ArrowLeft, Video, FileText, ClipboardList, Radio, Clock,
  BookOpen, Bell, Share2, Search, Download, Paperclip, MoreVertical,
  LayoutGrid, Play, User, CheckCircle2, Calendar, Sparkles, ChevronRight,
  GraduationCap, HelpCircle, Layers, ExternalLink
} from "lucide-react";
import { AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { TheaterModal, type TheaterLecture } from "@/components/theater-modal";
import { DocumentViewer } from "@/components/document-viewer";
import { cn, getStorageUrl, isClassLiveNow } from "@/lib/utils";

const batchPortalQuery = (slug: string) =>
  queryOptions({
    queryKey: ["my-batch", slug],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) throw new Error("Not signed in");

      // Try finding batch by slug first, fallback to id
      let { data: batch } = await supabase
        .from("batches")
        .select("*")
        .eq("slug", slug)
        .maybeSingle();

      if (!batch) {
        const { data: byId } = await supabase
          .from("batches")
          .select("*")
          .eq("id", slug)
          .maybeSingle();
        batch = byId;
      }

      if (!batch) throw notFound();

      const { data: enrollment } = await supabase
        .from("enrollments")
        .select("*")
        .eq("user_id", userId)
        .eq("batch_id", batch.id)
        .maybeSingle();

      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);
      const isAdmin = (roles ?? []).some((r) => r.role === "admin");

      if (!enrollment && !isAdmin) {
        return {
          userId,
          batch,
          enrolled: false,
          lectures: [],
          liveClasses: [],
          materials: [],
          notifications: [],
          tests: [],
        };
      }

      try {
        await supabase.rpc("tick_live_classes" as never);
      } catch {
        // ignore if rpc does not exist
      }

      const [lectures, liveClasses, materials, notifications, batchTests, freeTests, myAttempts, facultyList] =
        await Promise.all([
          supabase
            .from("lectures")
            .select("*")
            .eq("batch_id", batch.id)
            .eq("is_published", true),
          supabase
            .from("live_classes")
            .select("*")
            .eq("batch_id", batch.id)
            .order("scheduled_at", { ascending: false }),
          supabase
            .from("study_materials")
            .select("*")
            .eq("batch_id", batch.id)
            .order("created_at", { ascending: false }),
          supabase
            .from("notifications")
            .select("*")
            .order("created_at", { ascending: false })
            .limit(10),
          supabase
            .from("cbt_tests")
            .select("id,title,description,duration_minutes")
            .eq("batch_id", batch.id)
            .eq("is_published", true),
          supabase
            .from("cbt_tests")
            .select("id,title,description,duration_minutes")
            .eq("access_mode", "free")
            .eq("is_published", true),
          supabase
            .from("cbt_attempts")
            .select("test_id,status,score,max_score")
            .eq("user_id", userId),
          supabase
            .from("faculty")
            .select("id,name,photo_url")
            .eq("is_active", true),
        ]);

      const attemptByTest = new Map((myAttempts.data ?? []).map((a) => [a.test_id, a]));
      const tests = [...(batchTests.data ?? []), ...(freeTests.data ?? [])].map((t) => ({
        ...t,
        attempt: attemptByTest.get(t.id) ?? null,
      }));

      return {
        userId,
        batch,
        enrolled: true,
        lectures: lectures.data ?? [],
        liveClasses: liveClasses.data ?? [],
        materials: materials.data ?? [],
        notifications: notifications.data ?? [],
        facultyList: facultyList.data ?? [],
        tests,
      };
    },
  });

export const Route = createFileRoute("/_authenticated/my-batch/$slug")({
  validateSearch: (search: Record<string, unknown>) => ({
    liveClassId: typeof search.liveClassId === "string" ? search.liveClassId : undefined,
  }),
  loader: ({ context, params }) => context.queryClient.ensureQueryData(batchPortalQuery(params.slug)),
  component: BatchPortal,
  errorComponent: ({ error, reset }: any) => {
    console.error("BatchPortal Error Boundary caught:", error);
    const isChunkOrInitError =
      error?.message?.includes("dynamically imported module") ||
      error?.message?.includes("Failed to fetch") ||
      error?.message?.includes("Loading chunk") ||
      error?.message?.includes("is not defined") ||
      error?.message?.includes("before initialization") ||
      error?.message?.includes("Cannot access");

    const handleRetry = () => {
      if (typeof window !== "undefined") {
        try {
          const url = new URL(window.location.href);
          url.searchParams.set("_reload", Date.now().toString());
          window.location.replace(url.toString());
        } catch {
          window.location.reload();
        }
      } else if (reset) {
        reset();
      }
    };

    return (
      <div className="flex min-h-screen w-full items-center justify-center p-4 bg-slate-50">
        <div className="max-w-md w-full bg-white rounded-3xl p-8 text-center shadow-sm border">
          <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">
            {isChunkOrInitError ? "Update Available" : "This page didn't load"}
          </h2>
          <p className="text-slate-500 text-sm mb-2">
            {isChunkOrInitError
              ? "A fresh update was deployed. Please click below to load the latest version."
              : error?.message || "Something went wrong."}
          </p>
          <p className="text-xs text-slate-400 mb-6">
            Click below to refresh and load the class.
          </p>
          <div className="flex justify-center gap-3">
            <Button onClick={handleRetry} className="bg-[#6043ED] hover:bg-[#4E36C2]">
              Reload Page
            </Button>
            <Button variant="outline" asChild>
              <Link to="/dashboard">Go Home</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  },
});

type MainTab = "All Classes" | "Description" | "Tests" | "Notice Board";
type SubTab = "Lectures" | "Notes" | "DPP" | "DPP VIDEOS";

// Pastel colors for subject icons
const pastelColors = [
  "bg-blue-50 text-blue-600 border-blue-200",
  "bg-purple-50 text-purple-600 border-purple-200",
  "bg-emerald-50 text-emerald-600 border-emerald-200",
  "bg-amber-50 text-amber-600 border-amber-200",
  "bg-rose-50 text-rose-600 border-rose-200",
  "bg-cyan-50 text-cyan-600 border-cyan-200",
];

function BatchPortal() {
  const { slug } = Route.useParams();
  const { data } = useSuspenseQuery(batchPortalQuery(slug));
  const search = Route.useSearch();

  const [mainTab, setMainTab] = useState<MainTab>("All Classes");

  // Drill-down UI state
  const [activeSubject, setActiveSubject] = useState<string | null>(null);
  const [activeChapter, setActiveChapter] = useState<string | null>(null);
  const [subTab, setSubTab] = useState<SubTab>("Lectures");

  // Theater state
  const [theaterOpen, setTheaterOpen] = useState(false);
  const [playingVideo, setPlayingVideo] = useState<any>(null);
  const [docUrl, setDocUrl] = useState<string | null>(null);
  const [docTitle, setDocTitle] = useState<string>("");

  const [nowTime, setNowTime] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNowTime(Date.now()), 5000);
    return () => clearInterval(timer);
  }, []);

  const batch = data?.batch;
  const lectures = useMemo(() => data?.lectures ?? [], [data?.lectures]);
  const materials = useMemo(() => data?.materials ?? [], [data?.materials]);
  const liveClasses = useMemo(() => data?.liveClasses ?? [], [data?.liveClasses]);
  const tests = useMemo(() => data?.tests ?? [], [data?.tests]);
  const notifications = useMemo(() => data?.notifications ?? [], [data?.notifications]);

  const facultyPhotoMap = useMemo(() => {
    const map = new Map<string, string>();
    (data?.facultyList ?? []).forEach((f: any) => {
      if (f.name && f.photo_url) {
        map.set(f.name.toLowerCase().trim(), f.photo_url);
      }
    });
    return map;
  }, [data?.facultyList]);

  // Derive Subjects and Chapters with stable useMemo
  const { subjectsMap, subjects } = useMemo(() => {
    const map = new Map<string, { chapters: Set<string> }>();

    liveClasses.forEach((l: any) => {
      const s = l.subject || "General";
      const c = l.chapter || "Overview & Lectures";
      if (!map.has(s)) map.set(s, { chapters: new Set() });
      map.get(s)!.chapters.add(c);
    });

    lectures.forEach((l: any) => {
      const s = l.subject || "General";
      const c = l.chapter || "Overview & Lectures";
      if (!map.has(s)) map.set(s, { chapters: new Set() });
      map.get(s)!.chapters.add(c);
    });

    materials.forEach((m: any) => {
      const s = m.subject || "General";
      const c = m.chapter || "Overview & Lectures";
      if (!map.has(s)) map.set(s, { chapters: new Set() });
      map.get(s)!.chapters.add(c);
    });

    return {
      subjectsMap: map,
      subjects: Array.from(map.keys()).sort(),
    };
  }, [liveClasses, lectures, materials]);

  // Content for active drill-down
  const chapters = useMemo(() => {
    if (!activeSubject) return [];
    return Array.from(subjectsMap.get(activeSubject)?.chapters || []).sort();
  }, [activeSubject, subjectsMap]);

  // Today's Live Classes (Active or Scheduled for today)
  const todayLiveClasses = useMemo(() => {
    const today = new Date().toDateString();
    const list = liveClasses.filter((l: any) => {
      if (l.status === "live" || l.is_live) return true;
      if (l.scheduled_at) {
        return new Date(l.scheduled_at).toDateString() === today;
      }
      return false;
    });

    // Sequence logic:
    // 1. Live classes first (sorted chronologically by scheduled time)
    // 2. Upcoming classes sorted chronologically by scheduled_at asc (e.g. 10:00 AM, 12:00 PM, 04:00 PM, 07:00 PM)
    return list.sort((a: any, b: any) => {
      const aLive = a.status === "live" || a.is_live;
      const bLive = b.status === "live" || b.is_live;
      if (aLive && !bLive) return -1;
      if (!aLive && bLive) return 1;

      const aTime = a.scheduled_at ? new Date(a.scheduled_at).getTime() : 0;
      const bTime = b.scheduled_at ? new Date(b.scheduled_at).getTime() : 0;
      return aTime - bTime;
    });
  }, [liveClasses]);

  const formatClassTiming = (scheduledAt?: string | null, endAt?: string | null, durationMinutes?: number | null) => {
    if (!scheduledAt) return null;
    const start = new Date(scheduledAt);
    const startStr = start.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    if (endAt) {
      const end = new Date(endAt);
      const endStr = end.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      return `${startStr} - ${endStr}`;
    } else if (durationMinutes && durationMinutes > 0) {
      const end = new Date(start.getTime() + durationMinutes * 60000);
      const endStr = end.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      return `${startStr} - ${endStr}`;
    }
    return startStr;
  };

  // Canonical merged lectures list for the batch with 100% deduplication
  const allBatchLectures = useMemo(() => {
    // 1. Existing lectures from the `lectures` table
    const recMap = new Map<string, any>();
    const baseLectures = (lectures ?? []).map((l: any) => ({
      ...l,
      isLive: false,
      video_url: l.video_url || l.youtube_url,
      subtitle: [l.subject, l.chapter].filter(Boolean).join(" • "),
    }));

    // Index lectures by id, by video_url, and by normalized title+chapter
    baseLectures.forEach((lec: any) => {
      if (lec.id) recMap.set(`id:${lec.id}`, lec);
      if (lec.video_url) recMap.set(`url:${lec.video_url.trim()}`, lec);
      if (lec.title && lec.chapter) {
        recMap.set(
          `title:${lec.title.trim().toLowerCase()}__${lec.chapter.trim().toLowerCase()}`,
          lec
        );
      }
    });

    // 2. Process live_classes
    const mergedList = [...baseLectures];

    (liveClasses ?? []).forEach((lc: any) => {
      const isLiveNow = isClassLiveNow(lc, nowTime);
      const urlKey = (lc.youtube_url || lc.video_url || "").trim();
      const titleKey =
        lc.title && lc.chapter
          ? `${lc.title.trim().toLowerCase()}__${lc.chapter.trim().toLowerCase()}`
          : "";

      const duplicateIdx = mergedList.findIndex((m: any) => {
        if (lc.recorded_lecture_id && m.id === lc.recorded_lecture_id) return true;
        if (urlKey && m.video_url && m.video_url.trim() === urlKey) return true;
        if (titleKey && m.title && m.chapter) {
          const mKey = `${m.title.trim().toLowerCase()}__${m.chapter.trim().toLowerCase()}`;
          if (mKey === titleKey) return true;
        }
        return false;
      });

      if (isLiveNow) {
        // If class is currently LIVE:
        // If a duplicate archived lecture was found, remove it so the LIVE version replaces it!
        if (duplicateIdx !== -1) {
          mergedList.splice(duplicateIdx, 1);
        }
        // Add the shining live class at the top
        mergedList.unshift({
          ...lc,
          isLive: true,
          video_url: lc.youtube_url || lc.video_url,
          subtitle: [lc.subject, lc.chapter].filter(Boolean).join(" • "),
        });
      } else {
        // Class is NOT live (ended or scheduled)
        // If it already exists in lectures table, DO NOT add a duplicate!
        if (duplicateIdx === -1) {
          // If the class has ended or has a recording, but wasn't in lectures table, include it once as recorded lecture
          if (
            lc.status === "ended" ||
            (!lc.is_live && lc.scheduled_at && new Date(lc.scheduled_at).getTime() < nowTime)
          ) {
            mergedList.push({
              ...lc,
              isLive: false,
              video_url: lc.youtube_url || lc.video_url,
              subtitle: [lc.subject, lc.chapter].filter(Boolean).join(" • "),
            });
          }
        }
      }
    });

    return mergedList;
  }, [liveClasses, lectures, nowTime]);

  const chapterLectures = useMemo(() => {
    if (!activeSubject || !activeChapter) return [];
    return allBatchLectures
      .filter(
        (l: any) =>
          (l.subject === activeSubject || (!l.subject && activeSubject === "General")) &&
          (l.chapter === activeChapter || (!l.chapter && activeChapter === "Overview & Lectures"))
      )
      .sort((a: any, b: any) => {
        if (a.isLive && !b.isLive) return -1;
        if (!a.isLive && b.isLive) return 1;
        return (
          new Date(b.created_at || b.scheduled_at || 0).getTime() -
          new Date(a.created_at || a.scheduled_at || 0).getTime()
        );
      });
  }, [allBatchLectures, activeSubject, activeChapter]);

  const chapterNotes = useMemo(() => {
    if (!activeSubject || !activeChapter) return [];
    return materials.filter(
      (m: any) =>
        (m.subject === activeSubject || (!m.subject && activeSubject === "General")) &&
        (m.chapter === activeChapter || (!m.chapter && activeChapter === "Overview & Lectures")) &&
        m.material_type !== "dpp"
    );
  }, [materials, activeSubject, activeChapter]);

  const chapterDpps = useMemo(() => {
    if (!activeSubject || !activeChapter) return [];
    return materials.filter(
      (m: any) =>
        (m.subject === activeSubject || (!m.subject && activeSubject === "General")) &&
        (m.chapter === activeChapter || (!m.chapter && activeChapter === "Overview & Lectures")) &&
        m.material_type === "dpp"
    );
  }, [materials, activeSubject, activeChapter]);

  const chapterDppVideos = useMemo(() => {
    if (!activeSubject || !activeChapter) return [];
    return chapterLectures.filter(
      (l: any) =>
        l.title?.toLowerCase().includes("dpp") ||
        l.description?.toLowerCase().includes("dpp") ||
        l.chapter?.toLowerCase().includes("dpp")
    );
  }, [chapterLectures, activeSubject, activeChapter]);

  const allNotes = useMemo(
    () => materials.filter((m: any) => m.material_type !== "dpp"),
    [materials]
  );
  const allDpps = useMemo(
    () => materials.filter((m: any) => m.material_type === "dpp"),
    [materials]
  );

  // Completion Tracking for Lectures & Classes (PW Style)
  const userId = data?.userId || "user";
  const batchId = batch?.id || "batch";
  const storageKey = `sarvodaya_completed_lectures_${userId}_${batchId}`;

  const [completedIds, setCompletedIds] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set();
    try {
      const saved = localStorage.getItem(`sarvodaya_completed_lectures_${userId}_${batchId}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return new Set(parsed);
      }
    } catch {
      // ignore
    }
    return new Set();
  });

  const toggleComplete = (lectureId: string, lectureTitle?: string) => {
    setCompletedIds((prev) => {
      const next = new Set(prev);
      const isNowCompleted = !next.has(lectureId);
      if (isNowCompleted) {
        next.add(lectureId);
        toast.success(
          lectureTitle
            ? `Marked "${lectureTitle}" as completed! 🎉`
            : "Class marked as completed! 🎉"
        );
      } else {
        next.delete(lectureId);
        toast.info(
          lectureTitle
            ? `Marked "${lectureTitle}" as incomplete`
            : "Class marked as incomplete"
        );
      }
      try {
        localStorage.setItem(storageKey, JSON.stringify(Array.from(next)));
      } catch {
        // ignore
      }
      return next;
    });
  };

  const totalLecturesCount = allBatchLectures.length;
  const completedCount = useMemo(
    () => allBatchLectures.filter((l: any) => completedIds.has(l.id)).length,
    [allBatchLectures, completedIds]
  );
  const progressPercent =
    totalLecturesCount > 0
      ? Math.round((completedCount / totalLecturesCount) * 100)
      : 0;

  const playVideo = (item: any) => {
    const isLive = Boolean(
      item.isLive ?? item.is_live ?? (item.scheduled_at && !item.recorded_lecture_id && isClassLiveNow(item, nowTime))
    );
    setPlayingVideo({
      id: item.id,
      src: isLive ? item.youtube_url || item.video_url : item.video_url || item.youtube_url,
      poster: item.thumbnail_url,
      title: item.title,
      subject: item.subject,
      chapter: item.chapter,
      lecture_number: item.lecture_number,
      description: item.description,
      isLive,
    });
    setTheaterOpen(true);
  };

  const openDoc = (url: string | null, title: string) => {
    if (!url) return toast.error("No file attached");
    setDocUrl(url);
    setDocTitle(title);
  };

  // If student was redirected from Dashboard with ?liveClassId=..., automatically launch theater player
  useEffect(() => {
    const targetId = search?.liveClassId || (typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("liveClassId") : null);
    if (targetId && liveClasses && liveClasses.length > 0) {
      const target = liveClasses.find((lc: any) => lc.id === targetId);
      if (target) {
        playVideo(target);
      }
    }
  }, [liveClasses, search?.liveClassId]);

  // Safe early return for non-enrolled students AFTER all hooks are evaluated
  if (!data?.enrolled) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] py-16 px-4">
        <div className="mx-auto max-w-lg bg-white border border-slate-200/80 rounded-3xl p-10 text-center shadow-sm">
          <BookOpen className="mx-auto h-12 w-12 text-indigo-300 mb-4" />
          <h1 className="text-2xl font-bold text-slate-900">{data?.batch?.title || "Batch"}</h1>
          <p className="mt-2 text-sm text-slate-500">You haven't enrolled in this batch yet.</p>
          <div className="mt-6 flex justify-center gap-3">
            <Button asChild className="rounded-xl bg-[#6043ED] hover:bg-[#4E36C2]">
              <Link to="/batches">Browse Batches</Link>
            </Button>
            <Button variant="outline" asChild className="rounded-xl">
              <Link to="/dashboard">Go to Dashboard</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ----------------------------------------------------
  // RENDER: LEVEL 1 (PW Purple Banner + Tabs + Subjects)
  // ----------------------------------------------------
  if (!activeSubject) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] pb-24 font-sans text-slate-900">
        {/* PW Deep Purple Header Banner */}
        <div className="bg-gradient-to-r from-[#5338D9] via-[#6043ED] to-[#7B61FF] text-white pt-8 pb-6 px-4 sm:px-6 relative overflow-hidden shadow-inner">
          <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/3 blur-3xl pointer-events-none"></div>
          <div className="mx-auto max-w-7xl relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-white/20 text-white backdrop-blur-sm">
                  {batch.target_exam || "Full Course"}
                </span>
                {batch.validity_info && (
                  <span className="text-xs text-white/80 font-medium">
                    Valid till: {batch.validity_info}
                  </span>
                )}
              </div>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight">
                {batch.title}
              </h1>
              {batch.description && (
                <p className="mt-2 text-sm text-white/85 max-w-3xl line-clamp-2">
                  {batch.description}
                </p>
              )}
            </div>

            <div className="flex items-center gap-3 shrink-0 flex-wrap">
              {totalLecturesCount > 0 && (
                <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3 border border-white/15 min-w-[200px]">
                  <div className="flex items-center justify-between text-xs font-bold mb-1.5">
                    <span className="flex items-center gap-1.5 text-white">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" /> Course Progress
                    </span>
                    <span className="text-emerald-300 font-mono">{progressPercent}%</span>
                  </div>
                  <div className="w-full bg-white/20 rounded-full h-2 overflow-hidden mb-1">
                    <div
                      className="bg-emerald-400 h-full rounded-full transition-all duration-500"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                  <div className="text-[11px] text-white/75 font-medium flex items-center justify-between">
                    <span>{completedCount} of {totalLecturesCount} Completed</span>
                  </div>
                </div>
              )}

              <button
                onClick={() => {
                  navigator.clipboard?.writeText(window.location.href);
                  toast.success("Batch link copied to clipboard!");
                }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-white text-xs font-semibold backdrop-blur-sm transition h-fit"
              >
                <Share2 className="w-3.5 h-3.5" /> Share
              </button>
            </div>
          </div>
        </div>

        {/* White Sub-tabs Bar */}
        <div className="bg-white border-b border-slate-200/80 sticky top-0 z-20 shadow-sm">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="flex gap-6 overflow-x-auto scrollbar-hide">
              {(["All Classes", "Description", "Tests", "Notice Board"] as MainTab[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setMainTab(t)}
                  className={cn(
                    "py-3.5 text-sm font-bold whitespace-nowrap border-b-2 transition-all",
                    mainTab === t
                      ? "border-[#6043ED] text-[#6043ED]"
                      : "border-transparent text-slate-500 hover:text-slate-800"
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8">
          {mainTab === "All Classes" && (
            <>
              {/* Today's Classes / Live Classes Section (PW Style) */}
              {todayLiveClasses.length > 0 && (
                <div className="mb-10">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <span className="flex h-3 w-3 relative">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500"></span>
                      </span>
                      <h2 className="text-lg font-black text-slate-900 uppercase tracking-wide">
                        Today's Classes & Live
                      </h2>
                    </div>
                    <span className="text-xs font-semibold text-slate-500">
                      {todayLiveClasses.length} Scheduled
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {todayLiveClasses.map((item: any) => {
                      const isCurrentlyLive = item.status === "live" || item.is_live;
                      const isScheduledTimeReached = !item.scheduled_at || new Date(item.scheduled_at).getTime() <= nowTime;
                      const canJoin = isCurrentlyLive || isScheduledTimeReached;
                      const timingText = formatClassTiming(item.scheduled_at, item.end_at, item.duration_minutes);
                      const startText = item.scheduled_at
                        ? new Date(item.scheduled_at).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "Today";

                      return (
                        <div
                          key={item.id}
                          className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-sm hover:shadow-md transition-all flex flex-col justify-between group"
                        >
                          <div>
                            <div className="flex items-center justify-between gap-2 mb-2">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {isCurrentlyLive ? (
                                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-rose-500 text-white animate-pulse shadow-2xs">
                                    <Radio className="w-3 h-3" /> LIVE NOW
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                    <Clock className="w-3 h-3 text-amber-600" />
                                    Starts at {startText}
                                  </span>
                                )}

                                {timingText && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200/80 font-mono">
                                    <Clock className="w-3 h-3 text-slate-500" />
                                    {timingText}
                                  </span>
                                )}

                                {completedIds.has(item.id) && (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-600 text-white shadow-xs">
                                    <CheckCircle2 className="w-3 h-3" /> Completed
                                  </span>
                                )}
                              </div>

                              <span className="text-xs font-semibold text-slate-400 shrink-0">
                                {item.subject || "Live Session"}
                              </span>
                            </div>

                            <h3 className="font-bold text-slate-900 text-base line-clamp-2 mt-1 group-hover:text-[#6043ED] transition-colors">
                              {item.title}
                            </h3>
                            {item.chapter && (
                              <p className="text-xs font-medium text-slate-500 mt-1">
                                {item.chapter}
                              </p>
                            )}
                          </div>

                          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2 flex-wrap">
                            <span className="text-xs text-slate-500 truncate max-w-[130px]">
                              By {item.faculty || "Faculty"}
                            </span>
                            <div className="flex items-center gap-2 shrink-0">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleComplete(item.id, item.title);
                                }}
                                title={completedIds.has(item.id) ? "Mark as Incomplete" : "Mark as Complete"}
                                className={cn(
                                  "inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold transition active:scale-95 border",
                                  completedIds.has(item.id)
                                    ? "bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100"
                                    : "bg-slate-50 text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 hover:border-emerald-300 border-slate-200"
                                )}
                              >
                                <CheckCircle2
                                  className={cn(
                                    "w-3.5 h-3.5",
                                    completedIds.has(item.id) ? "text-emerald-600 fill-emerald-100" : "text-slate-400"
                                  )}
                                />
                                <span>{completedIds.has(item.id) ? "Completed" : "Complete"}</span>
                              </button>

                              {canJoin ? (
                                <Button
                                  size="sm"
                                  onClick={() => playVideo(item)}
                                  className={cn(
                                    "rounded-xl font-bold gap-1.5 shadow-sm shrink-0",
                                    isCurrentlyLive
                                      ? "bg-rose-600 hover:bg-rose-700 text-white"
                                      : "bg-[#6043ED] hover:bg-[#4E36C2] text-white"
                                  )}
                                >
                                  <Play className="w-3.5 h-3.5 fill-current" />
                                  {isCurrentlyLive ? "Watch Live" : "Join Class"}
                                </Button>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 text-amber-800 border border-amber-200/80 text-xs font-bold shrink-0 shadow-2xs">
                                  <Clock className="w-3.5 h-3.5 text-amber-600" />
                                  Starts at {startText}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Subjects Header */}
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-xl font-extrabold text-slate-900">Subjects</h2>
                  <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                    Select your subject to explore chapters, lectures, notes & DPPs
                  </p>
                </div>
              </div>

              {/* Subjects Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {subjects.length === 0 ? (
                  <div className="col-span-full py-16 text-center bg-white rounded-2xl border border-dashed border-slate-200">
                    <BookOpen className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                    <p className="text-sm font-semibold text-slate-600">No subjects available yet.</p>
                    <p className="text-xs text-slate-400 mt-1">Lectures and chapters will appear here once published.</p>
                  </div>
                ) : (
                  subjects.map((s, idx) => {
                    const color = pastelColors[idx % pastelColors.length];
                    const chapterCount = subjectsMap.get(s)?.chapters.size || 0;
                    return (
                      <button
                        key={s}
                        onClick={() => setActiveSubject(s)}
                        className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200/80 hover:border-[#6043ED]/40 hover:shadow-md transition-all flex items-center justify-between text-left group"
                      >
                        <div className="flex items-center gap-4 min-w-0">
                          <div
                            className={cn(
                              "w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border",
                              color
                            )}
                          >
                            <LayoutGrid className="w-6 h-6" />
                          </div>
                          <div className="min-w-0">
                            <h3 className="font-bold text-slate-900 text-sm truncate group-hover:text-[#6043ED] transition-colors">
                              {s}
                            </h3>
                            <p className="text-xs text-slate-500 mt-0.5">
                              {chapterCount} {chapterCount === 1 ? "Chapter" : "Chapters"}
                            </p>
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-[#6043ED] group-hover:translate-x-0.5 transition-all shrink-0" />
                      </button>
                    );
                  })
                )}
              </div>
            </>
          )}

          {/* DESCRIPTION TAB (PW Style Overview) */}
          {mainTab === "Description" && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm">
                  <h3 className="text-lg font-bold text-slate-900 mb-3">About This Batch</h3>
                  <p className="text-sm leading-relaxed text-slate-600 whitespace-pre-line">
                    {batch.description ||
                      "This comprehensive batch covers complete concepts, practice problems, live doubt clearing, and regular CBT test series to prepare you thoroughly for your examination."}
                  </p>
                </div>

                <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm">
                  <h3 className="text-lg font-bold text-slate-900 mb-4">What You Will Get</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-lg bg-indigo-50 text-[#6043ED]">
                        <Video className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-slate-900">Live & Recorded Lectures</h4>
                        <p className="text-xs text-slate-500">Watch classes anytime with unlimited views.</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-slate-900">Class Notes & PDFs</h4>
                        <p className="text-xs text-slate-500">Download high-quality handwritten notes.</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-lg bg-amber-50 text-amber-600">
                        <ClipboardList className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-slate-900">Daily Practice Problems (DPP)</h4>
                        <p className="text-xs text-slate-500">Chapter-wise DPPs with detailed video solutions.</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-lg bg-rose-50 text-rose-600">
                        <GraduationCap className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-slate-900">CBT Mock Test Series</h4>
                        <p className="text-xs text-slate-500">Real NTA/CBT exam environment with rank analysis.</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Sidebar Quick Info */}
              <div className="space-y-4">
                <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm">
                  <h4 className="font-bold text-slate-900 text-sm mb-4">Course Highlights</h4>
                  <ul className="space-y-3 text-xs text-slate-600">
                    <li className="flex items-center justify-between pb-2 border-b border-slate-100">
                      <span className="text-slate-400">Target Exam</span>
                      <span className="font-bold text-slate-800">{batch.target_exam || "All Exams"}</span>
                    </li>
                    <li className="flex items-center justify-between pb-2 border-b border-slate-100">
                      <span className="text-slate-400">Total Subjects</span>
                      <span className="font-bold text-slate-800">{subjects.length} Subjects</span>
                    </li>
                    <li className="flex items-center justify-between pb-2 border-b border-slate-100">
                      <span className="text-slate-400">Total Lectures</span>
                      <span className="font-bold text-slate-800">{lectures.length + liveClasses.length} Lectures</span>
                    </li>
                    <li className="flex items-center justify-between">
                      <span className="text-slate-400">Test Series</span>
                      <span className="font-bold text-slate-800">{tests.length} CBT Tests</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* TESTS TAB */}
          {mainTab === "Tests" && (
            <div>
              <div className="mb-4">
                <h2 className="text-xl font-extrabold text-slate-900">Batch CBT Tests & Quizzes</h2>
                <p className="text-xs text-slate-500 mt-0.5">Attempt Computer Based Tests to track your preparation</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {tests.length === 0 ? (
                  <div className="col-span-2 py-16 text-center bg-white rounded-2xl border border-dashed border-slate-200">
                    <GraduationCap className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                    <p className="text-sm font-semibold text-slate-600">No tests scheduled for this batch yet.</p>
                  </div>
                ) : (
                  tests.map((t) => (
                    <div
                      key={t.id}
                      className="border bg-white rounded-2xl p-6 shadow-sm flex flex-col justify-between hover:shadow-md transition-all"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[10px] font-black text-[#6043ED] bg-[#6043ED]/10 px-2.5 py-1 rounded-md uppercase tracking-wider">
                            CBT Test
                          </span>
                          <span className="text-xs font-semibold text-slate-500">
                            {t.duration_minutes} Mins
                          </span>
                        </div>
                        <h3 className="text-lg font-bold text-slate-900 mb-1">{t.title}</h3>
                        <p className="text-xs text-slate-500 line-clamp-2 mb-4">
                          {t.description || "Comprehensive assessment covering syllabus."}
                        </p>
                      </div>

                      {t.attempt?.status === "completed" ? (
                        <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-100">
                          <div>
                            <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                              Score
                            </p>
                            <p className="text-lg font-black text-emerald-600">
                              {t.attempt.score}{" "}
                              <span className="text-xs font-semibold text-emerald-600/50">
                                / {t.attempt.max_score}
                              </span>
                            </p>
                          </div>
                          <Button variant="outline" size="sm" asChild className="rounded-xl">
                            <Link to="/cbt/$testId/result" params={{ testId: t.id }}>
                              View Analysis
                            </Link>
                          </Button>
                        </div>
                      ) : (
                        <Button
                          asChild
                          className="w-full rounded-xl bg-[#6043ED] hover:bg-[#4E36C2] mt-4 shadow-sm"
                        >
                          <Link to="/cbt/$testId" params={{ testId: t.id }}>
                            Start Test
                          </Link>
                        </Button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* NOTICE BOARD TAB */}
          {mainTab === "Notice Board" && (
            <div className="max-w-3xl space-y-4">
              <h2 className="text-xl font-extrabold text-slate-900 mb-2">Notice Board & Announcements</h2>
              {notifications.length === 0 ? (
                <div className="py-16 text-center bg-white rounded-2xl border border-dashed border-slate-200">
                  <Bell className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-slate-600">No announcements yet.</p>
                </div>
              ) : (
                notifications.map((n: any) => (
                  <div
                    key={n.id}
                    className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-start gap-4"
                  >
                    <div className="p-2.5 rounded-xl bg-purple-50 text-[#6043ED] shrink-0">
                      <Bell className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm">{n.title}</h4>
                      <p className="text-xs text-slate-600 mt-1 leading-relaxed">{n.message || n.body}</p>
                      <span className="text-[10px] font-semibold text-slate-400 mt-2 block">
                        {new Date(n.created_at).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Theater Modal — was missing from this view, which is why "Join
            Class" here updated state but nothing ever appeared on screen.
            It only worked once you'd drilled into a chapter's lecture list
            (the other return block below, which already had it). */}
        {theaterOpen && playingVideo && (
          <TheaterModal
            open={theaterOpen}
            onClose={() => setTheaterOpen(false)}
            videoSrc={playingVideo.src}
            poster={playingVideo.poster}
            title={playingVideo.title}
            meta={playingVideo.isLive ? "Live Class" : "Recorded Lecture"}
            liveClassId={playingVideo.isLive ? playingVideo.id : undefined}
            currentLecture={playingVideo}
            activeLectureId={playingVideo.id}
            isCompleted={completedIds.has(playingVideo.id)}
            onToggleComplete={() => toggleComplete(playingVideo.id, playingVideo.title)}
            lectures={allBatchLectures}
            notes={allNotes}
            dpp={allDpps}
            onSelectLecture={(id) => {
              const found = allBatchLectures.find((l: any) => l.id === id);
              if (found) playVideo(found);
            }}
          />
        )}
      </div>
    );
  }

  // ----------------------------------------------------
  // RENDER: LEVEL 2 (Chapters List for activeSubject)
  // ----------------------------------------------------
  if (!activeChapter) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] pb-24 font-sans text-slate-900">
        {/* Navigation Bar */}
        <div className="bg-white border-b border-slate-200/80 sticky top-0 z-20 px-4 sm:px-6 py-3.5 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setActiveSubject(null)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-100 transition"
            >
              <ArrowLeft className="w-4 h-4" /> All Subjects
            </button>
            <span className="text-slate-300">/</span>
            <span className="text-sm font-extrabold text-slate-900">{activeSubject}</span>
          </div>
        </div>

        <div className="mx-auto max-w-5xl px-4 sm:px-6 py-8">
          <div className="mb-6">
            <h2 className="text-2xl font-black text-slate-900">{activeSubject}</h2>
            <p className="text-xs text-slate-500 mt-1">Select a chapter to watch lectures, download notes, and practice DPPs</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {chapters.length === 0 ? (
              <div className="col-span-2 py-16 text-center bg-white rounded-2xl border border-dashed border-slate-200">
                <BookOpen className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-600">No chapters found for {activeSubject}.</p>
              </div>
            ) : (
              chapters.map((c) => {
                const vids =
                  lectures.filter(
                    (l) =>
                      (l.subject === activeSubject || (!l.subject && activeSubject === "General")) &&
                      (l.chapter === c || (!l.chapter && c === "Overview & Lectures"))
                  ).length +
                  liveClasses.filter(
                    (l) =>
                      (l.subject === activeSubject || (!l.subject && activeSubject === "General")) &&
                      (l.chapter === c || (!l.chapter && c === "Overview & Lectures"))
                  ).length;

                const notesCount = materials.filter(
                  (m) =>
                    (m.subject === activeSubject || (!m.subject && activeSubject === "General")) &&
                    (m.chapter === c || (!m.chapter && c === "Overview & Lectures")) &&
                    m.material_type !== "dpp"
                ).length;

                const dppCount = materials.filter(
                  (m) =>
                    (m.subject === activeSubject || (!m.subject && activeSubject === "General")) &&
                    (m.chapter === c || (!m.chapter && c === "Overview & Lectures")) &&
                    m.material_type === "dpp"
                ).length;

                const chapterAll = [
                  ...lectures.filter(
                    (l) =>
                      (l.subject === activeSubject || (!l.subject && activeSubject === "General")) &&
                      (l.chapter === c || (!l.chapter && c === "Overview & Lectures"))
                  ),
                  ...liveClasses.filter(
                    (l) =>
                      (l.subject === activeSubject || (!l.subject && activeSubject === "General")) &&
                      (l.chapter === c || (!l.chapter && c === "Overview & Lectures"))
                  ),
                ];
                const completedInChapter = chapterAll.filter((l: any) => completedIds.has(l.id)).length;

                return (
                  <button
                    key={c}
                    onClick={() => {
                      setActiveChapter(c);
                      setSubTab("Lectures");
                    }}
                    className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200/80 hover:border-[#6043ED]/50 hover:shadow-md transition-all text-left flex flex-col justify-between border-l-4 border-l-[#6043ED] group"
                  >
                    <div>
                      <h3 className="font-bold text-slate-900 text-base mb-2 group-hover:text-[#6043ED] transition-colors">
                        {c}
                      </h3>
                    </div>

                    <div className="flex items-center gap-3 text-xs font-semibold text-slate-500 mt-4 pt-3 border-t border-slate-100 flex-wrap">
                      <span className="flex items-center gap-1">
                        <Video className="w-3.5 h-3.5 text-[#6043ED]" /> {vids} Videos
                      </span>
                      <span className="flex items-center gap-1">
                        <FileText className="w-3.5 h-3.5 text-blue-500" /> {notesCount} Notes
                      </span>
                      <span className="flex items-center gap-1">
                        <ClipboardList className="w-3.5 h-3.5 text-amber-500" /> {dppCount} DPPs
                      </span>
                      {chapterAll.length > 0 && (
                        <span
                          className={cn(
                            "flex items-center gap-1 ml-auto font-bold text-[11px] px-2 py-0.5 rounded-md",
                            completedInChapter === chapterAll.length
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : "bg-slate-100 text-slate-600"
                          )}
                        >
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          {completedInChapter}/{chapterAll.length} Done
                        </span>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>
    );
  }

  // ----------------------------------------------------
  // RENDER: LEVEL 3 (Lectures, Notes, DPPs inside Chapter)
  // ----------------------------------------------------
  return (
    <div className="min-h-screen bg-[#F8F9FA] pb-24 font-sans text-slate-900">
      {/* Top Header Navigation */}
      <div className="bg-white border-b border-slate-200/80 sticky top-0 z-20 px-4 sm:px-6 py-3.5 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-2 overflow-x-auto text-xs font-bold">
          <button
            onClick={() => {
              setActiveChapter(null);
              setActiveSubject(null);
            }}
            className="text-slate-500 hover:text-slate-900 transition whitespace-nowrap"
          >
            Subjects
          </button>
          <span className="text-slate-300">/</span>
          <button
            onClick={() => setActiveChapter(null)}
            className="text-slate-500 hover:text-slate-900 transition whitespace-nowrap"
          >
            {activeSubject}
          </button>
          <span className="text-slate-300">/</span>
          <span className="text-[#6043ED] whitespace-nowrap">{activeChapter}</span>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-8">
        <div className="mb-6">
          <div className="text-xs font-bold text-[#6043ED] uppercase tracking-wider mb-1">
            {activeSubject}
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900">{activeChapter}</h2>
        </div>

        {/* Tab Bar for Chapter Content (PW Style: Lectures | Notes | DPP | DPP Videos) */}
        <div className="flex gap-1.5 mb-8 bg-slate-100 p-1.5 rounded-2xl inline-flex flex-wrap border border-slate-200/80">
          {(["Lectures", "Notes", "DPP", "DPP VIDEOS"] as SubTab[]).map((t) => (
            <button
              key={t}
              onClick={() => setSubTab(t)}
              className={cn(
                "px-4 py-2 text-xs sm:text-sm font-bold rounded-xl transition-all",
                subTab === t
                  ? "bg-white text-[#6043ED] shadow-sm ring-1 ring-black/5"
                  : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
              )}
            >
              {t}
            </button>
          ))}
        </div>

        {/* 1. LECTURES GRID */}
        {subTab === "Lectures" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {chapterLectures.length === 0 ? (
              <div className="col-span-full py-16 text-center bg-white rounded-2xl border border-dashed border-slate-200">
                <Video className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-600">No lectures available in this chapter yet.</p>
              </div>
            ) : (
              chapterLectures.map((l: any) => {
              const isLive = Boolean(l.isLive || l.is_live);
              const teacherPhoto = l.faculty ? facultyPhotoMap.get(String(l.faculty).toLowerCase().trim()) : null;
              const avatarSrc = l.thumbnail_url
                ? (getStorageUrl(l.thumbnail_url) || l.thumbnail_url)
                : teacherPhoto
                ? (getStorageUrl(teacherPhoto) || teacherPhoto)
                : null;

              return (
                <div
                  key={l.id}
                  className={cn(
                    "bg-white rounded-2xl shadow-sm border overflow-hidden flex flex-col group transition-all",
                    isLive
                      ? "border-2 border-red-500 ring-2 ring-red-500/20 shadow-[0_0_24px_rgba(239,68,68,0.22)]"
                      : "border-slate-200/80 hover:shadow-md"
                  )}
                >
                  {isLive && (
                    <div className="h-1 bg-gradient-to-r from-red-500 via-rose-500 to-red-600 animate-pulse" />
                  )}

                  {/* Top Thumbnail / Card Header */}
                  <div className="bg-gradient-to-br from-[#F5F3FF] to-[#EDE9FE] p-4 relative h-40 flex flex-col justify-between">
                    <div className="pr-16">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {isLive ? (
                          <span className="relative overflow-hidden inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-red-600 via-rose-600 to-red-600 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-white live-badge-glow border border-red-300/50 shadow-xs">
                            <span className="live-shimmer" />
                            <span className="relative flex h-1.5 w-1.5">
                              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-95" />
                              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-white" />
                            </span>
                            <Radio className="h-3 w-3 text-white animate-pulse" />
                            <span>LIVE CLASS</span>
                          </span>
                        ) : (
                          <span className="text-[10px] font-black uppercase tracking-wider text-[#6043ED] bg-white px-2 py-0.5 rounded-full shadow-xs">
                            {l.lecture_number ? `Lec ${l.lecture_number}` : "Lecture"}
                          </span>
                        )}
                        {completedIds.has(l.id) && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-600 text-white shadow-xs">
                            <CheckCircle2 className="w-3 h-3" /> Completed
                          </span>
                        )}
                      </div>
                      <h4 className="font-bold text-slate-900 text-xs sm:text-sm line-clamp-2 mt-2">
                        {l.title}
                      </h4>
                    </div>

                    {/* Circular Teacher Photo / Thumbnail */}
                    <div className="absolute right-3 top-3 w-16 h-16 rounded-full border-2 border-white shadow-md overflow-hidden bg-white">
                      {avatarSrc ? (
                        <img
                          src={avatarSrc}
                          className="w-full h-full object-cover"
                          alt={l.faculty || "Faculty"}
                          loading="lazy"
                          decoding="async"
                        />
                      ) : (
                        <div className="w-full h-full bg-slate-200 flex items-center justify-center text-slate-400">
                          <User className="w-8 h-8" />
                        </div>
                      )}

                      {/* Play Button Overlay */}
                      <button
                        onClick={() => playVideo(l)}
                        className={cn(
                          "absolute -bottom-0.5 -right-0.5 w-7 h-7 rounded-full text-white flex items-center justify-center shadow-md border-2 border-white transition group-hover:scale-110",
                          isLive
                            ? "bg-red-600 hover:bg-red-700 animate-pulse"
                            : "bg-[#6043ED] hover:bg-[#4E36C2]"
                        )}
                      >
                        {isLive ? (
                          <Radio className="w-3.5 h-3.5" />
                        ) : (
                          <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                        )}
                      </button>
                    </div>

                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider truncate max-w-[130px]">
                      {l.faculty || "Sarvodaya Faculty"}
                    </div>
                  </div>

                  {/* Card Body */}
                  <div className="p-4 flex flex-col flex-1 bg-white">
                    <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 mb-2">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {new Date(l.created_at || l.scheduled_at).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                      <span className="flex items-center gap-1">
                        <Video className="w-3.5 h-3.5" />
                        {l.duration_minutes ? `${l.duration_minutes} mins` : "Full Lec"}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 line-clamp-2 mb-3 flex-1">
                      {l.description || `${activeChapter} - Comprehensive Class`}
                    </p>

                    <div className="space-y-2 mt-auto">
                      {isLive ? (
                        <Button
                          size="sm"
                          onClick={() => playVideo(l)}
                          className="w-full rounded-xl bg-gradient-to-r from-red-600 via-rose-600 to-red-600 hover:from-red-700 hover:to-rose-700 text-white text-xs font-black tracking-wider uppercase gap-1.5 shadow-md active:scale-[0.98]"
                        >
                          <Radio className="w-3.5 h-3.5 animate-pulse" /> Join Live Class
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          onClick={() => playVideo(l)}
                          className="w-full rounded-xl bg-[#6043ED] hover:bg-[#4E36C2] text-white text-xs font-bold gap-1.5 shadow-sm"
                        >
                          <Play className="w-3.5 h-3.5 fill-current" /> Watch Lecture
                        </Button>
                      )}

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleComplete(l.id, l.title);
                          }}
                          className={cn(
                            "w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-xl border text-xs font-bold transition active:scale-95",
                            completedIds.has(l.id)
                              ? "bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100"
                              : "bg-white text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 hover:border-emerald-300 border-slate-200"
                          )}
                        >
                          <CheckCircle2
                            className={cn(
                              "w-3.5 h-3.5",
                              completedIds.has(l.id) ? "text-emerald-600 fill-emerald-100" : "text-slate-400"
                            )}
                          />
                          <span>{completedIds.has(l.id) ? "Completed (Click to undo)" : "Mark as Complete"}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* 2. NOTES GRID */}
        {subTab === "Notes" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {chapterNotes.length === 0 ? (
              <div className="col-span-full py-16 text-center bg-white rounded-2xl border border-dashed border-slate-200">
                <FileText className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-600">No notes available for this chapter yet.</p>
              </div>
            ) : (
              chapterNotes.map((n) => (
                <div
                  key={n.id}
                  className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-5 flex flex-col justify-between h-full hover:shadow-md transition-all"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 text-[#6043ED] flex items-center justify-center shrink-0 font-black text-xs">
                      PDF
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-bold text-sm text-slate-900 line-clamp-2 mb-1">
                        {n.title}
                      </h4>
                      <p className="text-[11px] text-slate-400">Class Handwritten Notes</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between mt-6 pt-3 border-t border-slate-100">
                    <span className="text-[11px] font-semibold text-slate-400">PDF Document</span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openDoc(n.file_url, n.title)}
                      className="rounded-xl text-[#6043ED] border-[#6043ED]/30 hover:bg-[#6043ED]/10 text-xs font-bold gap-1"
                    >
                      <Download className="w-3.5 h-3.5" /> View / Download
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* 3. DPP GRID */}
        {subTab === "DPP" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {chapterDpps.length === 0 ? (
              <div className="col-span-full py-16 text-center bg-white rounded-2xl border border-dashed border-slate-200">
                <ClipboardList className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-600">No DPPs uploaded for this chapter yet.</p>
              </div>
            ) : (
              chapterDpps.map((d) => (
                <div
                  key={d.id}
                  className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-5 flex flex-col justify-between h-full hover:shadow-md transition-all"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 font-black text-xs">
                      <ClipboardList className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-bold text-sm text-slate-900 line-clamp-2 mb-1">
                        {d.title}
                      </h4>
                      <p className="text-[11px] text-slate-400">Daily Practice Problem</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between mt-6 pt-3 border-t border-slate-100">
                    <span className="text-[11px] font-semibold text-slate-400">Practice Sheet</span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openDoc(d.file_url, d.title)}
                      className="rounded-xl text-amber-600 border-amber-300 hover:bg-amber-50 text-xs font-bold gap-1"
                    >
                      <Download className="w-3.5 h-3.5" /> Solve DPP
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* 4. DPP VIDEOS */}
        {subTab === "DPP VIDEOS" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {chapterDppVideos.length === 0 ? (
              <div className="col-span-full py-16 text-center bg-white rounded-2xl border border-dashed border-slate-200">
                <Video className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-600">No DPP video solutions for this chapter.</p>
              </div>
            ) : (
              chapterDppVideos.map((l: any) => (
                <div
                  key={l.id}
                  className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-5 flex flex-col justify-between hover:shadow-md transition-all"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-black uppercase tracking-wider text-amber-600 bg-amber-50 px-2.5 py-1 rounded-md">
                        DPP Video Solution
                      </span>
                      {completedIds.has(l.id) && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                          <CheckCircle2 className="w-3 h-3" /> Completed
                        </span>
                      )}
                    </div>
                    <h4 className="font-bold text-sm text-slate-900 line-clamp-2 mt-3 mb-1">
                      {l.title}
                    </h4>
                    <p className="text-xs text-slate-500 line-clamp-2">
                      {l.description || "Video explanation for DPP questions."}
                    </p>
                  </div>

                  <div className="space-y-2 mt-4">
                    <Button
                      size="sm"
                      onClick={() => playVideo(l)}
                      className="w-full rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs gap-1.5"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" /> Watch Solution
                    </Button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleComplete(l.id, l.title);
                      }}
                      className={cn(
                        "w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-xl border text-xs font-bold transition active:scale-95",
                        completedIds.has(l.id)
                          ? "bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100"
                          : "bg-white text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 hover:border-emerald-300 border-slate-200"
                      )}
                    >
                      <CheckCircle2
                        className={cn(
                          "w-3.5 h-3.5",
                          completedIds.has(l.id) ? "text-emerald-600 fill-emerald-100" : "text-slate-400"
                        )}
                      />
                      <span>{completedIds.has(l.id) ? "Completed (Click to undo)" : "Mark as Complete"}</span>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Theater Modal with Player and Live Chat overlay */}
      {theaterOpen && playingVideo && (
        <TheaterModal
          open={theaterOpen}
          onClose={() => setTheaterOpen(false)}
          videoSrc={playingVideo.src}
          poster={playingVideo.poster}
          title={playingVideo.title}
          meta={playingVideo.isLive ? "Live Class" : "Recorded Lecture"}
          liveClassId={playingVideo.isLive ? playingVideo.id : undefined}
          currentLecture={playingVideo}
          activeLectureId={playingVideo.id}
          isCompleted={completedIds.has(playingVideo.id)}
          onToggleComplete={() => toggleComplete(playingVideo.id, playingVideo.title)}
          lectures={allBatchLectures}
          notes={allNotes}
          dpp={allDpps}
          onSelectLecture={(id) => {
            const found = allBatchLectures.find((l: any) => l.id === id);
            if (found) playVideo(found);
          }}
        />
      )}

      {/* Document PDF Viewer */}
      {docUrl && (
        <DocumentViewer
          url={docUrl}
          title={docTitle || "Document Viewer"}
          open={Boolean(docUrl)}
          onClose={() => setDocUrl(null)}
        />
      )}
    </div>
  );
}