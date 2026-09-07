import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Clock, Loader2, Send, ChevronLeft, ChevronRight, 
  Maximize2, Minimize2, Flag, Eye, Trophy, AlertTriangle,
  RotateCcw, CheckCircle2, Bookmark, HelpCircle
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

// -- Markdown / Mathongo Image Renderer --
function renderContent(text: string) {
  if (!text) return null;
  // If it's literally just a raw image URL
  if (text.startsWith("http") && (text.endsWith(".png") || text.endsWith(".jpg") || text.endsWith(".jpeg") || text.endsWith(".webp") || text.includes("supabase.co"))) {
    return <img src={text} alt="content" className="max-w-full max-h-[320px] object-contain rounded-lg shadow-sm" />;
  }
  // Markdown images ![alt](url)
  const parts = text.split(/(!\[.*?\]\(.*?\))/g);
  return (
    <div className="whitespace-pre-wrap break-words">
      {parts.map((part, i) => {
        const match = part.match(/!\[(.*?)\]\((.*?)\)/);
        if (match) {
          return <img key={i} src={match[2]} alt={match[1] || "Question image"} className="max-w-full max-h-[320px] object-contain rounded-lg shadow-sm my-2 inline-block" />;
        }
        return <span key={i}>{part}</span>;
      })}
    </div>
  );
}

export const Route = createFileRoute("/_authenticated/cbt/$testId/")({
  component: TestTakingPage,
});

/* ============ FULL SCREEN HELPER ============ */
function useFullscreen() {
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  const enter = useCallback(async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      }
    } catch (e) {
      console.log("Fullscreen request failed or was dismissed");
    }
  }, []);

  const exit = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
  }, []);

  const toggle = useCallback(() => {
    if (document.fullscreenElement) exit();
    else enter();
  }, [enter, exit]);

  return { isFullscreen, enter, exit, toggle };
}

/* ============ CBT TIMER ============ */
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
  }, []);

  const format = (sec: number) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60).toString().padStart(2, "0");
    const s = (sec % 60).toString().padStart(2, "0");
    return h > 0 ? `${h}:${m}:${s}` : `${m}:${s}`;
  };

  return { secondsLeft, formatted: format(secondsLeft) };
}

