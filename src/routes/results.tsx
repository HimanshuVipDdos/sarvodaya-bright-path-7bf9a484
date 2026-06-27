import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Star, Trophy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Section } from "@/components/section";

const resultsQuery = queryOptions({
  queryKey: ["results", "all"],
  queryFn: async () => (await supabase.from("results").select("*").order("sort_order")).data ?? [],
});

export const Route = createFileRoute("/results")({
  head: () => ({
    meta: [
      { title: "Results & Selections — Sarvodaya Adhyeta" },
      { name: "description", content: "Top selections from Sarvodaya Adhyeta across UP and central competitive exams." },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(resultsQuery),
  component: ResultsPage,
});

function ResultsPage() {
  const { data } = useSuspenseQuery(resultsQuery);
  return (
    <Section eyebrow="Results" title="Selections that speak for themselves" description="Some of the recent students who turned preparation into selection.">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {data.map((r, i) => (
          <motion.div
            key={r.id}
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: Math.min(i * 0.04, 0.3) }}
            className="glass-strong hover-lift rounded-3xl p-5"
          >
            <div className="flex items-center justify-between">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary-glow font-bold text-primary-foreground">
                {r.student_name.split(" ").map((s) => s[0]).slice(0, 2).join("")}
              </div>
              <Trophy className="h-5 w-5 text-primary" />
            </div>
            <h3 className="mt-3 font-semibold leading-tight">{r.student_name}</h3>
            <div className="text-xs text-primary">{r.exam_name}</div>
            {r.rank_or_marks && <div className="text-[11px] text-muted-foreground">{r.rank_or_marks}</div>}
            {r.testimonial && <p className="mt-3 line-clamp-4 text-sm text-muted-foreground">"{r.testimonial}"</p>}
            <div className="mt-3 flex gap-0.5">
              {[...Array(5)].map((_, j) => (
                <Star key={j} className="h-3.5 w-3.5 fill-primary text-primary" />
              ))}
            </div>
          </motion.div>
        ))}
      </div>
    </Section>
  );
}
