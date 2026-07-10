import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Sparkles,
  Trophy,
  Users,
  BookOpen,
  GraduationCap,
  ArrowRight,
  Star,
  Calendar,
  Bell,
  Video,
  FileText,
  CheckCircle2,
  MapPin,
  Phone,
  MessageCircle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Section } from "@/components/section";
import { InquiryForm } from "@/components/inquiry-form";
import { Button } from "@/components/ui/button";
import { SITE, whatsappHref, telHref } from "@/lib/site";

const landingQuery = queryOptions({
  queryKey: ["landing-data"],
  queryFn: async () => {
    const [batches, faculty, results, notifications, currentAffairs] = await Promise.all([
      supabase.from("batches").select("*").eq("is_active", true).eq("is_featured", true).limit(8),
      supabase.from("faculty").select("*").eq("is_active", true).order("sort_order").limit(6),
      supabase.from("results").select("*").order("sort_order").limit(8),
      supabase.from("notifications").select("*").eq("is_active", true).order("created_at", { ascending: false }).limit(5),
      supabase.from("current_affairs").select("*").eq("is_active", true).order("publish_date", { ascending: false }).limit(4),
    ]);
    return {
      batches: batches.data ?? [],
      faculty: faculty.data ?? [],
      results: results.data ?? [],
      notifications: notifications.data ?? [],
      currentAffairs: currentAffairs.data ?? [],
    };
  },
});

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: `${SITE.name} — ${SITE.tagline}` },
      { name: "description", content: `${SITE.name}, Kasganj — premium coaching for UP Police, SSC, Banking, Railway, Teaching, UPSC/UPPSC and state-level competitive exams.` },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(landingQuery),
  component: Index,
});

