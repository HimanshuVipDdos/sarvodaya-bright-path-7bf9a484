import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Bell, Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Section } from "@/components/section";

const query = queryOptions({
  queryKey: ["notifications", "all"],
  queryFn: async () => (await supabase.from("notifications").select("*").eq("is_active", true).order("created_at", { ascending: false })).data ?? [],
});

export const Route = createFileRoute("/notifications")({
  head: () => ({
    meta: [
      { title: "Exam Notifications — Sarvodaya Adhyeta" },
      { name: "description", content: "Latest vacancies, admit cards, answer keys and exam date alerts." },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(query),
  component: Page,
});

function Page() {
  const { data } = useSuspenseQuery(query);
  return (
    <Section eyebrow="Notifications" title="Latest exam alerts" description="Vacancies, admit cards, answer keys and important exam dates.">
      <div className="space-y-3">
        {data.map((n, i) => (
          <motion.div
            key={n.id}
            initial={{ opacity: 0, x: -10 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.35, delay: Math.min(i * 0.04, 0.3) }}
            className="glass-strong flex items-start gap-4 rounded-3xl p-5"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary-glow">
              <Bell className="h-5 w-5 text-primary-foreground" />
            </div>
            <div className="flex-1">
              <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-primary">{n.category}</div>
              <h3 className="mt-0.5 font-semibold">{n.title}</h3>
              {n.body && <p className="mt-1 text-sm text-muted-foreground">{n.body}</p>}
              {n.exam_date && (
                <div className="mt-2 inline-flex items-center gap-1 text-xs text-foreground/70">
                  <Calendar className="h-3.5 w-3.5" />
                  {new Date(n.exam_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                </div>
              )}
              {n.link_url && (
                <a href={n.link_url} target="_blank" rel="noreferrer" className="ml-3 text-xs font-medium text-primary">
                  View →
                </a>
              )}
            </div>
          </motion.div>
        ))}
        {data.length === 0 && (
          <div className="glass-strong rounded-3xl p-12 text-center text-sm text-muted-foreground">
            No active notifications right now.
          </div>
        )}
      </div>
    </Section>
  );
}
