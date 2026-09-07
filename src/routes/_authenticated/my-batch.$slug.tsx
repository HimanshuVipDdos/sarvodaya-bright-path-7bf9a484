import { useState, useMemo } from "react";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import {
  ArrowLeft, Video, FileText, ClipboardList, Radio, Clock,
  BookOpen, Bell, Share2, Search, Download, Paperclip, MoreVertical, Map, LayoutGrid
} from "lucide-react";
import { AlertCircle } from "lucide-react";
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

      const { data: batch } = await supabase
        .from("batches").select("*").eq("slug", slug).maybeSingle();
      if (!batch) throw notFound();

      const { data: enrollment } = await supabase
        .from("enrollments").select("*")
        .eq("user_id", userId).eq("batch_id", batch.id).maybeSingle();

      const { data: roles } = await supabase
        .from("user_roles").select("role").eq("user_id", userId);
      const isAdmin = (roles ?? []).some((r) => r.role === "admin");

      if (!enrollment && !isAdmin) {
        return {
          batch, enrolled: false, lectures: [], liveClasses: [], materials: [], notifications: [], tests: []
        };
      }

      await supabase.rpc("tick_live_classes" as never);

      const [lectures, liveClasses, materials, notifications, batchTests, freeTests, myAttempts] = await Promise.all([
        supabase.from("lectures").select("*").eq("batch_id", batch.id).eq("is_published", true),
        supabase.from("live_classes").select("*").eq("batch_id", batch.id).order("scheduled_at", { ascending: false }),
        supabase.from("study_materials").select("*").eq("batch_id", batch.id).order("created_at", { ascending: false }),
        supabase.from("notifications").select("*").order("created_at", { ascending: false }).limit(6),
        supabase.from("cbt_tests").select("id,title,description,duration_minutes").eq("batch_id", batch.id).eq("is_published", true),
        supabase.from("cbt_tests").select("id,title,description,duration_minutes").eq("access_mode", "free").eq("is_published", true),
        supabase.from("cbt_attempts").select("test_id,status,score,max_score").eq("user_id", userId),
      ]);

      const attemptByTest = new Map((myAttempts.data ?? []).map((a) => [a.test_id, a]));
      const tests = [...(batchTests.data ?? []), ...(freeTests.data ?? [])].map((t) => ({
        ...t, attempt: attemptByTest.get(t.id) ?? null,
      }));

      return {
        batch, enrolled: true,
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
  errorComponent: () => (
    <div className="flex h-screen w-full items-center justify-center p-4 bg-slate-50">
      <div className="max-w-md w-full bg-white rounded-3xl p-8 text-center shadow-sm border">
        <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-4" />
        <h2 className="text-xl font-bold mb-2">This page didn't load</h2>
        <p className="text-slate-500 mb-6">Something went wrong. Try again or head back home.</p>
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

  if (!data.enrolled) {
    return (
      <Section>
        <div className="mx-auto max-w-lg bg-white border rounded-3xl p-10 text-center shadow-sm">
          <BookOpen className="mx-auto h-12 w-12 text-slate-300 mb-4" />
          <h1 className="text-2xl font-bold">{data.batch.title}</h1>
          <p className="mt-2 text-sm text-slate-500">You haven't enrolled in this batch yet.</p>
          <div className="mt-6">
            <Button asChild><Link to="/dashboard">Go to Dashboard</Link></Button>
          </div>
        </div>
      </Section>
    );
  }

  const { batch, lectures, materials, liveClasses, tests } = data;

  // Derive Subjects
  const subjectsMap = new Map<string, { chapters: Set<string> }>();
  
  // Add live classes to subjects too!
  liveClasses.forEach(l => {
    if (l.subject) {
      if (!subjectsMap.has(l.subject)) subjectsMap.set(l.subject, { chapters: new Set() });
      if (l.chapter) subjectsMap.get(l.subject)!.chapters.add(l.chapter);
    }
  });
  lectures.forEach(l => {
    if (l.subject) {
      if (!subjectsMap.has(l.subject)) subjectsMap.set(l.subject, { chapters: new Set() });
      if (l.chapter) subjectsMap.get(l.subject)!.chapters.add(l.chapter);
    }
  });
  materials.forEach(m => {
    if (m.subject) {
      if (!subjectsMap.has(m.subject)) subjectsMap.set(m.subject, { chapters: new Set() });
      if (m.chapter) subjectsMap.get(m.subject)!.chapters.add(m.chapter);
    }
  });
  
  const subjects = Array.from(subjectsMap.keys()).sort();

  // Content for active drill-down
  let chapters: string[] = [];
  if (activeSubject) {
    chapters = Array.from(subjectsMap.get(activeSubject)?.chapters || []).sort();
  }

  const chapterLectures = useMemo(() => {
    const rec = lectures.filter(l => l.subject === activeSubject && l.chapter === activeChapter);
    const live = liveClasses.filter(l => l.subject === activeSubject && l.chapter === activeChapter);
    // Combine recorded and live for the chapter
    return [...live, ...rec].sort((a: any, b: any) => {
      // sort by date descending or lecture number
      return new Date(b.created_at || b.scheduled_at).getTime() - new Date(a.created_at || a.scheduled_at).getTime();
    });
  }, [lectures, liveClasses, activeSubject, activeChapter]);

  const chapterNotes = materials.filter(m => m.subject === activeSubject && m.chapter === activeChapter && m.material_type !== "dpp");
  const chapterDpps = materials.filter(m => m.subject === activeSubject && m.chapter === activeChapter && m.material_type === "dpp");

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
          {/* Subtle background decoration */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/3 blur-3xl"></div>
          <div className="mx-auto max-w-7xl px-4 sm:px-6 relative z-10">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-6">{batch.title}</h1>
          </div>
        </div>

        {/* White Sub-tabs Bar */}
        <div className="bg-white border-b sticky top-0 z-20 shadow-sm">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-2">
              <div className="flex gap-6 overflow-x-auto scrollbar-hide">
                {(["Description", "All Classes", "Infinity Learning", "Tests", "Community"] as MainTab[]).map(t => (
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
                <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-[12px] font-semibold text-slate-600 hover:bg-slate-50 transition">
                  <Share2 className="w-3.5 h-3.5" /> Share Batch
                </button>
                <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-[12px] font-semibold text-slate-600 hover:bg-slate-50 transition">
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
              <h2 className="text-xl font-bold text-slate-900">Subjects</h2>
              <p className="text-sm text-slate-500 mb-6 mt-1">Select your subjects & start learning</p>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {subjects.length === 0 ? (
                  <div className="col-span-full py-10 text-center text-slate-500">No subjects available yet.</div>
                ) : subjects.map((s, idx) => {
                  const color = pastelColors[idx % pastelColors.length];
                  const chapterCount = subjectsMap.get(s)?.chapters.size || 0;
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
                        <p className="text-[11px] text-slate-500 mt-1">{chapterCount} Chapters</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {mainTab === "Tests" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {tests.length === 0 ? <div className="col-span-2 py-10 text-center text-slate-500">No tests available.</div> :
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