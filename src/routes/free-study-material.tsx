import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Download, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Section } from "@/components/section";

const query = queryOptions({
  queryKey: ["materials", "free"],
  queryFn: async () => (await supabase.from("study_materials").select("*").eq("is_free", true).order("created_at", { ascending: false })).data ?? [],
});

export const Route = createFileRoute("/free-study-material")({
  head: () => ({
    meta: [
      { title: "Free Study Material — Sarvodaya Adhyeta" },
      { name: "description", content: "Free PDF notes, DPPs and previous year question papers." },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(query),
  component: Page,
});

function Page() {
  const { data } = useSuspenseQuery(query);
  return (
    <Section eyebrow="Free Resources" title="Free study material" description="Carefully selected PDFs, DPPs and PYQs available to everyone.">
      {data.length === 0 ? (
        <div className="glass-strong rounded-3xl p-12 text-center">
          <FileText className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">Free PDFs will appear here as our team uploads them.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {data.map((m, i) => (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: Math.min(i * 0.04, 0.3) }}
              className="glass-strong rounded-3xl p-5"
            >
              <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-primary">{m.material_type}</div>
              <h3 className="mt-2 font-semibold">{m.title}</h3>
              <div className="text-xs text-muted-foreground">{m.subject} {m.chapter ? `· ${m.chapter}` : ""}</div>
              {m.file_url && (
                <a href={m.file_url} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary">
                  <Download className="h-4 w-4" /> Download
                </a>
              )}
            </motion.div>
          ))}
        </div>
      )}
    </Section>
  );
}
