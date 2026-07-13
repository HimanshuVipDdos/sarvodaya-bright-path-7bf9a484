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
import { VideoPlayer } from "@/components/video-player";
import { LiveClassPlayer } from "@/components/live-class-player";
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
  const todayLive = data.liveClasses.filter((l) => {
    const t = new Date(l.scheduled_at).getTime();
    return l.is_live || (t > now - 2 * 3600_000 && t < now + 24 * 3600_000);
  });

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
  ].sort((a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime());

  const tabs: { key: Tab; label: string; icon: typeof Video; count?: number }[] = [
    { key: "classes", label: "Classes", icon: Video, count: combinedLectures.length },
    { key: "live", label: "Live", icon: Radio, count: todayLive.length },
    { key: "notes", label: "Notes", icon: FileText, count: notes.length },
    { key: "dpp", label: "DPP", icon: ClipboardList, count: dpp.length },
    { key: "tests", label: "Tests", icon: Award, count: data.tests.length },
    { key: "updates", label: "Updates", icon: Bell, count: data.notifications.length },
  ];

  const current = activeLecture
    ? combinedLectures.find((l) => l.id === activeLecture) ?? null
    : null;

  return (
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

      {todayLive.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          className="mt-4 glass-strong rounded-3xl border border-red-500/30 p-4"
        >
          <div className="flex items-center gap-2 text-xs font-semibold text-red-600 dark:text-red-400">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
            </span>
            LIVE / UPCOMING TODAY
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {todayLive.slice(0, 2).map((lc) => {
              return (
                <div key={lc.id} className="rounded-2xl bg-background/60 p-3">
                  <div className="text-sm font-semibold">{lc.title}</div>
                  <div className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    {new Date(lc.scheduled_at).toLocaleString("en-IN")}
                  </div>
                  {lc.is_live && lc.youtube_url && (
                    <div className="mt-2">
                      <LiveClassPlayer src={lc.youtube_url} title={lc.title} poster={lc.thumbnail_url ?? undefined} liveClassId={lc.id} />
                    </div>
                  )}
                  {!lc.is_live && (lc.zoom_url || lc.meet_url) && (
                    <div className="mt-2 flex flex-wrap gap-1">
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
                <div className="glass-strong overflow-hidden rounded-3xl">
                  {current._source === "live" ? (
                    <LiveClassPlayer
                      src={current.video_url ?? ""}
                      poster={current.thumbnail_url ?? undefined}
                      title={current.title}
                      liveClassId={current.id}
                    />
                  ) : (
                    <VideoPlayer
                      src={current.video_url ?? ""}
                      poster={current.thumbnail_url ?? undefined}
                      title={current.title}
                    />
                  )}
                  <div className="p-5">
                    <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                      {current._source === "live"
                        ? "Recording of a past live class"
                        : [current.subject, current.chapter].filter(Boolean).join(" • ") || "Lecture"}
                    </div>
                    <h3 className="mt-1 text-lg font-semibold">{current.title}</h3>
                    {current.description && (
                      <p className="mt-2 text-sm text-muted-foreground">{current.description}</p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="glass-strong flex h-64 items-center justify-center rounded-3xl text-sm text-muted-foreground">
                  Select a lecture to start watching
                </div>
              )}
            </div>
            <div className="glass-strong rounded-3xl p-3">
              <div className="px-2 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Lectures ({combinedLectures.length})
              </div>
              <div className="max-h-[520px] space-y-1 overflow-y-auto pr-1">
                {combinedLectures.length === 0 && (
                  <div className="p-4 text-sm text-muted-foreground">No lectures published yet.</div>
                )}
                {combinedLectures.map((l) => (
                  <button
                    key={l.id}
                    onClick={() => setActiveLecture(l.id)}
                    className={`flex w-full items-start gap-3 rounded-2xl p-3 text-left transition ${
                      activeLecture === l.id ? "bg-primary/10" : "hover:bg-muted/60"
                    }`}
                  >
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary-glow text-primary-foreground">
                      <PlayCircle className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">
                        {l.lecture_number ? `#${l.lecture_number} · ` : ""}{l.title}
                        {l._source === "live" && (
                          <span className="ml-1.5 rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-primary align-middle">
                            Recording
                          </span>
                        )}
                      </div>
                      {l._source === "lecture" && (
                        <div className="truncate text-[11px] text-muted-foreground">
                          {[l.subject, l.chapter, l.duration_minutes ? `${l.duration_minutes} min` : null]
                            .filter(Boolean).join(" • ")}
                        </div>
                      )}
                    </div>
                  </button>
                ))}
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
            {data.liveClasses.map((lc) => (
              <div key={lc.id} className="glass-strong rounded-3xl p-5">
                <div className="flex items-center gap-2">
                  {lc.is_live && (
                    <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-red-600">
                      🔴 Live
                    </span>
                  )}
                  <span className="text-[11px] text-muted-foreground">
                    {new Date(lc.scheduled_at).toLocaleString("en-IN")}
                  </span>
                </div>
                <h3 className="mt-2 font-semibold">{lc.title}</h3>
                {lc.description && (
                  <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{lc.description}</p>
                )}
                {lc.youtube_url && (
                  <div className="mt-3">
                    <LiveClassPlayer src={lc.youtube_url} title={lc.title} poster={lc.thumbnail_url ?? undefined} liveClassId={lc.id} />
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
