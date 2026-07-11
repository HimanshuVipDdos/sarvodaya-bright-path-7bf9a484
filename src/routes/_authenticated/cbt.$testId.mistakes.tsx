import { z } from "zod";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, ArrowLeft, XCircle, CheckCircle2 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { getCbtAttemptResult } from "@/lib/cbt.functions";
import { Section } from "@/components/section";

export const Route = createFileRoute("/_authenticated/cbt/$testId/mistakes")({
  validateSearch: z.object({ attempt: z.string() }),
  component: MistakesPage,
});

const OPTION_LABELS = { a: "option_a", b: "option_b", c: "option_c", d: "option_d" } as const;

function MistakesPage() {
  const { testId } = Route.useParams();
  const { attempt: attemptId } = Route.useSearch();
  const fetchResult = useServerFn(getCbtAttemptResult);

  const { data, isLoading, error } = useQuery({
    queryKey: ["cbt-result", attemptId],
    queryFn: () => fetchResult({ data: { attempt_id: attemptId } }),
  });

  if (isLoading) {
    return <Section><div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div></Section>;
  }
  if (error || !data) {
    return (
      <Section>
        <div className="mx-auto max-w-md glass-strong rounded-3xl p-10 text-center">
          <h1 className="text-xl font-bold">Not found</h1>
          <p className="mt-2 text-sm text-muted-foreground">{(error as Error)?.message}</p>
        </div>
      </Section>
    );
  }

  const breakdown = (data.attempt.topic_breakdown ?? {}) as Record<string, { correct: number; wrong: number; unanswered: number }>;
  const chartData = Object.entries(breakdown).map(([topic, v]) => ({ topic, Correct: v.correct, Wrong: v.wrong, Unanswered: v.unanswered }));
  const weakest = [...chartData].sort((a, b) => b.Wrong - a.Wrong)[0];

  return (
    <Section>
      <Link
        to="/cbt/$testId/result" params={{ testId }} search={{ attempt: attemptId }}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Report Card
      </Link>

      <div className="mt-4 mb-6">
        <h1 className="text-2xl font-bold">Review & Weak Topics</h1>
        <p className="mt-1 text-sm text-muted-foreground">{data.attempt.test?.title}</p>
      </div>

      {chartData.length > 0 && (
        <div className="glass-strong mb-6 rounded-3xl p-4 sm:p-6">
          <div className="mb-3 text-sm font-semibold">Topic-wise performance</div>
          {weakest && weakest.Wrong > 0 && (
            <p className="mb-3 text-xs text-muted-foreground">
              Your weakest topic is <span className="font-semibold text-destructive">{weakest.topic}</span> — focus revision there.
            </p>
          )}
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="topic" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="Correct" fill="#22c55e" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Wrong" fill="#ef4444" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Unanswered" fill="#a1a1aa" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {data.mistakes.length === 0 && (
          <div className="glass-strong rounded-3xl p-8 text-center text-sm text-muted-foreground">
            <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-emerald-500" />
            Perfect score — no mistakes to review!
          </div>
        )}
        {data.mistakes.map((m: any, i: number) => (
          <div key={i} className="glass-strong rounded-2xl p-5">
            <div className="flex items-start gap-2 text-sm font-semibold">
              <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" /> {m.question_text}
            </div>
            <div className="mt-1 text-[11px] uppercase tracking-wide text-muted-foreground">{m.topic}</div>
            <div className="mt-3 space-y-1.5 text-sm">
              {(["a", "b", "c", "d"] as const).map((opt) => {
                const isCorrect = opt === m.correct_option;
                const isSelected = opt === m.selected_option;
                return (
                  <div
                    key={opt}
                    className={`rounded-lg border p-2 ${
                      isCorrect ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" :
                      isSelected ? "border-destructive/50 bg-destructive/10 text-destructive" :
                      "border-border/50"
                    }`}
                  >
                    {m[OPTION_LABELS[opt]]}
                    {isCorrect && " ✓ Correct answer"}
                    {isSelected && !isCorrect && " ✗ Your answer"}
                  </div>
                );
              })}
              {!m.selected_option && <div className="text-xs text-muted-foreground">You didn't answer this question.</div>}
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}
