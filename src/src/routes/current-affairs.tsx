import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Section } from "@/components/section";
import { BookOpen, Download } from "lucide-react";

const query = queryOptions({
  queryKey: ["current_affairs"],
  queryFn: async () => (await supabase.from("current_affairs").select("*").eq("is_active", true).order("publish_date", { ascending: false })).data ?? [],
});

export const Route = createFileRoute("/current-affairs")({
  head: () => ({
    meta: [
      { title: "Current Affairs — Sarvodaya Adhyeta" },
      { name: "description", content: "Daily, weekly and monthly current affairs for competitive exams." },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(query),
  component: Page,
});

function Page() {
  const { data } = useSuspenseQuery(query);
  return (
    <Section eyebrow="Current Affairs" title="Daily updates for every aspirant" description="Curated news bites, weekly recaps and monthly compilations.">
      <div className="grid gap-4 md:grid-cols-2">
        {data.map((c, i) => (
          <motion.div
            key={c.id}
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: Math.min(i * 0.04, 0.3) }}
            className="glass-strong rounded-3xl p-6"
          >
            <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.18em] text-primary">
              <BookOpen className="h-3.5 w-3.5" />
              {new Date(c.publish_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
            </div>
            <h3 className="mt-2 text-lg font-semibold">{c.title}</h3>
            {c.summary && <p className="mt-2 text-sm text-muted-foreground">{c.summary}</p>}
            {c.pdf_url && (
              <a href={c.pdf_url} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 text-sm text-primary">
                <Download className="h-4 w-4" /> Download PDF
              </a>
            )}
          </motion.div>
        ))}
        {data.length === 0 && (
          <div className="glass-strong col-span-full rounded-3xl p-12 text-center text-sm text-muted-foreground">
            Daily updates will appear here.
          </div>
        )}
      </div>
    </Section>
  );
}
