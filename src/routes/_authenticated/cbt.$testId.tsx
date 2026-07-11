import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "framer-motion";
import { Clock, Loader2, ArrowLeft, Send } from "lucide-react";
import { toast } from "sonner";
import { startCbtAttempt, submitCbtAttempt } from "@/lib/cbt.functions";
import { Section } from "@/components/section";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/cbt/$testId")({
  component: TestTakingPage,
});

function formatTime(sec: number) {
  const m = Math.floor(sec / 60).toString().padStart(2, "0");
  const s = Math.floor(sec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function TestTakingPage() {
  const { testId } = Route.useParams();
  const navigate = useNavigate();
  const start = useServerFn(startCbtAttempt);
  const submit = useServerFn(submitCbtAttempt);

  const { data, isLoading, error } = useQuery({
    queryKey: ["cbt-start", testId],
    queryFn: () => start({ data: { test_id: testId } }),
    staleTime: Infinity,
    retry: false,
  });

  const [answers, setAnswers] = useState<Record<string, "a" | "b" | "c" | "d">>({});
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (data?.test?.duration_minutes && secondsLeft === null) {
      setSecondsLeft(data.test.duration_minutes * 60);
    }
  }, [data, secondsLeft]);

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!data) return;
      const payload = data.questions.map((q) => ({
        question_id: q.id,
        selected_option: answers[q.id] ?? null,
      }));
      return submit({ data: { attempt_id: data.attempt_id, answers: payload } });
    },
    onSuccess: (res) => {
      if (!res) return;
      setSubmitted(true);
      navigate({ to: "/cbt/$testId/result", params: { testId }, search: { attempt: res.attempt_id } as any });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  useEffect(() => {
    if (secondsLeft === null || submitted || submitMutation.isPending) return;
    if (secondsLeft <= 0) {
      toast.info("Time's up! Submitting your test…");
      submitMutation.mutate();
      return;
    }
    const t = setTimeout(() => setSecondsLeft((s) => (s ?? 0) - 1), 1000);
    return () => clearTimeout(t);
  }, [secondsLeft, submitted, submitMutation]);

  const answeredCount = Object.keys(answers).length;
  const totalQuestions = data?.questions.length ?? 0;

  if (isLoading) {
    return (
      <Section>
        <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      </Section>
    );
  }

  if (error || !data) {
    return (
      <Section>
        <div className="mx-auto max-w-md glass-strong rounded-3xl p-10 text-center">
          <h1 className="text-xl font-bold">Can't start this test</h1>
          <p className="mt-2 text-sm text-muted-foreground">{(error as Error)?.message ?? "Something went wrong."}</p>
          <Link to="/dashboard" className="mt-6 inline-block text-sm font-medium text-primary">Back to dashboard</Link>
        </div>
      </Section>
    );
  }

  return (
    <Section>
      <div className="sticky top-16 z-10 mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/60 bg-background/95 p-4 backdrop-blur">
        <div>
          <h1 className="text-lg font-bold">{data.test.title}</h1>
          <p className="text-xs text-muted-foreground">{answeredCount} of {totalQuestions} answered</p>
        </div>
        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold ${
            (secondsLeft ?? 0) < 60 ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"
          }`}>
            <Clock className="h-4 w-4" /> {secondsLeft !== null ? formatTime(secondsLeft) : "--:--"}
          </div>
          <Button
            onClick={() => { if (confirm("Submit the test? You can't change answers after this.")) submitMutation.mutate(); }}
            disabled={submitMutation.isPending}
            className="gap-2"
          >
            {submitMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Submit
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        {data.questions.map((q, i) => (
          <motion.div key={q.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="glass-strong rounded-2xl p-5">
            <div className="text-sm font-semibold">Q{i + 1}. {q.question_text}</div>
            <RadioGroup
              value={answers[q.id] ?? ""}
              onValueChange={(v) => setAnswers((a) => ({ ...a, [q.id]: v as "a" | "b" | "c" | "d" }))}
              className="mt-3 space-y-2"
            >
              {(["a", "b", "c", "d"] as const).map((opt) => (
                <label key={opt} className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-border/60 p-3 text-sm hover:bg-muted/40">
                  <RadioGroupItem value={opt} id={`${q.id}-${opt}`} />
                  <span>{(q as any)[`option_${opt}`]}</span>
                </label>
              ))}
            </RadioGroup>
          </motion.div>
        ))}
      </div>

      <div className="mt-6 flex justify-end">
        <Button
          size="lg"
          onClick={() => { if (confirm("Submit the test? You can't change answers after this.")) submitMutation.mutate(); }}
          disabled={submitMutation.isPending}
          className="gap-2"
        >
          {submitMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Submit Test
        </Button>
      </div>
    </Section>
  );
}
