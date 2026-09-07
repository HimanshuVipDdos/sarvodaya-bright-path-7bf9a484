import { useState, useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import {
  ArrowLeft, Video, FileText, ClipboardList, Radio, Clock,
  BookOpen, Bell, Share2, Search, Download, Paperclip, MoreVertical, Map, LayoutGrid,
  User, Play, AlertCircle
} from "lucide-react";
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
      try {
        const { data: userData } = await supabase.auth.getUser();
        const userId = userData.user?.id;
        if (!userId) {
          return { batch: null, enrolled: false, lectures: [], liveClasses: [], materials: [], notifications: [], tests: [] };
        }

        const cleanSlug = decodeURIComponent(slug).trim();
        let batch: any = null;

        // 1. Try exact slug
        const { data: b1 } = await supabase.from("batches").select("*").eq("slug", cleanSlug).maybeSingle();
        if (b1) {
          batch = b1;
        } else {
          // 2. Try UUID id if it looks like a uuid
          const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanSlug);
          if (isUUID) {
            const { data: b2 } = await supabase.from("batches").select("*").eq("id", cleanSlug).maybeSingle();
            if (b2) batch = b2;
          }
        }

        // 3. Try case-insensitive slug or clean title match
        if (!batch) {
          const { data: b3 } = await supabase.from("batches").select("*").ilike("slug", cleanSlug).maybeSingle();
          if (b3) {
            batch = b3;
          } else {
            const titleAttempt = cleanSlug.replace(/-/g, " ");
            const { data: b4 } = await supabase.from("batches").select("*").ilike("title", `%${titleAttempt}%`).maybeSingle();
            if (b4) batch = b4;
          }
        }

        if (!batch) {
          return { batch: null, enrolled: false, lectures: [], liveClasses: [], materials: [], notifications: [], tests: [] };
        }

        const [enrollmentRes, rolesRes] = await Promise.all([
          supabase.from("enrollments").select("*").eq("user_id", userId).eq("batch_id", batch.id).maybeSingle().catch(() => ({ data: null })),
          supabase.from("user_roles").select("role").eq("user_id", userId).catch(() => ({ data: [] })),
        ]);

        const isAdmin = ((rolesRes?.data ?? []) as any[]).some((r) => r.role === "admin");
        const isEnrolled = !!enrollmentRes?.data || isAdmin;

        if (!isEnrolled) {
          return {
            batch, enrolled: false, lectures: [], liveClasses: [], materials: [], notifications: [], tests: []
          };
        }

        await supabase.rpc("tick_live_classes" as never).catch(() => {});

        const [lectures, liveClasses, materials, notifications, batchTests, freeTests, myAttempts] = await Promise.all([
          supabase.from("lectures").select("*").eq("batch_id", batch.id).eq("is_published", true).catch(() => ({ data: [] })),
          supabase.from("live_classes").select("*").eq("batch_id", batch.id).order("scheduled_at", { ascending: false }).catch(() => ({ data: [] })),
          supabase.from("study_materials").select("*").eq("batch_id", batch.id).order("created_at", { ascending: false }).catch(() => ({ data: [] })),
          supabase.from("notifications").select("*").order("created_at", { ascending: false }).limit(6).catch(() => ({ data: [] })),
          supabase.from("cbt_tests").select("id,title,description,duration_minutes").eq("batch_id", batch.id).eq("is_published", true).catch(() => ({ data: [] })),
          supabase.from("cbt_tests").select("id,title,description,duration_minutes").eq("access_mode", "free").eq("is_published", true).catch(() => ({ data: [] })),
          supabase.from("cbt_attempts").select("test_id,status,score,max_score").eq("user_id", userId).catch(() => ({ data: [] })),
        ]);

        const attemptByTest = new Map(((myAttempts?.data ?? []) as any[]).map((a) => [a.test_id, a]));
        const tests = [...(batchTests?.data ?? []), ...(freeTests?.data ?? [])].map((t: any) => ({
          ...t, attempt: attemptByTest.get(t.id) ?? null,
        }));

        return {
          batch, enrolled: true,
          lectures: lectures?.data ?? [],
          liveClasses: liveClasses?.data ?? [],
          materials: materials?.data ?? [],
          notifications: notifications?.data ?? [],
          tests,
        };
      } catch (e) {
        console.error("Batch portal query error:", e);
        return { batch: null, enrolled: false, lectures: [], liveClasses: [], materials: [], notifications: [], tests: [] };
      }
    },
  });

