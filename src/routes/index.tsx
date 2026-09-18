import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { useState } from "react";
import {
  Sparkles,
  Trophy,
  Users,
  BookOpen,
  GraduationCap,
  ArrowRight,
  Star,
  Calendar,
  Bell,
  Video,
  FileText,
  CheckCircle2,
  MapPin,
  Phone,
  MessageCircle,
  Clock,
  Radio,
  Flame,
  ShieldCheck,
  Award,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Section } from "@/components/section";
import { InquiryForm } from "@/components/inquiry-form";
import { HeroSlider } from "@/components/hero-slider";
import { Hero3DModel } from "@/components/hero-3d-model";
import { Button } from "@/components/ui/button";
import { BatchCard } from "@/components/edtech/batch-card";
import { TopperCard } from "@/components/edtech/topper-card";
import { SITE, whatsappHref, telHref } from "@/lib/site";
import { cn, isClassLiveNow } from "@/lib/utils";
import {
  LandingStatsConfig,
  StatMetricKey,
  defaultLandingStatsConfig,
  formatStatDisplayValue,
  ICON_MAP,
  COLOR_MAP,
} from "@/lib/landing-stats";

const landingQuery = queryOptions({
  queryKey: ["landing-data"],
  queryFn: async () => {
    try {
      await supabase.rpc("tick_live_classes" as never);
    } catch {}

    const [
      batches,
      faculty,
      results,
      notifications,
      currentAffairs,
      statsConfigRes,
      studentCount,
      testCount,
      materialCount,
      batchCount,
      liveClassCount,
      liveRes,
    ] = await Promise.all([
      supabase.from("batches").select("*").eq("is_active", true).order("is_featured", { ascending: false }).limit(8),
      supabase.from("faculty").select("*").eq("is_active", true).order("sort_order").limit(6),
      supabase.from("results").select("*").order("sort_order").limit(12),
      supabase.from("notifications").select("*").eq("is_active", true).order("created_at", { ascending: false }).limit(5),
      supabase.from("current_affairs").select("*").eq("is_active", true).order("publish_date", { ascending: false }).limit(4),
      supabase.from("notifications").select("body").eq("category", "landing_stats_config").eq("title", "landing_stats").maybeSingle().then(res => res, () => ({ data: null, error: null })),
      supabase.from("profiles").select("id", { count: "exact", head: true }).then(res => res.count ?? 0, () => 0),
      supabase.from("cbt_tests").select("id", { count: "exact", head: true }).then(res => res.count ?? 0, () => 0),
      supabase.from("study_materials").select("id", { count: "exact", head: true }).then(res => res.count ?? 0, () => 0),
      supabase.from("batches").select("id", { count: "exact", head: true }).then(res => res.count ?? 0, () => 0),
      supabase.from("live_classes").select("id", { count: "exact", head: true }).then(res => res.count ?? 0, () => 0),
      supabase.from("live_classes").select("id, batch_id, is_live, status, scheduled_at, end_at, duration_minutes"),
    ]);

    let statsConfig: LandingStatsConfig = defaultLandingStatsConfig;
    if (statsConfigRes?.data?.body) {
      try {
        const parsed = JSON.parse(statsConfigRes.data.body) as LandingStatsConfig;
        if (parsed && Array.isArray(parsed.cards)) {
          statsConfig = {
            is_enabled: parsed.is_enabled ?? true,
            cards: parsed.cards,
          };
        }
      } catch {}
    } else if (typeof window !== "undefined") {
      try {
        const cached = localStorage.getItem("sarvodaya_landing_stats_config");
        if (cached) statsConfig = JSON.parse(cached);
      } catch {}
    }

    const nowMs = Date.now();
    const liveMap = new Map<string, any>();
    (liveRes.data ?? []).forEach((lc: any) => {
      if (!lc.batch_id) return;
      if (isClassLiveNow(lc, nowMs)) {
        if (!liveMap.has(lc.batch_id)) {
          liveMap.set(lc.batch_id, lc);
        }
      }
    });

    const enrichedBatches = (batches.data ?? []).map((b) => ({
      ...b,
      _isLive: liveMap.has(b.id),
    }));

    const actualCounts: Record<StatMetricKey, number> = {
      students: studentCount,
      tests: testCount,
      materials: materialCount,
      batches: batchCount,
      live_classes: liveClassCount,
      faculty: (faculty.data ?? []).length,
    };

    return {
      batches: enrichedBatches,
      faculty: faculty.data ?? [],
      results: results.data ?? [],
      notifications: notifications.data ?? [],
      currentAffairs: currentAffairs.data ?? [],
      statsConfig,
      actualCounts,
    };
  },
});

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: `${SITE.name} — Bharat's Most Trusted & Affordable EdTech` },
      { name: "description", content: `${SITE.name}, Kasganj — premium coaching for UP Police, SSC, Banking, Railway, Teaching, UPSC/UPPSC and state-level competitive exams.` },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(landingQuery),
  component: Index,
});

