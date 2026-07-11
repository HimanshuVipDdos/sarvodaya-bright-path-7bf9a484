import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  BookOpen,
  FileText,
  Bell,
  Trophy,
  LogOut,
  Shield,
  User,
  BarChart3,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Section } from "@/components/section";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const dashboardQuery = queryOptions({
  queryKey: ["dashboard"],
  queryFn: async () => {
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId)
      return { profile: null, enrollments: [], roles: [], attempts: [] };

    const [profile, enrollments, roles, attempts] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
      supabase.from("enrollments").select("*, batch:batches(*)").eq("user_id", userId),
      supabase.from("user_roles").select("role").eq("user_id", userId),
      supabase
        .from("cbt_attempts")
        .select("id, test_id, score, max_score, submitted_at, test:cbt_tests(title)")
        .eq("user_id", userId)
        .eq("status", "submitted")
        .order("submitted_at", { ascending: false })
        .limit(5),
    ]);
    return {
      profile: profile.data,
      enrollments: enrollments.data ?? [],
      roles: (roles.data ?? []).map((r) => r.role),
      attempts: attempts.data ?? [],
    };
  },
});

export const Route = createFileRoute("/_authenticated/dashboard")({
  loader: ({ context }) => context.queryClient.ensureQueryData(dashboardQuery),
  component: Dashboard,
});

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function Dashboard() {
  const { data } = useSuspenseQuery(dashboardQuery);
  const isAdmin = (data.roles as string[]).includes("admin");

  const testsAttempted = data.attempts.length;
  const avgPct =
    testsAttempted > 0
      ? Math.round(
          data.attempts.reduce(
            (sum, a) => sum + (a.max_score > 0 ? (a.score / a.max_score) * 100 : 0),
            0,
          ) / testsAttempted,
        )
      : 0;
  const bestPct =
    testsAttempted > 0
      ? Math.max(
          ...data.attempts.map((a) => (a.max_score > 0 ? Math.round((a.score / a.max_score) * 100) : 0)),
        )
      : 0;

  async function handleSignOut() {
    await supabase.auth.signOut();
    toast.success("Signed out");
    window.location.href = "/";
  }

  return (
    <Section>
      {/* ---- Welcome header ---- */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-strong relative mb-6 overflow-hidden rounded-3xl p-6 sm:p-8"
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-60"
          style={{
            background:
              "radial-gradient(80% 90% at 90% -20%, color-mix(in oklab, var(--primary-glow) 30%, transparent), transparent 60%)",
          }}
        />
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.18em] text-primary">
              <Sparkles className="h-3.5 w-3.5" /> {greeting()}
            </div>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-balance sm:text-3xl">
              {data.profile?.full_name ?? "Student"}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {data.profile?.exam_target
                ? `Preparing for ${data.profile.exam_target} — keep going!`
                : "Your learning hub — classes, notes and tests in one place."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm" variant="ghost" className="glass rounded-full">
              <Link to="/profile">
                <User className="mr-1.5 h-4 w-4" /> My Profile
              </Link>
            </Button>
            {isAdmin && (
              <Button asChild size="sm" variant="ghost" className="glass rounded-full">
                <Link to="/admin">
                  <Shield className="mr-1.5 h-4 w-4" /> Admin
                </Link>
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={handleSignOut} className="glass rounded-full">
              <LogOut className="mr-1.5 h-4 w-4" /> Sign out
            </Button>
          </div>
        </div>
      </motion.div>

      {/* ---- Real stats ---- */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {[
          { icon: BookOpen, label: "My Batches", value: String(data.enrollments.length) },
          { icon: Trophy, label: "Tests Attempted", value: String(testsAttempted) },
          { icon: BarChart3, label: "Average Score", value: testsAttempted ? `${avgPct}%` : "—" },
          { icon: Sparkles, label: "Best Score", value: testsAttempted ? `${bestPct}%` : "—" },
        ].map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 * i }}
            className="glass-strong rounded-3xl p-4 sm:p-5"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary-glow sm:h-10 sm:w-10">
              <s.icon className="h-4 w-4 text-primary-foreground sm:h-5 sm:w-5" />
            </div>
            <div className="mt-3 text-xl font-bold sm:text-2xl">{s.value}</div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground sm:text-[11px]">
              {s.label}
            </div>
          </motion.div>
        ))}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        {/* ---- My batches ---- */}
        <div className="glass-strong rounded-3xl p-6 lg:col-span-2">
          <h2 className="text-lg font-semibold">My Batches</h2>
          {data.enrollments.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-dashed border-border p-8 text-center">
              <BookOpen className="mx-auto h-8 w-8 text-muted-foreground" />
              <p className="mt-3 text-sm text-muted-foreground">
                You haven&apos;t enrolled in any batch yet.
              </p>
              <Button asChild className="mt-4 rounded-full bg-gradient-to-br from-primary to-primary-glow">
                <Link to="/batches">Browse batches</Link>
              </Button>
            </div>
          ) : (
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {data.enrollments.map((e: any) => (
                <Link
                  key={e.id}
                  to="/my-batch/$slug"
                  params={{ slug: e.batch?.slug ?? "" }}
                  className="group relative overflow-hidden rounded-2xl border border-border/60 bg-card transition hover:shadow-elegant"
                >
                  <div className="relative aspect-[16/9] w-full overflow-hidden bg-gradient-to-br from-primary to-primary-glow">
                    {e.batch?.thumbnail_url && (
                      <img
                        src={e.batch.thumbnail_url}
                        alt={e.batch?.title ?? ""}
                        className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                      />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent" />
                    <div className="absolute inset-x-0 bottom-0 p-3">
                      <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-white/85">
                        {e.batch?.exam_category}
                      </div>
                      <div className="mt-0.5 line-clamp-1 text-sm font-semibold text-white">
                        {e.batch?.title}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between px-4 py-3">
                    <span className="text-[11px] text-muted-foreground">
                      {e.payment_status === "paid" ? "✓ Paid" : e.payment_status ?? "Enrolled"}
                    </span>
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                      Open →
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* ---- Sidebar: recent tests + quick links ---- */}
        <div className="space-y-6">
          <div className="glass-strong rounded-3xl p-6">
            <h2 className="text-lg font-semibold">Recent Tests</h2>
            {data.attempts.length === 0 ? (
              <p className="mt-4 text-sm text-muted-foreground">
                No test attempted yet. Tests appear inside your batch portal.
              </p>
            ) : (
              <ul className="mt-4 space-y-2">
                {data.attempts.map((a) => {
                  const pct = a.max_score > 0 ? Math.round((a.score / a.max_score) * 100) : 0;
                  return (
                    <li key={a.id}>
                      <Link
                        to="/cbt/$testId/result"
                        params={{ testId: a.test_id }}
                        search={{ attempt: a.id }}
                        className="glass flex items-center justify-between gap-2 rounded-2xl p-3 transition-colors hover:bg-primary/5"
                      >
                        <span className="min-w-0 truncate text-sm">
                          {(a.test as { title: string } | null)?.title ?? "Test"}
                        </span>
                        <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                          {pct}%
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="glass-strong rounded-3xl p-6">
            <h2 className="text-lg font-semibold">Quick Links</h2>
            <ul className="mt-4 space-y-2 text-sm">
              {[
                { icon: User, label: "My Profile", to: "/profile" },
                { icon: FileText, label: "Free Study Material", to: "/free-study-material" },
                { icon: Bell, label: "Announcements", to: "/notifications" },
                { icon: BookOpen, label: "All Batches", to: "/batches" },
              ].map((q) => (
                <li key={q.label}>
                  <Link
                    to={q.to}
                    className="glass flex items-center justify-between rounded-2xl p-3 transition-colors hover:bg-primary/5"
                  >
                    <span className="flex items-center gap-3">
                      <q.icon className="h-4 w-4 text-primary" />
                      {q.label}
                    </span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </Section>
  );
}
