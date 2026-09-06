import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Award, CheckCircle2, ClipboardList } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Section } from "@/components/section";
import { Button } from "@/components/ui/button";

// Free tests (access_mode = 'free') are visible to every logged-in student
// via RLS regardless of whether they've enrolled in any batch. This page is
// the "Mock Test" destination students without a batch land on — previously
// free tests only ever showed up inside a paid batch's own Test tab, so
// students with no batch had nowhere to actually take them.
const mockTestsQuery = queryOptions({
  queryKey: ["mock-tests"],
  queryFn: async () => {
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) return { tests: [] as any[] };

    const [{ data: tests }, { data: attempts }] = await Promise.all([
      supabase
        .from("cbt_tests")
        .select("id,title,description,duration_minutes")
        .eq("access_mode", "free")
        .eq("is_published", true)
        .order("created_at", { ascending: false }),
      supabase
        .from("cbt_attempts")
        .select("test_id,id,status,score,max_score")
        .eq("user_id", userId),
    ]);

    const attemptByTest = new Map((attempts ?? []).map((a) => [a.test_id, a]));
    return {
      tests: (tests ?? []).map((t) => ({ ...t, attempt: attemptByTest.get(t.id) ?? null })),
    };
  },
});

export const Route = createFileRoute("/_authenticated/mock-tests")({
  loader: ({ context }) => context.queryClient.ensureQueryData(mockTestsQuery),
  component: MockTestsPage,
});

function MockTestsPage() {
  const { data } = useSuspenseQuery(mockTestsQuery);

  return (
    <Section>
      <div className="mb-6">
        <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-primary">Free for everyone</div>
        <h1 className="mt-1 text-3xl font-bold tracking-tight">Mock Tests</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Open to every student — no batch purchase needed.
        </p>
      </div>

      {data.tests.length === 0 ? (
        <div className="glass-strong rounded-3xl p-8 text-center text-sm text-muted-foreground">
          <ClipboardList className="mx-auto mb-3 h-8 w-8 opacity-50" />
          No mock tests available right now. Check back soon.
        </div>
      ) : (
        <div className="space-y-3">
          {data.tests.map((t: any) => (
            <motion.div key={t.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-strong rounded-2xl p-4">
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
            </motion.div>
          ))}
        </div>
      )}
    </Section>
  );
}