function Index() {
  const { data } = useSuspenseQuery(landingQuery);
  const statsConfig = data.statsConfig;
  const actualCounts = data.actualCounts;
  const visibleCards = (statsConfig?.cards ?? []).filter((c) => c.is_visible);

  const [selectedExamCategory, setSelectedExamCategory] = useState<string>("All");

  const categories = ["All", "UP Police", "SSC", "Banking", "Teaching", "Railway", "UPSC / UPPSC"];

  const filteredBatches = data.batches.filter((b) => {
    if (selectedExamCategory === "All") return true;
    return b.exam_category?.toLowerCase().includes(selectedExamCategory.toLowerCase());
  });

  return (
    <div className="relative overflow-hidden bg-zinc-950 text-white min-h-screen">
      {/* Ambient background glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-red-600/10 blur-[130px] pointer-events-none rounded-full" />
      <div className="absolute top-[800px] right-0 w-[500px] h-[500px] bg-amber-500/5 blur-[150px] pointer-events-none rounded-full" />

      {/* PROMOTIONAL SLIDER */}
      <HeroSlider />

      {/* HIGH-IMPACT HERO SECTION (PW Vanguard Style) */}
      <section className="relative py-12 sm:py-20 border-b border-white/5">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col lg:flex-row items-center justify-between gap-12">
            <div className="flex-1 text-center lg:text-left">
              {/* Trust Badge Pill */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="inline-flex items-center gap-2 rounded-full border border-red-500/30 bg-red-500/10 px-4 py-1.5 text-xs font-bold text-rose-300 shadow-sm mb-6"
              >
                <Flame className="h-3.5 w-3.5 text-red-500 animate-pulse" />
                <span>Bharat's #1 Dedicated Competitive Exam Institute</span>
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.55, ease: "easeOut" }}
                className="text-4xl sm:text-5xl lg:text-6xl font-black text-white leading-[1.12] tracking-tight"
              >
                Apka Selection, <br />
                <span className="bg-gradient-to-r from-red-500 via-rose-400 to-amber-400 bg-clip-text text-transparent">
                  Hamara Sankalp.
                </span>
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.55, delay: 0.15, ease: "easeOut" }}
                className="mt-5 text-base sm:text-lg text-zinc-400 max-w-xl font-normal leading-relaxed"
              >
                Prepare with Top Kota & Delhi Faculty, Daily Interactive Live Classes, High-Yield DPPs, and All-India Rank CBT Mock Tests.
              </motion.p>

              {/* Trust Counter Strip */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.25 }}
                className="mt-6 flex flex-wrap items-center justify-center lg:justify-start gap-4 text-xs font-semibold text-zinc-300"
              >
                <div className="flex items-center gap-1.5 bg-zinc-900/80 border border-white/10 px-3 py-1.5 rounded-full">
                  <Star className="h-3.5 w-3.5 text-amber-400 fill-amber-400" />
                  <span>4.9/5 Rating</span>
                </div>
                <div className="flex items-center gap-1.5 bg-zinc-900/80 border border-white/10 px-3 py-1.5 rounded-full">
                  <Users className="h-3.5 w-3.5 text-emerald-400" />
                  <span>50,000+ Students</span>
                </div>
                <div className="flex items-center gap-1.5 bg-zinc-900/80 border border-white/10 px-3 py-1.5 rounded-full">
                  <Trophy className="h-3.5 w-3.5 text-amber-400" />
                  <span>1,200+ Selections</span>
                </div>
              </motion.div>

              {/* Dual Action CTAs */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.55, delay: 0.35, ease: "easeOut" }}
                className="mt-8 flex flex-wrap items-center justify-center lg:justify-start gap-4"
              >
                <Button
                  asChild
                  size="lg"
                  className="rounded-xl bg-red-600 hover:bg-red-500 text-white font-black px-8 py-6 text-base shadow-[0_0_30px_rgba(239,68,68,0.4)] transition-all hover:scale-105 active:scale-95 cursor-pointer"
                >
                  <Link to="/batches">
                    <span>Explore Batches</span>
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>

                <Button
                  asChild
                  variant="outline"
                  size="lg"
                  className="rounded-xl border-white/20 bg-zinc-900/80 hover:bg-zinc-800 text-white font-bold px-7 py-6 text-base shadow-sm transition-all"
                >
                  <Link to="/mock-tests">Take Free Mock Test</Link>
                </Button>
              </motion.div>
            </div>

            <motion.div
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.2, ease: "easeOut" }}
              className="flex-1 relative flex justify-center lg:justify-end w-full max-w-md lg:max-w-none"
            >
              <Hero3DModel />
            </motion.div>
          </div>

          {/* ADMIN-MANAGED TRUST COUNTERS (PW Live Stats Strip) */}
          {statsConfig.is_enabled && visibleCards.length > 0 && (
            <div className="mt-16 sm:mt-20 border-t border-b border-white/10 py-8 bg-zinc-900/50 rounded-2xl backdrop-blur-md px-6">
              <div
                className={cn(
                  "grid gap-8 divide-y sm:divide-y-0 sm:divide-x divide-white/10",
                  visibleCards.length === 1
                    ? "grid-cols-1 max-w-sm mx-auto divide-x-0"
                    : visibleCards.length === 2
                    ? "grid-cols-2 max-w-2xl mx-auto"
                    : visibleCards.length === 3
                    ? "grid-cols-1 sm:grid-cols-3 max-w-4xl mx-auto"
                    : "grid-cols-2 lg:grid-cols-4"
                )}
              >
                {visibleCards.map((card, i) => {
                  const IconComp = ICON_MAP[card.icon] || Sparkles;
                  const colorObj = COLOR_MAP[card.color] || COLOR_MAP.blue;
                  const displayValue = formatStatDisplayValue(card, actualCounts);

                  return (
                    <motion.div
                      key={card.id || card.title}
                      initial={{ opacity: 0, y: 16 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true, amount: 0.4 }}
                      transition={{ duration: 0.4, delay: i * 0.08, ease: "easeOut" }}
                      className="flex flex-col items-center text-center px-4 pt-4 sm:pt-0"
                    >
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-800/90 border border-white/10 mb-3 shadow-inner">
                        <IconComp className={`w-6 h-6 ${colorObj.textClass}`} />
                      </div>
                      <div className="font-black text-white text-xl sm:text-2xl tracking-tight">
                        {displayValue}
                      </div>
                      <div className="text-xs text-zinc-400 mt-1 font-medium">{card.sub}</div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* EXAM CATEGORIES SWITCHER + BATCHES SHOWCASE */}
      <section className="py-20 relative">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
              Popular Targeted Batches
            </h2>
            <p className="mt-3 text-zinc-400 text-sm max-w-2xl mx-auto">
              Choose your targeted competitive exam to view tailored, structured curriculum led by expert educators.
            </p>

            {/* Category Filter Pills */}
            <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
              {categories.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setSelectedExamCategory(c)}
                  className={cn(
                    "px-5 py-2 rounded-full text-xs font-bold transition-all active:scale-95 cursor-pointer border",
                    selectedExamCategory === c
                      ? "bg-red-600 border-red-500 text-white shadow-[0_0_15px_rgba(239,68,68,0.4)]"
                      : "bg-zinc-900/80 border-white/10 text-zinc-400 hover:text-white hover:border-white/25"
                  )}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          {/* Batch Cards Grid */}
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredBatches.map((b, i) => (
              <BatchCard key={b.id} batch={b} index={i} featured={b.is_featured} />
            ))}
          </div>

          <div className="mt-12 text-center">
            <Button
              asChild
              variant="outline"
              className="rounded-xl border-white/20 bg-zinc-900 hover:bg-zinc-800 text-white font-bold px-8 py-5 text-sm shadow-md transition-transform hover:scale-105"
            >
              <Link to="/batches">
                <span>View All Batches</span>
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* HALL OF FAME: TOPPERS & SELECTIONS (PW Gold Metallic Showcase) */}
      <section className="py-20 bg-zinc-900/60 border-t border-b border-white/5 relative overflow-hidden">
        {/* Background text decoration */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.02]">
          <span className="text-[12rem] md:text-[18rem] font-black leading-none whitespace-nowrap text-white">
            TOPPERS
          </span>
        </div>

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-4 py-1.5 text-xs font-black text-amber-400 shadow-sm mb-4">
            <Trophy className="h-4 w-4 fill-current" />
            <span>ACADEMIC EXCELLENCE</span>
          </div>

          <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight">
            Hall of Fame & Selections
          </h2>
          <p className="mt-3 text-zinc-400 text-sm max-w-2xl mx-auto">
            Honoring the dedication, discipline, and outstanding ranks of our brilliant achievers.
          </p>

          <div className="mt-14 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-5">
            {data.results.slice(0, 12).map((r, i) => (
              <TopperCard key={r.id} topper={r} index={i} />
            ))}
          </div>

          <div className="mt-12 text-center">
            <Button
              asChild
              variant="outline"
              className="rounded-xl border-amber-500/30 bg-zinc-900/80 hover:bg-zinc-800 text-amber-400 font-bold px-8 py-5 text-sm shadow-md hover:border-amber-400"
            >
              <Link to="/results">
                <span>Explore All Selections</span>
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* KOTA STAR FACULTY SHOWCASE */}
      {data.faculty.length > 0 && (
        <section className="py-20 relative">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-red-500/30 bg-red-500/10 px-4 py-1.5 text-xs font-bold text-rose-300 shadow-sm mb-4">
              <Award className="h-4 w-4 text-red-500" />
              <span>LEARN FROM THE BEST</span>
            </div>

            <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
              Meet Our Star Faculty
            </h2>
            <p className="mt-3 text-zinc-400 text-sm max-w-2xl mx-auto">
              Passionate subject matter experts with 10+ years of proven track record mentoring thousands of successful candidates.
            </p>

            <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {data.faculty.map((f, i) => (
                <motion.div
                  key={f.id}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: i * 0.08 }}
                  className="rounded-2xl border border-white/10 bg-zinc-900/80 p-6 text-center shadow-lg hover:border-white/20 transition-all group"
                >
                  <div className="relative mx-auto mb-4 h-28 w-28 overflow-hidden rounded-full border-2 border-red-500/50 p-1 shadow-[0_0_20px_rgba(239,68,68,0.25)] group-hover:scale-105 transition-transform">
                    <div className="h-full w-full overflow-hidden rounded-full bg-zinc-800">
                      {f.photo_url ? (
                        <img
                          src={f.photo_url}
                          alt={f.name}
                          loading="lazy"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-3xl font-black text-red-400">
                          {f.name.charAt(0)}
                        </div>
                      )}
                    </div>
                  </div>

                  <h3 className="text-lg font-bold text-white tracking-tight">{f.name}</h3>
                  <p className="text-xs font-semibold text-red-400 uppercase tracking-wider mt-1">
                    {f.subject || "Senior Faculty"}
                  </p>
                  {f.experience_years && (
                    <p className="mt-2 text-xs text-zinc-400 font-medium">{f.experience_years}+ Years Experience</p>
                  )}
                  {f.bio && (
                    <p className="mt-3 text-xs text-zinc-400 line-clamp-2 border-t border-white/5 pt-3">
                      {f.bio}
                    </p>
                  )}
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* TECH-ENABLED OFFLINE CENTRES */}
      <section className="py-20 bg-zinc-900/50 border-t border-white/5 relative">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 text-center">
          <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
            Explore Tech-Enabled Offline Centres
          </h2>
          <p className="text-zinc-400 text-sm mt-3 mb-10">
            Creating new benchmarks in classroom & hybrid learning experiences with modern smart labs.
          </p>

          <div className="rounded-3xl border border-white/10 bg-zinc-950/80 p-8 shadow-2xl backdrop-blur-sm">
            <div className="text-center mb-8">
              <h3 className="font-bold text-lg text-white">Find Centre in your city</h3>
              <p className="text-xs text-zinc-400 mt-1">Visit our flagship campus</p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
              <div className="flex items-center gap-3 border border-red-500/50 bg-red-600/10 p-3.5 rounded-2xl cursor-pointer shadow-[0_0_15px_rgba(239,68,68,0.15)]">
                <div className="w-10 h-10 rounded-xl bg-red-600/20 flex items-center justify-center text-lg">
                  📍
                </div>
                <div className="text-sm font-bold text-white">Kasganj (Main)</div>
              </div>
              <div className="flex items-center gap-3 border border-white/5 p-3.5 rounded-2xl opacity-40 grayscale pointer-events-none bg-zinc-900">
                <div className="w-10 h-10 rounded-xl bg-zinc-800 flex items-center justify-center text-lg">🏙️</div>
                <div className="text-sm font-bold text-zinc-400">Agra (Coming)</div>
              </div>
              <div className="flex items-center gap-3 border border-white/5 p-3.5 rounded-2xl opacity-40 grayscale pointer-events-none bg-zinc-900">
                <div className="w-10 h-10 rounded-xl bg-zinc-800 flex items-center justify-center text-lg">🏙️</div>
                <div className="text-sm font-bold text-zinc-400">Aligarh (Coming)</div>
              </div>
              <div className="flex items-center gap-3 border border-white/5 p-3.5 rounded-2xl opacity-40 grayscale pointer-events-none bg-zinc-900">
                <div className="w-10 h-10 rounded-xl bg-zinc-800 flex items-center justify-center text-lg">🏙️</div>
                <div className="text-sm font-bold text-zinc-400">Bareilly (Coming)</div>
              </div>
            </div>

            <Button
              asChild
              className="bg-red-600 hover:bg-red-500 text-white font-bold px-10 py-5 rounded-xl text-sm shadow-lg hover:scale-105 transition-transform cursor-pointer"
            >
              <Link to="/contact">Visit Offline Centre</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* QUICK INQUIRY / ADMISSIONS FORM */}
      <section className="py-20 border-t border-white/5">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <div className="rounded-3xl border border-white/10 bg-zinc-900/90 p-8 sm:p-12 shadow-2xl backdrop-blur-md">
            <div className="text-center mb-8">
              <h2 className="text-2xl sm:text-3xl font-black text-white">
                Request a Free Career Counseling Call
              </h2>
              <p className="text-xs sm:text-sm text-zinc-400 mt-2">
                Have questions about which batch or exam path to choose? Our senior mentors will guide you.
              </p>
            </div>
            <InquiryForm />
          </div>
        </div>
      </section>
    </div>
  );
}
