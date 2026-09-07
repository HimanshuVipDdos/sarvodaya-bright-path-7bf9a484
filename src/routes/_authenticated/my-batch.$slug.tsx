import { useState, useMemo } from "react";
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
import { cn, getStorageUrl } from "@/lib/utils";

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

      const [lectures, liveClasses, materials, notifications, batchTests, freeTests, myAttempts] =
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
        ]);

      const attemptByTest = new Map((myAttempts.data ?? []).map((a) => [a.test_id, a]));
      const tests = [...(batchTests.data ?? []), ...(freeTests.data ?? [])].map((t) => ({
        ...t,
        attempt: attemptByTest.get(t.id) ?? null,
      }));

      return {
        batch,
        enrolled: true,
        lectures: lectures.data ?? [],
        liveClasses: liveClasses.data ?? [],
        materials: materials.data ?? [],
        notifications: notifications.data ?? [],
        tests,
      };
    },
  });

export const Route = createFileRoute("/_authenticated/my-batch/$slug")({
  loader: ({ context, params }) => context.queryClient.ensureQueryData(batchPortalQuery(params.slug)),
  component: BatchPortal,
  errorComponent: ({ error, reset }: any) => (
    <div className="flex min-h-screen w-full items-center justify-center p-4 bg-slate-50">
      <div className="max-w-md w-full bg-white rounded-3xl p-8 text-center shadow-sm border">
        <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-4" />
        <h2 className="text-xl font-bold mb-2">This page didn't load</h2>
        <p className="text-slate-500 text-sm mb-2">{error?.message || "Something went wrong."}</p>
        <p className="text-xs text-slate-400 mb-6">Try again or head back home.</p>
        <div className="flex justify-center gap-3">
          <Button onClick={() => (reset ? reset() : window.location.reload())}>Try Again</Button>
          <Button variant="outline" asChild>
            <Link to="/dashboard">Go Home</Link>
          </Button>
        </div>
      </div>
    </div>
  ),
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

  if (!data.enrolled) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] py-16 px-4">
        <div className="mx-auto max-w-lg bg-white border border-slate-200/80 rounded-3xl p-10 text-center shadow-sm">
          <BookOpen className="mx-auto h-12 w-12 text-indigo-300 mb-4" />
          <h1 className="text-2xl font-bold text-slate-900">{data.batch.title}</h1>
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

  const { batch, lectures, materials, liveClasses, tests, notifications } = data;

  // Derive Subjects and Chapters
  const subjectsMap = new Map<string, { chapters: Set<string> }>();

  liveClasses.forEach((l) => {
    const s = l.subject || "General";
    const c = l.chapter || "Overview & Lectures";
    if (!subjectsMap.has(s)) subjectsMap.set(s, { chapters: new Set() });
    subjectsMap.get(s)!.chapters.add(c);
  });

  lectures.forEach((l) => {
    const s = l.subject || "General";
    const c = l.chapter || "Overview & Lectures";
    if (!subjectsMap.has(s)) subjectsMap.set(s, { chapters: new Set() });
    subjectsMap.get(s)!.chapters.add(c);
  });

  materials.forEach((m) => {
    const s = m.subject || "General";
    const c = m.chapter || "Overview & Lectures";
    if (!subjectsMap.has(s)) subjectsMap.set(s, { chapters: new Set() });
    subjectsMap.get(s)!.chapters.add(c);
  });

  const subjects = Array.from(subjectsMap.keys()).sort();

  // Content for active drill-down
  const chapters = useMemo(() => {
    if (!activeSubject) return [];
    return Array.from(subjectsMap.get(activeSubject)?.chapters || []).sort();
  }, [activeSubject, subjectsMap]);

  // Today's Live Classes (Active or Scheduled for today)
  const todayLiveClasses = useMemo(() => {
    const today = new Date().toDateString();
    return liveClasses.filter((l: any) => {
      if (l.status === "live" || l.is_live) return true;
      if (l.scheduled_at) {
        return new Date(l.scheduled_at).toDateString() === today;
      }
      return false;
    });
  }, [liveClasses]);

  const chapterLectures = useMemo(() => {
    if (!activeSubject || !activeChapter) return [];
    const rec = lectures.filter(
      (l) =>
        (l.subject === activeSubject || (!l.subject && activeSubject === "General")) &&
        (l.chapter === activeChapter || (!l.chapter && activeChapter === "Overview & Lectures"))
    );
    const live = liveClasses.filter(
      (l) =>
        (l.subject === activeSubject || (!l.subject && activeSubject === "General")) &&
        (l.chapter === activeChapter || (!l.chapter && activeChapter === "Overview & Lectures"))
    );
    return [...live, ...rec].sort((a: any, b: any) => {
      return (
        new Date(b.created_at || b.scheduled_at).getTime() -
        new Date(a.created_at || a.scheduled_at).getTime()
      );
    });
  }, [lectures, liveClasses, activeSubject, activeChapter]);

  const chapterNotes = useMemo(() => {
    if (!activeSubject || !activeChapter) return [];
    return materials.filter(
      (m) =>
        (m.subject === activeSubject || (!m.subject && activeSubject === "General")) &&
        (m.chapter === activeChapter || (!m.chapter && activeChapter === "Overview & Lectures")) &&
        m.material_type !== "dpp"
    );
  }, [materials, activeSubject, activeChapter]);

  const chapterDpps = useMemo(() => {
    if (!activeSubject || !activeChapter) return [];
    return materials.filter(
      (m) =>
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
  }, [chapterLectures]);

  const allBatchLectures = useMemo(() => {
    const live = liveClasses.map((l: any) => ({
      ...l,
      isLive: true,
      video_url: l.youtube_url,
      subtitle: [l.subject, l.chapter].filter(Boolean).join(" • "),
    }));
    const rec = lectures.map((l: any) => ({
      ...l,
      isLive: false,
      subtitle: [l.subject, l.chapter].filter(Boolean).join(" • "),
    }));
    return [...live, ...rec];
  }, [liveClasses, lectures]);

  const allNotes = useMemo(
    () => materials.filter((m: any) => m.material_type !== "dpp"),
    [materials]
  );
  const allDpps = useMemo(
    () => materials.filter((m: any) => m.material_type === "dpp"),
    [materials]
  );

  const playVideo = (item: any) => {
    const isLive = Boolean(
      item.is_live ?? item.isLive ?? (item.scheduled_at && !item.recorded_lecture_id)
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

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => {
                  navigator.clipboard?.writeText(window.location.href);
                  toast.success("Batch link copied to clipboard!");
                }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-white text-xs font-semibold backdrop-blur-sm transition"
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
                      return (
                        <div
                          key={item.id}
                          className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-sm hover:shadow-md transition-all flex flex-col justify-between group"
                        >
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              {isCurrentlyLive ? (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-rose-500 text-white animate-pulse">
                                  <Radio className="w-3 h-3" /> LIVE NOW
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                  <Clock className="w-3 h-3" />
                                  {item.scheduled_at
                                    ? new Date(item.scheduled_at).toLocaleTimeString([], {
                                        hour: "2-digit",
                                        minute: "2-digit",
                                      })
                                    : "Today"}
                                </span>
                              )}
                              <span className="text-xs font-semibold text-slate-400">
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

                          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                            <span className="text-xs text-slate-500">
                              By {item.faculty || "Faculty"}
                            </span>
                            <Button
                              size="sm"
                              onClick={() => playVideo(item)}
                              className={cn(
                                "rounded-xl font-bold gap-1.5 shadow-sm",
                                isCurrentlyLive
                                  ? "bg-rose-600 hover:bg-rose-700 text-white"
                                  : "bg-[#6043ED] hover:bg-[#4E36C2] text-white"
                              )}
                            >
                              <Play className="w-3.5 h-3.5 fill-current" />
                              {isCurrentlyLive ? "Watch Live" : "Join Class"}
                            </Button>
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

                    <div className="flex items-center gap-3 text-xs font-semibold text-slate-500 mt-4 pt-3 border-t border-slate-100">
                      <span className="flex items-center gap-1">
                        <Video className="w-3.5 h-3.5 text-[#6043ED]" /> {vids} Videos
                      </span>
                      <span className="flex items-center gap-1">
                        <FileText className="w-3.5 h-3.5 text-blue-500" /> {notesCount} Notes
                      </span>
                      <span className="flex items-center gap-1">
                        <ClipboardList className="w-3.5 h-3.5 text-amber-500" /> {dppCount} DPPs
                      </span>
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
                const isLive = Boolean(l.is_live ?? (l.scheduled_at && !l.recorded_lecture_id));
                return (
                  <div
                    key={l.id}
                    className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden flex flex-col group hover:shadow-md transition-all"
                  >
                    {/* Top Thumbnail / Card Header */}
                    <div className="bg-gradient-to-br from-[#F5F3FF] to-[#EDE9FE] p-4 relative h-40 flex flex-col justify-between">
                      <div className="pr-16">
                        <span className="text-[10px] font-black uppercase tracking-wider text-[#6043ED] bg-white px-2 py-0.5 rounded-full shadow-xs">
                          {isLive ? "Live Class" : l.lecture_number ? `Lec ${l.lecture_number}` : "Lecture"}
                        </span>
                        <h4 className="font-bold text-slate-900 text-xs sm:text-sm line-clamp-2 mt-2">
                          {l.title}
                        </h4>
                      </div>

                      {/* Circular Teacher Photo / Thumbnail */}
                      <div className="absolute right-3 top-3 w-16 h-16 rounded-full border-2 border-white shadow-md overflow-hidden bg-white">
                        {l.thumbnail_url ? (
                          <img
                            src={getStorageUrl(l.thumbnail_url) || l.thumbnail_url}
                            className="w-full h-full object-cover"
                            alt=""
                          />
                        ) : (
                          <div className="w-full h-full bg-slate-200 flex items-center justify-center text-slate-400">
                            <User className="w-8 h-8" />
                          </div>
                        )}

                        {/* Play Button Overlay */}
                        <button
                          onClick={() => playVideo(l)}
                          className="absolute -bottom-0.5 -right-0.5 w-7 h-7 bg-[#6043ED] hover:bg-[#4E36C2] rounded-full text-white flex items-center justify-center shadow-md border-2 border-white transition group-hover:scale-110"
                        >
                          <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                        </button>
                      </div>

                      <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                        {l.faculty || "Faculty"}
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

                      <Button
                        size="sm"
                        onClick={() => playVideo(l)}
                        className="w-full rounded-xl bg-[#6043ED] hover:bg-[#4E36C2] text-white text-xs font-bold gap-1.5 shadow-sm"
                      >
                        <Play className="w-3.5 h-3.5 fill-current" /> Watch Lecture
                      </Button>
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
                    <span className="text-[10px] font-black uppercase tracking-wider text-amber-600 bg-amber-50 px-2.5 py-1 rounded-md">
                      DPP Video Solution
                    </span>
                    <h4 className="font-bold text-sm text-slate-900 line-clamp-2 mt-3 mb-1">
                      {l.title}
                    </h4>
                    <p className="text-xs text-slate-500 line-clamp-2">
                      {l.description || "Video explanation for DPP questions."}
                    </p>
                  </div>

                  <Button
                    size="sm"
                    onClick={() => playVideo(l)}
                    className="w-full rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs gap-1.5 mt-4"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" /> Watch Solution
                  </Button>
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
      <DocumentViewer url={docUrl} title={docTitle} onClose={() => setDocUrl(null)} />
    </div>
  );
}