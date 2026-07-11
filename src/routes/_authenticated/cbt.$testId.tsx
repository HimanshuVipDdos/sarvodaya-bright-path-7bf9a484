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
import { useEffect, useMemo, useState, useCallback } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Clock, Loader2, Send, ChevronLeft, ChevronRight, 
  Maximize2, Minimize2, Flag, Eye 
} from "lucide-react";
import { toast } from "sonner";
import { startCbtAttempt, submitCbtAttempt } from "@/lib/cbt.functions";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/cbt/$testId")({
  component: TestTakingPage,
});

/* ============ FULL SCREEN HOOK ============ */
function useFullscreen() {
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  const enter = useCallback(async () => {
    try {
      await document.documentElement.requestFullscreen();
      // Also lock screen orientation if mobile
      if ((screen as any).orientation?.lock) {
        await (screen as any).orientation.lock("landscape");
      }
    } catch (e) {
      console.log("Fullscreen not supported");
    }
  }, []);

  const exit = useCallback(() => {
    if (document.fullscreenElement) document.exitFullscreen();
  }, []);

  return { isFullscreen, enter, exit };
}

/* ============ CBT TIMER ============ */
function useTimer(durationMinutes: number, onTimeUp: () => void) {
  const [secondsLeft, setSecondsLeft] = useState(durationMinutes * 60);

  useEffect(() => {
    if (secondsLeft <= 0) {
      onTimeUp();
      return;
    }
    const t = setTimeout(() => setSecondsLeft(s => s - 1), 1000);
    return () => clearTimeout(t);
  }, [secondsLeft, onTimeUp]);

  const format = (sec: number) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60).toString().padStart(2, "0");
    const s = (sec % 60).toString().padStart(2, "0");
    return h > 0 ? `${h}:${m}:${s}` : `${m}:${s}`;
  };

  return { secondsLeft, formatted: format(secondsLeft) };
}

