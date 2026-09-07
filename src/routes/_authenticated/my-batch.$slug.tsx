import { useState, useMemo } from "react";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Video, FileText, ClipboardList, Radio, Clock,
  BookOpen, Bell, ExternalLink, PlayCircle, Award, Sparkles,
  ChevronRight, Folder, FolderOpen, Play, CheckCircle2, ChevronLeft
} from "lucide-react";

import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Section } from "@/components/section";
import { Button } from "@/components/ui/button";
import { TheaterModal, type TheaterLecture } from "@/components/theater-modal";
import { DocumentViewer } from "@/components/document-viewer";
import { cn } from "@/lib/utils";
import { getStorageUrl } from "@/lib/utils";

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

type MainTab = "Subjects" | "Live" | "Tests" | "Updates";
type SubTab = "Lectures" | "Notes" | "DPPs";

function BatchPortal() {
  const { slug } = Route.useParams();
  const { data } = useSuspenseQuery(batchPortalQuery(slug));

  const [mainTab, setMainTab] = useState<MainTab>("Subjects");
  
  // Folders UI state
  const [activeSubject, setActiveSubject] = useState<string | null>(null);
  const [activeChapter, setActiveChapter] = useState<string | null>(null);
  const [subTab, setSubTab] = useState<SubTab>("Lectures");

  // Theater state
  const [theaterOpen, setTheaterOpen] = useState(false);
  const [playingVideo, setPlayingVideo] = useState<any>(null); // holds lecture or live_class
  const [docUrl, setDocUrl] = useState<string | null>(null);

  if (!data.enrolled) {
    return (
      <Section>
        <div className="mx-auto max-w-lg bg-white border rounded-3xl p-10 text-center shadow-sm">
          <Lock className="mx-auto h-12 w-12 text-slate-300 mb-4" />
          <h1 className="text-2xl font-bold">{data.batch.title}</h1>
          <p className="mt-2 text-sm text-slate-500">You haven't enrolled in this batch yet.</p>
          <div className="mt-6">
            <Button asChild><Link to="/dashboard">Go to Dashboard</Link></Button>
          </div>
        </div>
      </Section>
    );
  }

  const { batch, lectures, materials, liveClasses, tests, notifications } = data;

  // Process Subjects & Chapters
  const subjectsSet = new Set<string>();
  lectures.forEach(l => l.subject && subjectsSet.add(l.subject));
  materials.forEach(m => m.subject && subjectsSet.add(m.subject));
  
  const subjects = Array.from(subjectsSet).sort();
  // Default selection
  if (!activeSubject && subjects.length > 0) {
    setActiveSubject(subjects[0]);
  }

  // Derive Chapters for activeSubject
  const chaptersSet = new Set<string>();
  if (activeSubject) {
    lectures.filter(l => l.subject === activeSubject && l.chapter).forEach(l => chaptersSet.add(l.chapter!));
    materials.filter(m => m.subject === activeSubject && m.chapter).forEach(m => chaptersSet.add(m.chapter!));
  }
  const chapters = Array.from(chaptersSet).sort();

  // Content for active chapter
  const chapterLectures = lectures.filter(l => l.subject === activeSubject && l.chapter === activeChapter).sort((a,b) => (a.lecture_number||0) - (b.lecture_number||0));
  const chapterNotes = materials.filter(m => m.subject === activeSubject && m.chapter === activeChapter && m.material_type !== "dpp");
  const chapterDpps = materials.filter(m => m.subject === activeSubject && m.chapter === activeChapter && m.material_type === "dpp");

  // Live classes logic
  const now = Date.now();
  const upcomingLive = liveClasses.filter(l => l.is_live || (new Date(l.scheduled_at).getTime() > now - 4*3600_000));

  const playVideo = (item: any, isLive = false) => {
    setPlayingVideo({
      id: item.id,
      src: isLive ? item.youtube_url : item.video_url,
      poster: item.thumbnail_url,
      title: item.title,
      isLive
    });
    setTheaterOpen(true);
  };

  const coverUrl = batch.thumbnail_url ? getStorageUrl(batch.thumbnail_url) : null;

  return (
    <div className="min-h-screen bg-slate-50/50 pb-20">
      {/* Batch Header */}
      <div className="bg-white border-b">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 flex flex-col md:flex-row gap-6 items-start md:items-center">
          <div className="h-24 w-24 md:h-32 md:w-32 shrink-0 rounded-2xl overflow-hidden shadow-sm border bg-slate-100">
            {coverUrl ? <img src={coverUrl} alt={batch.title} className="w-full h-full object-cover" /> : <BookOpen className="w-full h-full p-8 text-slate-300" />}
          </div>
          <div className="flex-1">
            <Link to="/dashboard" className="text-xs font-semibold text-primary mb-2 flex items-center gap-1"><ArrowLeft className="w-3 h-3"/> Dashboard</Link>
            <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">{batch.title}</h1>
            <div className="flex items-center gap-4 mt-3 text-xs font-medium text-slate-500">
              <span className="flex items-center gap-1"><Video className="w-4 h-4"/> {lectures.length} Lectures</span>
              <span className="flex items-center gap-1"><FileText className="w-4 h-4"/> {materials.length} Notes & DPPs</span>
            </div>
          </div>
        </div>

        {/* Main Tabs */}
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="flex gap-6 border-b overflow-x-auto scrollbar-hide">
            {(["Subjects", "Live", "Tests", "Updates"] as MainTab[]).map(t => (
              <button
                key={t}
                onClick={() => setMainTab(t)}
                className={cn(
                  "py-4 px-1 border-b-2 text-sm font-bold whitespace-nowrap transition-colors",
                  mainTab === t ? "border-primary text-primary" : "border-transparent text-slate-500 hover:text-slate-800"
                )}
              >
                {t}
                {t === "Live" && upcomingLive.length > 0 && <span className="ml-2 bg-rose-500 text-white text-[10px] px-1.5 py-0.5 rounded-full animate-pulse">LIVE</span>}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-8">
        
        {/* ================= SUBJECTS TAB (PW STYLE) ================= */}
        {mainTab === "Subjects" && (
          <div className="flex flex-col md:flex-row gap-8">
            
            {/* Sidebar: Subjects List */}
            <div className="w-full md:w-64 shrink-0 space-y-1">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 px-3">Subjects</h3>
              {subjects.length === 0 ? (
                <div className="text-sm text-slate-500 px-3">No subjects yet.</div>
              ) : (
                subjects.map(s => (
                  <button
                    key={s}
                    onClick={() => { setActiveSubject(s); setActiveChapter(null); }}
                    className={cn(
                      "w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-semibold transition-all",
                      activeSubject === s ? "bg-primary text-white shadow-md shadow-primary/20" : "text-slate-700 hover:bg-slate-100"
                    )}
                  >
                    {s}
                    <ChevronRight className={cn("w-4 h-4", activeSubject === s ? "text-white/70" : "text-slate-400")} />
                  </button>
                ))
              )}
            </div>

            {/* Main Content Area */}
            <div className="flex-1 min-w-0 bg-white border rounded-3xl p-6 shadow-sm">
              {!activeChapter ? (
                // CHAPTER LIST VIEW
                <>
                  <h2 className="text-xl font-bold text-slate-900 mb-6">{activeSubject} Chapters</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {chapters.length === 0 ? (
                      <p className="text-slate-500 text-sm col-span-2">No chapters found for this subject.</p>
                    ) : (
                      chapters.map(c => (
                        <button
                          key={c}
                          onClick={() => setActiveChapter(c)}
                          className="flex items-center gap-4 p-4 rounded-2xl border hover:border-primary/50 hover:bg-primary/5 transition-all text-left group"
                        >
                          <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                            <Folder className="w-6 h-6 fill-current opacity-20" />
                          </div>
                          <div className="flex-1">
                            <h4 className="font-bold text-slate-800 line-clamp-1">{c}</h4>
                            <p className="text-xs text-slate-500 mt-0.5">View lectures & notes</p>
                          </div>
                          <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-primary transition-colors" />
                        </button>
                      ))
                    )}
                  </div>
                </>
              ) : (
                // LECTURES & NOTES VIEW (INSIDE CHAPTER)
                <>
                  <button onClick={() => setActiveChapter(null)} className="flex items-center gap-1.5 text-xs font-semibold text-primary mb-4 hover:underline">
                    <ChevronLeft className="w-4 h-4"/> Back to Chapters
                  </button>
                  <h2 className="text-2xl font-bold text-slate-900 mb-6 flex items-center gap-2">
                    <FolderOpen className="w-6 h-6 text-primary fill-primary/20" /> {activeChapter}
                  </h2>

                  {/* Sub Tabs */}
                  <div className="flex gap-2 p-1 bg-slate-100 rounded-xl mb-6 inline-flex">
                    {(["Lectures", "Notes", "DPPs"] as SubTab[]).map(t => (
                      <button
                        key={t} onClick={() => setSubTab(t)}
                        className={cn(
                          "px-5 py-2 text-sm font-bold rounded-lg transition-all",
                          subTab === t ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                        )}
                      >
                        {t}
                      </button>
                    ))}
                  </div>

                  {/* Lists */}
                  <div className="space-y-3">
                    {subTab === "Lectures" && (
                      chapterLectures.length === 0 ? <Empty msg="No lectures in this chapter yet." /> :
                      chapterLectures.map(l => (
                        <div key={l.id} className="flex flex-col sm:flex-row gap-4 p-4 border rounded-2xl hover:border-primary/30 transition-all bg-slate-50/50">
                          <div className="w-full sm:w-40 aspect-video bg-black rounded-xl overflow-hidden relative shrink-0">
                            {l.thumbnail_url ? <img src={l.thumbnail_url} className="w-full h-full object-cover opacity-60" alt="" /> : null}
                            <PlayCircle className="absolute inset-0 m-auto w-8 h-8 text-white opacity-80" />
                          </div>
                          <div className="flex-1 py-1">
                            <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full uppercase tracking-widest">
                              Lec {l.lecture_number}
                            </span>
                            <h4 className="font-bold text-slate-900 mt-2 line-clamp-2">{l.title}</h4>
                            <Button size="sm" onClick={() => playVideo(l)} className="mt-3 gap-1.5 rounded-full px-5">
                              <Play className="w-3.5 h-3.5" /> Watch Now
                            </Button>
                          </div>
                        </div>
                      ))
                    )}
                    {subTab === "Notes" && (
                      chapterNotes.length === 0 ? <Empty msg="No notes uploaded." /> :
                      chapterNotes.map(n => (
                        <div key={n.id} className="flex items-center justify-between p-4 border rounded-2xl bg-slate-50/50">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center"><FileText className="w-5 h-5"/></div>
                            <h4 className="font-semibold text-sm text-slate-800">{n.title}</h4>
                          </div>
                          <Button variant="outline" size="sm" onClick={() => setDocUrl(n.file_url)}>View PDF</Button>
                        </div>
                      ))
                    )}
                    {subTab === "DPPs" && (
                      chapterDpps.length === 0 ? <Empty msg="No DPPs uploaded." /> :
                      chapterDpps.map(d => (
                        <div key={d.id} className="flex items-center justify-between p-4 border rounded-2xl bg-slate-50/50">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center"><ClipboardList className="w-5 h-5"/></div>
                            <h4 className="font-semibold text-sm text-slate-800">{d.title}</h4>
                          </div>
                          <Button variant="outline" size="sm" onClick={() => setDocUrl(d.file_url)}>Solve DPP</Button>
                        </div>
                      ))
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* ================= LIVE CLASSES TAB ================= */}
        {mainTab === "Live" && (
          <div className="max-w-4xl mx-auto space-y-4">
            {upcomingLive.length === 0 ? <Empty msg="No live classes scheduled currently." /> :
             upcomingLive.map(lc => (
              <div key={lc.id} className="flex flex-col sm:flex-row gap-4 p-5 border rounded-3xl bg-white shadow-sm items-center">
                <div className="w-full sm:w-48 aspect-video bg-slate-900 rounded-2xl overflow-hidden relative shrink-0">
                  {lc.thumbnail_url && <img src={lc.thumbnail_url} className="w-full h-full object-cover opacity-50" />}
                  {lc.is_live && <span className="absolute top-2 left-2 bg-rose-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-md animate-pulse">LIVE NOW</span>}
                </div>
                <div className="flex-1 w-full text-center sm:text-left">
                  <h3 className="text-lg font-bold text-slate-900 line-clamp-2">{lc.title}</h3>
                  <div className="flex flex-wrap gap-x-4 gap-y-2 mt-2 justify-center sm:justify-start">
                    <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg">
                      <Clock className="w-4 h-4 text-slate-400"/>
                      {new Date(lc.scheduled_at).toLocaleString("en-IN", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                    </span>
                    {lc.subject && <span className="text-xs font-bold text-primary bg-primary/10 px-2.5 py-1 rounded-lg">{lc.subject}</span>}
                  </div>
                </div>
                <div className="w-full sm:w-auto shrink-0">
                  <Button 
                    className="w-full sm:w-auto rounded-xl shadow-md gap-2" 
                    size="lg"
                    onClick={() => {
                      if (lc.is_live && lc.youtube_url) playVideo(lc, true);
                      else if (lc.zoom_url) window.open(lc.zoom_url);
                      else toast.warning("Class has not started yet.");
                    }}
                  >
                    <Radio className="w-4 h-4" /> Join Class
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ================= TESTS TAB ================= */}
        {mainTab === "Tests" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl mx-auto">
            {tests.length === 0 ? <div className="col-span-2"><Empty msg="No tests assigned to this batch." /></div> :
             tests.map(t => (
               <div key={t.id} className="border bg-white rounded-3xl p-6 shadow-sm flex flex-col">
                 <div className="flex items-start justify-between mb-4">
                   <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center shrink-0">
                     <Award className="w-6 h-6" />
                   </div>
                   <span className="text-xs font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded-lg">{t.duration_minutes} mins</span>
                 </div>
                 <h3 className="text-lg font-bold text-slate-900 mb-1">{t.title}</h3>
                 <p className="text-sm text-slate-500 line-clamp-2 mb-6 flex-1">{t.description}</p>
                 
                 {t.attempt?.status === "completed" ? (
                   <div className="flex items-center justify-between mt-auto">
                     <div>
                       <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Your Score</p>
                       <p className="text-xl font-extrabold text-emerald-600">{t.attempt.score} <span className="text-sm text-emerald-600/50">/ {t.attempt.max_score}</span></p>
                     </div>
                     <Button variant="outline" asChild className="rounded-xl"><Link to="/cbt/$testId/result" params={{ testId: t.id }}>View Analysis</Link></Button>
                   </div>
                 ) : (
                   <Button asChild className="w-full rounded-xl shadow-md mt-auto"><Link to="/cbt/$testId" params={{ testId: t.id }}>Start Test</Link></Button>
                 )}
               </div>
             ))
            }
          </div>
        )}

        {/* ================= UPDATES TAB ================= */}
        {mainTab === "Updates" && (
          <div className="max-w-2xl mx-auto space-y-3">
             {notifications.length === 0 ? <Empty msg="No recent updates." /> :
              notifications.map(n => (
                <div key={n.id} className="flex gap-4 p-5 bg-white border rounded-3xl shadow-sm">
                  <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                    <Bell className="w-5 h-5"/>
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900">{n.title}</h4>
                    <p className="text-sm text-slate-600 mt-1 leading-relaxed">{n.message}</p>
                    <span className="text-[10px] font-bold text-slate-400 mt-3 block">
                      {new Date(n.created_at).toLocaleDateString()}
                    </span>
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
          onOpenChange={setTheaterOpen}
          src={playingVideo.src}
          poster={playingVideo.poster}
          title={playingVideo.title}
          meta={playingVideo.isLive ? "Live Class" : "Recorded Lecture"}
          liveClassId={playingVideo.isLive ? playingVideo.id : undefined}
          lectures={[]}
          activeLectureId={null}
          onLectureChange={() => {}}
        />
      )}

      <DocumentViewer url={docUrl} onClose={() => setDocUrl(null)} />
    </div>
  );
}

function Empty({ msg }: { msg: string }) {
  return (
    <div className="text-center py-16 px-4 bg-white border border-dashed rounded-3xl">
      <FolderOpen className="w-10 h-10 text-slate-300 mx-auto mb-3" />
      <p className="text-sm font-medium text-slate-500">{msg}</p>
    </div>
  );
}