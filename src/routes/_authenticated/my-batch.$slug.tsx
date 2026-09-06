import { useState } from "react";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  ArrowLeft, Video, FileText, ClipboardList, Radio, Clock, Calendar,
  BookOpen, Bell, ExternalLink, PlayCircle, Award, CheckCircle2, Lock, AlertCircle, Sparkles,
  ChevronRight, ChevronDown, Folder, FolderOpen,
} from "lucide-react";

import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Section } from "@/components/section";
import { Button } from "@/components/ui/button";
import { TheaterModal, type TheaterLecture } from "@/components/theater-modal";
import { DocumentViewer } from "@/components/document-viewer";

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
          batch, enrolled: false, lectures: [], liveClasses: [], materials: [], notifications: [],
          tests: [] as {
            id: string; title: string; description: string | null; duration_minutes: number;
            attempt: { test_id: string; status: string; score: number; max_score: number } | null;
          }[],
        };
      }

      // Opportunistically start/end any due live classes (and auto-archive
      // ended ones to Lectures) before reading the list below.
      await supabase.rpc("tick_live_classes" as never);

      const [lectures, liveClasses, materials, notifications, batchTests, freeTests, myAttempts] = await Promise.all([
        supabase.from("lectures").select("*")
          .eq("batch_id", batch.id).eq("is_published", true)
          .order("lecture_number", { ascending: true }),
        supabase.from("live_classes").select("*")
          .eq("batch_id", batch.id).order("scheduled_at", { ascending: false }),
        supabase.from("study_materials").select("*")
          .eq("batch_id", batch.id).order("created_at", { ascending: false }),
        supabase.from("notifications").select("*")
          .order("created_at", { ascending: false }).limit(6),
        supabase.from("cbt_tests").select("id,title,description,duration_minutes")
          .eq("batch_id", batch.id).eq("is_published", true),
        supabase.from("cbt_tests").select("id,title,description,duration_minutes")
          .eq("access_mode", "free").eq("is_published", true),
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
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(batchPortalQuery(params.slug)),
  component: BatchPortal,
  errorComponent: ({ error }) => (
    <Section>
      <div className="mx-auto max-w-md glass-strong rounded-3xl p-8 text-center">
        <div className="text-sm text-destructive">{error.message}</div>
        <Link to="/dashboard" className="mt-4 inline-flex text-sm text-primary">← Dashboard</Link>
      </div>
    </Section>
  ),
  notFoundComponent: () => (
    <Section>
      <div className="mx-auto max-w-md glass-strong rounded-3xl p-8 text-center">
        <div className="text-lg font-semibold">Batch not found</div>
        <Link to="/dashboard" className="mt-4 inline-flex text-sm text-primary">← Dashboard</Link>
      </div>
    </Section>
  ),
});

type Tab = "classes" | "live" | "notes" | "dpp" | "tests" | "updates";