/* ============ MAIN CBT COMPONENT ============ */
function TestTakingPage() {
  const { testId } = Route.useParams();
  const navigate = useNavigate();
  const start = useServerFn(startCbtAttempt);
  const submit = useServerFn(submitCbtAttempt);
  const { isFullscreen, enter: enterFullscreen } = useFullscreen();

  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, "a" | "b" | "c" | "d">>({});
  const [flagged, setFlagged] = useState<Set<string>>(new Set());
  const [submitted, setSubmitted] = useState(false);

  // Auto-enter fullscreen when test starts
  useEffect(() => {
    const timer = setTimeout(() => enterFullscreen(), 500);
    return () => clearTimeout(timer);
  }, [enterFullscreen]);

  const { data, isLoading, error } = useQuery({
    queryKey: ["cbt-start", testId],
    queryFn: () => start({ data: { test_id: testId } }),
    staleTime: Infinity,
    retry: false,
  });

  const timer = useTimer(data?.test?.duration_minutes ?? 30, () => {
    toast.info("Time's up! Auto-submitting...");
    handleSubmit();
  });

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
      navigate({ 
        to: "/cbt/$testId/result", 
        params: { testId }, 
        search: { attempt: res.attempt_id } as any 
      });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleSubmit = useCallback(() => {
    const answered = Object.keys(answers).length;
    const total = data?.questions.length ?? 0;
    const msg = answered < total 
      ? `Only ${answered}/${total} answered. Submit anyway?` 
      : "Submit the test? You can't change answers after this.";
    if (confirm(msg)) submitMutation.mutate();
  }, [answers, data, submitMutation]);

  const toggleFlag = (qId: string) => {
    setFlagged(prev => {
      const next = new Set(prev);
      if (next.has(qId)) next.delete(qId);
      else next.add(qId);
      return next;
    });
  };

  if (isLoading) return <FullscreenLoader text="Loading your test..." />;
  if (error || !data) return <ErrorScreen error={error} />;

  const questions = data.questions;
  const currentQ = questions[currentQIndex];
  const answeredCount = Object.keys(answers).length;
  const totalQuestions = questions.length;

  return (
    <div className="fixed inset-0 bg-background flex flex-col">
      {/* ===== OFFICIAL CBT HEADER ===== */}
      <header className="flex-shrink-0 bg-primary text-primary-foreground px-4 py-2">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="font-bold text-sm sm:text-base truncate max-w-[200px] sm:max-w-md">
              {data.test.title}
            </h1>
            <span className="text-[10px] bg-primary-foreground/20 px-2 py-0.5 rounded-full">
              Q{currentQIndex + 1} of {totalQuestions}
            </span>
          </div>
          
          <div className="flex items-center gap-4">
            {/* Timer - Official CBT Style */}
            <div className={cn(
              "flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-mono font-bold",
              timer.secondsLeft < 300 ? "bg-red-500 animate-pulse" : "bg-primary-foreground/20"
            )}>
              <Clock className="h-4 w-4" />
              {timer.formatted}
            </div>
            
            <Button 
              size="sm" 
              onClick={handleSubmit}
              disabled={submitMutation.isPending}
              className="bg-white text-primary hover:bg-white/90 gap-1"
            >
              {submitMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
              Submit
            </Button>
          </div>
        </div>
      </header>

      {/* ===== MAIN CONTENT: Question + Palette ===== */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Question Area */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentQ.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="max-w-3xl mx-auto"
            >
              {/* Question Card */}
              <div className="bg-card border rounded-2xl p-5 sm:p-6 shadow-sm">
                <div className="flex items-start justify-between gap-2 mb-4">
                  <h2 className="text-base sm:text-lg font-medium leading-relaxed">
                    <span className="text-primary font-bold mr-2">Q{currentQIndex + 1}.</span>
                    {currentQ.question_text}
                  </h2>
                  <button
                    onClick={() => toggleFlag(currentQ.id)}
                    className={cn(
                      "p-1.5 rounded-lg transition-colors",
                      flagged.has(currentQ.id) ? "text-yellow-500 bg-yellow-500/10" : "text-muted-foreground hover:bg-muted"
                    )}
                    title="Flag for review"
                  >
                    <Flag className="h-4 w-4" fill={flagged.has(currentQ.id) ? "currentColor" : "none"} />
                  </button>
                </div>

                {/* Options - Official CBT Radio Style */}
                <RadioGroup
                  value={answers[currentQ.id] ?? ""}
                  onValueChange={(v) => setAnswers(a => ({ ...a, [currentQ.id]: v as "a" | "b" | "c" | "d" }))}
                  className="space-y-2"
                >
                  {(["a", "b", "c", "d"] as const).map((opt) => (
                    <label
                      key={opt}
                      className={cn(
                        "flex items-center gap-3 p-3 sm:p-4 rounded-xl border-2 cursor-pointer transition-all",
                        answers[currentQ.id] === opt
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/30 hover:bg-muted/30"
                      )}
                    >
                      <RadioGroupItem value={opt} id={`${currentQ.id}-${opt}`} />
                      <span className="font-bold text-primary min-w-[20px]">{opt.toUpperCase()}.</span>
                      <span className="text-sm">{(currentQ as any)[`option_${opt}`]}</span>
                    </label>
                  ))}
                </RadioGroup>
              </div>

              {/* Navigation Buttons */}
              <div className="flex items-center justify-between mt-6">
                <Button
                  variant="outline"
                  onClick={() => setCurrentQIndex(i => Math.max(0, i - 1))}
                  disabled={currentQIndex === 0}
                  className="gap-1"
                >
                  <ChevronLeft className="h-4 w-4" /> Previous
                </Button>
                
                {currentQIndex < totalQuestions - 1 ? (
                  <Button
                    onClick={() => setCurrentQIndex(i => i + 1)}
                    className="gap-1"
                  >
                    Next <ChevronRight className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button
                    onClick={handleSubmit}
                    disabled={submitMutation.isPending}
                    className="gap-1 bg-green-600 hover:bg-green-700"
                  >
                    {submitMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    Submit Test
                  </Button>
                )}
              </div>
            </motion.div>
          </AnimatePresence>
        </main>

        {/* Right: Question Palette (Official CBT Style) */}
        <aside className="hidden lg:block w-72 border-l bg-muted/30 overflow-y-auto p-4">
          <h3 className="text-sm font-semibold mb-3">Question Palette</h3>
          
          {/* Legend */}
          <div className="flex flex-wrap gap-2 text-[10px] mb-4">
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-green-500" /> Answered</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-yellow-500" /> Flagged</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-primary" /> Current</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-gray-300" /> Unanswered</span>
          </div>

          {/* Grid */}
          <div className="grid grid-cols-5 gap-1.5">
            {questions.map((q, i) => {
              const isAnswered = !!answers[q.id];
              const isFlagged = flagged.has(q.id);
              const isCurrent = i === currentQIndex;
              
              return (
                <button
                  key={q.id}
                  onClick={() => setCurrentQIndex(i)}
                  className={cn(
                    "aspect-square rounded-lg text-xs font-bold transition-all",
                    isCurrent ? "ring-2 ring-primary ring-offset-1 bg-primary text-primary-foreground"
                    : isAnswered && isFlagged ? "bg-yellow-500 text-white"
                    : isAnswered ? "bg-green-500 text-white"
                    : isFlagged ? "bg-yellow-200 text-yellow-700"
                    : "bg-gray-200 text-gray-600 hover:bg-gray-300"
                  )}
                >
                  {i + 1}
                </button>
              );
            })}
          </div>

          {/* Stats */}
          <div className="mt-4 pt-4 border-t space-y-1 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Answered</span>
              <span className="font-bold text-green-600">{answeredCount}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Flagged</span>
              <span className="font-bold text-yellow-600">{flagged.size}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Unanswered</span>
              <span className="font-bold text-red-500">{totalQuestions - answeredCount}</span>
            </div>
          </div>

          {/* Submit from Palette */}
          <Button
            onClick={handleSubmit}
            disabled={submitMutation.isPending}
            className="w-full mt-4 gap-1"
            variant="destructive"
          >
            <Send className="h-3 w-3" /> Submit Test
          </Button>
        </aside>
      </div>

      {/* ===== MOBILE PALETTE (Bottom Sheet) ===== */}
      <MobilePalette
        questions={questions}
        currentQIndex={currentQIndex}
        answers={answers}
        flagged={flagged}
        onSelect={setCurrentQIndex}
        answeredCount={answeredCount}
        totalQuestions={totalQuestions}
      />
    </div>
  );
}

/* ============ SUB-COMPONENTS ============ */

function FullscreenLoader({ text }: { text: string }) {
  return (
    <div className="fixed inset-0 bg-background flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-3" />
        <p className="text-muted-foreground">{text}</p>
      </div>
    </div>
  );
}

function ErrorScreen({ error }: { error: any }) {
  return (
    <div className="fixed inset-0 bg-background flex items-center justify-center">
      <div className="max-w-md text-center p-6">
        <h1 className="text-xl font-bold text-destructive">Can't start this test</h1>
        <p className="mt-2 text-sm text-muted-foreground">{(error as Error)?.message ?? "Something went wrong."}</p>
        <Link to="/dashboard" className="mt-4 inline-block text-primary font-medium">
          ← Back to Dashboard
        </Link>
      </div>
    </div>
  );
}

function MobilePalette({ questions, currentQIndex, answers, flagged, onSelect, answeredCount, totalQuestions }: any) {
  const [open, setOpen] = useState(false);
  
  return (
    <>
      {/* Mobile toggle bar */}
      <div className="lg:hidden flex-shrink-0 border-t bg-card px-4 py-2 flex items-center justify-between">
        <button onClick={() => setOpen(!open)} className="flex items-center gap-2 text-sm">
          <Eye className="h-4 w-4" /> Question Palette
        </button>
        <div className="text-xs text-muted-foreground">
          {answeredCount}/{totalQuestions} answered
        </div>
      </div>

      {/* Bottom sheet */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            className="lg:hidden fixed bottom-0 left-0 right-0 bg-card border-t rounded-t-2xl p-4 z-50 max-h-[50vh] overflow-y-auto"
          >
            <div className="w-8 h-1 bg-muted-foreground/30 rounded-full mx-auto mb-3" />
            <div className="grid grid-cols-6 gap-1.5">
              {questions.map((q: any, i: number) => (
                <button
                  key={q.id}
                  onClick={() => { onSelect(i); setOpen(false); }}
                  className={cn(
                    "aspect-square rounded-lg text-xs font-bold",
                    i === currentQIndex ? "bg-primary text-primary-foreground"
                    : answers[q.id] ? "bg-green-500 text-white"
                    : flagged.has(q.id) ? "bg-yellow-400"
                    : "bg-gray-200"
                  )}
                >
                  {i + 1}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
