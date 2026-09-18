import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Clock, Loader2, Send, ChevronLeft, ChevronRight, 
  Maximize2, Minimize2, RotateCcw, CheckCircle2, Bookmark, 
  AlertTriangle, FileText, HelpCircle, User, Sparkles, BookOpen,
  LayoutGrid, X, Check, ShieldAlert
} from "lucide-react";
import { toast } from "sonner";
import { startCbtAttempt, submitCbtAttempt } from "@/lib/cbt.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

// -- Intelligent Section Icon & Badge Helper for Any Exam --
function getSectionMeta(name: string) {
  const lower = name.toLowerCase();
  if (lower.includes("math") || lower.includes("quant") || lower.includes("arithmetic") || lower.includes("गणित") || lower.includes("संख्यात्मक")) {
    return { icon: "🔢", badge: "Maths / Quant", color: "from-blue-500 to-indigo-600" };
  }
  if (lower.includes("reason") || lower.includes("mental") || lower.includes("logic") || lower.includes("तर्क") || lower.includes("अभिरुचि")) {
    return { icon: "🧠", badge: "Reasoning", color: "from-purple-500 to-violet-600" };
  }
  if (lower.includes("gk") || lower.includes("aware") || lower.includes("general") || lower.includes("gs") || lower.includes("ज्ञान") || lower.includes("current") || lower.includes("history") || lower.includes("polity") || lower.includes("geography")) {
    return { icon: "🌍", badge: "General Knowledge", color: "from-amber-500 to-orange-600" };
  }
  if (lower.includes("eng") || lower.includes("verbal") || lower.includes("comprehension") || lower.includes("अंग्रेजी")) {
    return { icon: "📖", badge: "English", color: "from-emerald-500 to-teal-600" };
  }
  if (lower.includes("hindi") || lower.includes("हिंदी")) {
    return { icon: "🇮🇳", badge: "सामान्य हिंदी", color: "from-orange-500 to-red-600" };
  }
  if (lower.includes("physic") || lower.includes("भौतिक")) {
    return { icon: "⚛️", badge: "Physics", color: "from-cyan-500 to-blue-600" };
  }
  if (lower.includes("chem") || lower.includes("रसायन")) {
    return { icon: "🧪", badge: "Chemistry", color: "from-teal-500 to-emerald-600" };
  }
  if (lower.includes("bio") || lower.includes("botany") || lower.includes("zoology") || lower.includes("जीव")) {
    return { icon: "🧬", badge: "Biology", color: "from-emerald-500 to-green-600" };
  }
  return { icon: "📝", badge: "Section", color: "from-slate-600 to-slate-800" };
}

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