/* ============ TAB SWITCH ANTI-CHEAT (With 3 warnings) ============ */
function useAntiCheat(onDisqualify: () => void, enabled: boolean) {
  const warningsRef = useRef(0);
  const onDisqualifyRef = useRef(onDisqualify);
  useEffect(() => { onDisqualifyRef.current = onDisqualify; }, [onDisqualify]);

  useEffect(() => {
    if (!enabled) return;
    const handleVisibility = () => {
      if (document.visibilityState === "hidden") {
        warningsRef.current += 1;
        const count = warningsRef.current;
        if (count >= 3) {
          toast.error("Test auto-submitted: multiple tab switches detected!");
          onDisqualifyRef.current();
        } else {
          toast.warning(`Warning ${count}/3: Do not switch tabs during the CBT exam!`);
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [enabled]);
}

/* ============ MAIN TEST TAKING PAGE ============ */
function TestTakingPage() {
  const { testId } = Route.useParams();
  const navigate = useNavigate();
  const start = useServerFn(startCbtAttempt);

  const { data, isLoading, error } = useQuery({
    queryKey: ["cbt-start", testId],
    queryFn: () => start({ data: { test_id: testId } }),
    staleTime: Infinity,
    retry: false,
  });

  // If already submitted, offer an instant redirect or click button
  useEffect(() => {
    if (data && (data as any).already_submitted && (data as any).attempt_id) {
      const timer = setTimeout(() => {
        navigate({
          to: "/cbt/$testId/result",
          params: { testId },
          search: { attempt: (data as any).attempt_id } as any,
        });
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [data, testId, navigate]);

  if (isLoading) return <FullscreenLoader text="Preparing your CBT test environment..." />;

  if (data && (data as any).already_submitted) {
    return (
      <div className="flex h-screen w-full items-center justify-center p-4 bg-slate-50 font-sans">
        <div className="max-w-md w-full bg-white rounded-3xl p-8 text-center shadow-lg border border-slate-100">
          <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
          <h2 className="text-2xl font-black text-slate-900 mb-2">Test Already Submitted!</h2>
          <p className="text-slate-500 text-sm mb-6">
            Your answers and scorecard for &quot;{data.test?.title}&quot; are ready.
          </p>
          <Button
            asChild
            size="lg"
            className="w-full bg-[#6043ED] hover:bg-[#4E36C2] text-white font-bold rounded-xl shadow-md"
          >
            <Link to="/cbt/$testId/result" params={{ testId }} search={{ attempt: (data as any).attempt_id } as any}>
              View Your Scorecard & Result →
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  if (error || !data) return <ErrorScreen error={error} testId={testId} />;

  return <TestRunner key={data.attempt_id} testId={testId} data={data} />;
}

/* ============ INNER TEST RUNNER ============ */
function TestRunner({ testId, data }: { testId: string; data: any }) {
  const navigate = useNavigate();
  const submit = useServerFn(submitCbtAttempt);
  const { isFullscreen, enter: enterFullscreen, exit: exitFullscreen, toggle: toggleFullscreen } = useFullscreen();

  // Test state
  const [started, setStarted] = useState(false);
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, "a" | "b" | "c" | "d">>({});
  const [reviewed, setReviewed] = useState<Set<string>>(new Set()); // Marked for review

  // Candidate Name
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
      exitFullscreen();
      navigate({ 
        to: "/cbt/$testId/result", 
        params: { testId }, 
        search: { attempt: res.attempt_id } as any 
      });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const doSubmit = useCallback(() => {
    if (hasSubmittedRef.current) return;
    hasSubmittedRef.current = true;
    submitMutation.mutate();
  }, [submitMutation]);

  const handleSubmitPrompt = useCallback(() => {
    const answeredCount = Object.keys(answers).length;
    const total = data?.questions.length ?? 0;
    const unattempted = total - answeredCount;
    const msg = unattempted > 0 
      ? `You have ${unattempted} unanswered question(s). Are you sure you want to submit?`
      : "Are you ready to submit? You cannot change answers after submission.";
    setConfirmMsg(msg);
    setConfirmOpen(true);
  }, [answers, data]);

  const timer = useTimer(data?.test?.duration_minutes ?? 30, () => {
    toast.error("Time is up! Submitting your test automatically...");
    doSubmit();
  });

  useAntiCheat(doSubmit, started);

  const questions = data.questions;
  const currentQ = questions[currentQIndex];
  const totalQuestions = questions.length;

  // Actions
  const handleAnswerSelect = (option: "a" | "b" | "c" | "d") => {
    setAnswers(prev => ({ ...prev, [currentQ.id]: option }));
  };

  const handleClearResponse = () => {
    setAnswers(prev => {
      const next = { ...prev };
      delete next[currentQ.id];
      return next;
    });
    setReviewed(prev => {
      const next = new Set(prev);
      next.delete(currentQ.id);
      return next;
    });
  };

  const handleMarkForReviewAndNext = () => {
    setReviewed(prev => new Set(prev).add(currentQ.id));
    if (currentQIndex < totalQuestions - 1) {
      setCurrentQIndex(i => i + 1);
    }
  };

  const handleSaveAndNext = () => {
    // Unmark review if saved
    setReviewed(prev => {
      const next = new Set(prev);
      next.delete(currentQ.id);
      return next;
    });
    if (currentQIndex < totalQuestions - 1) {
      setCurrentQIndex(i => i + 1);
    }
  };

  // Pre-test instructions & Fullscreen launch modal
  if (!started) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-4 font-sans">
        <div className="max-w-xl w-full bg-slate-800 rounded-3xl p-6 sm:p-8 border border-white/10 shadow-2xl">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-2xl bg-[#6043ED]/20 text-[#A290FB] flex items-center justify-center font-bold text-xl">
              CBT
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-white">{data.test.title}</h1>
              <p className="text-xs text-slate-400 mt-0.5">Online Examination Portal</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-6">
            <div className="bg-slate-900/60 p-3.5 rounded-2xl border border-white/5">
              <span className="text-[11px] text-slate-400 font-semibold block">Total Questions</span>
              <span className="text-lg font-black text-white">{totalQuestions} Questions</span>
            </div>
            <div className="bg-slate-900/60 p-3.5 rounded-2xl border border-white/5">
              <span className="text-[11px] text-slate-400 font-semibold block">Duration</span>
              <span className="text-lg font-black text-white">{data.test.duration_minutes} Minutes</span>
            </div>
          </div>

          <div className="bg-slate-900/60 p-4 rounded-2xl border border-white/5 text-xs text-slate-300 space-y-2 mb-8">
            <h4 className="font-bold text-white uppercase tracking-wider text-[11px]">Exam Instructions:</h4>
            <ul className="list-disc list-inside space-y-1 text-slate-400">
              <li>Click <b className="text-white">Save & Next</b> to confirm your answer.</li>
              <li>Use <b className="text-purple-400">Mark for Review</b> to revisit tough questions later.</li>
              <li>The exam runs in full screen mode. Do not switch tabs.</li>
            </ul>
          </div>

          <Button
            size="lg"
            onClick={() => {
              enterFullscreen();
              setStarted(true);
            }}
            className="w-full bg-[#6043ED] hover:bg-[#4E36C2] text-white font-bold text-base py-6 rounded-2xl shadow-lg shadow-[#6043ED]/30 flex items-center justify-center gap-2"
          >
            <Maximize2 className="w-5 h-5" /> Start Test in Fullscreen
          </Button>
        </div>
      </div>
    );
  }

  const answeredCount = Object.keys(answers).length;
  const reviewCount = reviewed.size;
  const unansweredCount = totalQuestions - answeredCount;

  return (
    <div className="h-screen flex flex-col bg-slate-50 text-slate-900 font-sans select-none overflow-hidden">
      {/* ================= TOP HEADER ================= */}
      <header className="h-14 bg-[#1E1B4B] text-white px-4 sm:px-6 flex items-center justify-between shrink-0 shadow-md z-30">
        <div className="flex items-center gap-3 min-w-0">
          <div className="min-w-0">
            <h1 className="font-bold text-xs sm:text-sm text-white truncate max-w-[200px] sm:max-w-md uppercase tracking-wider">
              {data.test.title}
            </h1>
            <div className="text-[11px] text-slate-300 truncate">
              Candidate: <span className="font-semibold text-white">{candidateName}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 sm:gap-4">
          {/* Fullscreen Toggle Button */}
          <button
            onClick={toggleFullscreen}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-semibold text-white transition"
            title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            <span>{isFullscreen ? "Exit" : "Fullscreen"}</span>
          </button>

          {/* Timer Pill */}
          <div className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-mono text-xs sm:text-sm font-bold border shadow-inner",
            timer.secondsLeft < 300 
              ? "bg-red-600 border-red-400 text-white animate-pulse" 
              : "bg-white/10 border-white/20 text-white"
          )}>
            <Clock className="w-4 h-4" />
            <span>{timer.formatted}</span>
          </div>

          {/* Submit Test Button */}
          <Button
            size="sm"
            onClick={handleSubmitPrompt}
            disabled={submitMutation.isPending}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-md gap-1 text-xs"
          >
            {submitMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            <span>Submit</span>
          </Button>
        </div>
      </header>

      {/* ================= MAIN CONTENT BODY ================= */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        
        {/* LEFT: QUESTION WORKSPACE */}
        <main className="flex-1 flex flex-col min-w-0 bg-white overflow-hidden">
          
          {/* Question Sub-Header */}
          <div className="h-11 border-b px-4 sm:px-6 flex items-center justify-between shrink-0 bg-slate-50/70 text-xs font-bold text-slate-600">
            <span className="text-[#6043ED]">Question {currentQIndex + 1} of {totalQuestions}</span>
            <div className="flex items-center gap-3">
              <span className="text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md text-[10px]">
                +{currentQ.marks || 1} Marks
              </span>
              <span className="text-red-500 bg-red-50 border border-red-200 px-2 py-0.5 rounded-md text-[10px]">
                -0.25 Neg
              </span>
            </div>
          </div>

          {/* Scrollable Question Content */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-8 space-y-6">
            {/* Question Text / Snippet Image */}
            <div className="text-base sm:text-lg font-medium text-slate-900 leading-relaxed">
              {renderContent(currentQ.question_text)}
            </div>

            {/* Options List */}
            <RadioGroup
              value={answers[currentQ.id] ?? ""}
              onValueChange={(v) => handleAnswerSelect(v as any)}
              className="space-y-3 pt-2"
            >
              {(["a", "b", "c", "d"] as const).map((opt) => {
                const optText = currentQ[`option_${opt}`];
                if (!optText) return null;
                const isSelected = answers[currentQ.id] === opt;
                return (
                  <label
                    key={opt}
                    onClick={() => handleAnswerSelect(opt)}
                    className={cn(
                      "flex items-start gap-4 p-4 rounded-2xl border-2 cursor-pointer transition-all",
                      isSelected
                        ? "border-[#6043ED] bg-[#6043ED]/5 shadow-sm"
                        : "border-slate-200 hover:border-slate-300 hover:bg-slate-50/50 bg-white"
                    )}
                  >
                    <RadioGroupItem value={opt} id={`${currentQ.id}-${opt}`} className="mt-0.5" />
                    <span className={cn(
                      "w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs shrink-0",
                      isSelected ? "bg-[#6043ED] text-white" : "bg-slate-100 text-slate-700"
                    )}>
                      {opt.toUpperCase()}
                    </span>
                    <div className="flex-1 text-sm sm:text-base text-slate-800 pt-0.5">
                      {renderContent(optText)}
                    </div>
                  </label>
                );
              })}
            </RadioGroup>
          </div>

          {/* ================= BOTTOM ACTION CONTROLS (NTA / Mathango Style) ================= */}
          <div className="border-t bg-slate-50 p-3 sm:p-4 shrink-0 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentQIndex(i => Math.max(0, i - 1))}
                disabled={currentQIndex === 0}
                className="gap-1 rounded-xl font-semibold"
              >
                <ChevronLeft className="w-4 h-4" /> Previous
              </Button>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearResponse}
                disabled={!answers[currentQ.id]}
                className="text-slate-600 hover:text-slate-900 rounded-xl font-semibold text-xs"
              >
                <RotateCcw className="w-3.5 h-3.5 mr-1" /> Clear Response
              </Button>
            </div>

            <div className="flex items-center gap-2">
              {/* Mark for Review Button */}
              <Button
                size="sm"
                onClick={handleMarkForReviewAndNext}
                className={cn(
                  "rounded-xl font-bold gap-1 text-xs transition",
                  reviewed.has(currentQ.id)
                    ? "bg-purple-700 text-white"
                    : "bg-purple-600 hover:bg-purple-700 text-white shadow-sm"
                )}
              >
                <Bookmark className="w-3.5 h-3.5" /> Mark for Review & Next
              </Button>

              {/* Save & Next Button */}
              <Button
                size="sm"
                onClick={handleSaveAndNext}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-sm gap-1 text-xs"
              >
                <span>Save & Next</span>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>

        </main>

        {/* RIGHT: QUESTION PALETTE (Mathango Style) */}
        <aside className="hidden lg:flex w-80 border-l bg-slate-50/70 flex-col overflow-hidden shrink-0">
          
          {/* Palette Header & Legend */}
          <div className="p-4 border-b bg-white space-y-3 shrink-0">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Question Palette</h3>
            
            {/* Color Legend */}
            <div className="grid grid-cols-2 gap-2 text-[11px] font-semibold text-slate-600">
              <div className="flex items-center gap-1.5">
                <span className="w-3.5 h-3.5 rounded-md bg-emerald-500 shrink-0" />
                <span>Answered ({answeredCount})</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3.5 h-3.5 rounded-md bg-purple-600 shrink-0" />
                <span>Review ({reviewCount})</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3.5 h-3.5 rounded-md bg-slate-200 border border-slate-300 shrink-0" />
                <span>Unanswered ({unansweredCount})</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3.5 h-3.5 rounded-md bg-white border-2 border-primary shrink-0" />
                <span>Current</span>
              </div>
            </div>
          </div>

          {/* Palette Buttons Grid */}
          <div className="flex-1 overflow-y-auto p-4">
            <div className="grid grid-cols-5 gap-2">
              {questions.map((q: any, i: number) => {
                const isAnswered = Boolean(answers[q.id]);
                const isReview = reviewed.has(q.id);
                const isCurrent = i === currentQIndex;

                let colorStyle = "bg-white border-slate-200 text-slate-700 hover:border-slate-400";
                if (isReview && isAnswered) {
                  colorStyle = "bg-purple-600 text-white ring-2 ring-emerald-400 font-bold";
                } else if (isReview) {
                  colorStyle = "bg-purple-600 text-white font-bold";
                } else if (isAnswered) {
                  colorStyle = "bg-emerald-500 text-white font-bold shadow-sm";
                }

                return (
                  <button
                    key={q.id}
                    onClick={() => setCurrentQIndex(i)}
                    className={cn(
                      "aspect-square rounded-xl text-xs font-bold border transition-all flex items-center justify-center relative",
                      colorStyle,
                      isCurrent && "ring-2 ring-[#6043ED] ring-offset-2 scale-105 shadow-md"
                    )}
                  >
                    {i + 1}
                    {/* Green dot for Answered + Review */}
                    {isReview && isAnswered && (
                      <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-400 border border-white" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Palette Bottom Summary & Submit */}
          <div className="p-4 border-t bg-white space-y-3 shrink-0">
            <Button
              onClick={handleSubmitPrompt}
              disabled={submitMutation.isPending}
              className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-5 rounded-xl shadow-md gap-2"
            >
              {submitMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Submit Examination
            </Button>
          </div>

        </aside>

      </div>

      {/* Confirmation Dialog */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent className="rounded-3xl max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-black">Ready to Submit?</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-600 text-sm">
              {confirmMsg}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel className="rounded-xl font-bold">Cancel & Review</AlertDialogCancel>
            <AlertDialogAction
              onClick={doSubmit}
              disabled={submitMutation.isPending}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl"
            >
              {submitMutation.isPending ? "Submitting..." : "Yes, Submit Test"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function FullscreenLoader({ text }: { text: string }) {
  return (
    <div className="fixed inset-0 bg-white z-50 flex flex-col items-center justify-center gap-3">
      <Loader2 className="h-8 w-8 animate-spin text-[#6043ED]" />
      <p className="text-sm font-semibold text-slate-600">{text}</p>
    </div>
  );
}

function ErrorScreen({ error, testId }: { error: any; testId: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50 font-sans">
      <div className="max-w-md w-full bg-white rounded-3xl p-8 text-center shadow-lg border">
        <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-slate-900 mb-2">Unable to Load Test</h2>
        <p className="text-slate-500 text-sm mb-6">{error?.message || "An unexpected error occurred."}</p>
        <div className="flex justify-center gap-3">
          <Button onClick={() => window.location.reload()} className="rounded-xl">Try Again</Button>
          <Button variant="outline" asChild className="rounded-xl"><Link to="/dashboard">Dashboard</Link></Button>
        </div>
      </div>
    </div>
  );
}