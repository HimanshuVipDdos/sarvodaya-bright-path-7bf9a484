import { useState, useMemo } from "react";
import { z } from "zod";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "framer-motion";
import { 
  Loader2, Trophy, Download, Search, ArrowLeft, Award, 
  CheckCircle2, XCircle, MinusCircle, Target, TrendingUp, 
  BarChart3, Sparkles, BookOpen, ShieldAlert, Check, X,
  Flame, Zap, HelpCircle, ChevronRight, Share2
} from "lucide-react";
import { toast } from "sonner";
import { getCbtAttemptResult } from "@/lib/cbt.functions";
import { Section } from "@/components/section";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatScore, cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

// -- Intelligent Section Icon & Badge Helper for Any Exam --
function getSectionMeta(name: string) {
  const lower = name.toLowerCase();
  if (lower.includes("math") || lower.includes("quant") || lower.includes("arithmetic") || lower.includes("गणित") || lower.includes("संख्यात्मक")) {
    return { icon: "🔢", badge: "Maths / Quant", color: "from-blue-500 to-indigo-600", border: "border-blue-200", bg: "bg-blue-50", text: "text-blue-700" };
  }
  if (lower.includes("reason") || lower.includes("mental") || lower.includes("logic") || lower.includes("तर्क") || lower.includes("अभिरुचि")) {
    return { icon: "🧠", badge: "Reasoning", color: "from-purple-500 to-violet-600", border: "border-purple-200", bg: "bg-purple-50", text: "text-purple-700" };
  }
  if (lower.includes("gk") || lower.includes("aware") || lower.includes("general") || lower.includes("gs") || lower.includes("ज्ञान") || lower.includes("current") || lower.includes("history") || lower.includes("polity") || lower.includes("geography")) {
    return { icon: "🌍", badge: "General Knowledge", color: "from-amber-500 to-orange-600", border: "border-amber-200", bg: "bg-amber-50", text: "text-amber-700" };
  }
  if (lower.includes("eng") || lower.includes("verbal") || lower.includes("comprehension") || lower.includes("अंग्रेजी")) {
    return { icon: "📖", badge: "English", color: "from-emerald-500 to-teal-600", border: "border-emerald-200", bg: "bg-emerald-50", text: "text-emerald-700" };
  }
  if (lower.includes("hindi") || lower.includes("हिंदी")) {
    return { icon: "🇮🇳", badge: "सामान्य हिंदी", color: "from-orange-500 to-red-600", border: "border-orange-200", bg: "bg-orange-50", text: "text-orange-700" };
  }
  if (lower.includes("physic") || lower.includes("भौतिक")) {
    return { icon: "⚛️", badge: "Physics", color: "from-cyan-500 to-blue-600", border: "border-cyan-200", bg: "bg-cyan-50", text: "text-cyan-700" };
  }
  if (lower.includes("chem") || lower.includes("रसायन")) {
    return { icon: "🧪", badge: "Chemistry", color: "from-teal-500 to-emerald-600", border: "border-teal-200", bg: "bg-teal-50", text: "text-teal-700" };
  }
  if (lower.includes("bio") || lower.includes("botany") || lower.includes("zoology") || lower.includes("जीव")) {
    return { icon: "🧬", badge: "Biology", color: "from-emerald-500 to-green-600", border: "border-emerald-200", bg: "bg-emerald-50", text: "text-emerald-700" };
  }
  return { icon: "📝", badge: "Section", color: "from-slate-600 to-slate-800", border: "border-slate-200", bg: "bg-slate-50", text: "text-slate-700" };
}

// -- Image & Markdown Renderer for Questions & Options --
function renderContent(text: string) {
  if (!text) return null;
  if (text.startsWith("http") && (text.endsWith(".png") || text.endsWith(".jpg") || text.endsWith(".jpeg") || text.endsWith(".webp") || text.includes("supabase.co"))) {
    return <img src={text} alt="content" className="max-w-full max-h-[260px] object-contain rounded-xl shadow-xs" />;
  }
  const parts = text.split(/(!\[.*?\]\(.*?\))/g);
  return (
    <div className="whitespace-pre-wrap break-words leading-relaxed">
      {parts.map((part, i) => {
        const match = part.match(/!\[(.*?)\]\((.*?)\)/);
        if (match) {
          return <img key={i} src={match[2]} alt={match[1] || "Content"} className="max-w-full max-h-[260px] object-contain rounded-xl shadow-xs my-2 inline-block" />;
        }
        return <span key={i}>{part}</span>;
      })}
    </div>
  );
}

