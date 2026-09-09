import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { useState, useMemo, useEffect } from "react";
import { ArrowRight, Search, BookOpen, Layers, Radio } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Section } from "@/components/section";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn, getStorageUrl, isClassLiveNow } from "@/lib/utils";

const batchesQuery = queryOptions({
  queryKey: ["batches", "all"],
  queryFn: async () => {
    try {
      await supabase.rpc("tick_live_classes" as never);
    } catch {}

    const [batchesRes, liveRes] = await Promise.all([
      supabase.from("batches").select("*").eq("is_active", true).order("is_featured", { ascending: false }).order("title"),
      supabase.from("live_classes").select("id, batch_id, title, is_live, status, scheduled_at, end_at, duration_minutes, recorded_lecture_id"),
    ]);

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

    return (batchesRes.data ?? []).map((b) => ({
      ...b,
      _isLive: liveMap.has(b.id),
      _liveClass: liveMap.get(b.id) ?? null,
    }));
  },
});

export const Route = createFileRoute("/batches")({
  head: () => ({
    meta: [
      { title: "Batches — Sarvodaya Adhyeta" },
      { name: "description", content: "Competitive exam batches: UP Police, SSC, Railway, Banking, Teaching, UPSC/UPPSC and more." },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(batchesQuery),
  component: BatchesPage,
});

function BatchesPage() {
  const { data: batches } = useSuspenseQuery(batchesQuery);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string>("All");
  const queryClient = useQueryClient();

  // Dynamic real-time timer every 5s
  const [nowTime, setNowTime] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNowTime(Date.now()), 5000);
    return () => clearInterval(timer);
  }, []);

  // Supabase realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel("all-batches-live-sync")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "live_classes" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["batches", "all"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const categories = ["All", ...Array.from(new Set(batches.map((b) => b.exam_category)))];
  const filtered = batches.filter((b) => {
    const matchesCat = cat === "All" || b.exam_category === cat;
    const matchesQ = !q || b.title.toLowerCase().includes(q.toLowerCase()) || b.exam_category.toLowerCase().includes(q.toLowerCase());
    return matchesCat && matchesQ;
  });

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Promotional Banner Area (Like Teacher's Day Sale) */}
      <div className="mb-10 w-full overflow-hidden rounded-2xl bg-[#FFF6E5] relative shadow-sm border border-[#FFE4B5]">
        <div className="absolute inset-0 opacity-20 pointer-events-none" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23f59e0b\' fill-opacity=\'1\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")' }} />
        <div className="relative px-6 py-8 sm:px-10 sm:py-12 flex flex-col md:flex-row items-center justify-center md:justify-between gap-6">
          <div className="flex-1 flex justify-center">
            <div className="bg-[#1E293B] text-white p-6 rounded-xl shadow-lg transform -rotate-2 relative max-w-sm w-full text-center border-4 border-slate-700">
               <div className="absolute -top-3 -left-3 text-2xl">✨</div>
               <div className="absolute -bottom-3 -right-3 text-2xl">⭐</div>
               <h2 className="text-3xl font-black text-yellow-400 uppercase tracking-wider">Premium</h2>
               <h2 className="text-4xl font-black uppercase tracking-widest mt-1">Batches</h2>
               <div className="mt-3 bg-red-500 text-white text-xs font-bold py-1 px-3 rounded-full inline-block tracking-widest uppercase">
                 Enroll Now
               </div>
            </div>
          </div>
          <div className="flex gap-4 flex-wrap justify-center">
             <div className="bg-white p-4 rounded-xl shadow-sm border border-orange-100 flex flex-col items-center min-w-[120px]">
               <div className="w-10 h-10 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-2">⭐</div>
               <div className="text-xs font-bold text-slate-800">Target 2026</div>
               <div className="text-[10px] text-white bg-orange-600 px-2 py-0.5 rounded mt-2">New Batch</div>
             </div>
             <div className="bg-white p-4 rounded-xl shadow-sm border border-orange-100 flex flex-col items-center min-w-[120px]">
               <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-2">📚</div>
               <div className="text-xs font-bold text-slate-800">Complete Syllabus</div>
               <div className="text-[10px] text-white bg-orange-600 px-2 py-0.5 rounded mt-2">Live Classes</div>
             </div>
          </div>
        </div>
      </div>

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Popular Courses</h2>
        
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input 
              placeholder="Search batches..." 
              value={q} 
              onChange={(e) => setQ(e.target.value)} 
              className="pl-9 h-10 w-full rounded-full border-slate-200 bg-white shadow-sm"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {categories.map((c) => (
              <button
                key={c}
                onClick={() => setCat(c)}
                className={cn(
                  "rounded-full px-4 py-1.5 text-xs font-semibold transition-colors border flex items-center gap-2 shadow-sm",
                  cat === c 
                    ? "bg-[#EEF2FF] text-[#4F46E5] border-[#C7D2FE]" 
                    : "bg-[#F8FAFC] text-slate-700 border-slate-200 hover:bg-slate-50"
                )}
              >
                {cat === c && <div className="w-1.5 h-1.5 rounded-full bg-[#4F46E5]" />}
                {cat !== c && <div className="w-1.5 h-1.5 rounded-full bg-orange-400" />}
                {c}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {filtered.map((b, i) => {
           const discount = b.original_fees_inr && b.original_fees_inr > b.fees_inr 
              ? Math.round(((b.original_fees_inr - b.fees_inr) / b.original_fees_inr) * 100) 
              : 0;

           return (
          <motion.div
            key={b.id}
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: Math.min(i * 0.03, 0.3) }}
          >
            <Link to="/batches/$slug" params={{ slug: b.slug }} className="block h-full">
              <div className={cn(
                "group flex h-full flex-col overflow-hidden rounded-[20px] bg-white transition-all duration-300 relative",
                b._isLive
                  ? "border-2 border-red-500 shadow-[0_0_25px_rgba(239,68,68,0.22)] ring-2 ring-red-500/30 hover:shadow-[0_0_35px_rgba(239,68,68,0.38)]"
                  : "border border-slate-200/60 shadow-[0_4px_20px_rgba(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.08)]"
              )}>
                {/* Top ambient glowing bar when Live */}
                {b._isLive && (
                  <div className="h-1 w-full bg-gradient-to-r from-red-500 via-rose-500 to-red-600 animate-pulse" />
                )}
                
                {/* Image Section */}
                <div className="relative w-full aspect-video overflow-hidden bg-slate-100">
                  {b.thumbnail_url ? (
                    <img
                      src={getStorageUrl(b.thumbnail_url) || b.thumbnail_url}
                      alt={b.title}
                      loading="lazy"
                      onError={(e) => {
                        // If image fails to load, hide broken img and show fallback gradient
                        e.currentTarget.style.display = "none";
                        if (e.currentTarget.parentElement) {
                          e.currentTarget.parentElement.classList.add("bg-gradient-to-br", "from-[#E0E7FF]", "to-[#DBEAFE]");
                        }
                      }}
                      className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div className="absolute inset-0 bg-gradient-to-br from-[#E0E7FF] to-[#DBEAFE] flex items-center justify-center">
                       <span className="text-xl font-black text-[#4F46E5] opacity-20 uppercase tracking-widest px-4 text-center">{b.exam_category}</span>
                    </div>
                  )}
                  
                  {/* Top Badges */}
                  <div className="absolute top-0 left-0 right-0 flex justify-between p-3 pointer-events-none">
                     <div className="flex gap-1.5 flex-wrap">
                       {b.is_featured && <span className="rounded bg-yellow-400 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-yellow-900 shadow-sm">Featured</span>}
                       {b._isLive && (
                        <div className="relative overflow-hidden flex items-center gap-1.5 rounded-full bg-gradient-to-r from-red-600 via-rose-600 to-red-600 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-white live-badge-glow border border-red-300/50 shadow-sm pointer-events-none">
                          <span className="live-shimmer" />
                          <span className="relative flex h-2 w-2">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-95" />
                            <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
                          </span>
                          <Radio className="h-3 w-3 text-white animate-pulse" />
                          <span>LIVE</span>
                        </div>
                      )}
                     </div>
                  </div>
                </div>

                {/* Content Section */}
                <div className="flex flex-1 flex-col p-4 sm:p-5">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-xs font-bold text-red-500">{b.exam_category}</div>
                    <div className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[9px] font-bold uppercase text-slate-500">HINGLISH</div>
                  </div>
                  
                  <h3 className="text-[17px] font-bold text-slate-900 tracking-tight leading-snug mb-3 line-clamp-2">{b.title}</h3>
                  
                  <div className="space-y-1.5 mb-4 mt-auto">
                     <div className="flex items-center gap-2 text-xs font-medium text-slate-600">
                        <BookOpen className="h-3.5 w-3.5 text-slate-400" /> 
                        {b.exam_category} Target
                     </div>
                     <div className="flex items-center gap-2 text-xs font-medium text-slate-600">
                        <ArrowRight className="h-3.5 w-3.5 text-slate-400" />
                        {b._isLive ? (
                          <span className="text-red-600 font-bold flex items-center gap-1.5 animate-pulse">
                            <span className="relative flex h-2 w-2">
                              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
                              <span className="relative inline-flex h-2 w-2 rounded-full bg-red-600" />
                            </span>
                            <Radio className="h-3 w-3" /> Live Class Ongoing
                          </span>
                        ) : (
                          <span className="text-green-600 font-semibold">Available</span>
                        )}
                        <span className="text-slate-400">|</span> 
                        <span className="truncate">{b.duration}</span>
                     </div>
                  </div>

                  {/* Pricing and Action */}
                  <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                    <div>
                      <div className="flex items-center gap-2">
                         <span className="text-xl font-black text-slate-900">₹{b.fees_inr.toLocaleString("en-IN")}</span>
                         {discount > 0 && <span className="text-xs font-bold text-slate-400 line-through">₹{b.original_fees_inr?.toLocaleString("en-IN")}</span>}
                      </div>
                      {discount > 0 && <div className="text-[11px] font-bold text-green-600">{discount}% OFF</div>}
                    </div>
                    
                    <div className="flex">
                       <button className="bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold py-2 px-4 rounded-l-lg transition-colors">
                         Buy Now
                       </button>
                       <button className="bg-slate-800 hover:bg-slate-700 text-white px-3 rounded-r-lg border-l border-slate-700 transition-colors">
                         <ArrowRight className="h-4 w-4" />
                       </button>
                    </div>
                  </div>
                </div>
              </div>
            </Link>
          </motion.div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="mt-10 rounded-[24px] border border-dashed border-slate-300 bg-white p-12 text-center text-slate-500 shadow-sm">
          <Layers className="mx-auto h-10 w-10 text-slate-300 mb-3" />
          <p className="font-medium text-slate-600">No batches match your search.</p>
        </div>
      )}
    </div>
  );
}
