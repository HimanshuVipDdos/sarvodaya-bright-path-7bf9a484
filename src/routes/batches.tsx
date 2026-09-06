import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { useState } from "react";
import { ArrowRight, Search, BookOpen, Layers } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Section } from "@/components/section";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const batchesQuery = queryOptions({
  queryKey: ["batches", "all"],
  queryFn: async () => {
    const { data } = await supabase.from("batches").select("*").eq("is_active", true).order("is_featured", { ascending: false }).order("title");
    const { data: live } = await supabase.from("live_classes").select("batch_id").eq("is_live", true);
    const liveSet = new Set((live ?? []).map((l) => l.batch_id));
    return (data ?? []).map((b) => ({ ...b, _isLive: liveSet.has(b.id) }));
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
              <div className="group flex h-full flex-col overflow-hidden rounded-[20px] bg-white border border-slate-200/60 shadow-[0_4px_20px_rgba(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.08)] transition-all duration-300 relative">
                
                {/* Image Section */}
                <div className="relative w-full pt-[60%] overflow-hidden bg-slate-100">
                  {b.thumbnail_url ? (
                    <img src={b.thumbnail_url} alt={b.title} loading="lazy" className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
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
                        <span className="inline-flex items-center gap-1 rounded bg-red-600 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white shadow-sm">
                          <span className="relative flex h-1.5 w-1.5"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" /><span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-white" /></span>
                          Live
                        </span>
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
                        <span className="text-green-600 font-semibold">{b._isLive ? "Ongoing" : "Available"}</span>
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
