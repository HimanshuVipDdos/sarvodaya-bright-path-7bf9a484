import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { GraduationCap, BookOpen, Award } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Section } from "@/components/section";

const facultyQuery = queryOptions({
  queryKey: ["faculty", "all"],
  queryFn: async () =>
    (await supabase.from("faculty").select("*").eq("is_active", true).order("sort_order")).data ?? [],
});

export const Route = createFileRoute("/faculty")({
  head: () => ({
    meta: [
      { title: "Faculty — Sarvodaya Adhyeta" },
      { name: "description", content: "Meet the experienced faculty behind Sarvodaya Adhyeta's competitive exam coaching." },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(facultyQuery),
  component: FacultyPage,
});

function FacultyPage() {
  const { data } = useSuspenseQuery(facultyQuery);

  return (
    <Section
      eyebrow="Our Faculty"
      title="Meet the teachers behind your success"
      description="Experienced educators dedicated to helping you crack UP and central competitive exams."
    >
      {data.length === 0 ? (
        <div className="glass-strong rounded-3xl p-12 text-center">
          <GraduationCap className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">Faculty profiles are being added and will appear here soon.</p>
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((f, i) => (
            <motion.div
              key={f.id}
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: Math.min(i * 0.04, 0.3) }}
              className="glass-strong hover-lift overflow-hidden rounded-3xl"
            >
              <div className="relative aspect-[4/3] w-full overflow-hidden bg-gradient-to-br from-primary/15 via-primary/5 to-primary-glow/20">
                {f.photo_url ? (
                  <img src={f.photo_url} alt={f.name} loading="lazy" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-4xl font-bold text-primary/40">
                    {f.name.split(" ").map((s) => s[0]).slice(0, 2).join("")}
                  </div>
                )}
              </div>
              <div className="p-5">
                <h3 className="text-lg font-semibold tracking-tight">{f.name}</h3>
                {f.designation && <div className="text-xs text-primary">{f.designation}</div>}

                <div className="mt-3 space-y-1.5 text-sm text-muted-foreground">
                  {f.subject && (
                    <div className="flex items-center gap-2">
                      <BookOpen className="h-3.5 w-3.5 shrink-0 text-primary" />
                      <span>{f.subject}</span>
                    </div>
                  )}
                  {f.qualification && (
                    <div className="flex items-center gap-2">
                      <GraduationCap className="h-3.5 w-3.5 shrink-0 text-primary" />
                      <span>{f.qualification}</span>
                    </div>
                  )}
                  {typeof f.experience_years === "number" && f.experience_years > 0 && (
                    <div className="flex items-center gap-2">
                      <Award className="h-3.5 w-3.5 shrink-0 text-primary" />
                      <span>{f.experience_years}+ years experience</span>
                    </div>
                  )}
                </div>

                {f.bio && <p className="mt-3 line-clamp-3 text-sm text-muted-foreground">{f.bio}</p>}
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </Section>
  );
}

