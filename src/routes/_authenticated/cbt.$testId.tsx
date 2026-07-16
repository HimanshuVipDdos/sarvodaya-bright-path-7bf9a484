import { useEffect, useMemo, useState, useCallback, useRef } from "react";
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
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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

/* ============ CBT TIMER ============
 * Fix: previously this hook was mounted (via useTimer(...)) BEFORE the
 * `isLoading` early-return, so on the very first render `durationMinutes`
 * fell back to the hardcoded default (since `data` wasn't loaded yet) and
 * useState() locked that in forever — the real admin-configured duration
 * was silently ignored. Now the parent only mounts this once `data` is
 * guaranteed loaded, and the interval logic itself is rewritten to use a
 * single setInterval (not a chained setTimeout re-created on every render)
 * so it can't stall out from unrelated re-renders (selecting an answer,
 * flagging a question, etc).
 */
function useTimer(durationMinutes: number, onTimeUp: () => void) {
  const [secondsLeft, setSecondsLeft] = useState(() => durationMinutes * 60);
  const onTimeUpRef = useRef(onTimeUp);
  useEffect(() => { onTimeUpRef.current = onTimeUp; }, [onTimeUp]);

  useEffect(() => {
    const interval = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(interval);
          onTimeUpRef.current();
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const format = (sec: number) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60).toString().padStart(2, "0");
    const s = (sec % 60).toString().padStart(2, "0");
    return h > 0 ? `${h}:${m}:${s}` : `${m}:${s}`;
  };

  return { secondsLeft, formatted: format(secondsLeft) };
}

/* ============ AUTO-SUBMIT ON TAB SWITCH / APP SWITCH ============ */
function useAutoSubmitOnLeave(onLeave: () => void, enabled: boolean) {
  const onLeaveRef = useRef(onLeave);
  useEffect(() => { onLeaveRef.current = onLeave; }, [onLeave]);

  useEffect(() => {
    if (!enabled) return;
    const handleVisibility = () => {
      if (document.visibilityState === "hidden") onLeaveRef.current();
    };
    const handleBlur = () => onLeaveRef.current();
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("blur", handleBlur);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("blur", handleBlur);
    };
  }, [enabled]);
}

/* ============ SUBJECT GROUPING ============
 * Groups the flat question list by `topic` (used as "Subject"), preserving
 * the order subjects first appear in (which follows sort_order from the
 * admin panel / parser). Falls back to a single "General" subject if no
 * question has a topic set, so tests created before this feature still work
 * exactly as before (tab bar just won't show, since there'd only be 1 tab).
 */
function useSubjectGroups(questions: any[]) {
  return useMemo(() => {
    const order: string[] = [];
    const startIndex: Record<string, number> = {};
    const indices: Record<string, number[]> = {};
    questions.forEach((q, i) => {
      const subject = q.topic?.trim() || "General";
      if (!(subject in startIndex)) {
        order.push(subject);
        startIndex[subject] = i;
        indices[subject] = [];
      }
      indices[subject].push(i);
    });
    return { subjects: order, startIndex, indices };
  }, [questions]);
}

/* ============ OUTER: loads the attempt, then mounts the runner ============ */
function TestTakingPage() {
  const { testId } = Route.useParams();
  const start = useServerFn(startCbtAttempt);

  const { data, isLoading, error } = useQuery({
    queryKey: ["cbt-start", testId],
    queryFn: () => start({ data: { test_id: testId } }),
    staleTime: Infinity,
    retry: false,
  });

  if (isLoading) return <FullscreenLoader text="Loading your test..." />;
  if (error || !data) return <ErrorScreen error={error} />;

  // key={data.attempt_id} guarantees a fresh mount (fresh timer, fresh
  // state) per attempt, and guarantees duration_minutes is real by the
  // time any hooks inside TestRunner run.
  return <TestRunner key={data.attempt_id} testId={testId} data={data} />;
}

