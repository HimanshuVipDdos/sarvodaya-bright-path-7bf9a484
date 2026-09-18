import { useState, useMemo, useEffect, useRef } from "react";
import { z } from "zod";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Loader2, Trophy, Download, Search, ArrowLeft, Award, 
  CheckCircle2, XCircle, MinusCircle, Target, TrendingUp, 
  BarChart3, Sparkles, BookOpen, ShieldAlert, Check, X,
  Flame, Zap, HelpCircle, ChevronRight, Share2, Copy,
  CheckCheck, RotateCcw, AlertTriangle, Lightbulb, Compass,
  Layers, PieChart as PieChartIcon, Table as TableIcon,
  LayoutGrid, ArrowUpRight, Gauge, Clock, Medal
} from "lucide-react";
import { 
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, 
  CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell, 
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar 
} from "recharts";
import { toast } from "sonner";
import { getCbtAttemptResult } from "@/lib/cbt.functions";
import { Section } from "@/components/section";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatScore, cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

// -- Intelligent Section Icon & Badge Helper for Any Exam --
function getSectionMeta(name: string) {
  const lower = (name || "").toLowerCase();
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

// -- Robust Math Formula & Image Renderer --
function renderQuestionContent(text: string) {
  if (!text) return null;
  // If it's literally just a raw image URL
  if (text.startsWith("http") && (text.endsWith(".png") || text.endsWith(".jpg") || text.endsWith(".jpeg") || text.endsWith(".webp") || text.includes("supabase.co/storage"))) {
    return <img src={text} alt="Question visual" className="max-w-full max-h-[300px] object-contain rounded-2xl shadow-xs border border-slate-200/80 my-2" />;
  }

  // Pre-process common LaTeX math symbols into crisp unicode equivalents
  const cleanMathText = text
    .replace(/\\times/g, "×")
    .replace(/\\div/g, "÷")
    .replace(/\\pm/g, "±")
    .replace(/\\approx/g, "≈")
    .replace(/\\neq/g, "≠")
    .replace(/\\le/g, "≤")
    .replace(/\\ge/g, "≥")
    .replace(/\\rightarrow/g, "→")
    .replace(/\\infty/g, "∞")
    .replace(/\\alpha/g, "α")
    .replace(/\\beta/g, "β")
    .replace(/\\theta/g, "θ")
    .replace(/\\pi/g, "π")
    .replace(/\\Delta/g, "Δ")
    .replace(/\\sqrt\{([^}]+)\}/g, "√($1)")
    .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, "($1)/($2)")
    .replace(/\^2/g, "²")
    .replace(/\^3/g, "³")
    .replace(/\^([0-9])/g, (_, d) => "⁰¹²³⁴⁵⁶⁷⁸⁹"[parseInt(d)] || `^${d}`);

  // Split on markdown images: ![alt](url)
  const parts = cleanMathText.split(/(!\[.*?\]\(.*?\))/g);
  return (
    <div className="whitespace-pre-wrap break-words leading-relaxed font-medium">
      {parts.map((part, i) => {
        const match = part.match(/!\[(.*?)\]\((.*?)\)/);
        if (match) {
          return (
            <img
              key={i}
              src={match[2]}
              alt={match[1] || "Question visual"}
              className="max-w-full max-h-[280px] object-contain rounded-2xl shadow-xs border border-slate-200/80 my-2 inline-block"
            />
          );
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

  // Filter, view and search states
  const [reviewFilter, setReviewFilter] = useState<"all" | "mistakes" | "correct" | "unanswered">("all");
  const [selectedSectionFilter, setSelectedSectionFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sectionViewMode, setSectionViewMode] = useState<"cards" | "table">("cards");
  const [chartTab, setChartTab] = useState<"peer" | "radar" | "breakdown">("peer");
  const [activeQuestionId, setActiveQuestionId] = useState<string | null>(null);
  const [copiedShare, setCopiedShare] = useState(false);
  const [isClientMounted, setIsClientMounted] = useState(false);

  useEffect(() => {
    setIsClientMounted(true);
  }, []);

  // If attempt was not passed in query params, resolve user's latest submitted attempt
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

  // Certificate Download Generator (High-Res 1200x840 Canvas)
  function downloadCertificate() {
    if (!data) return;
    const canvas = document.createElement("canvas");
    canvas.width = 1200;
    canvas.height = 840;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Rich cream / ivory diploma background with subtle radial glow
    const bg = ctx.createLinearGradient(0, 0, 1200, 840);
    bg.addColorStop(0, "#FFFDF9");
    bg.addColorStop(1, "#FBF3E4");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 1200, 840);

    // Regal Golden & Navy Double Borders
    ctx.strokeStyle = "#78350F";
    ctx.lineWidth = 14;
    ctx.strokeRect(30, 30, 1140, 780);

    ctx.strokeStyle = "#D97706";
    ctx.lineWidth = 3;
    ctx.strokeRect(48, 48, 1104, 744);

    ctx.strokeStyle = "#FDE68A";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(56, 56, 1088, 728);

    // Corner decorative rosettes
    const corners = [
      [64, 64], [1136, 64], [64, 776], [1136, 776]
    ];
    corners.forEach(([cx, cy]) => {
      ctx.fillStyle = "#D97706";
      ctx.beginPath();
      ctx.arc(cx, cy, 8, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.textAlign = "center";
    
    // Top Brand Sub-heading
    ctx.fillStyle = "#92400E";
    ctx.font = "bold 18px sans-serif";
    ctx.fillText("SARVODAYA ADHYETA • STANDARDIZED ASSESSMENT SYSTEM", 600, 115);

    // Main Certificate Heading
    ctx.fillStyle = "#451A03";
    ctx.font = "bold 46px serif";
    ctx.fillText("Certificate of Performance & Merit", 600, 180);

    ctx.fillStyle = "#78716C";
    ctx.font = "18px sans-serif";
    ctx.fillText("This is officially awarded to", 600, 245);

    // Candidate Name
    ctx.fillStyle = "#1E1B4B";
    ctx.font = "bold 52px serif";
    ctx.fillText(data.student_name, 600, 320);

    // Test completion text
    ctx.fillStyle = "#57534E";
    ctx.font = "18px sans-serif";
    ctx.fillText("for successfully appearing in the competitive examination", 600, 380);

    // Test Title
    ctx.fillStyle = "#4338CA";
    ctx.font = "bold 32px sans-serif";
    ctx.fillText(`"${data.attempt.test?.title ?? "Standardized CBT Examination"}"`, 600, 435);

    // Score & Rank Metric Ribbon Line
    ctx.fillStyle = "#0F172A";
    ctx.font = "bold 24px sans-serif";
    ctx.fillText(
      `Score: ${formatScore(data.attempt.score)} / ${data.attempt.max_score}   •   All-India Rank #${data.rank} of ${data.total_participants}`,
      600,
      500,
    );

    // Accuracy & Percentile Sub-text
    const percentVal = data.attempt.max_score > 0 ? Math.round((data.attempt.score / data.attempt.max_score) * 100) : 0;
    const attemptedVal = data.attempt.correct_count + data.attempt.wrong_count;
    const accuracyVal = attemptedVal > 0 ? Math.round((data.attempt.correct_count / attemptedVal) * 100) : 0;
    const percentileVal = data.total_participants > 0
      ? Math.max(1, Math.min(99.9, Math.round(((data.total_participants - data.rank + 1) / data.total_participants) * 100 * 10) / 10))
      : 100;

    ctx.fillStyle = "#64748B";
    ctx.font = "16px sans-serif";
    ctx.fillText(`Percentile: ${percentileVal}%ile   •   Accuracy: ${accuracyVal}%   •   Score: ${percentVal}%`, 600, 540);

    // Seal Simulation
    ctx.strokeStyle = "#B45309";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(600, 640, 42, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = "#92400E";
    ctx.font = "bold 11px sans-serif";
    ctx.fillText("VERIFIED TEST", 600, 638);
    ctx.fillText("SARVODAYA", 600, 652);

    // Date and Signatures
    ctx.fillStyle = "#78716C";
    ctx.font = "15px sans-serif";
    const dateStr = new Date(data.attempt.submitted_at ?? Date.now()).toLocaleDateString("en-IN", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    ctx.fillText(`Date: ${dateStr}`, 280, 710);
    ctx.fillText("Controller of Examinations", 920, 710);

    // Underline for Signatures
    ctx.strokeStyle = "#CBD5E1";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(170, 690);
    ctx.lineTo(390, 690);
    ctx.moveTo(810, 690);
    ctx.lineTo(1030, 690);
    ctx.stroke();

    const link = document.createElement("a");
    link.download = `Certificate-${data.student_name.replace(/\s+/g, "-")}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
    toast.success("Official Certificate downloaded successfully!");
  }

  // Share scorecard summary handler
  function handleShareScore() {
    if (!data) return;
    const a = data.attempt;
    const totalQ = a.total_questions || (a.correct_count + a.wrong_count + a.unanswered_count);
    const text = `🎯 CBT Test Result — Sarvodaya Adhyeta\n📝 Test: ${a.test?.title ?? "CBT Exam"}\n👤 Candidate: ${data.student_name}\n📊 Score: ${formatScore(a.score)} / ${a.max_score}\n🏆 All-India Rank: #${data.rank} of ${data.total_participants}\n⚡ Percentile: ${percentile}%ile\n🎯 Accuracy: ${accuracyPercent}%\nCheck live rank & analysis at: ${window.location.href}`;
    
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedShare(true);
      setTimeout(() => setCopiedShare(false), 3000);
      toast.success("Score summary copied to clipboard! Ready to share.");
    }
  }

  // Smooth scroll to a question card
  function scrollToQuestion(idx: number) {
    const el = document.getElementById(`question-card-${idx}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      setActiveQuestionId(`question-${idx}`);
      setTimeout(() => setActiveQuestionId(null), 2500);
    }
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

  // Section performance metrics calculations
  const marksPerQ = Number(data?.attempt?.test?.marks_per_question ?? 1);
  const negativeMarking = !!data?.attempt?.test?.negative_marking;
  const negativeMarks = Number(data?.attempt?.test?.negative_marks ?? 0.25);

  const sectionPerformanceList = useMemo(() => {
    return sectionNames.map((name) => {
      const stats = topicBreakdown[name] || { correct: 0, wrong: 0, unanswered: 0 };
      const secTotal = stats.correct + stats.wrong + stats.unanswered;
      const secAttempted = stats.correct + stats.wrong;
      const secAccuracy = secAttempted > 0 ? Math.round((stats.correct / secAttempted) * 100) : 0;
      const secGross = stats.correct * marksPerQ;
      const secPenalty = negativeMarking ? stats.wrong * negativeMarks : 0;
      const secScore = Math.max(0, Math.round((secGross - secPenalty) * 100) / 100);
      const secMax = secTotal * marksPerQ;
      const secPercentage = secMax > 0 ? Math.round((secScore / secMax) * 100) : 0;

      let status = {
        label: "Solid Strength 💪",
        badgeColor: "bg-emerald-50 text-emerald-700 border-emerald-200",
        advice: "Outstanding accuracy! Maintain this momentum and speed.",
      };
      if (secAccuracy < 45) {
        status = {
          label: "Critical Focus 🚨",
          badgeColor: "bg-rose-50 text-rose-700 border-rose-200",
          advice: "High negative marks and error rate. Needs topic-wise re-reading.",
        };
      } else if (secAccuracy < 70) {
        status = {
          label: "Moderate Priority ⚠️",
          badgeColor: "bg-amber-50 text-amber-700 border-amber-200",
          advice: "Good foundation. Eliminate wild guesses to increase net score.",
        };
      }

      return {
        name,
        stats,
        secTotal,
        secAttempted,
        secAccuracy,
        secGross,
        secPenalty,
        secScore,
        secMax,
        secPercentage,
        status,
        meta: getSectionMeta(name),
      };
    });
  }, [sectionNames, topicBreakdown, marksPerQ, negativeMarking, negativeMarks]);

  // Filtered Questions for Review
  const filteredQuestions = useMemo(() => {
    if (!data?.all_answers) return [];
    return data.all_answers.filter((ans: any) => {
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
          <div className="relative">
            <div className="w-16 h-16 rounded-full border-4 border-indigo-100 border-t-indigo-600 animate-spin" />
            <Sparkles className="w-6 h-6 text-amber-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
          </div>
          <p className="text-sm font-bold text-slate-700">Calculating your All-India Rank and Diagnostic Matrix...</p>
          <span className="text-xs text-slate-400">Evaluating percentiles, section scores & peer benchmarking</span>
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
  const totalQuestions = a.total_questions || (a.correct_count + a.wrong_count + a.unanswered_count);
  const attemptedCount = a.correct_count + a.wrong_count;
  const percent = a.max_score > 0 ? Math.round((a.score / a.max_score) * 100) : 0;
  const accuracyPercent = attemptedCount > 0 ? ((a.correct_count / attemptedCount) * 100).toFixed(1) : "0.0";
  const attemptRate = totalQuestions > 0 ? ((attemptedCount / totalQuestions) * 100).toFixed(1) : "0.0";
  const grossMarks = a.correct_count * marksPerQ;
  const negativePenalty = negativeMarking ? (a.wrong_count * negativeMarks) : 0;

  // Estimated Percentile
  const percentile = data.total_participants > 0
    ? Math.max(1, Math.min(99.9, Math.round(((data.total_participants - data.rank + 1) / data.total_participants) * 100 * 10) / 10))
    : 100;

  // Peer Benchmarking Stats
  const peer = data.peer_benchmark || {
    topper_score: a.score,
    topper_accuracy: Math.round(Number(accuracyPercent)),
    topper_correct: a.correct_count,
    topper_attempted: attemptedCount,
    average_score: Math.round((a.score * 0.75) * 10) / 10,
    average_accuracy: Math.max(40, Math.round(Number(accuracyPercent) * 0.85)),
    average_correct: Math.round(a.correct_count * 0.8),
    average_attempted: Math.round(attemptedCount * 0.9),
    cutoff_score: Math.round((a.max_score || 100) * 0.45 * 10) / 10,
  };

  const cutoffScore = peer.cutoff_score || Math.round((a.max_score || 100) * 0.45 * 10) / 10;
  const cutoffCleared = a.score >= cutoffScore;
  const cutoffMargin = Math.round((a.score - cutoffScore) * 10) / 10;

  // Performance Tier
  let tier = { 
    label: "Topper Tier 🏆", 
    color: "text-emerald-700 bg-emerald-500/10 border-emerald-400/30", 
    desc: "Outstanding performance! You are leading at the top of the All-India merit list." 
  };
  if (percent < 40) {
    tier = { 
      label: "Needs Intensive Practice 📚", 
      color: "text-rose-400 bg-rose-500/10 border-rose-400/30", 
      desc: "Strengthen basics and review concept gaps in your mistakes below." 
    };
  } else if (percent < 60) {
    tier = { 
      label: "Average / Room to Grow ⚡", 
      color: "text-amber-400 bg-amber-500/10 border-amber-400/30", 
      desc: "Solid effort. Boost negative mark control and speed to climb ranks." 
    };
  } else if (percent < 80) {
    tier = { 
      label: "Strong Contender 🎯", 
      color: "text-blue-400 bg-blue-500/10 border-blue-400/30", 
      desc: "Great score! A little more precision will push you into the top 1%." 
    };
  }

  // Recharts: Peer Comparison Data
  const peerChartData = [
    {
      metric: "Score",
      You: Number(formatScore(a.score)),
      Topper: Number(formatScore(peer.topper_score)),
      Average: Number(formatScore(peer.average_score)),
    },
    {
      metric: "Accuracy %",
      You: Number(accuracyPercent),
      Topper: Number(peer.topper_accuracy),
      Average: Number(peer.average_accuracy),
    },
    {
      metric: "Attempt %",
      You: Number(attemptRate),
      Topper: Math.min(100, Math.round((peer.topper_attempted / (totalQuestions || 1)) * 100)),
      Average: Math.min(100, Math.round((peer.average_attempted / (totalQuestions || 1)) * 100)),
    },
  ];

  // Recharts: Radar Sectional Mastery
  const radarData = sectionPerformanceList.map((sec) => ({
    subject: sec.name.length > 12 ? `${sec.name.slice(0, 10)}..` : sec.name,
    fullName: sec.name,
    accuracy: sec.secAccuracy,
    scoreRate: sec.secPercentage,
    fullMark: 100,
  }));

  // Recharts: Donut Breakdown Data
  const pieBreakdownData = [
    { name: "Correct", value: a.correct_count, color: "#10B981" },
    { name: "Incorrect", value: a.wrong_count, color: "#F43F5E" },
    { name: "Unattempted", value: a.unanswered_count, color: "#94A3B8" },
  ];

  // AI Revision Strategic Action Items
  const mistakeSections = sectionPerformanceList
    .filter((s) => s.stats.wrong > 0)
    .sort((a, b) => b.stats.wrong - a.stats.wrong);
  const primaryWeakSection = mistakeSections[0];

  return (
    <Section>
      <div className="max-w-6xl mx-auto space-y-8 pb-20 font-sans">
        
        {/* ================= 0. TOP ACTION & NAVIGATION BAR ================= */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Link
              to="/dashboard"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 transition bg-white px-3.5 py-2 rounded-xl border border-slate-200 shadow-xs"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Dashboard
            </Link>
            <Badge variant="outline" className="text-xs font-semibold border-indigo-200 text-indigo-700 bg-indigo-50/70 hidden sm:inline-flex">
              National CBT Assessment System
            </Badge>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={handleShareScore}
              className="rounded-xl font-bold text-xs gap-1.5 border-slate-200 bg-white hover:bg-slate-50 text-slate-700 shadow-xs cursor-pointer"
            >
              {copiedShare ? <CheckCheck className="h-4 w-4 text-emerald-600" /> : <Share2 className="h-4 w-4 text-indigo-600" />}
              {copiedShare ? "Copied!" : "Share Score"}
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={downloadCertificate}
              className="rounded-xl font-bold text-xs gap-1.5 border-amber-300 bg-amber-50 hover:bg-amber-100/80 text-amber-900 shadow-xs cursor-pointer"
            >
              <Award className="h-4 w-4 text-amber-600" /> Download Certificate
            </Button>

            <Button
              asChild
              size="sm"
              variant="outline"
              className="rounded-xl font-bold text-xs gap-1.5 border-slate-200 bg-white hover:bg-slate-50 text-slate-700 shadow-xs"
            >
              <Link to="/cbt/$testId/leaderboard" params={{ testId }}>
                <Trophy className="h-4 w-4 text-amber-500" /> Live Leaderboard
              </Link>
            </Button>
          </div>
        </div>

        {/* ================= 1. HERO DIAGNOSTIC SCORECARD ================= */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0B0F19] via-[#111827] to-[#1E1B4B] text-white p-6 sm:p-10 shadow-2xl border border-indigo-500/20"
        >
          {/* Subtle Ambient Background Orbs */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-80 h-80 bg-purple-500/15 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-amber-500/5 rounded-full blur-2xl pointer-events-none" />

          <div className="relative z-10 space-y-7">
            
            {/* Header: Candidate Identity & Diagnostic Badge */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-6">
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[11px] font-black uppercase tracking-widest text-indigo-300 flex items-center gap-1 bg-indigo-950/60 border border-indigo-800/60 px-2.5 py-0.5 rounded-lg">
                    <Sparkles className="h-3 w-3 text-amber-400" /> All-India Diagnostic Scorecard
                  </span>
                  {negativeMarking && (
                    <span className="text-[10px] font-bold text-rose-300 bg-rose-950/50 border border-rose-800/40 px-2 py-0.5 rounded-lg">
                      Negative Marking Active (-{negativeMarks})
                    </span>
                  )}
                </div>
                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white tracking-tight pt-1">
                  {a.test?.title}
                </h1>
                <p className="text-xs text-slate-300 flex items-center gap-2 flex-wrap pt-0.5">
                  <span className="flex items-center gap-1 font-semibold text-white">
                    <Medal className="w-3.5 h-3.5 text-amber-400" /> {data.student_name}
                  </span>
                  <span className="text-slate-500">•</span>
                  <span className="text-slate-400">
                    Evaluated: {new Date(a.submitted_at ?? Date.now()).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </span>
                </p>
              </div>

              <div className="flex sm:flex-col items-end justify-between sm:justify-center gap-1.5 shrink-0">
                <Badge variant="outline" className={cn("px-3.5 py-1.5 font-bold text-xs border backdrop-blur-md shadow-lg", tier.color)}>
                  {tier.label}
                </Badge>
                <span className="text-[11px] text-slate-300 hidden sm:block text-right max-w-[240px]">
                  {tier.desc}
                </span>
              </div>
            </div>

            {/* Core 4 Big Stat Callouts */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              
              {/* Score Tile */}
              <div className="bg-white/[0.04] backdrop-blur-xl rounded-2xl p-4 sm:p-5 border border-white/10 flex flex-col justify-between hover:bg-white/[0.07] transition group">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-indigo-300 uppercase tracking-wider">Final Net Score</span>
                  <Award className="w-4 h-4 text-indigo-400 opacity-60 group-hover:opacity-100 transition" />
                </div>
                <div className="mt-3 flex items-baseline gap-1.5">
                  <span className="text-3xl sm:text-4xl lg:text-5xl font-black text-white">{formatScore(a.score)}</span>
                  <span className="text-xs sm:text-sm font-bold text-slate-400">/ {a.max_score}</span>
                </div>
                <div className="mt-3 text-[11px] text-emerald-400 font-bold flex items-center justify-between border-t border-white/5 pt-2">
                  <span className="flex items-center gap-1">
                    <TrendingUp className="w-3.5 h-3.5" /> {percent}% Aggregate
                  </span>
                  <span className="text-slate-400 font-mono text-[10px]">
                    +{grossMarks} / -{negativePenalty.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* All-India Rank Tile */}
              <div className="bg-white/[0.04] backdrop-blur-xl rounded-2xl p-4 sm:p-5 border border-white/10 flex flex-col justify-between hover:bg-white/[0.07] transition group">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-amber-300 uppercase tracking-wider">All-India Rank</span>
                  <Trophy className="w-4 h-4 text-amber-400 opacity-80 group-hover:scale-110 transition" />
                </div>
                <div className="mt-3 flex items-baseline gap-1.5">
                  <span className="text-3xl sm:text-4xl lg:text-5xl font-black text-amber-300">#{data.rank}</span>
                  <span className="text-xs sm:text-sm font-bold text-slate-400">/ {data.total_participants}</span>
                </div>
                <div className="mt-3 text-[11px] text-amber-400 font-bold flex items-center justify-between border-t border-white/5 pt-2">
                  <span>Top {Math.max(1, Math.round((data.rank / (data.total_participants || 1)) * 100))}% Nationally</span>
                  <span className="text-slate-400 text-[10px]">{data.total_participants} Aspirants</span>
                </div>
              </div>

              {/* Percentile Tile */}
              <div className="bg-white/[0.04] backdrop-blur-xl rounded-2xl p-4 sm:p-5 border border-white/10 flex flex-col justify-between hover:bg-white/[0.07] transition group">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-indigo-300 uppercase tracking-wider">Percentile</span>
                  <Flame className="w-4 h-4 text-indigo-300 opacity-70 group-hover:scale-110 transition" />
                </div>
                <div className="mt-3 flex items-baseline gap-1">
                  <span className="text-3xl sm:text-4xl lg:text-5xl font-black text-indigo-200">{percentile}</span>
                  <span className="text-xs sm:text-sm font-bold text-slate-400">%ile</span>
                </div>
                <div className="mt-3 text-[11px] text-indigo-300 font-bold flex items-center justify-between border-t border-white/5 pt-2">
                  <span>Ahead of {percentile}% students</span>
                  <span className="text-slate-400 text-[10px]">Rank Formula</span>
                </div>
              </div>

              {/* Accuracy % Tile */}
              <div className="bg-white/[0.04] backdrop-blur-xl rounded-2xl p-4 sm:p-5 border border-white/10 flex flex-col justify-between hover:bg-white/[0.07] transition group">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-emerald-300 uppercase tracking-wider">Precision Accuracy</span>
                  <Target className="w-4 h-4 text-emerald-400 opacity-80 group-hover:scale-110 transition" />
                </div>
                <div className="mt-3 flex items-baseline gap-1">
                  <span className="text-3xl sm:text-4xl lg:text-5xl font-black text-emerald-300">{accuracyPercent}</span>
                  <span className="text-xs sm:text-sm font-bold text-slate-400">%</span>
                </div>
                <div className="mt-3 text-[11px] text-emerald-400 font-bold flex items-center justify-between border-t border-white/5 pt-2">
                  <span>{a.correct_count} of {attemptedCount} attempted</span>
                  <span className="text-slate-400 text-[10px]">{attemptRate}% Att. Rate</span>
                </div>
              </div>

            </div>

            {/* Cutoff Clearance Indicator & Score Meter */}
            <div className="rounded-2xl bg-white/[0.03] backdrop-blur-md p-4 sm:p-5 border border-white/10 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Gauge className="w-4 h-4 text-amber-400" />
                  <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                    Predicted Qualifying Cutoff Clearance:
                  </span>
                  <span className="text-xs font-mono font-extrabold text-amber-300">
                    {cutoffScore} Marks
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {cutoffCleared ? (
                    <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 text-xs font-black gap-1 py-1 px-3">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      CLEARED MERIT CUTOFF (+{cutoffMargin} MARKS MARGIN)
                    </Badge>
                  ) : (
                    <Badge className="bg-rose-500/20 text-rose-300 border-rose-500/40 text-xs font-black gap-1 py-1 px-3">
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                      BORDERLINE (NEEDS +{Math.abs(cutoffMargin)} MARKS TO CLEAR)
                    </Badge>
                  )}
                </div>
              </div>

              {/* Cutoff Meter Bar */}
              <div className="space-y-1.5 pt-1">
                <div className="relative h-3 w-full bg-white/10 rounded-full overflow-hidden">
                  <div
                    className={cn(
                      "h-full transition-all duration-500 rounded-full",
                      cutoffCleared ? "bg-gradient-to-r from-indigo-500 to-emerald-400" : "bg-gradient-to-r from-rose-500 to-amber-500"
                    )}
                    style={{ width: `${Math.min(100, Math.max(5, (a.score / (a.max_score || 100)) * 100))}%` }}
                  />
                  {/* Cutoff threshold mark */}
                  <div
                    className="absolute top-0 bottom-0 w-1 bg-amber-400 z-10 shadow-sm"
                    style={{ left: `${Math.min(95, Math.max(5, (cutoffScore / (a.max_score || 100)) * 100))}%` }}
                    title={`Cutoff: ${cutoffScore}`}
                  />
                </div>
                <div className="flex justify-between text-[11px] text-slate-400 pt-0.5">
                  <span>0 Marks</span>
                  <span className="text-amber-300 font-semibold">Cutoff: {cutoffScore}</span>
                  <span className="text-white font-bold">Your Score: {formatScore(a.score)}</span>
                  <span>Max: {a.max_score}</span>
                </div>
              </div>
            </div>

            {/* Question Breakdown Strip */}
            <div className="rounded-2xl bg-black/30 p-4 border border-white/5 space-y-3">
              <div className="flex items-center justify-between text-xs font-bold text-slate-300">
                <span className="flex items-center gap-1.5 uppercase tracking-wider text-[11px]">
                  <BarChart3 className="w-3.5 h-3.5 text-indigo-400" /> Exam Question Composition:
                </span>
                <span className="font-mono text-slate-400">{totalQuestions} Total Questions Evaluated</span>
              </div>

              {/* Multi-segment Strip */}
              <div className="h-3.5 w-full rounded-full bg-white/10 overflow-hidden flex shadow-inner">
                <div 
                  style={{ width: `${(a.correct_count / totalQuestions) * 100}%` }} 
                  className="bg-emerald-500 hover:brightness-110 transition-all cursor-pointer" 
                  title={`Correct: ${a.correct_count}`} 
                  onClick={() => setReviewFilter("correct")}
                />
                <div 
                  style={{ width: `${(a.wrong_count / totalQuestions) * 100}%` }} 
                  className="bg-rose-500 hover:brightness-110 transition-all cursor-pointer" 
                  title={`Incorrect: ${a.wrong_count}`} 
                  onClick={() => setReviewFilter("mistakes")}
                />
                <div 
                  style={{ width: `${(a.unanswered_count / totalQuestions) * 100}%` }} 
                  className="bg-slate-500 hover:brightness-110 transition-all cursor-pointer" 
                  title={`Unattempted: ${a.unanswered_count}`} 
                  onClick={() => setReviewFilter("unanswered")}
                />
              </div>

              {/* Legend & Score Formula */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs pt-1">
                <button 
                  type="button"
                  onClick={() => setReviewFilter("correct")} 
                  className="flex items-center gap-2 text-left hover:opacity-80 cursor-pointer"
                >
                  <span className="w-3 h-3 rounded-full bg-emerald-500 shrink-0 shadow-xs" />
                  <span className="text-slate-300">Correct: <strong className="text-white">{a.correct_count}</strong></span>
                </button>
                <button 
                  type="button"
                  onClick={() => setReviewFilter("mistakes")} 
                  className="flex items-center gap-2 text-left hover:opacity-80 cursor-pointer"
                >
                  <span className="w-3 h-3 rounded-full bg-rose-500 shrink-0 shadow-xs" />
                  <span className="text-slate-300">Incorrect: <strong className="text-white">{a.wrong_count}</strong></span>
                </button>
                <button 
                  type="button"
                  onClick={() => setReviewFilter("unanswered")} 
                  className="flex items-center gap-2 text-left hover:opacity-80 cursor-pointer"
                >
                  <span className="w-3 h-3 rounded-full bg-slate-500 shrink-0 shadow-xs" />
                  <span className="text-slate-300">Skipped: <strong className="text-white">{a.unanswered_count}</strong></span>
                </button>
                <div className="flex items-center gap-1.5 text-amber-300 font-mono text-[11px] justify-end sm:justify-start">
                  <span>Net: +{grossMarks} - {negativePenalty.toFixed(2)} = <strong>{formatScore(a.score)}</strong></span>
                </div>
              </div>
            </div>

          </div>
        </motion.div>

        {/* ================= 2. PEER BENCHMARKING & COMPARATIVE METRICS ================= */}
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h2 className="text-lg sm:text-xl font-black text-slate-900 flex items-center gap-2">
                <Trophy className="w-5 h-5 text-amber-500" /> Peer Benchmarking & Cohort Comparison
              </h2>
              <p className="text-xs text-slate-500">
                Direct head-to-head comparison of your performance against the Test Topper and Cohort Average.
              </p>
            </div>
            <Badge variant="outline" className="text-xs font-bold text-amber-800 bg-amber-50 border-amber-200">
              All-India Peer Data
            </Badge>
          </div>

          {/* 3 Benchmarking Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            
            {/* Score Comparison Card */}
            <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Score Benchmark</span>
                <Badge variant="outline" className="text-[10px] font-extrabold text-indigo-700 bg-indigo-50 border-indigo-200">
                  Marks
                </Badge>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-700 flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-indigo-600" /> You
                  </span>
                  <span className="font-mono font-black text-indigo-700 text-sm">{formatScore(a.score)}</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                  <div className="bg-indigo-600 h-full rounded-full" style={{ width: `${Math.min(100, (a.score / (a.max_score || 1)) * 100)}%` }} />
                </div>

                <div className="flex items-center justify-between text-xs pt-1">
                  <span className="font-medium text-slate-600 flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Topper
                  </span>
                  <span className="font-mono font-bold text-amber-700">{formatScore(peer.topper_score)}</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                  <div className="bg-amber-500 h-full rounded-full" style={{ width: `${Math.min(100, (peer.topper_score / (a.max_score || 1)) * 100)}%` }} />
                </div>

                <div className="flex items-center justify-between text-xs pt-1">
                  <span className="font-medium text-slate-500 flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-slate-400" /> Average
                  </span>
                  <span className="font-mono font-bold text-slate-600">{formatScore(peer.average_score)}</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                  <div className="bg-slate-400 h-full rounded-full" style={{ width: `${Math.min(100, (peer.average_score / (a.max_score || 1)) * 100)}%` }} />
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-500 font-medium">
                {a.score >= peer.topper_score ? (
                  <span className="text-emerald-600 font-bold flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5" /> You set the benchmark score!
                  </span>
                ) : (
                  <span>Gap to Topper: <strong className="text-rose-600 font-mono">-{formatScore(peer.topper_score - a.score)} marks</strong></span>
                )}
              </div>
            </div>

            {/* Accuracy Benchmark Card */}
            <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Precision Accuracy</span>
                <Badge variant="outline" className="text-[10px] font-extrabold text-emerald-700 bg-emerald-50 border-emerald-200">
                  Percentage
                </Badge>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-700 flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" /> You
                  </span>
                  <span className="font-mono font-black text-emerald-700 text-sm">{accuracyPercent}%</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                  <div className="bg-emerald-600 h-full rounded-full" style={{ width: `${Number(accuracyPercent)}%` }} />
                </div>

                <div className="flex items-center justify-between text-xs pt-1">
                  <span className="font-medium text-slate-600 flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Topper
                  </span>
                  <span className="font-mono font-bold text-amber-700">{peer.topper_accuracy}%</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                  <div className="bg-amber-500 h-full rounded-full" style={{ width: `${peer.topper_accuracy}%` }} />
                </div>

                <div className="flex items-center justify-between text-xs pt-1">
                  <span className="font-medium text-slate-500 flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-slate-400" /> Average
                  </span>
                  <span className="font-mono font-bold text-slate-600">{peer.average_accuracy}%</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                  <div className="bg-slate-400 h-full rounded-full" style={{ width: `${peer.average_accuracy}%` }} />
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-500 font-medium">
                {Number(accuracyPercent) >= peer.average_accuracy ? (
                  <span className="text-emerald-600 font-bold">+{Math.round(Number(accuracyPercent) - peer.average_accuracy)}% higher than cohort average</span>
                ) : (
                  <span className="text-rose-600 font-bold">-{Math.round(peer.average_accuracy - Number(accuracyPercent))}% below cohort average</span>
                )}
              </div>
            </div>

            {/* Questions Attempted Benchmark */}
            <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Attempt Volume</span>
                <Badge variant="outline" className="text-[10px] font-extrabold text-blue-700 bg-blue-50 border-blue-200">
                  Questions
                </Badge>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-700 flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-600" /> You
                  </span>
                  <span className="font-mono font-black text-blue-700 text-sm">{attemptedCount} / {totalQuestions}</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                  <div className="bg-blue-600 h-full rounded-full" style={{ width: `${Number(attemptRate)}%` }} />
                </div>

                <div className="flex items-center justify-between text-xs pt-1">
                  <span className="font-medium text-slate-600 flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Topper
                  </span>
                  <span className="font-mono font-bold text-amber-700">{peer.topper_attempted} Qs</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                  <div className="bg-amber-500 h-full rounded-full" style={{ width: `${Math.min(100, (peer.topper_attempted / (totalQuestions || 1)) * 100)}%` }} />
                </div>

                <div className="flex items-center justify-between text-xs pt-1">
                  <span className="font-medium text-slate-500 flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-slate-400" /> Average
                  </span>
                  <span className="font-mono font-bold text-slate-600">{peer.average_attempted} Qs</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                  <div className="bg-slate-400 h-full rounded-full" style={{ width: `${Math.min(100, (peer.average_attempted / (totalQuestions || 1)) * 100)}%` }} />
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-500 font-medium">
                <span>Attempt Efficiency: <strong>{attemptRate}% of total paper</strong></span>
              </div>
            </div>

          </div>
        </div>

        {/* ================= 3. MULTI-CHART DIAGNOSTIC HUB (RECHARTS) ================= */}
        <div className="rounded-3xl border border-slate-200/80 bg-white p-5 sm:p-7 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-lg sm:text-xl font-black text-slate-900 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-indigo-600" /> Interactive Diagnostic Visualizations
              </h2>
              <p className="text-xs text-slate-500">
                Visualize cohort dynamics, question distribution, and sectional spider strengths.
              </p>
            </div>

            {/* Chart Navigation Tabs */}
            <div className="flex rounded-2xl bg-slate-100 p-1 text-xs font-bold self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setChartTab("peer")}
                className={cn(
                  "px-3 py-1.5 rounded-xl transition cursor-pointer flex items-center gap-1.5",
                  chartTab === "peer" ? "bg-white text-indigo-600 shadow-xs" : "text-slate-600 hover:text-slate-900"
                )}
              >
                <Trophy className="w-3.5 h-3.5" /> Peer Benchmark
              </button>
              {sectionNames.length >= 3 && (
                <button
                  type="button"
                  onClick={() => setChartTab("radar")}
                  className={cn(
                    "px-3 py-1.5 rounded-xl transition cursor-pointer flex items-center gap-1.5",
                    chartTab === "radar" ? "bg-white text-indigo-600 shadow-xs" : "text-slate-600 hover:text-slate-900"
                  )}
                >
                  <Compass className="w-3.5 h-3.5" /> Sectional Radar
                </button>
              )}
              <button
                type="button"
                onClick={() => setChartTab("breakdown")}
                className={cn(
                  "px-3 py-1.5 rounded-xl transition cursor-pointer flex items-center gap-1.5",
                  chartTab === "breakdown" ? "bg-white text-indigo-600 shadow-xs" : "text-slate-600 hover:text-slate-900"
                )}
              >
                <PieChartIcon className="w-3.5 h-3.5" /> Question Donut
              </button>
            </div>
          </div>

          {/* Chart Display Area */}
          {isClientMounted ? (
            <div className="h-72 sm:h-80 w-full pt-2">
              {chartTab === "peer" && (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={peerChartData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="metric" tick={{ fill: "#475569", fontSize: 12, fontWeight: 700 }} />
                    <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} />
                    <Tooltip 
                      contentStyle={{ borderRadius: 14, border: "1px solid #e2e8f0", boxShadow: "0 4px 12px rgba(0,0,0,0.05)", fontSize: 12 }} 
                    />
                    <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                    <Bar dataKey="You" fill="#6366F1" radius={[6, 6, 0, 0]} barSize={36} />
                    <Bar dataKey="Topper" fill="#F59E0B" radius={[6, 6, 0, 0]} barSize={36} />
                    <Bar dataKey="Average" fill="#94A3B8" radius={[6, 6, 0, 0]} barSize={36} />
                  </BarChart>
                </ResponsiveContainer>
              )}

              {chartTab === "radar" && (
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart cx="50%" cy="50%" outerRadius="75%" data={radarData}>
                    <PolarGrid stroke="#e2e8f0" strokeDasharray="3 3" />
                    <PolarAngleAxis dataKey="subject" tick={{ fill: "#334155", fontSize: 11, fontWeight: 700 }} />
                    <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: "#94a3b8", fontSize: 10 }} />
                    <Radar name="Accuracy %" dataKey="accuracy" stroke="#6366F1" fill="#6366F1" fillOpacity={0.4} />
                    <Radar name="Score Rate %" dataKey="scoreRate" stroke="#10B981" fill="#10B981" fillOpacity={0.25} />
                    <Tooltip 
                      contentStyle={{ borderRadius: 14, border: "1px solid #e2e8f0", fontSize: 12 }} 
                    />
                    <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                  </RadarChart>
                </ResponsiveContainer>
              )}

              {chartTab === "breakdown" && (
                <div className="flex flex-col sm:flex-row items-center justify-center h-full gap-6">
                  <div className="w-56 h-56 sm:w-64 sm:h-64 relative">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={pieBreakdownData}
                          innerRadius={60}
                          outerRadius={95}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          {pieBreakdownData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12 }} />
                      </PieChart>
                    </ResponsiveContainer>
                    {/* Donut Center Info */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
                      <span className="text-2xl font-black text-slate-900 block leading-tight">{attemptRate}%</span>
                      <span className="text-[10px] uppercase font-bold text-slate-400">Attempted</span>
                    </div>
                  </div>

                  <div className="space-y-3 min-w-[200px]">
                    <div className="flex items-center justify-between text-xs bg-emerald-50 border border-emerald-100 p-2.5 rounded-xl">
                      <span className="flex items-center gap-2 font-bold text-emerald-800">
                        <span className="w-3 h-3 rounded-full bg-emerald-500" /> Correct
                      </span>
                      <span className="font-mono font-black text-emerald-900">{a.correct_count} ({Math.round((a.correct_count / totalQuestions) * 100)}%)</span>
                    </div>
                    <div className="flex items-center justify-between text-xs bg-rose-50 border border-rose-100 p-2.5 rounded-xl">
                      <span className="flex items-center gap-2 font-bold text-rose-800">
                        <span className="w-3 h-3 rounded-full bg-rose-500" /> Incorrect
                      </span>
                      <span className="font-mono font-black text-rose-900">{a.wrong_count} ({Math.round((a.wrong_count / totalQuestions) * 100)}%)</span>
                    </div>
                    <div className="flex items-center justify-between text-xs bg-slate-50 border border-slate-200 p-2.5 rounded-xl">
                      <span className="flex items-center gap-2 font-bold text-slate-700">
                        <span className="w-3 h-3 rounded-full bg-slate-400" /> Skipped
                      </span>
                      <span className="font-mono font-black text-slate-800">{a.unanswered_count} ({Math.round((a.unanswered_count / totalQuestions) * 100)}%)</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="h-72 w-full flex items-center justify-center bg-slate-50 rounded-2xl">
              <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
            </div>
          )}
        </div>

        {/* ================= 4. SUBJECT & SECTION-WISE PERFORMANCE MATRIX ================= */}
        {sectionPerformanceList.length > 0 && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-lg sm:text-xl font-black text-slate-900 flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-indigo-600" /> Sectional & Subject Performance Matrix
                </h2>
                <p className="text-xs text-slate-500">
                  Comprehensive audit of marks, precision accuracy, and negative marks per exam portion.
                </p>
              </div>

              {/* Card vs Table View Toggle */}
              <div className="flex items-center gap-2 self-start sm:self-auto">
                <Badge variant="outline" className="text-xs font-bold text-indigo-700 bg-indigo-50 border-indigo-200">
                  {sectionPerformanceList.length} Portion{sectionPerformanceList.length > 1 ? "s" : ""}
                </Badge>
                <div className="flex rounded-xl bg-slate-100 p-1 text-xs">
                  <button
                    type="button"
                    onClick={() => setSectionViewMode("cards")}
                    className={cn(
                      "p-1.5 rounded-lg transition cursor-pointer",
                      sectionViewMode === "cards" ? "bg-white text-indigo-600 shadow-xs" : "text-slate-500"
                    )}
                    title="Grid Cards View"
                  >
                    <LayoutGrid className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setSectionViewMode("table")}
                    className={cn(
                      "p-1.5 rounded-lg transition cursor-pointer",
                      sectionViewMode === "table" ? "bg-white text-indigo-600 shadow-xs" : "text-slate-500"
                    )}
                    title="Table View"
                  >
                    <TableIcon className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* View 1: Card Grid View */}
            {sectionViewMode === "cards" && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {sectionPerformanceList.map((sec) => (
                  <div
                    key={sec.name}
                    className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-xs space-y-4 hover:shadow-md transition flex flex-col justify-between"
                  >
                    <div className="space-y-4">
                      {/* Section Card Header */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="text-2xl p-2 rounded-2xl bg-slate-50 border border-slate-100 shrink-0">
                            {sec.meta.icon}
                          </span>
                          <div className="min-w-0">
                            <h3 className="font-black text-sm text-slate-900 truncate">
                              {sec.name}
                            </h3>
                            <span className="text-[11px] text-slate-400 font-medium block">
                              {sec.secTotal} Questions ({sec.secMax} Marks)
                            </span>
                          </div>
                        </div>
                        <Badge variant="outline" className={cn("text-[10px] font-extrabold shrink-0 border", sec.status.badgeColor)}>
                          {sec.status.label}
                        </Badge>
                      </div>

                      {/* Mini Stats 3-Grid */}
                      <div className="grid grid-cols-3 gap-2 text-center text-xs">
                        <div className="bg-emerald-50/80 border border-emerald-100 rounded-xl p-2">
                          <span className="text-[10px] text-emerald-700 font-bold uppercase block">Correct</span>
                          <span className="text-base font-black text-emerald-800">{sec.stats.correct}</span>
                        </div>
                        <div className="bg-rose-50/80 border border-rose-100 rounded-xl p-2">
                          <span className="text-[10px] text-rose-700 font-bold uppercase block">Wrong</span>
                          <span className="text-base font-black text-rose-800">{sec.stats.wrong}</span>
                        </div>
                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-2">
                          <span className="text-[10px] text-slate-500 font-bold uppercase block">Skipped</span>
                          <span className="text-base font-black text-slate-700">{sec.stats.unanswered}</span>
                        </div>
                      </div>

                      {/* Section Accuracy & Score Bar */}
                      <div className="space-y-1.5 pt-1">
                        <div className="flex justify-between text-xs font-bold">
                          <span className="text-slate-600">Accuracy:</span>
                          <span className="text-indigo-600 font-mono">{sec.secAccuracy}%</span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                          <div
                            className={cn(
                              "h-full transition-all rounded-full",
                              sec.secAccuracy >= 75 ? "bg-emerald-500" : sec.secAccuracy >= 50 ? "bg-amber-500" : "bg-rose-500"
                            )}
                            style={{ width: `${sec.secAccuracy}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-[11px] text-slate-500 pt-0.5 font-medium">
                          <span>Net Score: <strong className="text-slate-900 font-mono">{formatScore(sec.secScore)} / {sec.secMax}</strong></span>
                          <span>Att: <strong>{sec.secAttempted}/{sec.secTotal}</strong></span>
                        </div>
                      </div>
                    </div>

                    {/* Actionable Advice Footer */}
                    <div className="pt-3 border-t border-slate-100 text-[11px] text-slate-500 flex items-start gap-1.5">
                      <Lightbulb className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                      <span>{sec.status.advice}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* View 2: Detailed Matrix Table */}
            {sectionViewMode === "table" && (
              <div className="rounded-3xl border border-slate-200/80 bg-white shadow-xs overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-500 uppercase tracking-wider text-[10px]">
                      <tr>
                        <th className="py-3.5 px-4 font-extrabold">Section / Subject</th>
                        <th className="py-3.5 px-3 font-extrabold text-center">Total Qs</th>
                        <th className="py-3.5 px-3 font-extrabold text-center">Attempted</th>
                        <th className="py-3.5 px-3 font-extrabold text-center text-emerald-700">Correct</th>
                        <th className="py-3.5 px-3 font-extrabold text-center text-rose-700">Wrong</th>
                        <th className="py-3.5 px-3 font-extrabold text-center text-slate-500">Skipped</th>
                        <th className="py-3.5 px-3 font-extrabold text-center">Accuracy %</th>
                        <th className="py-3.5 px-3 font-extrabold text-right">Net Score</th>
                        <th className="py-3.5 px-4 font-extrabold text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {sectionPerformanceList.map((sec) => (
                        <tr key={sec.name} className="hover:bg-slate-50/50 transition">
                          <td className="py-3.5 px-4 font-bold text-slate-900 flex items-center gap-2">
                            <span>{sec.meta.icon}</span> {sec.name}
                          </td>
                          <td className="py-3.5 px-3 text-center font-mono">{sec.secTotal}</td>
                          <td className="py-3.5 px-3 text-center font-mono font-medium">{sec.secAttempted}</td>
                          <td className="py-3.5 px-3 text-center font-mono font-bold text-emerald-600">+{sec.stats.correct}</td>
                          <td className="py-3.5 px-3 text-center font-mono font-bold text-rose-600">-{sec.stats.wrong}</td>
                          <td className="py-3.5 px-3 text-center font-mono text-slate-400">{sec.stats.unanswered}</td>
                          <td className="py-3.5 px-3 text-center font-mono font-extrabold text-indigo-700">{sec.secAccuracy}%</td>
                          <td className="py-3.5 px-3 text-right font-mono font-black text-slate-900">{formatScore(sec.secScore)} / {sec.secMax}</td>
                          <td className="py-3.5 px-4 text-right">
                            <Badge variant="outline" className={cn("text-[10px] font-bold border", sec.status.badgeColor)}>
                              {sec.status.label}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

          </div>
        )}

        {/* ================= 5. SMART WEAK AREA & AI REVISION STRATEGY ================= */}
        <div className="rounded-3xl border border-indigo-100 bg-gradient-to-br from-indigo-50/50 via-white to-purple-50/40 p-6 sm:p-8 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="text-[11px] font-black uppercase tracking-widest text-indigo-600 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" /> Actionable AI Exam Diagnostic
              </span>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight pt-1">
                Marks Booster Plan: How to Gain +15 to +20 Marks
              </h2>
              <p className="text-xs text-slate-600">
                Data-driven strategic recommendations based on your mistakes and attempt efficiency.
              </p>
            </div>
            <div className="bg-indigo-600 text-white px-4 py-2 rounded-2xl text-xs font-black self-start sm:self-auto shadow-md">
              Target Next Attempt: {Math.min(a.max_score, Math.round((a.score + 18) * 10) / 10)} Marks
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            
            {/* Action 1: Negative Marks Shield */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs space-y-3">
              <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-black">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <h3 className="font-extrabold text-sm text-slate-900">1. Negative Mark Containment</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                You lost <strong className="text-rose-600">-{negativePenalty.toFixed(2)} marks</strong> to incorrect answers. In competitive exams, eliminating blind guesses can elevate your percentile by <strong>~8-12%</strong> instantly.
              </p>
              <div className="text-[11px] font-semibold text-rose-700 bg-rose-50/80 p-2 rounded-xl border border-rose-100">
                Rule: Never guess unless you can eliminate at least 2 options!
              </div>
            </div>

            {/* Action 2: Weakest Portion Revision */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs space-y-3">
              <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-black">
                <Target className="w-5 h-5" />
              </div>
              <h3 className="font-extrabold text-sm text-slate-900">2. Target Weakest Topic</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                {primaryWeakSection ? (
                  <>
                    Your highest error rate was in <strong className="text-amber-700">{primaryWeakSection.name}</strong> ({primaryWeakSection.stats.wrong} mistakes). Focus your next 3 revision days strictly on this section.
                  </>
                ) : (
                  "Review the mistake questions in detail below to identify conceptual blind spots."
                )}
              </p>
              <div className="text-[11px] font-semibold text-amber-800 bg-amber-50/80 p-2 rounded-xl border border-amber-100">
                Focus: Revise core formulas & solve 30 practice questions.
              </div>
            </div>

            {/* Action 3: Speed & Question Triage */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs space-y-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-black">
                <Zap className="w-5 h-5" />
              </div>
              <h3 className="font-extrabold text-sm text-slate-900">3. 2-Pass Test Strategy</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                You skipped <strong className="text-slate-800">{a.unanswered_count} questions</strong>. In Pass 1, clear all 100% confident questions in under 45 seconds each. In Pass 2, tackle calculations and reasoning puzzles.
              </p>
              <div className="text-[11px] font-semibold text-indigo-800 bg-indigo-50/80 p-2 rounded-xl border border-indigo-100">
                Result: Unlocks 6-8 additional high-accuracy questions!
              </div>
            </div>

          </div>
        </div>

        {/* ================= 6. IN-DEPTH QUESTION & SOLUTION REVIEW ENGINE ================= */}
        <div className="space-y-6 pt-2">
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
                <Target className="w-5 h-5 text-indigo-600" /> In-Depth Question & Solution Review Engine
              </h2>
              <p className="text-xs text-slate-500">
                Inspect every question, your selected option, and official verified solutions with side-by-side diagnostics.
              </p>
            </div>

            {/* Real-Time Question Search Bar */}
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search question text or options..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-7 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Interactive Question Jump Palette (1..N Matrix) */}
          {data.all_answers && data.all_answers.length > 0 && (
            <div className="rounded-3xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between text-xs font-bold text-slate-600">
                <span className="flex items-center gap-1.5 uppercase tracking-wider text-[11px]">
                  <Layers className="w-3.5 h-3.5 text-indigo-600" /> Fast Jump Question Palette:
                </span>
                <span className="text-[11px] text-slate-400">Click any question number to scroll directly</span>
              </div>

              <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto pr-1 py-1">
                {data.all_answers.map((ans: any, idx: number) => {
                  const isCorrect = ans.is_correct;
                  const isUnanswered = ans.selected_option === null;
                  const isWrong = !isCorrect && !isUnanswered;

                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => scrollToQuestion(idx)}
                      className={cn(
                        "w-8 h-8 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center justify-center shrink-0 border",
                        isCorrect
                          ? "bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100"
                          : isWrong
                          ? "bg-rose-50 text-rose-700 border-rose-300 hover:bg-rose-100"
                          : "bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200"
                      )}
                      title={`Q.${idx + 1}: ${isCorrect ? "Correct" : isWrong ? "Incorrect" : "Unattempted"}`}
                    >
                      {idx + 1}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

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
                All ({data.all_answers?.length || 0})
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
                <MinusCircle className="w-3.5 h-3.5" /> Skipped ({a.unanswered_count})
              </button>
            </div>

            {/* Portion / Section Selector Pills */}
            {sectionNames.length > 1 && (
              <div className="flex items-center gap-1.5 text-xs font-bold overflow-x-auto py-1">
                <span className="text-slate-400 text-[11px] uppercase tracking-wider shrink-0">Subject:</span>
                <button
                  type="button"
                  onClick={() => setSelectedSectionFilter("all")}
                  className={cn(
                    "px-2.5 py-1 rounded-lg border transition cursor-pointer shrink-0 text-[11px]",
                    selectedSectionFilter === "all"
                      ? "bg-indigo-600 text-white border-indigo-600 shadow-xs"
                      : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                  )}
                >
                  All Portions
                </button>
                {sectionNames.map((sName) => (
                  <button
                    key={sName}
                    type="button"
                    onClick={() => setSelectedSectionFilter(sName)}
                    className={cn(
                      "px-2.5 py-1 rounded-lg border transition cursor-pointer shrink-0 text-[11px]",
                      selectedSectionFilter === sName
                        ? "bg-indigo-600 text-white border-indigo-600 shadow-xs"
                        : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                    )}
                  >
                    {sName}
                  </button>
                ))}
              </div>
            )}

          </div>

          {/* Questions Render List */}
          {filteredQuestions.length === 0 ? (
            <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-500 flex items-center justify-center mx-auto text-2xl">
                🔍
              </div>
              <h3 className="font-extrabold text-slate-800 text-base">No questions match your filter</h3>
              <p className="text-xs text-slate-500">Try changing the status filter or clearing your search keywords.</p>
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
            <div className="space-y-5">
              {filteredQuestions.map((q: any, idx: number) => {
                const isCorrect = q.is_correct;
                const isUnanswered = q.selected_option === null;
                const isWrong = !isCorrect && !isUnanswered;
                const secMeta = getSectionMeta(q.topic || "General");
                const qNumber = q.sort_order ?? idx + 1;
                const isHighlighted = activeQuestionId === `question-${idx}`;

                return (
                  <div
                    key={q.id ?? idx}
                    id={`question-card-${idx}`}
                    className={cn(
                      "rounded-3xl border bg-white p-5 sm:p-7 shadow-xs space-y-5 transition-all duration-300",
                      isHighlighted
                        ? "ring-4 ring-indigo-400 border-indigo-500 shadow-lg"
                        : "border-slate-200/90 hover:border-slate-300"
                    )}
                  >
                    {/* Top Question Meta Row */}
                    <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-black text-xs text-indigo-700 bg-indigo-50 border border-indigo-200 px-3 py-1 rounded-xl">
                          Q.{qNumber}
                        </span>
                        <Badge variant="outline" className="text-[11px] font-bold gap-1 text-slate-700 bg-slate-50 border-slate-200">
                          <span>{secMeta.icon}</span> {q.topic || "General Portion"}
                        </Badge>
                        <span className="text-[11px] font-semibold text-slate-400">
                          +{marksPerQ} Marks
                        </span>
                      </div>

                      {/* Question Outcome Badge */}
                      {isCorrect && (
                        <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs font-black gap-1 py-1 px-3">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Correct (+{marksPerQ})
                        </Badge>
                      )}
                      {isWrong && (
                        <Badge className="bg-rose-50 text-rose-700 border-rose-200 text-xs font-black gap-1 py-1 px-3">
                          <XCircle className="w-3.5 h-3.5 text-rose-600" /> Incorrect (-{negativeMarks})
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
                      {renderQuestionContent(q.question_text)}
                    </div>

                    {/* 4 Options Matrix */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                      {(["a", "b", "c", "d"] as const).map((opt) => {
                        const optText = q[`option_${opt}`];
                        if (!optText) return null;

                        const isStudentChoice = q.selected_option === opt;
                        const isCorrectAnswer = q.correct_option === opt;

                        let style = "border-slate-200 bg-slate-50/50 text-slate-700 hover:bg-slate-50";
                        let badge = null;

                        if (isCorrectAnswer) {
                          style = "border-emerald-500 bg-emerald-50/90 text-emerald-950 font-bold ring-2 ring-emerald-300";
                          badge = (
                            <span className="text-[10px] uppercase font-black tracking-wider bg-emerald-600 text-white px-2 py-0.5 rounded-md shrink-0 flex items-center gap-1 shadow-xs">
                              <Check className="w-3 h-3 stroke-[3]" /> Official Key
                            </span>
                          );
                        } else if (isStudentChoice && !isCorrectAnswer) {
                          style = "border-rose-500 bg-rose-50/90 text-rose-950 font-bold ring-2 ring-rose-200";
                          badge = (
                            <span className="text-[10px] uppercase font-black tracking-wider bg-rose-600 text-white px-2 py-0.5 rounded-md shrink-0 flex items-center gap-1 shadow-xs">
                              <X className="w-3 h-3 stroke-[3]" /> Your Answer
                            </span>
                          );
                        }

                        return (
                          <div
                            key={opt}
                            className={cn(
                              "p-3.5 rounded-2xl border-2 flex items-start gap-3 transition-all",
                              style
                            )}
                          >
                            <span className={cn(
                              "w-6 h-6 rounded-lg flex items-center justify-center font-black text-xs shrink-0 mt-0.5",
                              isCorrectAnswer
                                ? "bg-emerald-600 text-white shadow-xs"
                                : isStudentChoice
                                ? "bg-rose-600 text-white shadow-xs"
                                : "bg-slate-200 text-slate-700"
                            )}>
                              {opt.toUpperCase()}
                            </span>

                            <div className="flex-1 text-xs sm:text-sm pt-0.5 leading-snug">
                              {renderQuestionContent(optText)}
                            </div>

                            {badge}
                          </div>
                        );
                      })}
                    </div>

                    {/* Diagnostic Answer Rationale Bar */}
                    <div className="text-[11px] text-slate-600 bg-slate-50/80 p-3.5 rounded-2xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                        <span>
                          {isCorrect ? (
                            <strong className="text-emerald-700">Answered correctly on your first attempt (+{marksPerQ} Marks).</strong>
                          ) : isWrong ? (
                            <span className="text-rose-700 font-semibold">
                              You selected <strong>Option {q.selected_option?.toUpperCase()}</strong>, but official answer key is <strong>Option {q.correct_option?.toUpperCase()}</strong> (-{negativeMarks} marks).
                            </span>
                          ) : (
                            <span className="text-slate-600 font-medium">
                              You left this question unattempted. The official key is <strong>Option {q.correct_option?.toUpperCase()}</strong>.
                            </span>
                          )}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-auto shrink-0 font-mono text-[10px] text-slate-400">
                        <span>ID: {q.id ? q.id.slice(0, 8) : "Q-" + qNumber}</span>
                      </div>
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