function BatchPortal() {
  const { slug } = Route.useParams();
  const { data } = useSuspenseQuery(batchPortalQuery(slug));
  const [tab, setTab] = useState<Tab>("classes");
  const [activeLecture, setActiveLecture] = useState<string | null>(null);
  const [theaterOpen, setTheaterOpen] = useState(false);
  // When set, the theater plays THIS live class instead of the classes-tab
  // "current" lecture (used when opening straight from the Live tab / the
  // today's-live banner, which aren't part of the lecture list).
  const [theaterLive, setTheaterLive] = useState<
    { id: string; src: string; poster?: string | null; title: string } | null
  >(null);

  if (!data.enrolled) {
    return (
      <Section>
        <div className="mx-auto max-w-lg glass-strong rounded-3xl p-10 text-center">
          <BookOpen className="mx-auto h-10 w-10 text-primary" />
          <h1 className="mt-4 text-2xl font-bold">{data.batch.title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            You haven't enrolled in this batch yet. Contact us to get access.
          </p>
          <div className="mt-6 flex justify-center gap-2">
            <Button asChild><Link to="/batches/$slug" params={{ slug }}>View batch</Link></Button>
            <Button asChild variant="ghost"><Link to="/dashboard">Dashboard</Link></Button>
          </div>
        </div>
      </Section>
    );
  }

  const now = Date.now();
  // Live classes scheduled for today or upcoming in next 48h (or active live)
  const todayOrUpcomingLive = data.liveClasses
    .filter((l) => {
      const t = new Date(l.scheduled_at).getTime();
      return l.is_live || (t > now - 3 * 3600_000 && t < now + 48 * 3600_000);
    })
    .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());

  // Check if live class is unlocked for playback (live or scheduled time reached)
  const isClassUnlocked = (lc: any) => {
    if (lc.is_live) return true;
    const t = new Date(lc.scheduled_at).getTime();
    return Date.now() >= t;
  };

  const handleLiveClassClick = (lc: any) => {
    if (!isClassUnlocked(lc)) {
      const timeStr = new Date(lc.scheduled_at).toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });
      const dateStr = new Date(lc.scheduled_at).toLocaleDateString("en-IN", {
        month: "short",
        day: "numeric",
      });
      toast.warning(
        `This live class is scheduled for ${dateStr} at ${timeStr}. Video will unlock and play strictly at that time!`,
        { duration: 4500 }
      );
      return;
    }

    if (lc.youtube_url) {
      setTheaterLive({
        id: lc.id,
        src: lc.youtube_url,
        poster: lc.thumbnail_url,
        title: lc.title,
      });
      setTheaterOpen(true);
    } else if (lc.zoom_url) {
      window.open(lc.zoom_url, "_blank");
    } else if (lc.meet_url) {
      window.open(lc.meet_url, "_blank");
    } else {
      toast.info("Teacher has not attached a video link yet.");
    }
  };

  const notes = data.materials.filter((m) => m.material_type === "notes" || m.material_type === "pdf");
  const dpp = data.materials.filter((m) => m.material_type === "dpp");

  // Recorded Lectures tab = real "lectures" table entries PLUS any live
  // class that has finished (is_live turned off) and has a video to replay.
  // No data is copied/duplicated — this just merges two sources for display,
  // so the moment a class ends it shows up here automatically.
  const endedLiveAsLectures = data.liveClasses
    .filter((lc) => !lc.is_live && lc.youtube_url)
    .map((lc) => ({
      id: lc.id,
      title: lc.title,
      description: lc.description,
      subject: null as string | null,
      chapter: null as string | null,
      lecture_number: null as number | null,
      duration_minutes: null as number | null,
      video_url: lc.youtube_url,
      thumbnail_url: lc.thumbnail_url,
      created_at: lc.scheduled_at,
      _source: "live" as const,
    }));

  const combinedLectures = [
    ...data.lectures.map((l) => ({ ...l, _source: "lecture" as const })),
    ...endedLiveAsLectures,
  ].sort((a, b) => {
    if (a.lecture_number != null && b.lecture_number != null) return a.lecture_number - b.lecture_number;
    if (a.lecture_number != null) return -1;
    if (b.lecture_number != null) return 1;
    return new Date(a.created_at ?? 0).getTime() - new Date(b.created_at ?? 0).getTime();
  });

  const tabs: { key: Tab; label: string; icon: typeof Video; count?: number }[] = [
    { key: "classes", label: "Classes", icon: Video, count: combinedLectures.length },
    { key: "live", label: "Live", icon: Radio, count: todayOrUpcomingLive.length },
    { key: "notes", label: "Notes", icon: FileText, count: notes.length },
    { key: "dpp", label: "DPP", icon: ClipboardList, count: dpp.length },
    { key: "tests", label: "Tests", icon: Award, count: data.tests.length },
    { key: "updates", label: "Updates", icon: Bell, count: data.notifications.length },
  ];

  const current = activeLecture
    ? combinedLectures.find((l) => l.id === activeLecture) ?? null
    : null;

  // What the theater modal is actually showing: a live class opened from
  // the Live tab / today's-live banner takes priority, otherwise it's
  // whatever's selected in the Classes tab.
  const nowPlaying = theaterLive
    ? {
        src: theaterLive.src,
        poster: theaterLive.poster,
        title: theaterLive.title,
        meta: "Live class",
        description: null as string | null,
        liveClassId: theaterLive.id,
      }
    : current
    ? {
        src: current.video_url ?? "",
        poster: current.thumbnail_url,
        title: current.title,
        meta: current._source === "live"
          ? "Recording of a past live class"
          : [current.subject, current.chapter].filter(Boolean).join(" • ") || "Lecture",
        description: current.description ?? null,
        liveClassId: current._source === "live" ? current.id : undefined,
      }
    : null;

  const theaterLectures: TheaterLecture[] = combinedLectures.map((l) => ({
    id: l.id,
    title: l.lecture_number ? `#${l.lecture_number} · ${l.title}` : l.title,
    subtitle: l._source === "lecture" ? [l.subject, l.chapter].filter(Boolean).join(" • ") : "Recording",
    isLive: l._source === "live",
  }));

  return (
    <>
    <Section>
      <motion.div
        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        className="mb-6"
      >
        <Link to="/dashboard" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Dashboard
        </Link>
      </motion.div>

      <div
        className="relative overflow-hidden rounded-3xl border border-border/60"
        style={data.batch.thumbnail_url ? {
          backgroundImage: `url(${data.batch.thumbnail_url})`,
          backgroundSize: "cover", backgroundPosition: "center",
        } : undefined}
      >
        <div className="bg-gradient-to-br from-primary/85 to-primary-glow/70 p-8 backdrop-blur-md sm:p-10">
          <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-primary-foreground/80">
            {data.batch.exam_category}
          </div>
          <h1 className="mt-1 text-3xl font-bold text-primary-foreground sm:text-4xl">{data.batch.title}</h1>
          {data.batch.duration && (
            <div className="mt-2 inline-flex items-center gap-1.5 text-xs text-primary-foreground/85">
              <Clock className="h-3.5 w-3.5" /> {data.batch.duration}
            </div>
          )}
        </div>
      </div>

      {/* Today's Live Class Schedule Banner (with Scheduled Timing Lock) */}
      {todayOrUpcomingLive.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-6 rounded-3xl bg-gradient-to-r from-red-500/10 via-amber-500/5 to-purple-500/10 border border-red-500/25 p-5 shadow-sm"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
              </span>
              <span className="text-xs font-bold uppercase tracking-wider text-red-600 dark:text-red-400">
                Today's Live Classes (आज की लाइव क्लास)
              </span>
            </div>
            <span className="text-[11px] text-muted-foreground">
              Video unlocks strictly at scheduled time (समय होने पर ही चलेगी)
            </span>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {todayOrUpcomingLive.map((lc) => {
              const unlocked = isClassUnlocked(lc);
              const timeStr = new Date(lc.scheduled_at).toLocaleTimeString("en-IN", {
                hour: "2-digit",
                minute: "2-digit",
                hour12: true,
              });
              const dateStr = new Date(lc.scheduled_at).toLocaleDateString("en-IN", {
                month: "short",
                day: "numeric",
              });

              return (
                <div
                  key={lc.id}
                  onClick={() => handleLiveClassClick(lc)}
                  className={`rounded-2xl p-4 transition-all border flex flex-col justify-between ${
                    unlocked
                      ? "bg-white dark:bg-slate-900 border-red-500/40 shadow-sm cursor-pointer hover:border-red-500"
                      : "bg-white/60 dark:bg-slate-900/60 border-slate-200 cursor-pointer hover:border-slate-300"
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                        <Radio className="w-4 h-4 text-red-500" />
                        {lc.title}
                      </div>
                      {unlocked ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-red-500 text-white animate-pulse">
                          🔴 Live Now
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-800 border border-amber-200 flex items-center gap-1">
                          <Lock className="w-3 h-3" />
                          Locked
                        </span>
                      )}
                    </div>
                    {lc.description && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{lc.description}</p>
                    )}
                    <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        {dateStr}
                      </span>
                      <span className="flex items-center gap-1 font-semibold text-slate-800 dark:text-slate-200">
                        <Clock className="w-3.5 h-3.5 text-primary" />
                        {timeStr}
                      </span>
                    </div>
                  </div>

                  <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <span className="text-[11px] text-muted-foreground">
                      {unlocked ? "Click to play immediately" : `Unlocks at ${timeStr}`}
                    </span>
                    <Button
                      size="sm"
                      className={`rounded-xl text-xs h-8 px-3 font-semibold ${
                        unlocked
                          ? "bg-red-600 hover:bg-red-700 text-white shadow-sm"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200"
                      }`}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleLiveClassClick(lc);
                      }}
                    >
                      {unlocked ? (
                        <>
                          <PlayCircle className="w-3.5 h-3.5 mr-1" /> Watch Live
                        </>
                      ) : (
                        <>
                          <Lock className="w-3.5 h-3.5 mr-1" /> Starts at {timeStr}
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}

      <div className="mt-6 flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`glass inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm transition ${
              tab === t.key ? "bg-primary text-primary-foreground" : "hover:bg-muted"
            }`}
          >
            <t.icon className="h-3.5 w-3.5" /> {t.label}
            {typeof t.count === "number" && (
              <span className={`rounded-full px-1.5 text-[10px] ${
                tab === t.key ? "bg-primary-foreground/20" : "bg-muted-foreground/10"
              }`}>{t.count}</span>
            )}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {tab === "classes" && (
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              {current ? (
                <button
                  onClick={() => { setTheaterLive(null); setTheaterOpen(true); }}
                  className="glass-strong group relative block w-full overflow-hidden rounded-3xl text-left"
                >
                  <div className="relative aspect-video w-full bg-black">
                    {current.thumbnail_url ? (
                      <img
                        src={current.thumbnail_url}
                        alt=""
                        className="h-full w-full object-cover opacity-90 transition group-hover:opacity-100"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/40 to-primary-glow/30">
                        <PlayCircle className="h-14 w-14 text-white/70" />
                      </div>
                    )}
                    <div className="absolute inset-0 flex items-center justify-center bg-black/25 transition group-hover:bg-black/35">
                      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary-glow text-primary-foreground shadow-elegant transition group-hover:scale-105">
                        <PlayCircle className="h-8 w-8" />
                      </div>
                    </div>
                    {current._source === "live" && (
                      <span className="absolute right-3 top-3 rounded-full bg-black/70 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-white">
                        Recording
                      </span>
                    )}
                  </div>
                  <div className="p-5">
                    <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                      {current._source === "live"
                        ? "Recording of a past live class · tap to watch"
                        : [current.subject, current.chapter].filter(Boolean).join(" • ") || "Lecture · tap to watch"}
                    </div>
                    <h3 className="mt-1 text-lg font-semibold">{current.title}</h3>
                    {current.description && (
                      <p className="mt-2 text-sm text-muted-foreground">{current.description}</p>
                    )}
                  </div>
                </button>
              ) : (
                <div className="glass-strong flex h-64 items-center justify-center rounded-3xl text-sm text-muted-foreground">
                  Select a lecture to start watching
                </div>
              )}
            </div>
            <div className="glass-strong rounded-3xl p-3">
              <div className="px-2 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                <span>Lectures ({combinedLectures.length})</span>
                {todayOrUpcomingLive.length > 0 && (
                  <span className="text-[10px] text-red-600 dark:text-red-400 font-bold bg-red-50 dark:bg-red-950/40 px-2 py-0.5 rounded-full border border-red-200 dark:border-red-800 flex items-center gap-1">
                    <Radio className="w-3 h-3 animate-pulse" />
                    {todayOrUpcomingLive.length} Live Today
                  </span>
                )}
              </div>
              <div className="max-h-[520px] space-y-1.5 overflow-y-auto pr-1">
                {/* 1. Today's / Upcoming Live Classes shown FIRST at the top */}
                {todayOrUpcomingLive.map((lc) => {
                  const unlocked = isClassUnlocked(lc);
                  const timeStr = new Date(lc.scheduled_at).toLocaleTimeString("en-IN", {
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: true,
                  });
                  return (
                    <button
                      key={lc.id}
                      onClick={() => handleLiveClassClick(lc)}
                      className={`flex w-full items-start gap-3 rounded-2xl p-3 text-left transition border ${
                        unlocked
                          ? "bg-red-500/10 border-red-500/30 hover:bg-red-500/20"
                          : "bg-muted/40 border-border/60 hover:bg-muted/60"
                      }`}
                    >
                      <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${
                        unlocked ? "bg-red-600 text-white shadow-sm" : "bg-muted text-muted-foreground"
                      }`}>
                        {unlocked ? <Radio className="h-4 w-4 animate-pulse" /> : <Lock className="h-4 w-4" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1">
                          <span className="truncate text-sm font-semibold text-foreground">
                            {lc.title}
                          </span>
                          <span className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded-full shrink-0 ${
                            unlocked ? "bg-red-600 text-white" : "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                          }`}>
                            {unlocked ? "LIVE" : "SCHEDULED"}
                          </span>
                        </div>
                        <div className="truncate text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {unlocked ? "Started • Tap to watch" : `Starts at ${timeStr} • Locked`}
                        </div>
                      </div>
                    </button>
                  );
                })}

                {/* 2. Subject → Chapter → Lecture accordion */}
                <LectureAccordion
                  lectures={combinedLectures}
                  materials={data.materials}
                  activeLecture={activeLecture}
                  onSelectLecture={(id) => { setActiveLecture(id); setTheaterLive(null); setTheaterOpen(true); }}
                />

              </div>
            </div>
          </div>
        )}

        {tab === "live" && (
          <div className="grid gap-4 sm:grid-cols-2">
            {data.liveClasses.length === 0 && (
              <div className="glass-strong col-span-full rounded-3xl p-8 text-center text-sm text-muted-foreground">
                No live classes scheduled yet.
              </div>
            )}
            {data.liveClasses.map((lc) => {
              const unlocked = isClassUnlocked(lc);
              const timeStr = new Date(lc.scheduled_at).toLocaleTimeString("en-IN", {
                hour: "2-digit",
                minute: "2-digit",
                hour12: true,
              });

              return (
                <div key={lc.id} className="glass-strong rounded-3xl p-5 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {unlocked ? (
                          <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-red-600">
                            🔴 Live
                          </span>
                        ) : (
                          <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400 flex items-center gap-1">
                            <Lock className="w-3 h-3" /> Scheduled
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-muted-foreground">
                        {new Date(lc.scheduled_at).toLocaleString("en-IN")}
                      </span>
                    </div>
                    <h3 className="mt-2 font-semibold text-foreground">{lc.title}</h3>
                    {lc.description && (
                      <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{lc.description}</p>
                    )}

                    {lc.youtube_url && (
                      <button
                        onClick={() => handleLiveClassClick(lc)}
                        className={`group relative mt-3 block aspect-video w-full overflow-hidden rounded-2xl bg-black ${
                          unlocked ? "cursor-pointer" : "cursor-pointer opacity-90"
                        }`}
                      >
                        {lc.thumbnail_url ? (
                          <img src={lc.thumbnail_url} alt="" className="h-full w-full object-cover opacity-90 transition group-hover:opacity-100" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/40 to-primary-glow/30">
                            <PlayCircle className="h-10 w-10 text-white/70" />
                          </div>
                        )}
                        <div className="absolute inset-0 flex items-center justify-center bg-black/25 transition group-hover:bg-black/35">
                          {unlocked ? (
                            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary-glow text-primary-foreground shadow-elegant">
                              <PlayCircle className="h-6 w-6" />
                            </div>
                          ) : (
                            <div className="flex flex-col items-center gap-1 bg-black/70 px-4 py-2 rounded-xl text-white">
                              <Lock className="h-5 w-5 text-amber-400" />
                              <span className="text-[10px] font-semibold">Unlocks at {timeStr}</span>
                            </div>
                          )}
                        </div>
                      </button>
                    )}
                  </div>

                  <div className="mt-4 pt-3 border-t border-border/50 flex flex-wrap items-center justify-between gap-2">
                    <Button
                      size="sm"
                      onClick={() => handleLiveClassClick(lc)}
                      className={`rounded-xl text-xs font-semibold ${
                        unlocked
                          ? "bg-red-600 hover:bg-red-700 text-white"
                          : "bg-muted text-muted-foreground hover:bg-muted/80"
                      }`}
                    >
                      {unlocked ? (
                        <>
                          <PlayCircle className="mr-1.5 h-3.5 w-3.5" /> Watch Live
                        </>
                      ) : (
                        <>
                          <Lock className="mr-1.5 h-3.5 w-3.5" /> Starts at {timeStr}
                        </>
                      )}
                    </Button>

                    <div className="flex flex-wrap gap-2">
                      {lc.zoom_url && (
                        <Button size="sm" variant="secondary" onClick={() => handleLiveClassClick(lc)}>
                          <ExternalLink className="mr-1 h-3 w-3" /> Zoom
                        </Button>
                      )}
                      {lc.meet_url && (
                        <Button size="sm" variant="secondary" onClick={() => handleLiveClassClick(lc)}>
                          <ExternalLink className="mr-1 h-3 w-3" /> Meet
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {tab === "notes" && <MaterialsList items={notes} empty="No notes uploaded yet." />}
        {tab === "dpp" && <MaterialsList items={dpp} empty="No DPP uploaded yet." />}

        {tab === "tests" && (
          <div className="space-y-3">
            {data.tests.length === 0 && (
              <div className="glass-strong rounded-3xl p-8 text-center text-sm text-muted-foreground">
                No tests available right now.
              </div>
            )}
            {data.tests.map((t: any) => (
              <div key={t.id} className="glass-strong rounded-2xl p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      <Award className="h-4 w-4 text-primary" /> {t.title}
                    </div>
                    {t.description && <div className="mt-1 text-xs text-muted-foreground">{t.description}</div>}
                    <div className="mt-1 text-[11px] text-muted-foreground">{t.duration_minutes} minutes</div>
                  </div>
                  {t.attempt?.status === "submitted" ? (
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-600">
                        <CheckCircle2 className="h-3 w-3" /> {t.attempt.score}/{t.attempt.max_score}
                      </span>
                      <Link to="/cbt/$testId/mistakes" params={{ testId: t.id }} search={{ attempt: t.attempt.id } as any}>
                        <Button size="sm" variant="outline">Review Mistakes</Button>
                      </Link>
                      <Link to="/cbt/$testId/result" params={{ testId: t.id }} search={{ attempt: t.attempt.id } as any}>
                        <Button size="sm">Report Card</Button>
                      </Link>
                    </div>
                  ) : (
                    <Link to="/cbt/$testId" params={{ testId: t.id }}>
                      <Button size="sm">{t.attempt?.status === "in_progress" ? "Resume Test" : "Start Test"}</Button>
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === "updates" && (
          <div className="space-y-3">
            {data.notifications.length === 0 && (
              <div className="glass-strong rounded-3xl p-8 text-center text-sm text-muted-foreground">
                No updates.
              </div>
            )}
            {data.notifications.map((n) => (
              <div key={n.id} className="glass-strong rounded-2xl p-4">
                <div className="flex items-start gap-3">
                  <Bell className="mt-0.5 h-4 w-4 text-primary" />
                  <div className="min-w-0">
                    <div className="text-sm font-semibold">{n.title}</div>
                    {n.body && (
                      <div className="mt-1 text-xs text-muted-foreground">{n.body}</div>
                    )}
                    <div className="mt-1 text-[11px] text-muted-foreground">
                      {new Date(n.created_at).toLocaleDateString("en-IN")}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Section>

    {nowPlaying && (
      <TheaterModal
        open={theaterOpen}
        onClose={() => setTheaterOpen(false)}
        videoSrc={nowPlaying.src}
        poster={nowPlaying.poster}
        title={nowPlaying.title}
        meta={nowPlaying.meta}
        description={nowPlaying.description}
        liveClassId={nowPlaying.liveClassId}
        lectures={theaterLectures}
        activeLectureId={theaterLive ? undefined : activeLecture ?? undefined}
        onSelectLecture={(id) => { setTheaterLive(null); setActiveLecture(id); }}
        notes={notes.map((m) => ({
          id: m.id, title: m.title,
          subtitle: [m.subject, m.chapter].filter(Boolean).join(" • "),
          file_url: m.file_url,
        }))}
        dpp={dpp.map((m) => ({
          id: m.id, title: m.title,
          subtitle: [m.subject, m.chapter].filter(Boolean).join(" • "),
          file_url: m.file_url,
        }))}
      />
    )}
    </>
  );
}

// ─── Lecture Accordion: Subject → Chapter → Lectures ────────────────────────
type LectureItem = {
  id: string; title: string; description?: string | null;
  subject?: string | null; chapter?: string | null;
  lecture_number?: number | null; duration_minutes?: number | null;
  video_url?: string | null; thumbnail_url?: string | null;
  _source: "lecture" | "live";
};

type Material = {
  id: string; title: string; subject?: string | null; chapter?: string | null;
  material_type: string; file_url?: string | null;
};

function LectureAccordion({
  lectures, materials, activeLecture, onSelectLecture,
}: {
  lectures: LectureItem[];
  materials: Material[];
  activeLecture: string | null;
  onSelectLecture: (id: string) => void;
}) {
  const [openSubjects, setOpenSubjects] = useState<Set<string>>(new Set(["__recordings__", "__uncategorized__"]));
  const [openChapters, setOpenChapters] = useState<Set<string>>(new Set());

  if (lectures.length === 0) {
    return <div className="p-4 text-sm text-muted-foreground">No lectures published yet.</div>;
  }

  // Group lectures into: subject → chapter → lectures[]
  type ChapterMap = Map<string, LectureItem[]>;
  type SubjectMap = Map<string, ChapterMap>;
  const grouped: SubjectMap = new Map();

  for (const l of lectures) {
    const subject = l._source === "live" ? "__recordings__" : (l.subject?.trim() || "__uncategorized__");
    const chapter = l._source === "live" ? "__recordings__" : (l.chapter?.trim() || "__uncategorized__");
    if (!grouped.has(subject)) grouped.set(subject, new Map());
    const cm = grouped.get(subject)!;
    if (!cm.has(chapter)) cm.set(chapter, []);
    cm.get(chapter)!.push(l);
  }

  const toggleSubject = (s: string) => setOpenSubjects((prev) => {
    const next = new Set(prev);
    next.has(s) ? next.delete(s) : next.add(s);
    return next;
  });
  const toggleChapter = (key: string) => setOpenChapters((prev) => {
    const next = new Set(prev);
    next.has(key) ? next.delete(key) : next.add(key);
    return next;
  });

  const subjectLabel = (s: string) => s === "__recordings__" ? "📹 Recordings" : s === "__uncategorized__" ? "All Lectures" : s;
  const chapterLabel = (c: string) => c === "__recordings__" || c === "__uncategorized__" ? null : c;

  return (
    <div className="space-y-1">
      {[...grouped.entries()].map(([subject, chapterMap]) => {
        const isSubjectOpen = openSubjects.has(subject);
        const totalLecs = [...chapterMap.values()].flat().length;
        return (
          <div key={subject}>
            {/* Subject Row */}
            <button
              onClick={() => toggleSubject(subject)}
              className="flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left transition hover:bg-muted/60"
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                {isSubjectOpen ? <FolderOpen className="h-4 w-4 text-primary" /> : <Folder className="h-4 w-4 text-primary" />}
              </span>
              <span className="flex-1 truncate text-sm font-semibold text-foreground">{subjectLabel(subject)}</span>
              <span className="text-[10px] text-muted-foreground mr-1">{totalLecs}</span>
              {isSubjectOpen ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
            </button>

            {isSubjectOpen && [...chapterMap.entries()].map(([chapter, lecs]) => {
              const chapterKey = `${subject}::${chapter}`;
              const isChapterOpen = openChapters.has(chapterKey);
              const label = chapterLabel(chapter);

              return (
                <div key={chapter} className="ml-4">
                  {label && (
                    <button
                      onClick={() => toggleChapter(chapterKey)}
                      className="flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-left transition hover:bg-muted/60"
                    >
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-muted">
                        {isChapterOpen ? <ChevronDown className="h-3 w-3 text-muted-foreground" /> : <ChevronRight className="h-3 w-3 text-muted-foreground" />}
                      </span>
                      <span className="flex-1 truncate text-xs font-semibold text-muted-foreground">{label}</span>
                      <span className="text-[10px] text-muted-foreground mr-1">{lecs.length}</span>
                    </button>
                  )}

                  {/* If no chapter label (uncategorized/recordings), show directly; else show inside accordion */}
                  {(!label || isChapterOpen) && (
                    <div className={label ? "ml-3" : ""}>
                      {lecs.map((l) => {
                        const lecMaterials = materials.filter(
                          (m) =>
                            (m.subject?.trim() || "") === (l.subject?.trim() || "") &&
                            (m.chapter?.trim() || "") === (l.chapter?.trim() || "")
                        );
                        const lecNotes = lecMaterials.filter((m) => m.material_type === "notes" || m.material_type === "pdf");
                        const lecDpp = lecMaterials.filter((m) => m.material_type === "dpp");

                        return (
                          <div key={l.id} className="mb-0.5">
                            <button
                              onClick={() => onSelectLecture(l.id)}
                              className={`flex w-full items-start gap-3 rounded-2xl p-3 text-left transition ${
                                activeLecture === l.id ? "bg-primary/10 ring-1 ring-primary/30" : "hover:bg-muted/60"
                              }`}
                            >
                              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary-glow text-primary-foreground">
                                <PlayCircle className="h-4 w-4" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="truncate text-sm font-medium">
                                  {l.lecture_number ? `Lec ${l.lecture_number} · ` : ""}{l.title}
                                  {l._source === "live" && (
                                    <span className="ml-1.5 rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-primary align-middle">
                                      Rec
                                    </span>
                                  )}
                                </div>
                                {l.duration_minutes && (
                                  <div className="text-[11px] text-muted-foreground">{l.duration_minutes} min</div>
                                )}
                              </div>
                            </button>

                            {/* Inline DPPs and Notes for this lecture */}
                            {(lecNotes.length > 0 || lecDpp.length > 0) && (
                              <div className="ml-11 mb-2 grid gap-1">
                                {lecNotes.map((m) => (
                                  <InlineMaterial key={m.id} item={m} badge="Notes" color="blue" />
                                ))}
                                {lecDpp.map((m) => (
                                  <InlineMaterial key={m.id} item={m} badge="DPP" color="orange" />
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

function InlineMaterial({ item, badge, color }: { item: Material; badge: string; color: "blue" | "orange" }) {
  const colorMap = {
    blue: "bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800",
    orange: "bg-orange-50 dark:bg-orange-950/30 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-800",
  };
  const badgeMap = {
    blue: "bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300",
    orange: "bg-orange-100 dark:bg-orange-900/50 text-orange-700 dark:text-orange-300",
  };
  if (!item.file_url) return null;
  return (
    <a
      href={item.file_url}
      target="_blank"
      rel="noreferrer"
      className={`flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs transition hover:opacity-80 ${colorMap[color]}`}
    >
      <FileText className="h-3.5 w-3.5 shrink-0" />
      <span className="min-w-0 flex-1 truncate">{item.title}</span>
      <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${badgeMap[color]}`}>{badge}</span>
    </a>
  );
}


function MaterialsList({ items, empty }: { items: any[]; empty: string }) {
  if (items.length === 0) {
    return (
      <div className="glass-strong rounded-3xl p-8 text-center text-sm text-muted-foreground">
        {empty}
      </div>
    );
  }
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {items.map((m) => (
        <div key={m.id} className="glass-strong rounded-2xl p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary-glow">
              <FileText className="h-4 w-4 text-primary-foreground" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold">{m.title}</div>
              <div className="text-[11px] text-muted-foreground">
                {[m.subject, m.chapter].filter(Boolean).join(" • ")}
              </div>
              {m.file_url && (
                <div className="mt-2">
                  <DocumentViewer url={m.file_url} title={m.title} />
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
