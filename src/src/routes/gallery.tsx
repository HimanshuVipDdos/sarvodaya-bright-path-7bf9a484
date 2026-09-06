import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Image as ImageIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Section } from "@/components/section";

const galleryQuery = queryOptions({
  queryKey: ["gallery"],
  queryFn: async () => (await supabase.from("gallery").select("*").order("sort_order")).data ?? [],
});

export const Route = createFileRoute("/gallery")({
  head: () => ({
    meta: [
      { title: "Gallery — Sarvodaya Adhyeta" },
      { name: "description", content: "Campus, classroom, events and seminar moments." },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(galleryQuery),
  component: GalleryPage,
});

function GalleryPage() {
  const { data } = useSuspenseQuery(galleryQuery);
  return (
    <Section eyebrow="Gallery" title="Inside Sarvodaya Adhyeta" description="Classroom, events, seminars and selection celebrations.">
      {data.length === 0 ? (
        <div className="glass-strong rounded-3xl p-12 text-center">
          <ImageIcon className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">Photos are being curated and will appear here soon.</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((g, i) => (
            <motion.div
              key={g.id}
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: Math.min(i * 0.04, 0.3) }}
              className="glass-strong overflow-hidden rounded-3xl"
            >
              <img src={g.image_url} alt={g.title ?? "Gallery"} loading="lazy" className="aspect-[4/3] w-full object-cover" />
              {g.title && <div className="p-3 text-sm">{g.title}</div>}
            </motion.div>
          ))}
        </div>
      )}
    </Section>
  );
}
