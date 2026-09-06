import { useState } from "react";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  ArrowLeft, Video, FileText, ClipboardList, Radio, Clock, Calendar,
  BookOpen, Bell, ExternalLink, PlayCircle, Award, CheckCircle2,
} from "lucide-react";
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

// Helper: determine if a live class is "active" (currently live OR scheduled within next 24h)
function isActiveOrUpcoming(lc: { is_live: boolean; scheduled_at: string }) {
  if (lc.is_live) return true;
  const t = new Date(lc.scheduled_at).getTime();
  const now = Date.now();
  // Upcoming: starts within next 24h but hasn't started yet
  return t > now && t < now + 24 * 3600_000;
}

// Helper: determine if a live class has ended (timeline passed, not live)
function hasEnded(lc: { is_live: boolean; scheduled_at: string; duration_minutes?: number | null }) {
  if (lc.is_live) return false;
  const startTime = new Date(lc.scheduled_at).getTime();
  const durationMs = (lc.duration_minutes ?? 60) * 60_000;
  const endTime = startTime + durationMs;
  return Date.now() > endTime;
}

function BatchPortal() {
  const { slug } = Route.useParams();
  const { data } = useSuspenseQuery(batchPortalQuery(slug));
  const [tab, setTab] = useState<Tab>("classes");
  const [activeLecture, setActiveLecture] = useState<string | null>(null);
  const [theaterOpen, setTheaterOpen] = useState(false);
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

  // ─── LIVE TAB: only currently-live OR genuinely upcoming (future) classes ───
  // Ended classes are EXCLUDED from here — they move to the Classes/Recorded section only
  const activeLiveClasses = data.liveClasses.filter(isActiveOrUpcoming);

  // ─── RECORDED FROM LIVE: ended live classes that have a video replay ───
  // These show ONLY in the Classes tab, never in Live tab
  const endedLiveAsLectures = data.liveClasses
    .filter((lc) => hasEnded(lc) && lc.youtube_url)
    .map((lc) => ({
      id: lc.id,
      title: lc.title,
      description: lc.description,
      subject: null as string | null,
      chapter: null as string | null,
      lecture_number: null as number | null,
      duration_minutes: lc.duration_minutes as number | null,
      video_url: lc.youtube_url,
      thumbnail_url: lc.thumbnail_url,
      created_at: lc.scheduled_at,
      _source: "live" as const,
    }));

  const combinedLectures = [
    ...data.lectures.map((l) => ({ ...l, _source: "lecture" as const })),
    ...endedLiveAsLectures,
  ].sort((a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime());

  const notes = data.materials.filter((m) => m.material_type === "notes" || m.material_type === "pdf");
  const dpp = data.materials.filter((m) => m.material_type === "dpp");

  const tabs: { key: Tab; label: string; icon: typeof Video; count?: number }[] = [
    { key: "classes", label: "Classes", icon: Video, count: combinedLectures.length },
    { key: "live", label: "Live", icon: Radio, count: activeLiveClasses.length },
    { key: "notes", label: "Notes", icon: FileText, count: notes.length },
    { key: "dpp", label: "DPP", icon: ClipboardList, count: dpp.length },
    { key: "tests", label: "Tests", icon: Award, count: data.tests.length },
    { key: "updates", label: "Updates", icon: Bell, count: data.notifications.length },
  ];

  const current = activeLecture
    ? combinedLectures.find((l) => l.id === activeLecture) ?? null
    : null;

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
        <Link to="/dashboard" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-3.5 w-3.5" /> Dashboard
        </Link>
      </motion.div>

      {/* ─── Batch Hero Banner ─── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
        className="relative overflow-hidden rounded-3xl border border-border/60"
        style={data.batch.thumbnail_url ? {
          backgroundImage: `url(${data.batch.thumbnail_url})`,
          backgroundSize: "cover", backgroundPosition: "center",
        } : undefined}
      >
        <div className="bg-gradient-to-br from-primary/85 to-primary-glow/70 p-8 backdrop-blur-md sm:p-10">
          <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary-foreground/70">
            {data.batch.exam_category}
          </div>
          <h1 className="mt-1.5 text-3xl font-bold text-primary-foreground sm:text-4xl leading-tight">
            {data.batch.title}
          </h1>
          {data.batch.duration && (
            <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-black/20 px-3 py-1 text-xs text-primary-foreground/90">
              <Clock className="h-3.5 w-3.5" /> {data.batch.duration}
            </div>
          )}
        </div>
      </motion.div>

      {/* ─── Live / Upcoming Banner — only shows truly active/upcoming classes ─── */}
      {activeLiveClasses.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="mt-4 glass-strong rounded-3xl border border-red-500/25 p-5"
        >
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-red-500">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
            </span>
            Live / Upcoming Today
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {activeLiveClasses.slice(0, 2).map((lc) => (
              <div key={lc.id} className="rounded-2xl bg-background/50 p-4 border border-border/40">
                <div className="flex items-center gap-2 mb-1">
                  {lc.is_live && (
                    <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-red-500">
                      🔴 Live Now
                    </span>
                  )}
                </div>
                <div className="text-sm font-semibold">{lc.title}</div>
                <div className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                  <Calendar className="h-3 w-3" />
                  {new Date(lc.scheduled_at).toLocaleString("en-IN")}
                </div>
                {lc.is_live && lc.youtube_url && (
                  <Button
                    size="sm"
                    className="mt-3 gap-1.5"
                    onClick={() => {
                      setTheaterLive({ id: lc.id, src: lc.youtube_url!, poster: lc.thumbnail_url, title: lc.title });
                      setTheaterOpen(true);
                    }}
                  >
                    <PlayCircle className="h-3.5 w-3.5" /> Watch Live
                  </Button>
                )}
                {!lc.is_live && (lc.zoom_url || lc.meet_url) && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {lc.zoom_url && (
                      <Button size="sm" variant="secondary" asChild>
                        <a href={lc.zoom_url} target="_blank" rel="noreferrer">Zoom</a>
                      </Button>
                    )}
                    {lc.meet_url && (
                      <Button size="sm" variant="secondary" asChild>
                        <a href={lc.meet_url} target="_blank" rel="noreferrer">Meet</a>
                      </Button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* ─── Tab Bar ─── */}
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }}
        className="mt-6 flex flex-wrap gap-2"
      >
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all ${
              tab === t.key
                ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                : "glass hover:bg-muted/60 text-muted-foreground hover:text-foreground"
            }`}
          >
            <t.icon className="h-3.5 w-3.5" /> {t.label}
            {typeof t.count === "number" && (
              <span className={`rounded-full px-1.5 py-px text-[10px] font-semibold ${
                tab === t.key ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted-foreground/15 text-muted-foreground"
              }`}>{t.count}</span>
            )}
          </button>
        ))}
      </motion.div>

      <div className="mt-6">
        {/* ─── Classes Tab (recorded lectures + ended live classes) ─── */}
        {tab === "classes" && (
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              {current ? (
                <button
                  onClick={() => { setTheaterLive(null); setTheaterOpen(true); }}
                  className="glass-strong group relative block w-full overflow-hidden rounded-3xl text-left transition-transform hover:scale-[1.005]"
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
                      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/90 text-primary shadow-elegant transition group-hover:scale-105">
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
                      <p className="mt-2 text-sm text-muted-foreground line-clamp-2">{current.description}</p>
                    )}
                  </div>
                </button>
              ) : (
                <div className="glass-strong flex h-64 flex-col items-center justify-center gap-3 rounded-3xl text-center">
                  <PlayCircle className="h-10 w-10 text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">Select a lecture from the list to start watching</p>
                </div>
              )}
            </div>

            <div className="glass-strong rounded-3xl p-3">
              <div className="px-2 py-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
                All Lectures ({combinedLectures.length})
              </div>
              <div className="max-h-[520px] space-y-1 overflow-y-auto pr-1">
                {combinedLectures.length === 0 && (
                  <div className="p-4 text-sm text-muted-foreground text-center">No lectures published yet.</div>
                )}
                {combinedLectures.map((l) => (
                  <button
                    key={l.id}
                    onClick={() => { setActiveLecture(l.id); setTheaterLive(null); setTheaterOpen(true); }}
                    className={`flex w-full items-start gap-3 rounded-2xl p-3 text-left transition-colors ${
                      activeLecture === l.id ? "bg-primary/10 border border-primary/20" : "hover:bg-muted/60"
                    }`}
                  >
                    <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${
                      l._source === "live"
                        ? "bg-gradient-to-br from-orange-500 to-red-500"
                        : "bg-gradient-to-br from-primary to-primary-glow"
                    } text-white`}>
                      <PlayCircle className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">
                        {l.lecture_number ? `#${l.lecture_number} · ` : ""}{l.title}
                        {l._source === "live" && (
                          <span className="ml-1.5 rounded-full bg-orange-500/10 px-1.5 py-0.5 text-[9px] font-bold uppercase text-orange-500 align-middle">
                            REC
                          </span>
                        )}
                      </div>
                      {l._source === "lecture" && (
                        <div className="truncate text-[11px] text-muted-foreground">
                          {[l.subject, l.chapter, l.duration_minutes ? `${l.duration_minutes} min` : null]
                            .filter(Boolean).join(" • ")}
                        </div>
                      )}
                      {l._source === "live" && (
                        <div className="text-[11px] text-muted-foreground">
                          {new Date(l.created_at ?? "").toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ─── Live Tab — only active/upcoming classes, NO ended ones ─── */}
        {tab === "live" && (
          <div className="grid gap-4 sm:grid-cols-2">
            {activeLiveClasses.length === 0 && (
              <div className="glass-strong col-span-full rounded-3xl p-10 text-center">
                <Radio className="mx-auto h-8 w-8 text-muted-foreground/40 mb-3" />
                <p className="text-sm text-muted-foreground">No live classes right now.</p>
                <p className="text-xs text-muted-foreground/60 mt-1">
                  Past recordings are available in the Classes tab.
                </p>
              </div>
            )}
            {activeLiveClasses.map((lc) => (
              <div key={lc.id} className="glass-strong rounded-3xl p-5 border border-border/40">
                <div className="flex items-center gap-2 mb-3">
                  {lc.is_live ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/10 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-red-500">
                      <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
                      Live Now
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-primary">
                      Upcoming
                    </span>
                  )}
                  <span className="text-[11px] text-muted-foreground">
                    {new Date(lc.scheduled_at).toLocaleString("en-IN")}
                  </span>
                </div>
                <h3 className="font-semibold">{lc.title}</h3>
                {lc.description && (
                  <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{lc.description}</p>
                )}
                {lc.is_live && lc.youtube_url && (
                  <button
                    onClick={() => {
                      setTheaterLive({ id: lc.id, src: lc.youtube_url!, poster: lc.thumbnail_url, title: lc.title });
                      setTheaterOpen(true);
                    }}
                    className="group relative mt-4 block aspect-video w-full overflow-hidden rounded-2xl bg-black"
                  >
                    {lc.thumbnail_url ? (
                      <img src={lc.thumbnail_url} alt="" className="h-full w-full object-cover opacity-90 transition group-hover:opacity-100" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/40 to-primary-glow/30">
                        <PlayCircle className="h-10 w-10 text-white/70" />
                      </div>
                    )}
                    <div className="absolute inset-0 flex items-center justify-center bg-black/25 transition group-hover:bg-black/35">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/90 text-primary shadow-elegant">
                        <PlayCircle className="h-6 w-6" />
                      </div>
                    </div>
                  </button>
                )}
                {!lc.is_live && lc.youtube_url && (
                  <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" />
                    Stream will appear here when class goes live
                  </div>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  {lc.zoom_url && (
                    <Button size="sm" variant="secondary" asChild>
                      <a href={lc.zoom_url} target="_blank" rel="noreferrer">
                        <ExternalLink className="mr-1 h-3 w-3" /> Zoom
                      </a>
                    </Button>
                  )}
                  {lc.meet_url && (
                    <Button size="sm" variant="secondary" asChild>
                      <a href={lc.meet_url} target="_blank" rel="noreferrer">
                        <ExternalLink className="mr-1 h-3 w-3" /> Meet
                      </a>
                    </Button>
                  )}
                </div>
              </div>
            ))}
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
              <div key={t.id} className="glass-strong rounded-2xl p-4 border border-border/40">
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
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-500">
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
                No updates yet.
              </div>
            )}
            {data.notifications.map((n) => (
              <div key={n.id} className="glass-strong rounded-2xl p-4 border border-border/40">
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                    <Bell className="h-4 w-4 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold">{n.title}</div>
                    {n.body && (
                      <div className="mt-1 text-xs text-muted-foreground">{n.body}</div>
                    )}
                    <div className="mt-1.5 text-[11px] text-muted-foreground">
                      {new Date(n.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
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
      />
    )}
    </>
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
        <div key={m.id} className="glass-strong rounded-2xl p-4 border border-border/40">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary-glow">
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
