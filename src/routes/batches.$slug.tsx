import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  CheckCircle2,
  Clock,
  BookOpen,
  Users,
  ArrowLeft,
  MessageCircle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { VideoPlayer } from "@/components/video-player";
import { SITE, whatsappHref } from "@/lib/site";

const batchQuery = (slug: string) =>
  queryOptions({
    queryKey: ["batch", slug],
    queryFn: async () => {
      const { data } = await supabase.from("batches").select("*").eq("slug", slug).maybeSingle();
      if (!data) throw notFound();
      return data;
    },
  });

export const Route = createFileRoute("/batches/$slug")({
  head: ({ params }) => ({
    meta: [
      { title: `${params.slug.replaceAll("-", " ")} — Sarvodaya Adhyeta` },
      { name: "description", content: "Course details, fees, faculty and demo lecture." },
    ],
  }),
  loader: ({ context, params }) => context.queryClient.ensureQueryData(batchQuery(params.slug)),
  component: BatchDetail,
  notFoundComponent: () => (
    <div className="mx-auto max-w-xl px-4 py-32 text-center">
      <div className="glass-strong rounded-3xl p-10">
        <h1 className="text-2xl font-semibold">Batch not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">It may have been moved or renamed.</p>
        <Button asChild className="mt-6 rounded-full bg-gradient-to-br from-primary to-primary-glow">
          <Link to="/batches">Browse all batches</Link>
        </Button>
      </div>
    </div>
  ),
  errorComponent: ({ error, reset }) => (
    <div className="mx-auto max-w-xl px-4 py-32 text-center">
      <div className="glass-strong rounded-3xl p-10">
        <h1 className="text-xl font-semibold">Couldn't load batch</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        <Button onClick={() => reset()} className="mt-6 rounded-full">Try again</Button>
      </div>
    </div>
  ),
});

function BatchDetail() {
  const { slug } = Route.useParams();
  const { data: b } = useSuspenseQuery(batchQuery(slug));

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-16">
      <Link to="/batches" className="inline-flex items-center text-sm text-muted-foreground hover:text-primary">
        <ArrowLeft className="mr-1 h-4 w-4" /> All batches
      </Link>

      <div className="mt-6 grid gap-8 lg:grid-cols-3">
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="lg:col-span-2">
          <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-primary">{b.exam_category}</div>
          <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">{b.title}</h1>
          <p className="mt-3 text-base text-muted-foreground">{b.description}</p>

          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="glass-strong rounded-2xl p-4">
              <Clock className="h-5 w-5 text-primary" />
              <div className="mt-2 text-xs text-muted-foreground">Duration</div>
              <div className="font-semibold">{b.duration ?? "—"}</div>
            </div>
            <div className="glass-strong rounded-2xl p-4">
              <BookOpen className="h-5 w-5 text-primary" />
              <div className="mt-2 text-xs text-muted-foreground">Subjects</div>
              <div className="font-semibold">{b.subjects?.length ?? 0}</div>
            </div>
            <div className="glass-strong rounded-2xl p-4">
              <Users className="h-5 w-5 text-primary" />
              <div className="mt-2 text-xs text-muted-foreground">Faculty</div>
              <div className="font-semibold">{b.faculty?.length ?? 1}+</div>
            </div>
          </div>

          {b.subjects && b.subjects.length > 0 && (
            <div className="mt-8">
              <h2 className="text-lg font-semibold">Subjects covered</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {b.subjects.map((s) => (
                  <span key={s} className="rounded-full glass px-3 py-1 text-sm">{s}</span>
                ))}
              </div>
            </div>
          )}

          {b.features && b.features.length > 0 && (
            <div className="mt-8">
              <h2 className="text-lg font-semibold">What's included</h2>
              <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                {b.features.map((f) => (
                  <li key={f} className="glass flex items-start gap-2 rounded-2xl p-3 text-sm">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> {f}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {b.demo_video_url && (
            <div className="mt-8">
              <h2 className="text-lg font-semibold">Demo Lecture</h2>
              <div className="mt-3 aspect-video overflow-hidden rounded-3xl glass-strong">
                <iframe
                  src={b.demo_video_url}
                  title="Demo Lecture"
                  className="h-full w-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            </div>
          )}
        </motion.div>

        <motion.aside initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="lg:sticky lg:top-24 lg:self-start">
          <div className="glass-strong rounded-3xl p-6">
            <div className="text-xs text-muted-foreground">Course fees</div>
            <div className="mt-1 flex items-end gap-2">
              <div className="text-4xl font-bold text-gradient">₹{b.fees_inr.toLocaleString("en-IN")}</div>
              {b.original_fees_inr && b.original_fees_inr > b.fees_inr && (
                <div className="pb-1 text-sm text-muted-foreground line-through">₹{b.original_fees_inr.toLocaleString("en-IN")}</div>
              )}
            </div>
            <Button asChild className="mt-4 w-full rounded-2xl bg-gradient-to-br from-primary to-primary-glow py-6 text-base font-semibold shadow-elegant">
              <Link to="/contact">Enroll / Enquire</Link>
            </Button>
            <Button asChild variant="ghost" className="mt-2 w-full rounded-2xl glass py-6">
              <a href={whatsappHref()} target="_blank" rel="noreferrer">
                <MessageCircle className="mr-2 h-4 w-4" /> WhatsApp
              </a>
            </Button>
            <p className="mt-4 text-center text-xs text-muted-foreground">
              Online payment coming soon. For now please call {SITE.phone} or use the inquiry form.
            </p>
          </div>
        </motion.aside>
      </div>
    </div>
  );
}
