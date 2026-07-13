import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Shield, Users, BookOpen, Bell, FileText, Video, Image as ImageIcon,
  GraduationCap, Trophy, Inbox, Newspaper, ArrowRight, MessageSquare, ListChecks,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Section } from "@/components/section";

const adminQuery = queryOptions({
  queryKey: ["admin", "overview"],
  queryFn: async () => {
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    const roles = userId
      ? (await supabase.from("user_roles").select("role").eq("user_id", userId)).data ?? []
      : [];
    const isAdmin = roles.some((r) => r.role === "admin");
    if (!isAdmin) return { isAdmin: false, counts: null };

    const [batches, inquiries, lectures, materials, notifications, students] = await Promise.all([
      supabase.from("batches").select("id", { count: "exact", head: true }),
      supabase.from("inquiries").select("id", { count: "exact", head: true }),
      supabase.from("lectures").select("id", { count: "exact", head: true }),
      supabase.from("study_materials").select("id", { count: "exact", head: true }),
      supabase.from("notifications").select("id", { count: "exact", head: true }),
      supabase.from("profiles").select("id", { count: "exact", head: true }),
    ]);
    return {
      isAdmin: true,
      counts: {
        batches: batches.count ?? 0,
        inquiries: inquiries.count ?? 0,
        lectures: lectures.count ?? 0,
        materials: materials.count ?? 0,
        notifications: notifications.count ?? 0,
        students: students.count ?? 0,
      },
    };
  },
});

export const Route = createFileRoute("/_authenticated/admin/")({
  loader: ({ context }) => context.queryClient.ensureQueryData(adminQuery),
  component: AdminPage,
});

function AdminPage() {
  const { data } = useSuspenseQuery(adminQuery);

  if (!data.isAdmin) {
    return (
      <Section>
        <div className="mx-auto max-w-md glass-strong rounded-3xl p-10 text-center">
          <Shield className="mx-auto h-12 w-12 text-primary" />
          <h1 className="mt-4 text-2xl font-bold">Admin access required</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Your account doesn't have admin privileges. Ask the founder to grant your account the
            <code className="mx-1 rounded bg-muted px-1.5 py-0.5 text-xs">admin</code> role.
          </p>
          <Link to="/dashboard" className="mt-6 inline-flex items-center text-sm font-medium text-primary">
            Back to dashboard <ArrowRight className="ml-1 h-4 w-4" />
          </Link>
        </div>
      </Section>
    );
  }

  const c = data.counts!;
  const stats = [
    { icon: BookOpen, label: "Batches", value: c.batches },
    { icon: Users, label: "Students", value: c.students },
    { icon: Inbox, label: "Inquiries", value: c.inquiries },
    { icon: Video, label: "Lectures", value: c.lectures },
    { icon: FileText, label: "Study Materials", value: c.materials },
    { icon: Bell, label: "Notifications", value: c.notifications },
  ];

  const sections: { icon: typeof BookOpen; label: string; desc: string; to?: string }[] = [
    { icon: BookOpen, label: "Batches", desc: "Create, edit, delete batches (with cover photos)", to: "/admin/batches" },
    { icon: Video, label: "Recorded Lectures", desc: "Upload and manage lectures", to: "/admin/lectures" },
    { icon: Video, label: "Live Classes", desc: "Schedule live classes for each batch", to: "/admin/live-classes" },
    { icon: MessageSquare, label: "Live Comments", desc: "Watch & moderate live class comments", to: "/admin/live-chat" },
    { icon: Users, label: "Grant Batch Access", desc: "Enroll students free / discount / paid", to: "/admin/enrollments" },
    { icon: ListChecks, label: "CBT Tests", desc: "Create tests, questions, and view rankings", to: "/admin/cbt" },
    { icon: FileText, label: "PDFs & Notes", desc: "PDFs, notes, PYQs, answer keys", to: "/admin/pdfs" },
    { icon: FileText, label: "Daily Practice Problems", desc: "Manage DPPs by batch & subject", to: "/admin/dpps" },
    { icon: Newspaper, label: "Current Affairs", desc: "Daily and weekly updates", to: "/admin/current-affairs" },
    { icon: Bell, label: "Notifications", desc: "Vacancies, admit cards, dates", to: "/admin/notifications" },
    { icon: Trophy, label: "Results", desc: "Selections and testimonials", to: "/admin/results" },
    { icon: GraduationCap, label: "Faculty", desc: "Manage faculty profiles", to: "/admin/faculty" },
    { icon: ImageIcon, label: "Gallery", desc: "Campus, events, seminars", to: "/admin/gallery" },
    { icon: Inbox, label: "Inquiries", desc: "View and respond to leads" },
  ];

  return (
    <Section>
      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-primary">Admin</div>
        <h1 className="mt-1 text-3xl font-bold tracking-tight">Control Panel</h1>
        <p className="mt-1 text-sm text-muted-foreground">Manage everything that powers Sarvodaya Adhyeta.</p>
      </motion.div>

      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {stats.map((s) => (
          <div key={s.label} className="glass-strong rounded-2xl p-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary-glow">
              <s.icon className="h-4 w-4 text-primary-foreground" />
            </div>
            <div className="mt-2 text-2xl font-bold">{s.value}</div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{s.label}</div>
          </div>
        ))}
      </div>

      <h2 className="mt-12 text-lg font-semibold">Management modules</h2>
      <p className="text-sm text-muted-foreground">Live CRUD is enabled for the linked modules. Others are coming next.</p>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {sections.map((s, i) => {
          const inner = (
            <>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary-glow">
                  <s.icon className="h-4 w-4 text-primary-foreground" />
                </div>
                <div>
                  <div className="font-semibold">{s.label}</div>
                  <div className="text-xs text-muted-foreground">{s.desc}</div>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between text-[11px] uppercase tracking-wider text-muted-foreground">
                <span>{s.to ? "Manage" : "Coming next"}</span>
                {s.to && <ArrowRight className="h-3.5 w-3.5" />}
              </div>
            </>
          );
          return (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.35, delay: Math.min(i * 0.03, 0.2) }}
              className="glass-strong hover-lift rounded-2xl p-5"
            >
              {s.to ? <Link to={s.to}>{inner}</Link> : inner}
            </motion.div>
          );
        })}
      </div>
    </Section>
  );
}
