import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "framer-motion";
import { Loader2, ArrowLeft, Trophy, Medal } from "lucide-react";
import { getCbtPublicLeaderboard } from "@/lib/cbt.functions";
import { Section } from "@/components/section";

export const Route = createFileRoute("/_authenticated/cbt/$testId/leaderboard")({
  component: StudentLeaderboardPage,
});

const MEDAL_COLORS = ["text-amber-500", "text-zinc-400", "text-amber-700"];

function StudentLeaderboardPage() {
  const { testId } = Route.useParams();
  const fetchLeaderboard = useServerFn(getCbtPublicLeaderboard);

  const { data, isLoading, error } = useQuery({
    queryKey: ["cbt-public-leaderboard", testId],
    queryFn: () => fetchLeaderboard({ data: { test_id: testId } }),
  });

  if (isLoading) {
    return (
      <Section>
        <div className="flex justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </Section>
    );
  }
  if (error || !data) {
    return (
      <Section>
        <div className="mx-auto max-w-md glass-strong rounded-3xl p-10 text-center">
          <h1 className="text-xl font-bold">Leaderboard not available</h1>
          <p className="mt-2 text-sm text-muted-foreground">{(error as Error)?.message}</p>
          <Link to="/dashboard" className="mt-6 inline-block text-sm font-medium text-primary">
            Back to dashboard
          </Link>
        </div>
      </Section>
    );
  }

  return (
    <Section>
      <Link
        to="/dashboard"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Dashboard
      </Link>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mx-auto mt-6 max-w-xl">
        <div className="glass-strong rounded-3xl p-6 sm:p-8">
          <div className="text-center">
            <Trophy className="mx-auto h-10 w-10 text-amber-500" />
            <h1 className="mt-2 text-xl font-bold text-balance">{data.test_title}</h1>
            <p className="mt-1 text-sm text-muted-foreground">Top 20 Leaderboard</p>
          </div>

          {data.entries.length === 0 ? (
            <p className="mt-8 text-center text-sm text-muted-foreground">
              No submissions yet. Be the first to attempt this test!
            </p>
          ) : (
            <ol className="mt-6 flex flex-col gap-2">
              {data.entries.map((e, i) => (
                <motion.li
                  key={e.rank}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: Math.min(i * 0.04, 0.6) }}
                  className={`flex items-center gap-3 rounded-2xl border p-3 ${
                    e.is_me ? "border-primary/60 bg-primary/10" : "border-border/50"
                  }`}
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-background/60 text-sm font-bold">
                    {e.rank <= 3 ? <Medal className={`h-4 w-4 ${MEDAL_COLORS[e.rank - 1]}`} /> : e.rank}
                  </div>
                  <div className="min-w-0 flex-1 truncate text-sm font-medium">
                    {e.name}
                    {e.is_me && <span className="ml-1.5 text-xs font-semibold text-primary">(You)</span>}
                  </div>
                  <div className="shrink-0 text-sm font-bold tabular-nums">
                    {e.score}
                    <span className="text-xs font-normal text-muted-foreground">/{e.max_score}</span>
                  </div>
                </motion.li>
              ))}
            </ol>
          )}
        </div>
      </motion.div>
    </Section>
  );
}