/* ============ INNER: all the actual test-taking state/logic ============ */
function TestRunner({ testId, data }: { testId: string; data: any }) {
  const navigate = useNavigate();
  const submit = useServerFn(submitCbtAttempt);
  const { enter: enterFullscreen } = useFullscreen();

  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, "a" | "b" | "c" | "d">>({});
  const [flagged, setFlagged] = useState<Set<string>>(new Set());

  const { data: candidateName } = useQuery({
    queryKey: ["cbt-candidate-name"],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return "Candidate";
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", userData.user.id)
        .maybeSingle();
      return profile?.full_name || userData.user.email?.split("@")[0] || "Candidate";
    },
    staleTime: Infinity,
  });

  useEffect(() => {
    const t = setTimeout(() => enterFullscreen(), 500);
    return () => clearTimeout(t);
  }, [enterFullscreen]);

  // Guards against the mutation ever firing twice (e.g. auto-submit-on-leave
  // racing with a manual submit), independent of React state timing.
  const hasSubmittedRef = useRef(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmMsg, setConfirmMsg] = useState("");

  const submitMutation = useMutation({
    mutationFn: async () => {
      const payload = data.questions.map((q: any) => ({
        question_id: q.id,
        selected_option: answers[q.id] ?? null,
      }));
      return submit({ data: { attempt_id: data.attempt_id, answers: payload } });
    },
    onSuccess: (res) => {
      if (!res) return;
      // Hard navigation (full page load) instead of soft client-side
      // navigate — guarantees a fresh page load even if the browser has
      // an old cached JS bundle, so the wrong screen never shows up.
      window.location.href = `/cbt/${testId}/result?attempt=${res.attempt_id}`;
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const doSubmit = useCallback(() => {
    if (hasSubmittedRef.current) return;
    hasSubmittedRef.current = true;
    submitMutation.mutate();
  }, [submitMutation]);

  const handleSubmit = useCallback(() => {
    const answered = Object.keys(answers).length;
    const total = data?.questions.length ?? 0;
    const msg = answered < total 
      ? `Only ${answered}/${total} answered. Submit anyway?` 
      : "Submit the test? You can't change answers after this.";
    // NOTE: intentionally not using window.confirm() here — a native
    // confirm() dialog blurs the window, which used to fire the
    // anti-cheat auto-submit-on-leave at the same moment and race with
    // this submit, leaving the test stuck without opening the result page.
    setConfirmMsg(msg);
    setConfirmOpen(true);
  }, [answers, data]);

  const autoSubmit = useCallback(() => {
    if (hasSubmittedRef.current) return;
    toast.info("Test auto-submitted — you left the test screen.");
    doSubmit();
  }, [doSubmit]);

  const timer = useTimer(data?.test?.duration_minutes ?? 30, () => {
    toast.info("Time's up! Auto-submitting...");
    doSubmit();
  });

  // Switching tabs/apps or minimizing during the test auto-submits it.
  // Disabled while the submit-confirmation dialog itself is open, since
  // opening/closing that dialog can also trigger a visibility/blur event.
  useAutoSubmitOnLeave(autoSubmit, !confirmOpen && !submitMutation.isPending && !submitMutation.isSuccess);

  const toggleFlag = (qId: string) => {
    setFlagged(prev => {
      const next = new Set(prev);
      if (next.has(qId)) next.delete(qId);
      else next.add(qId);
      return next;
    });
  };

  const questions = data.questions;
  const currentQ = questions[currentQIndex];
  const answeredCount = Object.keys(answers).length;
  const totalQuestions = questions.length;

  const { subjects, startIndex, indices } = useSubjectGroups(questions);
  const currentSubject = currentQ.topic?.trim() || "General";
  const showSubjectTabs = subjects.length > 1;
  const subjectStats = useMemo(() => {
    const stats: Record<string, { answered: number; total: number }> = {};
    subjects.forEach((s) => {
      const qIdx = indices[s];
      stats[s] = {
        total: qIdx.length,
        answered: qIdx.filter((i) => !!answers[questions[i].id]).length,
      };
    });
    return stats;
  }, [subjects, indices, answers, questions]);

  return (
    <div className="fixed inset-0 z-[100] bg-background flex flex-col">
      {/* ===== OFFICIAL CBT HEADER ===== */}
      <header className="flex-shrink-0 border-b-2 border-primary-foreground/20 bg-primary text-primary-foreground px-4 py-2">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-sm sm:text-base truncate max-w-[160px] sm:max-w-md uppercase tracking-wide">
                {data.test.title}
              </h1>
              <span className="hidden sm:inline text-[9px] text-primary-foreground/50">Made by Extreme OG</span>
            </div>
            <div className="text-[11px] text-primary-foreground/75">
              Candidate: <span className="font-medium text-primary-foreground">{candidateName ?? "…"}</span>
              <span className="mx-1.5">•</span>
              Q{currentQIndex + 1} of {totalQuestions}
              {showSubjectTabs && <><span className="mx-1.5">•</span>{currentSubject}</>}
            </div>
          </div>
          
          <div className="flex items-center gap-3 sm:gap-4">
            <div className={cn(
              "flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-mono font-bold border",
              timer.secondsLeft < 300 ? "bg-red-500 border-red-400 animate-pulse" : "bg-primary-foreground/10 border-primary-foreground/20"
            )}>
              <Clock className="h-4 w-4" />
              {timer.formatted}
            </div>
            
            <Button 
              size="sm" 
              onClick={handleSubmit}
              disabled={submitMutation.isPending}
              className="bg-white text-primary hover:bg-white/90 gap-1 font-semibold"
            >
              {submitMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
              Submit
            </Button>
          </div>
        </div>
      </header>

      {/* ===== SUBJECT TABS (Testbook-style) — only shown when questions have topics set ===== */}
      {showSubjectTabs && (
        <div className="flex-shrink-0 border-b bg-card overflow-x-auto">
          <div className="flex gap-1 px-3 py-2 min-w-max">
            {subjects.map((subject) => {
              const stat = subjectStats[subject];
              const isActive = subject === currentSubject;
              return (
                <button
                  key={subject}
                  onClick={() => setCurrentQIndex(startIndex[subject])}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors",
                    isActive ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/70"
                  )}
                >
                  {subject}
                  <span className={cn("rounded-full px-1.5 text-[10px]", isActive ? "bg-white/20" : "bg-background")}>
                    {stat.answered}/{stat.total}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ===== MAIN CONTENT: Question + Palette ===== */}
      <div className="flex-1 flex overflow-hidden">
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentQ.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="max-w-3xl mx-auto"
            >
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

        <aside className="hidden lg:block w-72 border-l bg-muted/30 overflow-y-auto p-4">
          <h3 className="text-sm font-semibold mb-3">Question Palette</h3>
          
          <div className="flex flex-wrap gap-2 text-[10px] mb-4">
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-green-500" /> Answered</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-yellow-500" /> Flagged</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-primary" /> Current</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-gray-300" /> Unanswered</span>
          </div>

          {subjects.map((subject) => (
            <div key={subject} className="mb-4">
              {showSubjectTabs && (
                <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {subject}
                </div>
              )}
              <div className="grid grid-cols-5 gap-1.5">
                {indices[subject].map((i) => {
                  const q = questions[i];
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
            </div>
          ))}

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

      <MobilePalette
        questions={questions}
        currentQIndex={currentQIndex}
        answers={answers}
        flagged={flagged}
        onSelect={setCurrentQIndex}
        answeredCount={answeredCount}
        totalQuestions={totalQuestions}
        subjects={subjects}
        indices={indices}
        showSubjectTabs={showSubjectTabs}
      />

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Submit test?</AlertDialogTitle>
            <AlertDialogDescription>{confirmMsg}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmOpen(false);
                doSubmit();
              }}
            >
              Submit
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/* ============ SUB-COMPONENTS ============ */

function FullscreenLoader({ text }: { text: string }) {
  return (
    <div className="fixed inset-0 z-[100] bg-background flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-3" />
        <p className="text-muted-foreground">{text}</p>
      </div>
    </div>
  );
}

function ErrorScreen({ error }: { error: any }) {
  return (
    <div className="fixed inset-0 z-[100] bg-background flex items-center justify-center">
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

function MobilePalette({ questions, currentQIndex, answers, flagged, onSelect, answeredCount, totalQuestions, subjects, indices, showSubjectTabs }: any) {
  const [open, setOpen] = useState(false);
  
  return (
    <>
      <div className="lg:hidden flex-shrink-0 border-t bg-card px-4 py-2 flex items-center justify-between">
        <button onClick={() => setOpen(!open)} className="flex items-center gap-2 text-sm">
          <Eye className="h-4 w-4" /> Question Palette
        </button>
        <div className="text-xs text-muted-foreground">
          {answeredCount}/{totalQuestions} answered
        </div>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            className="lg:hidden fixed bottom-0 left-0 right-0 bg-card border-t rounded-t-2xl p-4 z-50 max-h-[60vh] overflow-y-auto"
          >
            <div className="w-8 h-1 bg-muted-foreground/30 rounded-full mx-auto mb-3" />
            {(subjects ?? [null]).map((subject: string | null) => (
              <div key={subject ?? "all"} className="mb-3">
                {showSubjectTabs && subject && (
                  <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {subject}
                  </div>
                )}
                <div className="grid grid-cols-6 gap-1.5">
                  {(subject ? indices[subject] : questions.map((_: any, i: number) => i)).map((i: number) => {
                    const q = questions[i];
                    return (
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
                    );
                  })}
                </div>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