export const Route = createFileRoute("/_authenticated/my-batch/$slug")({
  loader: ({ context, params }) => context.queryClient.ensureQueryData(batchPortalQuery(params.slug)),
  component: BatchPortal,
  errorComponent: ({ error }: { error?: Error }) => (
    <div className="flex h-screen w-full items-center justify-center p-4 bg-slate-50">
      <div className="max-w-md w-full bg-white rounded-3xl p-8 text-center shadow-sm border">
        <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-4" />
        <h2 className="text-xl font-bold mb-2">This page didn't load</h2>
        <p className="text-slate-500 mb-6">{error?.message || "Something went wrong. Try again or head back home."}</p>
        <div className="flex justify-center gap-3">
          <Button onClick={() => window.location.reload()}>Try Again</Button>
          <Button variant="outline" asChild><Link to="/dashboard">Go Home</Link></Button>
        </div>
      </div>
    </div>
  ),
});

type MainTab = "Description" | "All Classes" | "Infinity Learning" | "Tests" | "Community";
type SubTab = "Lectures" | "Notes" | "DPP" | "DPP PDF" | "DPP VIDEOS";

// Pastel colors for subject icons
const pastelColors = [
  "bg-blue-50 text-blue-500 border-blue-100",
  "bg-purple-50 text-purple-500 border-purple-100",
  "bg-emerald-50 text-emerald-500 border-emerald-100",
  "bg-rose-50 text-rose-500 border-rose-100",
  "bg-orange-50 text-orange-500 border-orange-100",
  "bg-cyan-50 text-cyan-500 border-cyan-100",
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

  if (!data?.batch) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center p-4">
        <div className="mx-auto max-w-lg w-full bg-white border rounded-3xl p-10 text-center shadow-sm">
          <BookOpen className="mx-auto h-12 w-12 text-slate-300 mb-4" />
          <h1 className="text-2xl font-bold text-slate-900">Batch Not Found</h1>
          <p className="mt-2 text-sm text-slate-500">The batch you are looking for does not exist or has been removed.</p>
          <div className="mt-6">
            <Button asChild><Link to="/my-batches">Back to My Batches</Link></Button>
          </div>
        </div>
      </div>
    );
  }

  if (!data.enrolled) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center p-4">
        <div className="mx-auto max-w-lg w-full bg-white border rounded-3xl p-10 text-center shadow-sm">
          <BookOpen className="mx-auto h-12 w-12 text-slate-300 mb-4" />
          <h1 className="text-2xl font-bold text-slate-900">{data.batch.title}</h1>
          <p className="mt-2 text-sm text-slate-500">You haven't enrolled in this batch yet.</p>
          <div className="mt-6 flex justify-center gap-3">
            <Button asChild><Link to="/dashboard">Go to Study</Link></Button>
            <Button variant="outline" asChild><Link to="/batches">Explore Batches</Link></Button>
          </div>
        </div>
      </div>
    );
  }

  const { batch, lectures, materials, liveClasses, tests, notifications } = data;

  // Derive Subjects safely with fallback
  const subjectsMap = new Map<string, { chapters: Set<string> }>();
  const defaultSubject = (batch.subjects && batch.subjects[0]) || "Core Subjects";

  // 1. Initialize with batch.subjects if configured
  if (Array.isArray(batch.subjects)) {
    batch.subjects.forEach((s: string) => {
      if (s && !subjectsMap.has(s)) subjectsMap.set(s, { chapters: new Set() });
    });
  }

  // 2. Add live classes
  liveClasses.forEach((l: any) => {
    const subj = l.subject || defaultSubject;
    const ch = l.chapter || "Live Sessions";
    if (!subjectsMap.has(subj)) subjectsMap.set(subj, { chapters: new Set() });
    subjectsMap.get(subj)!.chapters.add(ch);
  });

  // 3. Add lectures
  lectures.forEach((l: any) => {
    const subj = l.subject || defaultSubject;
    const ch = l.chapter || "Lectures & Classes";
    if (!subjectsMap.has(subj)) subjectsMap.set(subj, { chapters: new Set() });
    subjectsMap.get(subj)!.chapters.add(ch);
  });

  // 4. Add study materials
  materials.forEach((m: any) => {
    const subj = m.subject || defaultSubject;
    const ch = m.chapter || "Study Notes";
    if (!subjectsMap.has(subj)) subjectsMap.set(subj, { chapters: new Set() });
    subjectsMap.get(subj)!.chapters.add(ch);
  });

  // 5. Ensure at least one subject exists
  if (subjectsMap.size === 0) {
    subjectsMap.set("All Classes", { chapters: new Set(["Lectures & Notes"]) });
  }

  const subjects = Array.from(subjectsMap.keys()).sort();

  // Content for active drill-down
  let chapters: string[] = [];
  if (activeSubject) {
    chapters = Array.from(subjectsMap.get(activeSubject)?.chapters || []).sort();
    if (chapters.length === 0) chapters = ["General Classes"];
  }

  const chapterLectures = useMemo(() => {
    const rec = lectures.filter((l: any) => {
      const s = l.subject || defaultSubject;
      const c = l.chapter || "Lectures & Classes";
      return s === activeSubject && (!activeChapter || c === activeChapter);
    });
    const live = liveClasses.filter((l: any) => {
      const s = l.subject || defaultSubject;
      const c = l.chapter || "Live Sessions";
      return s === activeSubject && (!activeChapter || c === activeChapter);
    });
    return [...live, ...rec].sort((a: any, b: any) => {
      return new Date(b.created_at || b.scheduled_at).getTime() - new Date(a.created_at || a.scheduled_at).getTime();
    });
  }, [lectures, liveClasses, activeSubject, activeChapter, defaultSubject]);

  const chapterNotes = materials.filter((m: any) => {
    const s = m.subject || defaultSubject;
    const c = m.chapter || "Study Notes";
    return s === activeSubject && (!activeChapter || c === activeChapter) && m.material_type !== "dpp";
  });
  
  const chapterDpps = materials.filter((m: any) => {
    const s = m.subject || defaultSubject;
    const c = m.chapter || "Study Notes";
    return s === activeSubject && (!activeChapter || c === activeChapter) && m.material_type === "dpp";
  });

  const playVideo = (item: any) => {
    const isLive = "is_live" in item;
    setPlayingVideo({
      id: item.id,
      src: isLive ? item.youtube_url : item.video_url,
      poster: item.thumbnail_url,
      title: item.title,
      isLive
    });
    setTheaterOpen(true);
  };

  const openDoc = (url: string | null, title: string) => {
    if (!url) return toast.error("No file attached");
    setDocUrl(url);
    setDocTitle(title);
  };

  // ----------------------------------------------------
  // RENDER: LEVEL 1 (Blue Banner + Subjects Grid)
  // ----------------------------------------------------
  if (!activeSubject) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] pb-20 font-sans">
        {/* The Purple/Blue PW Header */}
        <div className="bg-[#6043ED] text-white pt-8 pb-4 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/3 blur-3xl"></div>
          <div className="mx-auto max-w-7xl px-4 sm:px-6 relative z-10">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-2">{batch.title}</h1>
            {batch.exam_category && (
              <span className="inline-block px-2.5 py-0.5 rounded-full bg-white/20 text-white text-xs font-semibold uppercase tracking-wider mb-4">
                {batch.exam_category}
              </span>
            )}
          </div>
        </div>

        {/* White Sub-tabs Bar */}
        <div className="bg-white border-b sticky top-0 z-20 shadow-sm">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-2">
              <div className="flex gap-6 overflow-x-auto scrollbar-hide">
                {(["All Classes", "Description", "Tests", "Infinity Learning", "Community"] as MainTab[]).map(t => (
                  <button
                    key={t}
                    onClick={() => setMainTab(t)}
                    className={cn(
                      "py-3 text-[13px] font-semibold whitespace-nowrap border-b-2 transition-colors",
                      mainTab === t ? "border-[#6043ED] text-[#6043ED]" : "border-transparent text-slate-500 hover:text-slate-800"
                    )}
                  >
                    {t}
                  </button>
                ))}
              </div>
              
              <div className="flex items-center gap-3 shrink-0 pb-2 sm:pb-0">
                <button
                  onClick={() => {
                    if (navigator.clipboard) {
                      navigator.clipboard.writeText(window.location.href);
                      toast.success("Batch link copied to clipboard!");
                    }
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-[12px] font-semibold text-slate-600 hover:bg-slate-50 transition"
                >
                  <Share2 className="w-3.5 h-3.5" /> Share Batch
                </button>
                <button
                  onClick={() => setMainTab("Community")}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-[12px] font-semibold text-slate-600 hover:bg-slate-50 transition"
                >
                  <Bell className="w-3.5 h-3.5" /> Announcement
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8">
          {mainTab === "All Classes" && (
            <>
              {/* Quick direct lectures if available */}
              {lectures.length > 0 && subjects.length === 1 && (
                <div className="mb-10">
                  <h3 className="text-base font-bold text-slate-900 mb-4">Recent Lectures</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {lectures.slice(0, 4).map((l: any) => (
                      <div
                        key={l.id}
                        onClick={() => playVideo(l)}
                        className="bg-white rounded-xl border border-slate-200 p-3 shadow-xs hover:shadow-md transition cursor-pointer flex flex-col"
                      >
                        <div className="aspect-video w-full rounded-lg bg-slate-100 overflow-hidden relative mb-2 flex items-center justify-center">
                          {l.thumbnail_url ? (
                            <img src={getStorageUrl(l.thumbnail_url) || l.thumbnail_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <Video className="w-8 h-8 text-slate-300" />
                          )}
                          <div className="absolute inset-0 bg-black/20 flex items-center justify-center hover:bg-black/30 transition">
                            <div className="w-9 h-9 rounded-full bg-[#6043ED] text-white flex items-center justify-center shadow-lg">
                              <Play className="w-4 h-4 ml-0.5" />
                            </div>
                          </div>
                        </div>
                        <h4 className="font-bold text-xs text-slate-900 line-clamp-2">{l.title}</h4>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <h2 className="text-xl font-bold text-slate-900">Subjects</h2>
              <p className="text-sm text-slate-500 mb-6 mt-1">Select your subjects & start learning</p>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {subjects.map((s, idx) => {
                  const color = pastelColors[idx % pastelColors.length];
                  const chapterCount = subjectsMap.get(s)?.chapters.size || 1;
                  return (
                    <button
                      key={s}
                      onClick={() => setActiveSubject(s)}
                      className="bg-white p-4 rounded-xl shadow-sm border border-slate-200/60 hover:shadow-md transition-all flex items-center gap-4 text-left group"
                    >
                      <div className={cn("w-12 h-12 rounded-lg flex items-center justify-center shrink-0 border", color)}>
                        <LayoutGrid className="w-6 h-6" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="font-bold text-slate-800 text-sm truncate group-hover:text-[#6043ED] transition-colors">{s}</h3>
                        <p className="text-[11px] text-slate-500 mt-1">{chapterCount} {chapterCount === 1 ? "Chapter / Section" : "Chapters"}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {mainTab === "Description" && (
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-sm max-w-4xl space-y-6">
              <div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">About this Batch</h3>
                <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">
                  {batch.description || "Comprehensive coaching and test preparation designed for guaranteed success in examinations."}
                </p>
              </div>
              {batch.faculty && batch.faculty.length > 0 && (
                <div>
                  <h4 className="text-sm font-bold text-slate-900 mb-2">Faculty</h4>
                  <div className="flex flex-wrap gap-2">
                    {batch.faculty.map((f: string) => (
                      <span key={f} className="px-3 py-1 bg-indigo-50 text-indigo-700 text-xs font-semibold rounded-full border border-indigo-100">
                        👨‍🏫 {f}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {batch.features && batch.features.length > 0 && (
                <div>
                  <h4 className="text-sm font-bold text-slate-900 mb-2">Batch Highlights</h4>
                  <ul className="grid sm:grid-cols-2 gap-2">
                    {batch.features.map((feat: string, idx: number) => (
                      <li key={idx} className="flex items-center gap-2 text-xs text-slate-700">
                        <span className="text-emerald-500 font-bold">✓</span> {feat}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="pt-4 border-t flex flex-wrap gap-6 text-xs text-slate-500 font-medium">
                {batch.starts_on && <div>Starts on: <strong className="text-slate-800">{new Date(batch.starts_on).toLocaleDateString()}</strong></div>}
                {batch.duration && <div>Duration: <strong className="text-slate-800">{batch.duration}</strong></div>}
                {batch.exam_category && <div>Target Exam: <strong className="text-slate-800">{batch.exam_category}</strong></div>}
              </div>
            </div>
          )}

          {mainTab === "Infinity Learning" && (
            <div className="space-y-4">
              <h3 className="text-lg font-bold text-slate-900">Study Materials & Notes</h3>
              {materials.length === 0 ? (
                <div className="py-12 text-center text-slate-500 bg-white rounded-3xl border">No study materials uploaded yet.</div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {materials.map((m: any) => (
                    <div key={m.id} className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm flex flex-col justify-between">
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                          {m.material_type || "Notes"}
                        </span>
                        <h4 className="font-bold text-slate-900 text-sm mt-2 line-clamp-2">{m.title}</h4>
                      </div>
                      <div className="flex items-center justify-between mt-4 pt-3 border-t">
                        <span className="text-[11px] text-slate-400">{new Date(m.created_at).toLocaleDateString()}</span>
                        <Button size="sm" variant="outline" onClick={() => openDoc(m.file_url, m.title)} className="gap-1.5 text-xs">
                          <Download className="w-3.5 h-3.5" /> View PDF
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {mainTab === "Community" && (
            <div className="max-w-2xl mx-auto space-y-4">
              <h3 className="text-lg font-bold text-slate-900">Announcements & Updates</h3>
              {notifications.length === 0 ? (
                <div className="py-12 text-center text-slate-500 bg-white rounded-3xl border">No announcements yet. Check back soon!</div>
              ) : (
                notifications.map((n: any) => (
                  <div key={n.id} className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm flex gap-4 items-start">
                    <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0 border border-purple-100">
                      <Bell className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-bold text-slate-900 text-sm">{n.title}</h4>
                      <p className="text-xs text-slate-600 mt-1 leading-relaxed">{n.message || n.body}</p>
                      <span className="text-[10px] text-slate-400 mt-2 block font-medium">
                        {new Date(n.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {mainTab === "Tests" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {tests.length === 0 ? <div className="col-span-2 py-10 text-center text-slate-500 bg-white rounded-3xl border">No tests available for this batch yet.</div> :
               tests.map(t => (
                 <div key={t.id} className="border bg-white rounded-2xl p-6 shadow-sm flex flex-col">
                   <div className="flex items-center justify-between mb-2">
                     <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md uppercase tracking-wide">Test</span>
                     <span className="text-xs font-semibold text-slate-500">{t.duration_minutes} mins</span>
                   </div>
                   <h3 className="text-lg font-bold text-slate-900 mb-1">{t.title}</h3>
                   <p className="text-sm text-slate-500 line-clamp-2 mb-6 flex-1">{t.description}</p>
                   
                   {t.attempt?.status === "completed" ? (
                     <div className="flex items-center justify-between mt-auto">
                       <div>
                         <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Score</p>
                         <p className="text-xl font-black text-emerald-600">{t.attempt.score} <span className="text-sm font-semibold text-emerald-600/50">/ {t.attempt.max_score}</span></p>
                       </div>
                       <Button variant="outline" asChild className="rounded-lg"><Link to="/cbt/$testId/result" params={{ testId: t.id }}>View Analysis</Link></Button>
                     </div>
                   ) : (
                     <Button asChild className="w-full rounded-lg bg-[#6043ED] hover:bg-[#4E36C2] mt-auto shadow-sm"><Link to="/cbt/$testId" params={{ testId: t.id }}>Start Test</Link></Button>
                   )}
                 </div>
               ))
              }
            </div>
          )}
        </div>
      </div>
    );
  }

  // ----------------------------------------------------
  // RENDER: LEVEL 2 (Chapters List)
  // ----------------------------------------------------
  if (!activeChapter) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] pb-20 font-sans">
        {/* Simple Header with Back Button */}
        <div className="bg-white border-b sticky top-0 z-20 px-4 sm:px-6 py-4 flex items-center justify-between shadow-sm">
          <button onClick={() => setActiveSubject(null)} className="flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900 transition">
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
        </div>

        <div className="mx-auto max-w-5xl px-4 sm:px-6 py-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {chapters.length === 0 ? (
              <div className="col-span-2 py-10 text-center text-slate-500">No chapters found.</div>
            ) : (
              chapters.map(c => {
                const vids = lectures.filter(l => l.subject === activeSubject && l.chapter === c).length + liveClasses.filter(l => l.subject === activeSubject && l.chapter === c).length;
                const notesCount = materials.filter(m => m.subject === activeSubject && m.chapter === c && m.material_type !== "dpp").length;
                const dppCount = materials.filter(m => m.subject === activeSubject && m.chapter === c && m.material_type === "dpp").length;
                
                return (
                  <button
                    key={c}
                    onClick={() => setActiveChapter(c)}
                    className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200/70 hover:shadow-md transition-all text-left flex flex-col justify-center border-l-4 border-l-[#6043ED]"
                  >
                    <h3 className="font-bold text-slate-900 text-[15px] mb-2">{c}</h3>
                    <div className="flex items-center gap-3 text-[11px] font-semibold text-slate-400">
                      <span>{vids} Videos</span>
                      <span>{dppCount} Exercises</span>
                      <span>{notesCount} Notes</span>
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
  // RENDER: LEVEL 3 (Lectures / Notes inside Chapter)
  // ----------------------------------------------------
  return (
    <div className="min-h-screen bg-[#F8F9FA] pb-20 font-sans">
      {/* Simple Header with Back Button */}
      <div className="bg-white border-b sticky top-0 z-20 px-4 sm:px-6 py-4 flex items-center justify-between shadow-sm">
        <button onClick={() => setActiveChapter(null)} className="flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900 transition">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
      </div>

      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-8">
        <h2 className="text-2xl font-bold text-slate-900 mb-6">{activeChapter}</h2>

        {/* Tab Bar for Chapter Content */}
        <div className="flex gap-1 mb-8 bg-slate-100/50 p-1 rounded-xl inline-flex flex-wrap border">
          {(["Lectures", "Notes", "DPP", "DPP PDF", "DPP VIDEOS"] as SubTab[]).map(t => (
            <button
              key={t}
              onClick={() => setSubTab(t)}
              className={cn(
                "px-4 py-2 text-[13px] font-bold rounded-lg transition-all",
                subTab === t ? "bg-white text-[#6043ED] shadow-sm ring-1 ring-black/5" : "text-slate-500 hover:text-slate-700 hover:bg-black/5"
              )}
            >
              {t}
            </button>
          ))}
        </div>

        {/* LECTURES GRID */}
        {subTab === "Lectures" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {chapterLectures.length === 0 ? <div className="col-span-full py-10 text-center text-slate-500">No lectures available.</div> :
             chapterLectures.map((l: any) => (
               <div key={l.id} className="bg-white rounded-2xl shadow-sm border border-slate-200/70 overflow-hidden flex flex-col group">
                 {/* Top Half: Lavender Background */}
                 <div className="bg-[#F6F5FC] p-4 relative h-36 flex flex-col justify-between">
                   <div className="pr-16">
                     <h4 className="font-bold text-[#6043ED] text-sm line-clamp-1">{activeChapter}</h4>
                     <p className="text-xs font-black text-slate-900 mt-1 line-clamp-2">Lec {l.lecture_number}: {l.title}</p>
                   </div>
                   
                   {/* Teacher Circle Image (Mocked if empty) */}
                   <div className="absolute right-3 top-3 w-16 h-16 rounded-full border-2 border-white shadow-sm overflow-hidden bg-white">
                      {l.thumbnail_url ? (
                        <img src={getStorageUrl(l.thumbnail_url) || l.thumbnail_url} className="w-full h-full object-cover" alt="" />
                      ) : (
                        <div className="w-full h-full bg-slate-200 flex items-center justify-center text-slate-400">
                          <User className="w-8 h-8" />
                        </div>
                      )}
                      
                      {/* Purple Play Button overlay */}
                      <button 
                        onClick={() => playVideo(l)}
                        className="absolute -bottom-1 -right-1 w-7 h-7 bg-[#6043ED] rounded-full text-white flex items-center justify-center shadow-md border-2 border-white transition group-hover:scale-110"
                      >
                        <Play className="w-3.5 h-3.5 ml-0.5" />
                      </button>
                   </div>

                   <div className="text-[10px] font-bold text-slate-400 mt-auto uppercase tracking-wider">By Faculty</div>
                 </div>

                 {/* Bottom Half: White */}
                 <div className="p-4 flex flex-col flex-1 bg-white">
                   <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 mb-2">
                     <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5"/> {new Date(l.created_at || l.scheduled_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                     <span className="flex items-center gap-1"><Video className="w-3.5 h-3.5"/> {l.duration_minutes || "00"}:00:00</span>
                   </div>
                   <p className="text-xs font-semibold text-slate-800 line-clamp-2 mb-3 flex-1">
                     {activeChapter} {l.lecture_number ? `|| Lec ${l.lecture_number}` : ""} || {l.title}
                   </p>
                   <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                     <button className="p-1.5 text-slate-400 hover:text-slate-600 transition"><Paperclip className="w-4 h-4" /></button>
                     <button className="p-1.5 text-slate-400 hover:text-slate-600 transition"><MoreVertical className="w-4 h-4" /></button>
                   </div>
                 </div>
               </div>
             ))
            }
          </div>
        )}

        {/* NOTES GRID */}
        {subTab === "Notes" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {chapterNotes.length === 0 ? <div className="col-span-full py-10 text-center text-slate-500">No notes available.</div> :
             chapterNotes.map(n => (
               <div key={n.id} className="bg-white rounded-xl shadow-sm border border-slate-200/70 p-4 flex flex-col h-full">
                 <h4 className="font-bold text-sm text-slate-900 mb-6 flex-1 line-clamp-3">{n.title}</h4>
                 <div className="flex items-center justify-between mt-auto">
                   <div className="w-8 h-8 rounded-lg bg-[#6043ED] text-white flex items-center justify-center shrink-0">
                     <span className="text-[10px] font-black tracking-tighter">PDF</span>
                   </div>
                   <button 
                     onClick={() => openDoc(n.file_url, n.title)}
                     className="w-8 h-8 rounded-full border border-slate-200 text-[#6043ED] flex items-center justify-center hover:bg-slate-50 transition"
                   >
                     <Download className="w-4 h-4" />
                   </button>
                 </div>
               </div>
             ))
            }
          </div>
        )}

        {/* DPP GRID */}
        {(subTab === "DPP" || subTab === "DPP PDF") && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {chapterDpps.length === 0 ? <div className="col-span-full py-10 text-center text-slate-500">No DPPs available.</div> :
             chapterDpps.map(d => (
               <div key={d.id} className="bg-white rounded-xl shadow-sm border border-slate-200/70 p-4 flex flex-col h-full">
                 <h4 className="font-bold text-sm text-slate-900 mb-6 flex-1 line-clamp-3">{d.title}</h4>
                 <div className="flex items-center justify-between mt-auto">
                   <div className="w-8 h-8 rounded-lg bg-orange-500 text-white flex items-center justify-center shrink-0">
                     <ClipboardList className="w-4 h-4" />
                   </div>
                   <button 
                     onClick={() => openDoc(d.file_url, d.title)}
                     className="w-8 h-8 rounded-full border border-slate-200 text-orange-500 flex items-center justify-center hover:bg-slate-50 transition"
                   >
                     <Download className="w-4 h-4" />
                   </button>
                 </div>
               </div>
             ))
            }
          </div>
        )}
      </div>

      {theaterOpen && playingVideo && (
        <TheaterModal
          open={theaterOpen}
          onClose={() => setTheaterOpen(false)}
          videoSrc={playingVideo.src}
          poster={playingVideo.poster}
          title={playingVideo.title}
          meta={playingVideo.isLive ? "Live Class" : "Recorded Lecture"}
          liveClassId={playingVideo.isLive ? playingVideo.id : undefined}
          lectures={[]}
          onSelectLecture={() => {}}
        />
      )}

      <DocumentViewer url={docUrl} title={docTitle} onClose={() => setDocUrl(null)} />
    </div>
  );
}