export const Route = createFileRoute("/_authenticated/cbt/$testId/result")({
  validateSearch: z.object({ attempt: z.string().optional() }),
  component: ResultPage,
});

function ResultPage() {
  const { testId } = Route.useParams();
  const search = Route.useSearch();
  const fetchResult = useServerFn(getCbtAttemptResult);

  // Filter and search state for question review
  const [reviewFilter, setReviewFilter] = useState<"all" | "mistakes" | "correct" | "unanswered">("all");
  const [selectedSectionFilter, setSelectedSectionFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // If attempt was not passed in query params, resolve the user's latest submitted attempt
  const { data: latestAttemptId, isLoading: findingAttempt } = useQuery({
    queryKey: ["cbt-latest-attempt", testId],
    enabled: !search?.attempt,
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return null;
      const { data } = await supabase
        .from("cbt_attempts")
        .select("id")
        .eq("test_id", testId)
        .eq("user_id", userData.user.id)
        .eq("status", "submitted")
        .order("submitted_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data?.id ?? null;
    },
  });

  const effectiveAttemptId = search?.attempt || latestAttemptId;

  const { data, isLoading, error } = useQuery({
    queryKey: ["cbt-result", effectiveAttemptId],
    enabled: !!effectiveAttemptId,
    queryFn: () => fetchResult({ data: { attempt_id: effectiveAttemptId! } }),
  });

  // Certificate Download Generator
  function downloadCertificate() {
    if (!data) return;
    const canvas = document.createElement("canvas");
    canvas.width = 1200;
    canvas.height = 840;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Rich cream / ivory diploma background
    const bg = ctx.createLinearGradient(0, 0, 1200, 840);
    bg.addColorStop(0, "#FFFDF9");
    bg.addColorStop(1, "#FAF3E8");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 1200, 840);

    // Regal Golden / Bronze Borders
    ctx.strokeStyle = "#854D0E";
    ctx.lineWidth = 14;
    ctx.strokeRect(30, 30, 1140, 780);

    ctx.strokeStyle = "#D97706";
    ctx.lineWidth = 3;
    ctx.strokeRect(48, 48, 1104, 744);

    ctx.strokeStyle = "#FEF3C7";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(56, 56, 1088, 728);

    ctx.textAlign = "center";
    
    // Top Brand Sub-heading
    ctx.fillStyle = "#B45309";
    ctx.font = "bold 20px sans-serif";
    ctx.fillText("SARVODAYA ADHYETA • ONLINE ASSESSMENT SYSTEM", 600, 120);

    // Main Certificate Heading
    ctx.fillStyle = "#78350F";
    ctx.font = "bold 44px serif";
    ctx.fillText("Certificate of Performance", 600, 185);

    ctx.fillStyle = "#78716C";
    ctx.font = "19px sans-serif";
    ctx.fillText("This is officially awarded to", 600, 255);

    // Candidate Name
    ctx.fillStyle = "#1E1B4B";
    ctx.font = "bold 50px serif";
    ctx.fillText(data.student_name, 600, 325);

    // Test completion text
    ctx.fillStyle = "#57534E";
    ctx.font = "19px sans-serif";
    ctx.fillText("for successfully appearing and completing the standardized test", 600, 385);

    // Test Title
    ctx.fillStyle = "#4338CA";
    ctx.font = "bold 30px sans-serif";
    ctx.fillText(`"${data.attempt.test?.title ?? "CBT Examination"}"`, 600, 440);

    // Score & Rank Metric Line
    ctx.fillStyle = "#1E293B";
    ctx.font = "bold 24px sans-serif";
    ctx.fillText(
      `Score: ${formatScore(data.attempt.score)} / ${data.attempt.max_score}   •   All-India Rank #${data.rank} of ${data.total_participants}`,
      600,
      505,
    );

    // Accuracy & Percentile Sub-text
    const percent = data.attempt.max_score > 0 ? Math.round((data.attempt.score / data.attempt.max_score) * 100) : 0;
    const attempted = data.attempt.correct_count + data.attempt.wrong_count;
    const accuracy = attempted > 0 ? Math.round((data.attempt.correct_count / attempted) * 100) : 0;
    ctx.fillStyle = "#64748B";
    ctx.font = "16px sans-serif";
    ctx.fillText(`Performance: ${percent}% Score   •   Accuracy: ${accuracy}%   •   Status: Verified Submission`, 600, 545);

    // Date and Signatures
    ctx.fillStyle = "#78716C";
    ctx.font = "15px sans-serif";
    const dateStr = new Date(data.attempt.submitted_at ?? Date.now()).toLocaleDateString("en-IN", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    ctx.fillText(`Date: ${dateStr}`, 300, 680);
    ctx.fillText("Controller of Examinations", 900, 680);

    // Underline for Signatures
    ctx.strokeStyle = "#CBD5E1";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(180, 660);
    ctx.lineTo(420, 660);
    ctx.moveTo(780, 660);
    ctx.lineTo(1020, 660);
    ctx.stroke();

    const link = document.createElement("a");
    link.download = `Certificate-${data.student_name.replace(/\s+/g, "-")}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
    toast.success("Certificate downloaded successfully!");
  }

  // Parse Section-wise breakdown safely from attempt
  const topicBreakdown = useMemo(() => {
    const raw = data?.attempt?.topic_breakdown;
    if (!raw) return {};
    if (typeof raw === "string") {
      try {
        return JSON.parse(raw);
      } catch {
        return {};
      }
    }
    return raw as Record<string, { correct: number; wrong: number; unanswered: number }>;
  }, [data?.attempt?.topic_breakdown]);

  // Section list extracted from results
  const sectionNames = useMemo(() => {
    const names = new Set<string>();
    Object.keys(topicBreakdown).forEach((k) => names.add(k));
    if (data?.all_answers) {
      data.all_answers.forEach((ans: any) => {
        if (ans.topic) names.add(ans.topic);
      });
    }
    return Array.from(names);
  }, [topicBreakdown, data?.all_answers]);

  // Filtered Questions for Review
  const filteredQuestions = useMemo(() => {
    if (!data?.all_answers) return [];
    return data.all_answers.filter((ans: any, idx: number) => {
      // 1. Filter by status
      if (reviewFilter === "mistakes" && (ans.is_correct || ans.selected_option === null)) return false;
      if (reviewFilter === "correct" && !ans.is_correct) return false;
      if (reviewFilter === "unanswered" && ans.selected_option !== null) return false;

      // 2. Filter by section
      if (selectedSectionFilter !== "all" && ans.topic !== selectedSectionFilter) return false;

      // 3. Filter by search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const text = (ans.question_text || "").toLowerCase();
        const optA = (ans.option_a || "").toLowerCase();
        const optB = (ans.option_b || "").toLowerCase();
        const optC = (ans.option_c || "").toLowerCase();
        const optD = (ans.option_d || "").toLowerCase();
        if (!text.includes(q) && !optA.includes(q) && !optB.includes(q) && !optC.includes(q) && !optD.includes(q)) {
          return false;
        }
      }

      return true;
    });
  }, [data?.all_answers, reviewFilter, selectedSectionFilter, searchQuery]);

  if (findingAttempt || isLoading) {
    return (
      <Section>
        <div className="flex flex-col items-center justify-center py-28 gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-indigo-600" />
          <p className="text-sm font-bold text-slate-600">Calculating your All-India rank and diagnostic analytics...</p>
        </div>
      </Section>
    );
  }

  if (error || !data) {
    return (
      <Section>
        <div className="mx-auto max-w-md bg-white rounded-3xl p-10 text-center shadow-lg border border-slate-100 space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto text-2xl font-black">
            !
          </div>
          <h1 className="text-xl font-bold text-slate-900">Result Not Found</h1>
          <p className="text-sm text-slate-500">{(error as Error)?.message || "Could not retrieve the score card for this attempt."}</p>
          <Button asChild className="rounded-xl mt-2">
            <Link to="/dashboard">Back to Dashboard</Link>
          </Button>
        </div>
      </Section>
    );
  }

  const a = data.attempt;
  const marksPerQ = Number(a.test?.marks_per_question ?? 1);
  const totalQuestions = a.total_questions || (a.correct_count + a.wrong_count + a.unanswered_count);
  const attemptedCount = a.correct_count + a.wrong_count;
  const percent = a.max_score > 0 ? Math.round((a.score / a.max_score) * 100) : 0;
  const accuracyPercent = attemptedCount > 0 ? ((a.correct_count / attemptedCount) * 100).toFixed(1) : "0.0";
  const attemptRate = totalQuestions > 0 ? ((attemptedCount / totalQuestions) * 100).toFixed(1) : "0.0";
  const grossMarks = a.correct_count * marksPerQ;
  const negativePenalty = a.wrong_count * 0.25;

  // Estimated Percentile
  const percentile = data.total_participants > 0
    ? Math.max(1, Math.min(99.9, Math.round(((data.total_participants - data.rank + 1) / data.total_participants) * 100 * 10) / 10))
    : 100;

  // Performance Tier
  let tier = { label: "Topper Tier 🏆", color: "text-emerald-700 bg-emerald-50 border-emerald-200", desc: "Outstanding performance! You are leading among candidates." };
  if (percent < 40) {
    tier = { label: "Needs Intensive Practice 📚", color: "text-rose-700 bg-rose-50 border-rose-200", desc: "Strengthen basics and review concept gaps in your mistakes below." };
  } else if (percent < 60) {
    tier = { label: "Average / Room to Grow ⚡", color: "text-amber-700 bg-amber-50 border-amber-200", desc: "Solid effort. Boost negative mark control and speed to climb ranks." };
  } else if (percent < 80) {
    tier = { label: "Strong Contender 🎯", color: "text-blue-700 bg-blue-50 border-blue-200", desc: "Great score! A little more accuracy will push you into the top 1%." };
  }

  return (
    <Section>
      <div className="max-w-5xl mx-auto space-y-8 pb-16 font-sans">
        
        {/* Top Breadcrumb & Return Action */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-900 transition bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-xs"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Dashboard
          </Link>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={downloadCertificate}
              className="rounded-xl font-bold text-xs gap-1.5 border-amber-300 bg-amber-50/60 hover:bg-amber-100 text-amber-900 shadow-xs cursor-pointer"
            >
              <Award className="h-4 w-4 text-amber-600" /> Download Certificate
            </Button>
            <Button
              asChild
              size="sm"
              variant="outline"
              className="rounded-xl font-bold text-xs gap-1.5 border-slate-200 hover:bg-slate-50 text-slate-700 shadow-xs"
            >
              <Link to="/cbt/$testId/leaderboard" params={{ testId }}>
                <Trophy className="h-4 w-4 text-indigo-600" /> Leaderboard
              </Link>
            </Button>
          </div>
        </div>

        {/* ================= 1. HERO DIAGNOSTIC SCORECARD ================= */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0F172A] via-[#1E1B4B] to-[#2E1065] text-white p-6 sm:p-10 shadow-2xl border border-indigo-900/50"
        >
          {/* Subtle Ambient Background Orbs */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 space-y-6">
            
            {/* Header / Test Title */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-6">
              <div>
                <span className="text-[11px] font-extrabold uppercase tracking-widest text-indigo-300 flex items-center gap-1.5 mb-1">
                  <Sparkles className="h-3.5 w-3.5 text-amber-400" /> Diagnostic Performance Report
                </span>
                <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                  {a.test?.title}
                </h1>
                <p className="text-xs text-slate-300 mt-1 flex items-center gap-2">
                  <span>Aspirant: <strong className="text-white">{data.student_name}</strong></span>
                  <span>•</span>
                  <span>Completed: {new Date(a.submitted_at ?? Date.now()).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span>
                </p>
              </div>

              <div className="flex sm:flex-col items-end justify-between sm:justify-center gap-1">
                <Badge variant="outline" className={cn("px-3 py-1 font-bold text-xs border", tier.color)}>
                  {tier.label}
                </Badge>
                <span className="text-[11px] text-slate-300 hidden sm:block text-right max-w-[220px]">
                  {tier.desc}
                </span>
              </div>
            </div>

            {/* Core 4 Big Stat Callouts */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
              
              {/* Score */}
              <div className="bg-white/5 backdrop-blur-md rounded-2xl p-4 border border-white/10 flex flex-col justify-between">
                <span className="text-[11px] font-bold text-indigo-300 uppercase tracking-wider">Final Net Score</span>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-3xl sm:text-4xl font-black text-white">{formatScore(a.score)}</span>
                  <span className="text-xs font-semibold text-slate-400">/ {a.max_score}</span>
                </div>
                <div className="mt-2 text-[11px] text-emerald-400 font-bold flex items-center gap-1">
                  <TrendingUp className="w-3.5 h-3.5" /> {percent}% Aggregate
                </div>
              </div>

              {/* All-India Rank */}
              <div className="bg-white/5 backdrop-blur-md rounded-2xl p-4 border border-white/10 flex flex-col justify-between">
                <span className="text-[11px] font-bold text-indigo-300 uppercase tracking-wider">All-India Rank</span>
                <div className="mt-2 flex items-baseline gap-1.5">
                  <span className="text-3xl sm:text-4xl font-black text-amber-300">#{data.rank}</span>
                  <span className="text-xs font-semibold text-slate-400">/ {data.total_participants}</span>
                </div>
                <div className="mt-2 text-[11px] text-amber-400 font-bold">
                  Top {Math.max(1, Math.round((data.rank / (data.total_participants || 1)) * 100))}% of cohort
                </div>
              </div>

              {/* Percentile */}
              <div className="bg-white/5 backdrop-blur-md rounded-2xl p-4 border border-white/10 flex flex-col justify-between">
                <span className="text-[11px] font-bold text-indigo-300 uppercase tracking-wider">Percentile</span>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-3xl sm:text-4xl font-black text-indigo-200">{percentile}</span>
                  <span className="text-xs font-semibold text-slate-400">%ile</span>
                </div>
                <div className="mt-2 text-[11px] text-indigo-300 font-bold">
                  Ahead of {percentile}% students
                </div>
              </div>

              {/* Accuracy % */}
              <div className="bg-white/5 backdrop-blur-md rounded-2xl p-4 border border-white/10 flex flex-col justify-between">
                <span className="text-[11px] font-bold text-indigo-300 uppercase tracking-wider">Precision Accuracy</span>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-3xl sm:text-4xl font-black text-emerald-300">{accuracyPercent}</span>
                  <span className="text-xs font-semibold text-slate-400">%</span>
                </div>
                <div className="mt-2 text-[11px] text-emerald-400 font-bold">
                  {a.correct_count} of {attemptedCount} attempted
                </div>
              </div>

            </div>

            {/* Score Chemistry Breakdown Bar */}
            <div className="rounded-2xl bg-black/20 p-4 border border-white/5 space-y-3">
              <div className="flex items-center justify-between text-xs font-bold text-slate-300">
                <span className="flex items-center gap-1.5 uppercase tracking-wider text-[11px]">
                  <BarChart3 className="w-3.5 h-3.5 text-indigo-400" /> Question Breakdown:
                </span>
                <span className="font-mono text-slate-400">{totalQuestions} Total Questions</span>
              </div>

              {/* Visual Strip */}
              <div className="h-3 w-full rounded-full bg-white/10 overflow-hidden flex">
                <div style={{ width: `${(a.correct_count / totalQuestions) * 100}%` }} className="bg-emerald-500 transition-all" title={`Correct: ${a.correct_count}`} />
                <div style={{ width: `${(a.wrong_count / totalQuestions) * 100}%` }} className="bg-rose-500 transition-all" title={`Wrong: ${a.wrong_count}`} />
                <div style={{ width: `${(a.unanswered_count / totalQuestions) * 100}%` }} className="bg-slate-500 transition-all" title={`Unanswered: ${a.unanswered_count}`} />
              </div>

              {/* Legend & Score Formula */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs pt-1">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-emerald-500 shrink-0" />
                  <span className="text-slate-300">Correct: <strong className="text-white">{a.correct_count}</strong></span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-rose-500 shrink-0" />
                  <span className="text-slate-300">Incorrect: <strong className="text-white">{a.wrong_count}</strong></span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-slate-500 shrink-0" />
                  <span className="text-slate-300">Unattempted: <strong className="text-white">{a.unanswered_count}</strong></span>
                </div>
                <div className="flex items-center gap-2 text-amber-300 font-mono text-[11px]">
                  <span>Score: +{grossMarks} - {negativePenalty.toFixed(2)} = <strong>{formatScore(a.score)}</strong></span>
                </div>
              </div>
            </div>

          </div>
        </motion.div>

        {/* ================= 2. UNIVERSAL SECTION-WISE PERFORMANCE MATRIX ================= */}
        {sectionNames.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-indigo-600" /> Sectional & Subject Performance Matrix
                </h2>
                <p className="text-xs text-slate-500">
                  Comprehensive breakdown of your speed, accuracy, and negative marks per exam portion.
                </p>
              </div>
              <Badge variant="outline" className="text-xs font-bold text-indigo-700 bg-indigo-50 border-indigo-200">
                {sectionNames.length} Portion{sectionNames.length > 1 ? "s" : ""} Evaluated
              </Badge>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {sectionNames.map((name) => {
                const meta = getSectionMeta(name);
                const stats = topicBreakdown[name] || { correct: 0, wrong: 0, unanswered: 0 };
                const secTotal = stats.correct + stats.wrong + stats.unanswered;
                const secAttempted = stats.correct + stats.wrong;
                const secAccuracy = secAttempted > 0 ? Math.round((stats.correct / secAttempted) * 100) : 0;
                const secScore = Math.max(0, Math.round((stats.correct * marksPerQ - stats.wrong * 0.25) * 100) / 100);

                let secStatus = { label: "Strong Subject 💪", color: "text-emerald-700 bg-emerald-50 border-emerald-200" };
                if (secAccuracy < 50) {
                  secStatus = { label: "Needs Practice ⚠️", color: "text-rose-700 bg-rose-50 border-rose-200" };
                } else if (secAccuracy < 75) {
                  secStatus = { label: "Moderate ⚡", color: "text-amber-700 bg-amber-50 border-amber-200" };
                }

                return (
                  <div
                    key={name}
                    className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-xs space-y-4 hover:shadow-md transition"
                  >
                    {/* Section Card Header */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="text-2xl p-2 rounded-2xl bg-slate-50 border border-slate-100 shrink-0">
                          {meta.icon}
                        </span>
                        <div className="min-w-0">
                          <h3 className="font-extrabold text-sm text-slate-900 truncate">
                            {name}
                          </h3>
                          <span className="text-[11px] text-slate-400 font-medium block">
                            {secTotal} Questions ({secTotal * marksPerQ} Marks)
                          </span>
                        </div>
                      </div>
                      <Badge variant="outline" className={cn("text-[10px] font-extrabold shrink-0 border", secStatus.color)}>
                        {secStatus.label}
                      </Badge>
                    </div>

                    {/* Mini Stats Grid */}
                    <div className="grid grid-cols-3 gap-2 text-center text-xs">
                      <div className="bg-emerald-50/70 border border-emerald-100 rounded-xl p-2">
                        <span className="text-[10px] text-emerald-700 font-bold uppercase block">Correct</span>
                        <span className="text-base font-black text-emerald-800">{stats.correct}</span>
                      </div>
                      <div className="bg-rose-50/70 border border-rose-100 rounded-xl p-2">
                        <span className="text-[10px] text-rose-700 font-bold uppercase block">Wrong</span>
                        <span className="text-base font-black text-rose-800">{stats.wrong}</span>
                      </div>
                      <div className="bg-slate-50 border border-slate-200 rounded-xl p-2">
                        <span className="text-[10px] text-slate-500 font-bold uppercase block">Skipped</span>
                        <span className="text-base font-black text-slate-700">{stats.unanswered}</span>
                      </div>
                    </div>

                    {/* Section Accuracy & Score Bar */}
                    <div className="space-y-1.5 pt-1">
                      <div className="flex justify-between text-xs font-bold">
                        <span className="text-slate-600">Accuracy:</span>
                        <span className="text-indigo-600">{secAccuracy}%</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-indigo-600 h-full transition-all rounded-full"
                          style={{ width: `${secAccuracy}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-[11px] text-slate-400 pt-0.5 font-medium">
                        <span>Net Score: <strong>{formatScore(secScore)}</strong></span>
                        <span>Attempted: <strong>{secAttempted}/{secTotal}</strong></span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ================= 3. INTEGRATED FILTERABLE QUESTION & MISTAKE REVIEW ================= */}
        <div className="space-y-6 pt-4">
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
                <Target className="w-5 h-5 text-indigo-600" /> In-Depth Question & Solution Review
              </h2>
              <p className="text-xs text-slate-500">
                Inspect every question, your selected option, and the official answer key with full explanations.
              </p>
            </div>

            {/* Search Input */}
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search questions..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Review Filter Tabs & Section Selector */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
            
            {/* Status Tabs */}
            <div className="flex rounded-2xl bg-slate-100 p-1 text-xs font-bold">
              <button
                type="button"
                onClick={() => setReviewFilter("all")}
                className={cn(
                  "px-3 py-1.5 rounded-xl transition cursor-pointer",
                  reviewFilter === "all" ? "bg-white text-indigo-600 shadow-xs" : "text-slate-600 hover:text-slate-900"
                )}
              >
                All Questions ({data.all_answers?.length || 0})
              </button>
              <button
                type="button"
                onClick={() => setReviewFilter("mistakes")}
                className={cn(
                  "px-3 py-1.5 rounded-xl transition cursor-pointer flex items-center gap-1",
                  reviewFilter === "mistakes" ? "bg-white text-rose-600 shadow-xs" : "text-slate-600 hover:text-slate-900"
                )}
              >
                <XCircle className="w-3.5 h-3.5" /> Mistakes ({a.wrong_count})
              </button>
              <button
                type="button"
                onClick={() => setReviewFilter("correct")}
                className={cn(
                  "px-3 py-1.5 rounded-xl transition cursor-pointer flex items-center gap-1",
                  reviewFilter === "correct" ? "bg-white text-emerald-600 shadow-xs" : "text-slate-600 hover:text-slate-900"
                )}
              >
                <CheckCircle2 className="w-3.5 h-3.5" /> Correct ({a.correct_count})
              </button>
              <button
                type="button"
                onClick={() => setReviewFilter("unanswered")}
                className={cn(
                  "px-3 py-1.5 rounded-xl transition cursor-pointer flex items-center gap-1",
                  reviewFilter === "unanswered" ? "bg-white text-slate-700 shadow-xs" : "text-slate-600 hover:text-slate-900"
                )}
              >
                <MinusCircle className="w-3.5 h-3.5" /> Unanswered ({a.unanswered_count})
              </button>
            </div>

            {/* Portion / Section Selector */}
            {sectionNames.length > 1 && (
              <div className="flex items-center gap-1.5 text-xs font-bold overflow-x-auto py-1">
                <span className="text-slate-400 text-[11px] uppercase tracking-wider shrink-0">Portion:</span>
                <button
                  type="button"
                  onClick={() => setSelectedSectionFilter("all")}
                  className={cn(
                    "px-2.5 py-1 rounded-lg border transition cursor-pointer shrink-0 text-[11px]",
                    selectedSectionFilter === "all"
                      ? "bg-[#6043ED] text-white border-[#6043ED]"
                      : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                  )}
                >
                  All
                </button>
                {sectionNames.map((sName) => (
                  <button
                    key={sName}
                    type="button"
                    onClick={() => setSelectedSectionFilter(sName)}
                    className={cn(
                      "px-2.5 py-1 rounded-lg border transition cursor-pointer shrink-0 text-[11px]",
                      selectedSectionFilter === sName
                        ? "bg-[#6043ED] text-white border-[#6043ED]"
                        : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                    )}
                  >
                    {sName}
                  </button>
                ))}
              </div>
            )}

          </div>

          {/* Questions List */}
          {filteredQuestions.length === 0 ? (
            <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-500 flex items-center justify-center mx-auto text-xl">
                🔍
              </div>
              <h3 className="font-extrabold text-slate-800 text-base">No questions match this filter</h3>
              <p className="text-xs text-slate-500">Try changing the status tab or clear your search term.</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setReviewFilter("all");
                  setSelectedSectionFilter("all");
                  setSearchQuery("");
                }}
                className="rounded-xl text-xs"
              >
                Reset All Filters
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredQuestions.map((q: any, idx: number) => {
                const isCorrect = q.is_correct;
                const isUnanswered = q.selected_option === null;
                const isWrong = !isCorrect && !isUnanswered;
                const secMeta = getSectionMeta(q.topic || "General");

                return (
                  <div
                    key={idx}
                    className="rounded-3xl border border-slate-200/90 bg-white p-5 sm:p-7 shadow-xs space-y-5 transition"
                  >
                    {/* Top Question Header */}
                    <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-xs text-indigo-700 bg-indigo-50 border border-indigo-100 px-2.5 py-1 rounded-xl">
                          Q.{idx + 1}
                        </span>
                        <Badge variant="outline" className="text-[11px] font-bold gap-1 text-slate-600 bg-slate-50 border-slate-200">
                          <span>{secMeta.icon}</span> {q.topic || "General Section"}
                        </Badge>
                      </div>

                      {/* Question Result Badge */}
                      {isCorrect && (
                        <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs font-extrabold gap-1 py-1 px-3">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Correct (+{marksPerQ})
                        </Badge>
                      )}
                      {isWrong && (
                        <Badge className="bg-rose-50 text-rose-700 border-rose-200 text-xs font-extrabold gap-1 py-1 px-3">
                          <XCircle className="w-3.5 h-3.5 text-rose-600" /> Incorrect (-0.25)
                        </Badge>
                      )}
                      {isUnanswered && (
                        <Badge variant="outline" className="bg-slate-50 text-slate-600 border-slate-200 text-xs font-bold gap-1 py-1 px-3">
                          <MinusCircle className="w-3.5 h-3.5 text-slate-400" /> Not Attempted (0.0)
                        </Badge>
                      )}
                    </div>

                    {/* Question Content */}
                    <div className="text-sm sm:text-base font-semibold text-slate-900 leading-relaxed">
                      {renderContent(q.question_text)}
                    </div>

                    {/* 4 Options Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                      {(["a", "b", "c", "d"] as const).map((opt) => {
                        const optText = q[`option_${opt}`];
                        if (!optText) return null;

                        const isStudentChoice = q.selected_option === opt;
                        const isCorrectAnswer = q.correct_option === opt;

                        let style = "border-slate-200 bg-slate-50/50 text-slate-700";
                        let badge = null;

                        if (isCorrectAnswer) {
                          style = "border-emerald-500 bg-emerald-50/80 text-emerald-950 font-bold ring-1 ring-emerald-300";
                          badge = (
                            <span className="text-[10px] uppercase font-black tracking-wider bg-emerald-600 text-white px-2 py-0.5 rounded-md shrink-0 flex items-center gap-1">
                              <Check className="w-3 h-3 stroke-[3]" /> Correct Key
                            </span>
                          );
                        } else if (isStudentChoice && !isCorrectAnswer) {
                          style = "border-rose-400 bg-rose-50/80 text-rose-950 font-bold ring-1 ring-rose-200";
                          badge = (
                            <span className="text-[10px] uppercase font-black tracking-wider bg-rose-600 text-white px-2 py-0.5 rounded-md shrink-0 flex items-center gap-1">
                              <X className="w-3 h-3 stroke-[3]" /> Your Answer
                            </span>
                          );
                        }

                        return (
                          <div
                            key={opt}
                            className={cn(
                              "p-3 sm:p-3.5 rounded-2xl border-2 flex items-start gap-3 transition-all",
                              style
                            )}
                          >
                            <span className={cn(
                              "w-6 h-6 rounded-lg flex items-center justify-center font-black text-xs shrink-0 mt-0.5",
                              isCorrectAnswer
                                ? "bg-emerald-600 text-white"
                                : isStudentChoice
                                ? "bg-rose-600 text-white"
                                : "bg-slate-200 text-slate-700"
                            )}>
                              {opt.toUpperCase()}
                            </span>

                            <div className="flex-1 text-xs sm:text-sm pt-0.5 leading-snug">
                              {renderContent(optText)}
                            </div>

                            {badge}
                          </div>
                        );
                      })}
                    </div>

                    {/* Review Diagnostic Hint */}
                    <div className="text-[11px] text-slate-500 bg-slate-50 p-3 rounded-2xl border border-slate-200 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                        Status:{" "}
                        {isCorrect ? (
                          <strong className="text-emerald-700">Answered correctly on your first attempt.</strong>
                        ) : isWrong ? (
                          <strong className="text-rose-700">You marked option ({q.selected_option?.toUpperCase()}), but correct is ({q.correct_option?.toUpperCase()}).</strong>
                        ) : (
                          <strong className="text-slate-600">You left this question unattempted. Correct option is ({q.correct_option?.toUpperCase()}).</strong>
                        )}
                      </span>
                    </div>

                  </div>
                );
              })}
            </div>
          )}

        </div>

      </div>
    </Section>
  );
}
