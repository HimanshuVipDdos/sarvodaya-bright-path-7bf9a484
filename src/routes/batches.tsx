import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { useState } from "react";
import { ArrowRight, Search } from "lucide-react";
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
    <Section
      eyebrow="All Batches"
      title="Find the right batch for your exam"
      description="13+ batches across UP and central competitive exams. Live classes, recorded lectures, DPPs and mock tests included."
    >
      <div className="glass-strong mb-8 flex flex-col gap-3 rounded-3xl p-4 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search batch…" className="border-0 bg-transparent pl-9 focus-visible:ring-0" />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setCat(c)}
              className={cn(
                "rounded-full px-3 py-1.5 text-xs font-medium transition",
                cat === c ? "bg-gradient-to-br from-primary to-primary-glow text-primary-foreground shadow-elegant" : "glass text-foreground/70 hover:text-foreground",
              )}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((b, i) => (
          <motion.div
            key={b.id}
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: Math.min(i * 0.03, 0.3) }}
          >
            <Link to="/batches/$slug" params={{ slug: b.slug }} className="block h-full">
              <div className="glass-strong hover-lift flex h-full flex-col overflow-hidden rounded-3xl">
                {b.thumbnail_url ? (
                  <div className="relative aspect-[16/9] w-full overflow-hidden">
                    <img src={b.thumbnail_url} alt={b.title} loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                    <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/50 to-transparent" />
                    {b.is_featured && <span className="absolute right-3 top-3 rounded-full bg-white/95 px-2 py-0.5 text-[10px] font-medium text-primary shadow">Featured</span>}
                  </div>
                ) : (
                  <div className="relative aspect-[16/9] w-full bg-gradient-to-br from-primary/15 via-primary/5 to-primary-glow/20">
                    {b.is_featured && <span className="absolute right-3 top-3 rounded-full bg-white/95 px-2 py-0.5 text-[10px] font-medium text-primary shadow">Featured</span>}
                  </div>
                )}
                <div className="flex flex-1 flex-col p-6">
                <div className="flex items-center justify-between">
                  <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-primary">{b.exam_category}</div>
                </div>
                <h3 className="mt-2 text-lg font-semibold tracking-tight">{b.title}</h3>
                <p className="mt-1.5 line-clamp-2 text-sm text-muted-foreground">{b.description}</p>
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {b.subjects?.slice(0, 4).map((s) => (
                    <span key={s} className="rounded-full glass px-2 py-0.5 text-[10px] text-foreground/70">{s}</span>
                  ))}
                </div>
                <div className="mt-auto flex items-end justify-between pt-5">
                  <div>
                    <div className="text-xs text-muted-foreground">{b.duration}</div>
                    <div className="text-2xl font-bold text-gradient">₹{b.fees_inr.toLocaleString("en-IN")}</div>
                    {b.original_fees_inr && b.original_fees_inr > b.fees_inr && (
                      <div className="text-xs text-muted-foreground line-through">₹{b.original_fees_inr.toLocaleString("en-IN")}</div>
                    )}
                  </div>
                  <Button size="sm" className="rounded-full bg-gradient-to-br from-primary to-primary-glow">
                    Details <ArrowRight className="ml-1 h-4 w-4" />
                  </Button>
                </div>
                </div>
              </div>
            </Link>
          </motion.div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="glass-strong rounded-3xl p-12 text-center text-muted-foreground">
          No batches match your search.
        </div>
      )}
    </Section>
  );
}