function TestRunner({ testId, data }: { testId: string; data: any }) {
  const navigate = useNavigate();
  const submit = useServerFn(submitCbtAttempt);
  const { isFullscreen, enter: enterFullscreen, exit: exitFullscreen, toggle: toggleFullscreen } = useFullscreen();

  const questions = (data.questions ?? []) as any[];
  const totalQuestions = questions.length;

  // Test state
  const [started, setStarted] = useState(false);
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, "a" | "b" | "c" | "d">>({});
  const [reviewed, setReviewed] = useState<Set<string>>(new Set());
  const [visited, setVisited] = useState<Set<string>>(() => new Set(questions[0]?.id ? [questions[0].id] : []));
  const [fontSize, setFontSize] = useState<"small" | "normal" | "large">("normal");

  // Section Navigation & Filter State
  const [activeSectionName, setActiveSectionName] = useState<string | null>(null);
  const [paletteFilter, setPaletteFilter] = useState<"section" | "all">("section");
  const [mobilePaletteOpen, setMobilePaletteOpen] = useState(false);
  const [paperModalOpen, setPaperModalOpen] = useState(false);

  // Dynamically extract sections from questions (supporting ANY exam: SSC, RRB, JEE, NEET, etc.)
  const sections = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const q of questions) {
      const sName = q.topic?.trim() || "General Section";
      if (!map.has(sName)) {
        map.set(sName, []);
      }
      map.get(sName)!.push(q);
    }
    return Array.from(map.entries()).map(([name, qs]) => {
      const startIndex = questions.findIndex((q) => q.id === qs[0].id);
      return {
        name,
        questions: qs,
        startIndex,
        count: qs.length,
        meta: getSectionMeta(name),
      };
    });
  }, [questions]);

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

  const currentQ = questions[currentQIndex] || questions[0];

  // Auto-mark visited when current question changes
  useEffect(() => {
    if (currentQ?.id) {
      setVisited((prev) => new Set(prev).add(currentQ.id));
    }
  }, [currentQ?.id]);

  // Identify which section current question belongs to
  const currentSection = useMemo(() => {
    return sections.find((s) => s.questions.some((q) => q.id === currentQ?.id)) || sections[0];
  }, [sections, currentQ?.id]);

  // Selected Section for Section Tabs (defaults to current question's section)
  const selectedSection = sections.find((s) => s.name === activeSectionName) || currentSection || sections[0];

  // Question index within current section (e.g. Question 12 of 25)
  const questionIndexInSection = useMemo(() => {
    if (!currentSection) return currentQIndex + 1;
    const idx = currentSection.questions.findIndex((q) => q.id === currentQ?.id);
    return idx >= 0 ? idx + 1 : 1;
  }, [currentSection, currentQ?.id, currentQIndex]);

  const hasSubmittedRef = useRef(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const submitMutation = useMutation({
    mutationFn: async () => {
      const payload = questions.map((q: any) => {
        const val = answers[q.id];
        const selected = (val === "a" || val === "b" || val === "c" || val === "d") ? val : null;
        return {
          question_id: q.id,
          selected_option: selected,
        };
      });
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
    onError: (e: Error) => {
      hasSubmittedRef.current = false;
      toast.error(e.message || "Failed to submit test. Please try again.");
    },
  });

  const doSubmit = useCallback(() => {
    if (hasSubmittedRef.current) return;
    hasSubmittedRef.current = true;
    submitMutation.mutate();
  }, [submitMutation]);

  const handleSubmitPrompt = useCallback(() => {
    setConfirmOpen(true);
  }, []);

  const timer = useTimer(data?.test?.duration_minutes ?? 30, () => {
    toast.error("Time is up! Submitting your test automatically...");
    doSubmit();
  });

  useAntiCheat(doSubmit, started);

  // Actions
  const handleAnswerSelect = (option: "a" | "b" | "c" | "d") => {
    setAnswers((prev) => ({ ...prev, [currentQ.id]: option }));
  };

  const handleClearResponse = () => {
    setAnswers((prev) => {
      const next = { ...prev };
      delete next[currentQ.id];
      return next;
    });
    setReviewed((prev) => {
      const next = new Set(prev);
      next.delete(currentQ.id);
      return next;
    });
  };

  const handleMarkForReviewAndNext = () => {
    setReviewed((prev) => new Set(prev).add(currentQ.id));
    if (currentQIndex < totalQuestions - 1) {
      setCurrentQIndex((i) => i + 1);
    }
  };

  const handleSaveAndMarkForReview = () => {
    setReviewed((prev) => new Set(prev).add(currentQ.id));
    if (currentQIndex < totalQuestions - 1) {
      setCurrentQIndex((i) => i + 1);
    }
  };

  const handleSaveAndNext = () => {
    // Unmark review if explicitly saved
    setReviewed((prev) => {
      const next = new Set(prev);
      next.delete(currentQ.id);
      return next;
    });
    if (currentQIndex < totalQuestions - 1) {
      setCurrentQIndex((i) => i + 1);
    }
  };

  // Switch to a section tab
  const handleSectionTabClick = (sec: typeof sections[0]) => {
    setActiveSectionName(sec.name);
    setCurrentQIndex(sec.startIndex);
    if (mobilePaletteOpen) setMobilePaletteOpen(false);
  };

  // Keyboard navigation shortcuts for CBT desktop test-takers
  useEffect(() => {
    if (!started || confirmOpen || paperModalOpen || mobilePaletteOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "1" || e.key === "a" || e.key === "A") {
        handleAnswerSelect("a");
      } else if (e.key === "2" || e.key === "b" || e.key === "B") {
        handleAnswerSelect("b");
      } else if (e.key === "3" || e.key === "c" || e.key === "C") {
        handleAnswerSelect("c");
      } else if (e.key === "4" || e.key === "d" || e.key === "D") {
        handleAnswerSelect("d");
      } else if (e.key === "ArrowRight" || (e.key === "Enter" && !e.shiftKey)) {
        handleSaveAndNext();
      } else if (e.key === "ArrowLeft") {
        setCurrentQIndex((i) => Math.max(0, i - 1));
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [started, confirmOpen, paperModalOpen, mobilePaletteOpen, currentQIndex, totalQuestions, currentQ?.id]);

  // Overall Statistics across test
  const answeredCount = Object.keys(answers).length;
  const reviewCount = Array.from(reviewed).filter((id) => !answers[id]).length;
  const answeredAndReviewCount = Array.from(reviewed).filter((id) => Boolean(answers[id])).length;
  const notAnsweredCount = Array.from(visited).filter((id) => !answers[id] && !reviewed.has(id)).length;
  const notVisitedCount = Math.max(0, totalQuestions - visited.size);

  // Helper to determine exact official 5-state palette status of any question
  const getQuestionState = (qId: string) => {
    const isAns = Boolean(answers[qId]);
    const isRev = reviewed.has(qId);
    const isVis = visited.has(qId);

    if (isRev && isAns) {
      return {
        label: "Answered & Marked for Review",
        className: "bg-purple-600 text-white ring-2 ring-emerald-400 font-bold",
        dot: true,
      };
    }
    if (isRev) {
      return {
        label: "Marked for Review",
        className: "bg-purple-600 text-white font-bold",
        dot: false,
      };
    }
    if (isAns) {
      return {
        label: "Answered",
        className: "bg-emerald-600 text-white font-bold shadow-xs",
        dot: false,
      };
    }
    if (isVis) {
      return {
        label: "Not Answered",
        className: "bg-rose-500 text-white font-bold",
        dot: false,
      };
    }
    return {
      label: "Not Visited",
      className: "bg-slate-100 border border-slate-300 text-slate-700 hover:bg-slate-200",
      dot: false,
    };
  };

  // Pre-test instructions & Fullscreen launch modal
  if (!started) {
    return (
      <div className="min-h-screen bg-[#0F172A] text-white flex items-center justify-center p-4 font-sans selection:bg-indigo-600 selection:text-white">
        <div className="max-w-2xl w-full bg-slate-900/95 backdrop-blur-xl rounded-3xl p-6 sm:p-8 border border-white/10 shadow-2xl space-y-6">
          
          {/* Header */}
          <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-5">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white flex items-center justify-center font-black text-xl shadow-lg shadow-indigo-500/20">
                CBT
              </div>
              <div>
                <span className="text-[11px] font-extrabold uppercase tracking-widest text-indigo-400">
                  Official Online Examination
                </span>
                <h1 className="text-xl sm:text-2xl font-black text-white leading-tight">
                  {data.test.title}
                </h1>
                <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5 text-indigo-400" /> Candidate: <span className="font-bold text-slate-200">{candidateName}</span>
                </p>
              </div>
            </div>
            <Badge variant="outline" className="border-indigo-500/40 text-indigo-300 bg-indigo-500/10 px-3 py-1 font-mono text-xs shrink-0">
              Live Mock Test
            </Badge>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="bg-slate-800/80 p-3.5 rounded-2xl border border-white/5">
              <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Total Questions</span>
              <span className="text-lg font-black text-white">{totalQuestions} Questions</span>
            </div>
            <div className="bg-slate-800/80 p-3.5 rounded-2xl border border-white/5">
              <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Duration</span>
              <span className="text-lg font-black text-white">{data.test.duration_minutes} Minutes</span>
            </div>
            <div className="col-span-2 sm:col-span-1 bg-slate-800/80 p-3.5 rounded-2xl border border-white/5">
              <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Negative Marking</span>
              <span className="text-lg font-black text-amber-400">-0.25 Marks</span>
            </div>
          </div>

          {/* Detected Subject / Section Breakdown for ANY exam */}
          <div className="rounded-2xl border border-white/10 bg-slate-800/60 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <BookOpen className="h-3.5 w-3.5 text-indigo-400" /> Exam Portions & Section Breakdown:
              </span>
              <span className="text-[11px] text-slate-400 font-medium">
                {sections.length} Section{sections.length > 1 ? "s" : ""}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {sections.map((sec) => (
                <div key={sec.name} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900/60 border border-white/5">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-base">{sec.meta.icon}</span>
                    <span className="text-xs font-bold text-slate-200 truncate">{sec.name}</span>
                  </div>
                  <span className="text-xs font-mono font-bold text-indigo-300 px-2 py-0.5 rounded-md bg-indigo-500/10">
                    {sec.count} Qs
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Instructions Legend */}
          <div className="bg-slate-800/40 p-4 rounded-2xl border border-white/5 text-xs text-slate-300 space-y-2.5">
            <h4 className="font-bold text-white uppercase tracking-wider text-[11px] flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-amber-400" /> Exam Rules & Palette Legend:
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px] pt-1">
              <div className="flex items-center gap-1.5">
                <span className="w-3.5 h-3.5 rounded bg-emerald-600 shrink-0" />
                <span>Answered</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3.5 h-3.5 rounded bg-rose-500 shrink-0" />
                <span>Not Answered</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3.5 h-3.5 rounded bg-purple-600 shrink-0" />
                <span>Marked for Review</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3.5 h-3.5 rounded bg-purple-600 ring-2 ring-emerald-400 shrink-0" />
                <span>Answered & Review</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3.5 h-3.5 rounded bg-slate-600 shrink-0" />
                <span>Not Visited</span>
              </div>
              <div className="flex items-center gap-1.5 text-amber-400 font-semibold">
                <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                <span>Anti-Cheat Enabled</span>
              </div>
            </div>
          </div>

          {/* Action Button */}
          <Button
            size="lg"
            onClick={() => {
              enterFullscreen();
              setStarted(true);
            }}
            className="w-full bg-gradient-to-r from-[#5338D9] via-[#6043ED] to-[#7B61FF] hover:opacity-95 text-white font-extrabold text-base py-6 rounded-2xl shadow-xl shadow-indigo-600/30 flex items-center justify-center gap-2 cursor-pointer transition active:scale-[0.99]"
          >
            <Maximize2 className="w-5 h-5" /> Start Examination (परीक्षा शुरू करें)
          </Button>
        </div>
      </div>
    );
  }

  // Filtered questions for the palette based on active filter
  const displayedPaletteQuestions = paletteFilter === "section" && currentSection
    ? currentSection.questions
    : questions;

  return (
    <div className="h-screen flex flex-col bg-slate-100 text-slate-900 font-sans select-none overflow-hidden">
      
      {/* ================= 1. OFFICIAL TOP HEADER ================= */}
      <header className="h-14 bg-[#0F172A] text-white px-3 sm:px-6 flex items-center justify-between shrink-0 shadow-lg z-30 border-b border-slate-800">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-black text-sm shrink-0">
            CBT
          </div>
          <div className="min-w-0">
            <h1 className="font-bold text-xs sm:text-sm text-white truncate max-w-[160px] sm:max-w-md uppercase tracking-wider">
              {data.test.title}
            </h1>
            <div className="text-[10px] sm:text-[11px] text-slate-400 truncate flex items-center gap-2">
              <span>Candidate: <strong className="text-slate-200">{candidateName}</strong></span>
              <span className="hidden md:inline-flex items-center gap-1 text-emerald-400 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Live Exam Mode
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {/* Question Paper View Button */}
          <button
            type="button"
            onClick={() => setPaperModalOpen(true)}
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition border border-slate-700 cursor-pointer"
            title="View entire Question Paper"
          >
            <FileText className="w-3.5 h-3.5 text-indigo-400" />
            <span>Question Paper</span>
          </button>

          {/* Fullscreen Toggle Button */}
          <button
            type="button"
            onClick={toggleFullscreen}
            className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition border border-slate-700 cursor-pointer"
            title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            <span>{isFullscreen ? "Exit" : "Full"}</span>
          </button>

          {/* Official Countdown Timer */}
          <div className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-mono text-xs sm:text-sm font-bold border shadow-inner transition-colors",
            timer.secondsLeft < 300 
              ? "bg-rose-600 border-rose-400 text-white animate-pulse" 
              : "bg-slate-800/90 border-slate-700 text-emerald-400"
          )}>
            <Clock className="w-3.5 h-3.5 shrink-0" />
            <span>{timer.formatted}</span>
          </div>

          {/* Mobile Palette Drawer Toggle */}
          <button
            type="button"
            onClick={() => setMobilePaletteOpen(true)}
            className="lg:hidden flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition shadow-sm cursor-pointer"
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            <span>Palette ({answeredCount}/{totalQuestions})</span>
          </button>

          {/* Submit Test Button */}
          <Button
            size="sm"
            onClick={handleSubmitPrompt}
            disabled={submitMutation.isPending}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-md gap-1 text-xs px-3 sm:px-4 cursor-pointer"
          >
            {submitMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            <span>Submit</span>
          </Button>
        </div>
      </header>

      {/* ================= 2. UNIVERSAL DYNAMIC SECTION TABS BAR ================= */}
      <div className="h-11 bg-white border-b border-slate-200 px-3 sm:px-6 flex items-center justify-between gap-2 shrink-0 overflow-x-auto scrollbar-none shadow-xs z-20">
        <div className="flex items-center gap-2 min-w-0 py-1">
          <span className="hidden sm:flex items-center gap-1 text-[11px] font-extrabold uppercase tracking-wider text-slate-400 shrink-0 mr-1">
            <BookOpen className="w-3.5 h-3.5 text-indigo-600" /> Sections:
          </span>
          
          {sections.map((sec) => {
            const isSelected = (currentSection?.name === sec.name);
            const secAnsCount = sec.questions.filter((q) => Boolean(answers[q.id])).length;

            return (
              <button
                key={sec.name}
                type="button"
                onClick={() => handleSectionTabClick(sec)}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer shrink-0 border",
                  isSelected
                    ? "bg-[#6043ED] text-white border-[#6043ED] shadow-sm ring-2 ring-indigo-200"
                    : "bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200"
                )}
              >
                <span>{sec.meta.icon}</span>
                <span>{sec.name}</span>
                <span className={cn(
                  "text-[10px] px-1.5 py-0.2 rounded-md font-mono font-semibold",
                  isSelected
                    ? "bg-white/20 text-white"
                    : "bg-slate-200/80 text-slate-600"
                )}>
                  {secAnsCount}/{sec.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Font Size Adjuster Controls */}
        <div className="hidden sm:flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200 text-[11px] shrink-0">
          <button
            type="button"
            onClick={() => setFontSize("small")}
            title="Smaller text"
            className={cn(
              "px-2 py-0.5 rounded-lg font-bold transition cursor-pointer",
              fontSize === "small" ? "bg-white text-indigo-600 shadow-xs" : "text-slate-600 hover:text-slate-900"
            )}
          >
            A-
          </button>
          <button
            type="button"
            onClick={() => setFontSize("normal")}
            title="Default text"
            className={cn(
              "px-2 py-0.5 rounded-lg font-bold transition cursor-pointer",
              fontSize === "normal" ? "bg-white text-indigo-600 shadow-xs" : "text-slate-600 hover:text-slate-900"
            )}
          >
            A
          </button>
          <button
            type="button"
            onClick={() => setFontSize("large")}
            title="Larger text"
            className={cn(
              "px-2 py-0.5 rounded-lg font-bold transition cursor-pointer",
              fontSize === "large" ? "bg-white text-indigo-600 shadow-xs" : "text-slate-600 hover:text-slate-900"
            )}
          >
            A+
          </button>
        </div>
      </div>

      {/* ================= 3. MAIN WORKSPACE BODY ================= */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        
        {/* LEFT / CENTER: QUESTION WORKSPACE */}
        <main className="flex-1 flex flex-col min-w-0 bg-white overflow-hidden">
          
          {/* Question Meta Sub-Header */}
          <div className="h-12 border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between shrink-0 bg-slate-50/70 text-xs font-bold text-slate-600">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <Badge variant="outline" className="bg-white border-slate-300 text-slate-700 font-bold gap-1 text-[11px]">
                <span>{currentSection?.meta.icon}</span>
                <span className="truncate max-w-[130px] sm:max-w-none">{currentSection?.name}</span>
              </Badge>

              <span className="text-indigo-600 font-extrabold text-xs sm:text-sm">
                Question {questionIndexInSection} of {currentSection?.count}
              </span>
              <span className="text-slate-400 text-[11px] hidden sm:inline">
                (Overall Q{currentQIndex + 1})
              </span>
            </div>

            <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
              <span className="text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-md text-[11px] font-bold">
                +{currentQ.marks || 1}
              </span>
              <span className="text-rose-600 bg-rose-50 border border-rose-200 px-2.5 py-0.5 rounded-md text-[11px] font-bold">
                -0.25
              </span>
            </div>
          </div>

          {/* Scrollable Question & Options Content */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-8 space-y-6">
            
            {/* Question Text / Image */}
            <div className={cn(
              "font-medium text-slate-900 leading-relaxed transition-all",
              fontSize === "small" && "text-sm sm:text-base",
              fontSize === "normal" && "text-base sm:text-lg",
              fontSize === "large" && "text-lg sm:text-xl"
            )}>
              {renderContent(currentQ.question_text)}
            </div>

            {/* Interactive Options Cards */}
            <div className="space-y-3 pt-2">
              {(["a", "b", "c", "d"] as const).map((opt, optIdx) => {
                const optText = currentQ[`option_${opt}`];
                if (!optText) return null;
                const isSelected = answers[currentQ.id] === opt;

                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => handleAnswerSelect(opt)}
                    className={cn(
                      "w-full text-left flex items-start gap-3.5 sm:gap-4 p-3.5 sm:p-4 rounded-2xl border-2 cursor-pointer transition-all duration-150",
                      isSelected
                        ? "border-[#6043ED] bg-indigo-50/50 shadow-sm ring-2 ring-indigo-200/50"
                        : "border-slate-200 hover:border-slate-300 hover:bg-slate-50/70 bg-white"
                    )}
                  >
                    <span className={cn(
                      "w-7 h-7 sm:w-8 sm:h-8 rounded-xl flex items-center justify-center font-black text-xs shrink-0 transition-colors",
                      isSelected ? "bg-[#6043ED] text-white shadow-xs" : "bg-slate-100 text-slate-700 border border-slate-200"
                    )}>
                      {opt.toUpperCase()}
                    </span>

                    <div className={cn(
                      "flex-1 text-slate-800 pt-0.5 transition-all leading-snug",
                      fontSize === "small" && "text-xs sm:text-sm",
                      fontSize === "normal" && "text-sm sm:text-base",
                      fontSize === "large" && "text-base sm:text-lg"
                    )}>
                      {renderContent(optText)}
                    </div>

                    <div className="shrink-0 pt-0.5">
                      <div className={cn(
                        "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors",
                        isSelected ? "border-[#6043ED] bg-[#6043ED]" : "border-slate-300 bg-white"
                      )}>
                        {isSelected && <Check className="w-3 h-3 text-white stroke-[3]" />}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Keyboard shortcut hint for desktop */}
            <div className="hidden sm:flex items-center gap-2 text-[11px] text-slate-400 pt-2 font-medium">
              <span>Shortcuts:</span>
              <kbd className="px-1.5 py-0.5 bg-slate-100 rounded border border-slate-200 text-slate-600 font-mono text-[10px]">1-4</kbd> Select Option
              <span className="mx-1">•</span>
              <kbd className="px-1.5 py-0.5 bg-slate-100 rounded border border-slate-200 text-slate-600 font-mono text-[10px]">Enter</kbd> Save & Next
              <span className="mx-1">•</span>
              <kbd className="px-1.5 py-0.5 bg-slate-100 rounded border border-slate-200 text-slate-600 font-mono text-[10px]">←</kbd> Previous
            </div>
          </div>

          {/* ================= 4. OFFICIAL ACTION CONTROLS (NTA / TCS iON) ================= */}
          <div className="border-t border-slate-200 bg-slate-50 p-3 sm:p-4 shrink-0 flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentQIndex((i) => Math.max(0, i - 1))}
                disabled={currentQIndex === 0}
                className="gap-1 rounded-xl font-bold text-xs cursor-pointer border-slate-300"
              >
                <ChevronLeft className="w-4 h-4" /> Previous
              </Button>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearResponse}
                disabled={!answers[currentQ.id]}
                className="text-slate-600 hover:text-slate-900 rounded-xl font-semibold text-xs cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5 mr-1" /> Clear Response
              </Button>
            </div>

            <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap">
              {/* Mark for Review Button */}
              <Button
                size="sm"
                variant="outline"
                onClick={handleMarkForReviewAndNext}
                className={cn(
                  "rounded-xl font-bold gap-1 text-xs cursor-pointer border transition",
                  reviewed.has(currentQ.id) && !answers[currentQ.id]
                    ? "bg-purple-700 text-white border-purple-700 hover:bg-purple-800"
                    : "border-purple-300 text-purple-700 bg-purple-50 hover:bg-purple-100"
                )}
              >
                <Bookmark className="w-3.5 h-3.5" /> Mark for Review
              </Button>

              {/* Save & Mark for Review */}
              <Button
                size="sm"
                onClick={handleSaveAndMarkForReview}
                disabled={!answers[currentQ.id]}
                className="bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl shadow-xs gap-1 text-xs cursor-pointer"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" /> Save & Mark Review
              </Button>

              {/* Save & Next Button */}
              <Button
                size="sm"
                onClick={handleSaveAndNext}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl shadow-sm gap-1 text-xs px-4 cursor-pointer"
              >
                <span>Save & Next</span>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>

        </main>

        {/* RIGHT: OFFICIAL 5-STATE QUESTION PALETTE (Desktop) */}
        <aside className="hidden lg:flex w-84 border-l border-slate-200 bg-white flex-col overflow-hidden shrink-0 shadow-xs">
          
          {/* Palette Filter Switcher */}
          <div className="p-3.5 border-b border-slate-200 bg-slate-50 space-y-3 shrink-0">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <LayoutGrid className="w-3.5 h-3.5 text-indigo-600" /> Question Palette
              </h3>
              <span className="text-[11px] font-bold text-slate-500 font-mono">
                {currentQIndex + 1}/{totalQuestions}
              </span>
            </div>

            {/* Filter Toggle: Current Section vs All Sections */}
            {sections.length > 1 && (
              <div className="flex rounded-xl bg-slate-200/80 p-0.5 text-[11px] font-bold">
                <button
                  type="button"
                  onClick={() => setPaletteFilter("section")}
                  className={cn(
                    "flex-1 py-1 rounded-lg transition text-center cursor-pointer",
                    paletteFilter === "section" ? "bg-white text-indigo-700 shadow-xs" : "text-slate-600 hover:text-slate-900"
                  )}
                >
                  Current Section
                </button>
                <button
                  type="button"
                  onClick={() => setPaletteFilter("all")}
                  className={cn(
                    "flex-1 py-1 rounded-lg transition text-center cursor-pointer",
                    paletteFilter === "all" ? "bg-white text-indigo-700 shadow-xs" : "text-slate-600 hover:text-slate-900"
                  )}
                >
                  All Sections
                </button>
              </div>
            )}

            {/* Official 5-State Legend */}
            <div className="grid grid-cols-2 gap-1.5 text-[10px] font-bold text-slate-600 pt-1">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-emerald-600 shrink-0" />
                <span>Answered ({answeredCount})</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-rose-500 shrink-0" />
                <span>Not Answered ({notAnsweredCount})</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-purple-600 shrink-0" />
                <span>Marked Review ({reviewCount})</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-purple-600 ring-2 ring-emerald-400 shrink-0" />
                <span>Ans & Review ({answeredAndReviewCount})</span>
              </div>
              <div className="flex items-center gap-1.5 col-span-2">
                <span className="w-3 h-3 rounded bg-slate-200 border border-slate-300 shrink-0" />
                <span>Not Visited ({notVisitedCount})</span>
              </div>
            </div>
          </div>

          {/* Palette Question Buttons Grid */}
          <div className="flex-1 overflow-y-auto p-3.5 space-y-4">
            
            {/* When viewing All Sections, display section group titles */}
            {paletteFilter === "all" && sections.length > 1 ? (
              sections.map((sec) => (
                <div key={sec.name} className="space-y-2">
                  <div className="text-[11px] font-extrabold uppercase text-slate-500 tracking-wider flex items-center justify-between border-b pb-1">
                    <span className="flex items-center gap-1">
                      <span>{sec.meta.icon}</span> {sec.name}
                    </span>
                    <span className="font-mono text-[10px] text-slate-400">
                      {sec.questions.filter((q) => Boolean(answers[q.id])).length}/{sec.count}
                    </span>
                  </div>
                  <div className="grid grid-cols-5 gap-2">
                    {sec.questions.map((q) => {
                      const globalIdx = questions.findIndex((item) => item.id === q.id);
                      const qState = getQuestionState(q.id);
                      const isCurrent = globalIdx === currentQIndex;

                      return (
                        <button
                          key={q.id}
                          type="button"
                          onClick={() => setCurrentQIndex(globalIdx)}
                          className={cn(
                            "aspect-square rounded-xl text-xs font-extrabold transition-all flex items-center justify-center relative cursor-pointer",
                            qState.className,
                            isCurrent && "ring-3 ring-indigo-600 ring-offset-2 scale-105 shadow-md z-10"
                          )}
                          title={`Q${globalIdx + 1}: ${qState.label}`}
                        >
                          {globalIdx + 1}
                          {qState.dot && (
                            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-white" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))
            ) : (
              <div className="grid grid-cols-5 gap-2">
                {displayedPaletteQuestions.map((q: any) => {
                  const globalIdx = questions.findIndex((item) => item.id === q.id);
                  const qState = getQuestionState(q.id);
                  const isCurrent = globalIdx === currentQIndex;

                  return (
                    <button
                      key={q.id}
                      type="button"
                      onClick={() => setCurrentQIndex(globalIdx)}
                      className={cn(
                        "aspect-square rounded-xl text-xs font-extrabold transition-all flex items-center justify-center relative cursor-pointer",
                        qState.className,
                        isCurrent && "ring-3 ring-indigo-600 ring-offset-2 scale-105 shadow-md z-10"
                      )}
                      title={`Q${globalIdx + 1}: ${qState.label}`}
                    >
                      {globalIdx + 1}
                      {qState.dot && (
                        <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-white" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Palette Bottom Sectional Progress & Submit */}
          <div className="p-3.5 border-t border-slate-200 bg-slate-50 space-y-2.5 shrink-0">
            {currentSection && (
              <div className="text-[11px] bg-white p-2.5 rounded-xl border border-slate-200 space-y-1">
                <div className="flex justify-between font-bold text-slate-700">
                  <span className="truncate">{currentSection.name} Progress:</span>
                  <span className="font-mono text-indigo-600">
                    {currentSection.questions.filter((q) => Boolean(answers[q.id])).length} / {currentSection.count}
                  </span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-emerald-500 h-full transition-all"
                    style={{
                      width: `${(currentSection.questions.filter((q) => Boolean(answers[q.id])).length / currentSection.count) * 100}%`,
                    }}
                  />
                </div>
              </div>
            )}

            <Button
              onClick={handleSubmitPrompt}
              disabled={submitMutation.isPending}
              className="w-full bg-red-600 hover:bg-red-700 text-white font-extrabold py-5 rounded-xl shadow-md gap-2 cursor-pointer transition active:scale-[0.99]"
            >
              {submitMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Submit Examination
            </Button>
          </div>

        </aside>

      </div>

      {/* ================= 5. MOBILE QUESTION PALETTE SHEET ================= */}
      <Sheet open={mobilePaletteOpen} onOpenChange={setMobilePaletteOpen}>
        <SheetContent side="right" className="w-[85vw] sm:w-96 p-0 flex flex-col bg-white">
          <SheetHeader className="p-4 border-b border-slate-200 bg-slate-50">
            <SheetTitle className="text-sm font-black uppercase tracking-wider text-slate-800 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <LayoutGrid className="w-4 h-4 text-indigo-600" /> Question Palette
              </span>
              <span className="text-xs font-mono text-indigo-600">
                {answeredCount}/{totalQuestions} Answered
              </span>
            </SheetTitle>
          </SheetHeader>

          {/* Legend */}
          <div className="p-3 border-b border-slate-100 bg-slate-50/50">
            <div className="grid grid-cols-2 gap-1.5 text-[10px] font-bold text-slate-600">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-emerald-600 shrink-0" />
                <span>Answered ({answeredCount})</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-rose-500 shrink-0" />
                <span>Not Answered ({notAnsweredCount})</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-purple-600 shrink-0" />
                <span>Marked Review ({reviewCount})</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-slate-200 border border-slate-300 shrink-0" />
                <span>Not Visited ({notVisitedCount})</span>
              </div>
            </div>
          </div>

          {/* Palette Questions Grid */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {sections.map((sec) => (
              <div key={sec.name} className="space-y-2">
                <div className="text-xs font-extrabold uppercase text-slate-600 tracking-wider flex items-center justify-between border-b pb-1">
                  <span>{sec.meta.icon} {sec.name}</span>
                  <span className="font-mono text-[11px] text-indigo-600">
                    {sec.questions.filter((q) => Boolean(answers[q.id])).length}/{sec.count}
                  </span>
                </div>
                <div className="grid grid-cols-5 gap-2">
                  {sec.questions.map((q) => {
                    const globalIdx = questions.findIndex((item) => item.id === q.id);
                    const qState = getQuestionState(q.id);
                    const isCurrent = globalIdx === currentQIndex;

                    return (
                      <button
                        key={q.id}
                        type="button"
                        onClick={() => {
                          setCurrentQIndex(globalIdx);
                          setMobilePaletteOpen(false);
                        }}
                        className={cn(
                          "aspect-square rounded-xl text-xs font-extrabold transition-all flex items-center justify-center relative cursor-pointer",
                          qState.className,
                          isCurrent && "ring-3 ring-indigo-600 ring-offset-2 scale-105 shadow-md"
                        )}
                      >
                        {globalIdx + 1}
                        {qState.dot && (
                          <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-400 border border-white" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <div className="p-4 border-t border-slate-200 bg-slate-50">
            <Button
              onClick={() => {
                setMobilePaletteOpen(false);
                handleSubmitPrompt();
              }}
              className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-5 rounded-xl shadow-md cursor-pointer"
            >
              Submit Examination
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* ================= 6. QUESTION PAPER FULL VIEW MODAL ================= */}
      <Dialog open={paperModalOpen} onOpenChange={setPaperModalOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col rounded-3xl p-0 overflow-hidden bg-white">
          <DialogHeader className="p-5 border-b border-slate-200 bg-slate-50 shrink-0">
            <DialogTitle className="text-lg font-black text-slate-900 flex items-center gap-2">
              <FileText className="w-5 h-5 text-indigo-600" /> Entire Question Paper View
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Browse all questions across portions. Click &quot;Jump to Question&quot; on any item to solve it.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-6 space-y-8">
            {sections.map((sec) => (
              <div key={sec.name} className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b-2 border-indigo-500/30">
                  <span className="text-xl">{sec.meta.icon}</span>
                  <h3 className="font-black text-sm uppercase tracking-wide text-slate-800">
                    {sec.name} ({sec.count} Questions)
                  </h3>
                </div>

                <div className="space-y-4">
                  {sec.questions.map((q, idx) => {
                    const globalIdx = questions.findIndex((item) => item.id === q.id);
                    const isAnswered = Boolean(answers[q.id]);

                    return (
                      <div key={q.id} className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition space-y-3">
                        <div className="flex items-start justify-between gap-3">
                          <span className="font-extrabold text-xs text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-100">
                            Q{globalIdx + 1}
                          </span>
                          <div className="flex items-center gap-2">
                            {isAnswered && (
                              <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-[10px]">
                                Answered: {answers[q.id]?.toUpperCase()}
                              </Badge>
                            )}
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setCurrentQIndex(globalIdx);
                                setPaperModalOpen(false);
                              }}
                              className="text-xs h-7 rounded-lg border-indigo-200 text-indigo-600 hover:bg-indigo-50 font-bold"
                            >
                              Jump to Question →
                            </Button>
                          </div>
                        </div>

                        <div className="text-sm text-slate-800 font-medium">
                          {renderContent(q.question_text)}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-700 pt-1">
                          {(["a", "b", "c", "d"] as const).map((opt) => {
                            const optText = q[`option_${opt}`];
                            if (!optText) return null;
                            const isSelected = answers[q.id] === opt;
                            return (
                              <div
                                key={opt}
                                className={cn(
                                  "p-2 rounded-xl border flex items-center gap-2",
                                  isSelected ? "bg-indigo-50 border-indigo-300 font-bold text-indigo-900" : "bg-white border-slate-200"
                                )}
                              >
                                <span className="w-5 h-5 rounded-md bg-slate-100 flex items-center justify-center font-bold text-[10px] shrink-0">
                                  {opt.toUpperCase()}
                                </span>
                                <span className="truncate">{optText}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* ================= 7. ENHANCED SECTIONAL SUBMISSION CONFIRMATION DIALOG ================= */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent className="rounded-3xl max-w-xl p-6 bg-white">
          <AlertDialogHeader className="space-y-2">
            <AlertDialogTitle className="text-xl font-black text-slate-900 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-indigo-600" /> Ready to Submit Examination?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-slate-600 text-xs">
              Please review your sectional attempt breakdown before finalizing your submission. Once submitted, you cannot change your answers.
            </AlertDialogDescription>
          </AlertDialogHeader>

          {/* Section-Wise Summary Table (TCS iON Standard) */}
          <div className="my-3 border rounded-2xl overflow-hidden border-slate-200 text-xs">
            <div className="bg-slate-100 px-3 py-2 font-bold text-slate-700 grid grid-cols-5 text-center text-[11px]">
              <span className="text-left col-span-2">Section Name</span>
              <span>Total</span>
              <span className="text-emerald-700">Ans</span>
              <span className="text-rose-600">Unans</span>
            </div>
            <div className="divide-y divide-slate-100 max-h-48 overflow-y-auto">
              {sections.map((sec) => {
                const secAns = sec.questions.filter((q) => Boolean(answers[q.id])).length;
                const secUnans = sec.count - secAns;
                return (
                  <div key={sec.name} className="px-3 py-2 grid grid-cols-5 text-center text-slate-700 items-center">
                    <span className="text-left col-span-2 font-semibold truncate flex items-center gap-1">
                      <span>{sec.meta.icon}</span> {sec.name}
                    </span>
                    <span className="font-mono">{sec.count}</span>
                    <span className="font-mono font-bold text-emerald-600">{secAns}</span>
                    <span className="font-mono text-slate-500">{secUnans}</span>
                  </div>
                );
              })}
            </div>
            <div className="bg-slate-50 px-3 py-2 font-black text-slate-900 grid grid-cols-5 text-center border-t border-slate-200 text-[11px]">
              <span className="text-left col-span-2">TOTAL</span>
              <span className="font-mono">{totalQuestions}</span>
              <span className="font-mono text-emerald-700">{answeredCount}</span>
              <span className="font-mono text-rose-600">{totalQuestions - answeredCount}</span>
            </div>
          </div>

          {/* Warning if unattempted */}
          {totalQuestions - answeredCount > 0 && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs">
              <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
              <span>
                You have <strong>{totalQuestions - answeredCount} unattempted</strong> questions. Are you sure you want to finish now?
              </span>
            </div>
          )}

          <AlertDialogFooter className="gap-2 sm:gap-3 pt-2">
            <AlertDialogCancel className="rounded-xl font-bold cursor-pointer">
              Resume Test (वापस जाएं)
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={doSubmit}
              disabled={submitMutation.isPending}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl px-5 cursor-pointer shadow-md"
            >
              {submitMutation.isPending ? (
                <span className="flex items-center gap-1.5">
                  <Loader2 className="w-4 h-4 animate-spin" /> Submitting...
                </span>
              ) : (
                "Yes, Submit Test"
              )}
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