function Index() {
  const { data } = useSuspenseQuery(landingQuery);

  return (
    <>
      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="mx-auto max-w-7xl px-4 pb-16 pt-10 sm:px-6 sm:pt-16">
          <div className="grid items-center gap-10 lg:grid-cols-2">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: [0.2, 0.8, 0.2, 1] }}
            >
              <div className="inline-flex items-center gap-2 rounded-full glass px-3 py-1.5 text-xs font-medium text-primary">
                <Sparkles className="h-3.5 w-3.5" /> Premium coaching · Kasganj, UP
              </div>
              <h1 className="mt-5 text-balance text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
                Crack India's toughest{" "}
                <span className="text-gradient">competitive exams</span>{" "}
                with confidence.
              </h1>
              <p className="mt-5 max-w-xl text-base text-muted-foreground sm:text-lg">
                Live classes, recorded lectures, daily practice problems and mock tests —
                taught with discipline by <strong>{SITE.owner}</strong> and a senior faculty team.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Button asChild size="lg" className="rounded-full bg-gradient-to-br from-primary to-primary-glow px-6 shadow-elegant">
                  <Link to="/batches">
                    Explore Batches <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="ghost" className="rounded-full glass">
                  <a href={whatsappHref()} target="_blank" rel="noreferrer">
                    <MessageCircle className="mr-2 h-4 w-4" /> WhatsApp
                  </a>
                </Button>
              </div>

              <div className="mt-10 grid max-w-md grid-cols-3 gap-3">
                {[
                  { k: "5K+", v: "Aspirants" },
                  { k: "500+", v: "Selections" },
                  { k: "26+", v: "Batches" },
                ].map((s) => (
                  <div key={s.v} className="glass rounded-2xl px-4 py-3 text-center">
                    <div className="text-xl font-bold text-gradient">{s.k}</div>
                    <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{s.v}</div>
                  </div>
                ))}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, ease: [0.2, 0.8, 0.2, 1] }}
              className="relative"
            >
              <div className="glass-tint relative aspect-square overflow-hidden rounded-[2.5rem] p-6 sm:p-10">
                <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-gradient-to-br from-primary to-primary-glow opacity-30 blur-3xl" />
                <div className="absolute -bottom-20 -left-20 h-72 w-72 rounded-full bg-primary-glow/30 blur-3xl" />

                <div className="relative grid h-full grid-cols-2 gap-4">
                  <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.3 }}
                    className="glass-strong col-span-2 rounded-2xl p-4"
                  >
                    <div className="flex items-center gap-2 text-xs font-medium text-primary">
                      <span className="relative flex h-2 w-2">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                        <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
                      </span>
                      Live Class · UP Police Constable
                    </div>
                    <div className="mt-1 text-sm font-semibold">Reasoning — Coding/Decoding</div>
                    <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                      <Calendar className="h-3.5 w-3.5" /> Today · 7:00 PM
                    </div>
                  </motion.div>

                  <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.45 }} className="glass-strong rounded-2xl p-4">
                    <Trophy className="h-5 w-5 text-primary" />
                    <div className="mt-2 text-2xl font-bold">500+</div>
                    <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Selections</div>
                  </motion.div>
                  <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.55 }} className="glass-strong rounded-2xl p-4">
                    <Video className="h-5 w-5 text-primary" />
                    <div className="mt-2 text-2xl font-bold">1000+</div>
                    <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Lectures</div>
                  </motion.div>
                  <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.65 }} className="glass-strong col-span-2 flex items-center justify-between rounded-2xl p-4">
                    <div>
                      <div className="text-sm font-semibold">Daily DPP & Mock Tests</div>
                      <div className="text-xs text-muted-foreground">Subject-wise practice + leaderboard</div>
                    </div>
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary-glow">
                      <FileText className="h-5 w-5 text-primary-foreground" />
                    </div>
                  </motion.div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* WHY CHOOSE */}
      <Section
        eyebrow="Why Sarvodaya Adhyeta"
        title="Built for serious aspirants"
        description="Disciplined teaching, structured practice and modern learning — everything that goes into a real selection."
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: GraduationCap, title: "Expert Faculty", text: "Subject specialists with proven selection records." },
            { icon: Video, title: "Live + Recorded", text: "Live classes plus full recorded library, anytime." },
            { icon: FileText, title: "DPP & Mock Tests", text: "Daily Practice Problems and exam-level mock series." },
            { icon: Trophy, title: "Result-driven", text: "Hundreds of selections across UP & central exams." },
          ].map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.08 }}
              className="glass-strong hover-lift rounded-3xl p-6"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary-glow">
                <f.icon className="h-5 w-5 text-primary-foreground" />
              </div>
              <h3 className="mt-4 text-lg font-semibold">{f.title}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">{f.text}</p>
            </motion.div>
          ))}
        </div>
      </Section>

      {/* POPULAR BATCHES */}
      <Section eyebrow="Popular Batches" title="Featured competitive exam batches" description="Hand-picked batches with live classes, recorded lectures, PDFs, DPPs and mock tests.">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {data.batches.map((b, i) => (
            <motion.div
              key={b.id}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.05 }}
            >
              <Link to="/batches/$slug" params={{ slug: b.slug }} className="block">
                <div className="glass-strong hover-lift flex h-full flex-col rounded-3xl p-5">
                  <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-primary">{b.exam_category}</div>
                  <h3 className="mt-2 text-lg font-semibold tracking-tight">{b.title}</h3>
                  <p className="mt-1.5 line-clamp-2 text-sm text-muted-foreground">{b.description}</p>
                  <div className="mt-4 flex items-end justify-between">
                    <div>
                      <div className="text-2xl font-bold text-gradient">₹{b.fees_inr.toLocaleString("en-IN")}</div>
                      {b.original_fees_inr && b.original_fees_inr > b.fees_inr && (
                        <div className="text-xs text-muted-foreground line-through">₹{b.original_fees_inr.toLocaleString("en-IN")}</div>
                      )}
                    </div>
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary-glow">
                      <ArrowRight className="h-4 w-4 text-primary-foreground" />
                    </div>
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
        <div className="mt-8 text-center">
          <Button asChild variant="ghost" className="rounded-full glass">
            <Link to="/batches">View all 26+ batches <ArrowRight className="ml-2 h-4 w-4" /></Link>
          </Button>
        </div>
      </Section>

      {/* FACULTY */}
      <Section eyebrow="Faculty" title="Learn from teachers who deliver results">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.faculty.map((f, i) => (
            <motion.div
              key={f.id}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.05 }}
              className="glass-strong rounded-3xl p-6"
            >
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary-glow text-xl font-bold text-primary-foreground">
                  {f.name.split(" ").map((n) => n[0]).slice(0, 2).join("")}
                </div>
                <div>
                  <h3 className="font-semibold leading-tight">{f.name}</h3>
                  <div className="text-xs text-muted-foreground">{f.designation}</div>
                  {f.subject && <div className="text-[11px] mt-0.5 text-primary">{f.subject}</div>}
                </div>
              </div>
              {f.bio && <p className="mt-4 text-sm text-muted-foreground">{f.bio}</p>}
            </motion.div>
          ))}
        </div>
      </Section>

      {/* RESULTS / TESTIMONIALS */}
      <Section eyebrow="Achievements" title="Our students. Their selections." description="Real students, real exams, real selections.">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {data.results.map((r, i) => (
            <motion.div
              key={r.id}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.45, delay: i * 0.05 }}
              className="glass-strong hover-lift rounded-3xl p-5"
            >
              <div className="flex items-center justify-between">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary-glow font-bold text-primary-foreground">
                  {r.student_name.split(" ").map((s) => s[0]).slice(0, 2).join("")}
                </div>
                <div className="flex gap-0.5">
                  {[...Array(5)].map((_, j) => (
                    <Star key={j} className="h-3.5 w-3.5 fill-primary text-primary" />
                  ))}
                </div>
              </div>
              <h3 className="mt-3 font-semibold leading-tight">{r.student_name}</h3>
              <div className="text-xs text-primary">{r.exam_name}</div>
              {r.rank_or_marks && <div className="text-[11px] text-muted-foreground">{r.rank_or_marks}</div>}
              {r.testimonial && <p className="mt-3 line-clamp-3 text-sm text-muted-foreground">"{r.testimonial}"</p>}
            </motion.div>
          ))}
        </div>
      </Section>

      {/* NOTIFICATIONS + CURRENT AFFAIRS */}
      <Section eyebrow="Stay updated" title="Notifications & Current Affairs">
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="glass-strong rounded-3xl p-6">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary-glow">
                <Bell className="h-4 w-4 text-primary-foreground" />
              </div>
              <h3 className="text-lg font-semibold">Latest Notifications</h3>
            </div>
            <ul className="mt-5 divide-y divide-border/60">
              {data.notifications.map((n) => (
                <li key={n.id} className="py-3">
                  <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-primary">{n.category}</div>
                  <div className="text-sm font-medium">{n.title}</div>
                  {n.body && <p className="text-xs text-muted-foreground">{n.body}</p>}
                </li>
              ))}
            </ul>
            <Link to="/notifications" className="mt-4 inline-flex items-center text-sm font-medium text-primary">View all <ArrowRight className="ml-1 h-4 w-4" /></Link>
          </div>

          <div className="glass-strong rounded-3xl p-6">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary-glow">
                <BookOpen className="h-4 w-4 text-primary-foreground" />
              </div>
              <h3 className="text-lg font-semibold">Current Affairs</h3>
            </div>
            <ul className="mt-5 space-y-3">
              {data.currentAffairs.map((c) => (
                <li key={c.id} className="rounded-2xl glass p-3">
                  <div className="text-sm font-medium">{c.title}</div>
                  {c.summary && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{c.summary}</p>}
                </li>
              ))}
            </ul>
            <Link to="/current-affairs" className="mt-4 inline-flex items-center text-sm font-medium text-primary">More updates <ArrowRight className="ml-1 h-4 w-4" /></Link>
          </div>
        </div>
      </Section>

      {/* CONTACT */}
      <Section id="contact" eyebrow="Get in touch" title="Talk to us about your preparation" description="Visit our centre in Kasganj, call us, or send a quick inquiry — we'll respond fast.">
        <div className="grid gap-6 lg:grid-cols-5">
          <div className="glass-strong space-y-4 rounded-3xl p-6 lg:col-span-2">
            <div className="flex items-start gap-3">
              <MapPin className="mt-0.5 h-5 w-5 text-primary" />
              <div className="text-sm">{SITE.address}</div>
            </div>
            <a href={telHref()} className="flex items-center gap-3 text-sm hover:text-primary">
              <Phone className="h-5 w-5 text-primary" /> {SITE.phone}
            </a>
            <a href={whatsappHref()} target="_blank" rel="noreferrer" className="flex items-center gap-3 text-sm hover:text-primary">
              <MessageCircle className="h-5 w-5 text-primary" /> WhatsApp Chat
            </a>
            <div className="overflow-hidden rounded-2xl border border-border/60">
              <iframe
                title="Sarvodaya Adhyeta location"
                className="h-56 w-full"
                loading="lazy"
                src={`https://www.google.com/maps?q=${encodeURIComponent(SITE.mapsQuery)}&output=embed`}
              />
            </div>
          </div>
          <div className="glass-strong rounded-3xl p-6 lg:col-span-3">
            <h3 className="text-lg font-semibold">Send an inquiry</h3>
            <p className="text-sm text-muted-foreground">We typically reply within a few hours.</p>
            <div className="mt-5">
              <InquiryForm />
            </div>
          </div>
        </div>
      </Section>
    </>
  );
}
