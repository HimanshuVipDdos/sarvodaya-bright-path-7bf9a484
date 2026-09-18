import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Shield, Users, BookOpen, Bell, FileText, Video, Image as ImageIcon,
  GraduationCap, Trophy, Inbox, Newspaper, ArrowRight, MessageSquare, ListChecks, LayoutDashboard, Sparkles, Radio,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Section } from "@/components/section";
import { OwnerRevenueCard, type RevenueStats } from "@/components/admin/owner-revenue-card";

const adminQuery = queryOptions({
  queryKey: ["admin", "overview"],
  queryFn: async () => {
    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    const userId = user?.id;
    const userEmail = (user?.email ?? "").toLowerCase().trim();

    const rolesRes = userId
      ? await supabase.from("user_roles").select("role, created_at").eq("user_id", userId)
      : { data: [] };
    const roles = rolesRes.data ?? [];
    const isAdmin = roles.some((r) => r.role === "admin");
    if (!isAdmin) return { isAdmin: false, isOwner: false, counts: null, revenueStats: null, currentUserId: undefined };

    // Strict Owner Identification:
    // 1. Check known owner/founder emails (Himanshu / Sarvodaya)
    // 2. Or query earliest created admin in user_roles
    let isOwner = userEmail === "hr152830@gmail.com" || userEmail === "info@sarvodayaadhyeta.in";
    if (!isOwner) {
      const { data: earliestAdmin } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "admin")
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (earliestAdmin && earliestAdmin.user_id === userId) {
        isOwner = true;
      }
    }

    const [batches, inquiries, lectures, materials, notifications, students] = await Promise.all([
      supabase.from("batches").select("id", { count: "exact", head: true }),
      supabase.from("inquiries").select("id", { count: "exact", head: true }),
      supabase.from("lectures").select("id", { count: "exact", head: true }),
      supabase.from("study_materials").select("id", { count: "exact", head: true }),
      supabase.from("notifications").select("id", { count: "exact", head: true }),
      supabase.from("profiles").select("id", { count: "exact", head: true }),
    ]);

    let revenueStats: RevenueStats | null = null;

    // ONLY fetch and compute financial statistics if the authenticated user is verified as Owner
    if (isOwner) {
      const { data: enrollments } = await supabase
        .from("enrollments")
        .select("id, amount_paid_inr, payment_status, enrolled_at")
        .order("enrolled_at", { ascending: true });

      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      const paidList = (enrollments ?? []).filter((e) => {
        const amt = Number(e.amount_paid_inr) || 0;
        return amt > 0 || e.payment_status === "paid";
      });

      let totalLifetime = 0;
      let monthly = 0;
      let weekly = 0;
      let today = 0;

      paidList.forEach((e) => {
        const amt = Number(e.amount_paid_inr) || 0;
        totalLifetime += amt;
        const eDate = e.enrolled_at ? new Date(e.enrolled_at) : new Date(0);
        if (eDate >= thirtyDaysAgo) monthly += amt;
        if (eDate >= sevenDaysAgo) weekly += amt;
        if (eDate >= todayStart) today += amt;
      });

      // Prepare 30-day timeline map
      const map30: Record<string, { date: string; revenue: number; orders: number; label: string }> = {};
      for (let i = 29; i >= 0; i--) {
        const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
        const key = d.toISOString().split("T")[0];
        const label = d.toLocaleDateString("en-IN", { month: "short", day: "numeric" });
        map30[key] = { date: key, revenue: 0, orders: 0, label };
      }

      // Prepare 7-day timeline map
      const map7: Record<string, { date: string; revenue: number; orders: number; label: string }> = {};
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
        const key = d.toISOString().split("T")[0];
        const label = d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric" });
        map7[key] = { date: key, revenue: 0, orders: 0, label };
      }

      paidList.forEach((e) => {
        if (e.enrolled_at) {
          const key = new Date(e.enrolled_at).toISOString().split("T")[0];
          const amt = Number(e.amount_paid_inr) || 0;
          if (map30[key]) {
            map30[key].revenue += amt;
            map30[key].orders += 1;
          }
          if (map7[key]) {
            map7[key].revenue += amt;
            map7[key].orders += 1;
          }
        }
      });

      revenueStats = {
        totalLifetime,
        monthly,
        weekly,
        today,
        totalPaidStudents: paidList.length,
        averageOrderValue: paidList.length > 0 ? Math.round(totalLifetime / paidList.length) : 0,
        chartData30Days: Object.values(map30),
        chartData7Days: Object.values(map7),
      };
    }

    return {
      isAdmin: true,
      isOwner,
      currentUserId: userId,
      revenueStats,
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
  const stats: { icon: typeof BookOpen; label: string; value: number; to?: string }[] = [
    { icon: BookOpen, label: "Batches", value: c.batches, to: "/admin/batches" },
    { icon: Users, label: "Students", value: c.students, to: "/admin/students" },
    { icon: Inbox, label: "Inquiries", value: c.inquiries },
    { icon: Video, label: "Lectures", value: c.lectures, to: "/admin/lectures" },
    { icon: FileText, label: "Study Materials", value: c.materials, to: "/admin/pdfs" },
    { icon: Bell, label: "Notifications", value: c.notifications, to: "/admin/notifications" },
  ];

  const sections: { icon: typeof BookOpen; label: string; desc: string; to?: string }[] = [
    { icon: BookOpen, label: "Batches", desc: "Create, edit, delete batches (with cover photos)", to: "/admin/batches" },
    { icon: Users, label: "Students", desc: "View student names, phone, email & batch enrollment", to: "/admin/students" },
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
    { icon: LayoutDashboard, label: "Dashboard Editor", desc: "Customize all texts, titles, banners & announcements", to: "/admin/dashboard-settings" },
    { icon: Sparkles, label: "Homepage Trust Stats", desc: "Manage counter badges: real DB counts vs custom marketing (PW style)", to: "/admin/landing-stats" },
    { icon: ImageIcon, label: "Homepage Slider", desc: "Promotional images with WhatsApp/link redirect", to: "/admin/hero-slides" },
    { icon: Inbox, label: "Inquiries", desc: "View and respond to leads" },
  ];

  return (
    <Section>
      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-primary">Admin</div>
        <h1 className="mt-1 text-3xl font-bold tracking-tight">Control Panel</h1>
        <p className="mt-1 text-sm text-muted-foreground">Manage everything that powers Sarvodaya Adhyeta.</p>
      </motion.div>

      {/* Teacher Quick Launchpad / शिक्षक त्वरित कार्य */}
      <div className="mb-8 rounded-3xl border border-border/80 bg-gradient-to-r from-primary/5 via-purple-500/5 to-indigo-500/5 p-4 sm:p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-primary text-primary-foreground shadow-xs">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight text-foreground flex items-center gap-2">
                Teacher Quick Launchpad
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-black uppercase">
                  शिक्षक केंद्र
                </span>
              </h2>
              <p className="text-xs text-muted-foreground">
                Live class, lectures, notes aur DPPs manage karne ke liye 1-tap shortcuts:
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <Link
            to="/admin/live-classes"
            className="group flex flex-col p-3.5 rounded-2xl bg-background/80 hover:bg-background border border-border/60 hover:border-red-500/50 hover:shadow-md transition-all cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <div className="p-2 rounded-xl bg-red-500/10 text-red-600 group-hover:bg-red-500 group-hover:text-white transition">
                <Radio className="h-4 w-4 animate-pulse" />
              </div>
              <span className="text-[10px] font-bold text-red-600 bg-red-50 dark:bg-red-950/40 px-1.5 py-0.5 rounded">
                Live
              </span>
            </div>
            <div className="mt-2.5 font-bold text-xs sm:text-sm text-foreground group-hover:text-red-600 transition">
              Live Classes
            </div>
            <div className="text-[11px] text-muted-foreground mt-0.5">
              तुरंत लाइव या शेड्यूल करें
            </div>
          </Link>

          <Link
            to="/admin/lectures"
            className="group flex flex-col p-3.5 rounded-2xl bg-background/80 hover:bg-background border border-border/60 hover:border-indigo-500/50 hover:shadow-md transition-all cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 group-hover:bg-indigo-500 group-hover:text-white transition">
                <Video className="h-4 w-4" />
              </div>
              <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 dark:bg-indigo-950/40 px-1.5 py-0.5 rounded">
                Videos
              </span>
            </div>
            <div className="mt-2.5 font-bold text-xs sm:text-sm text-foreground group-hover:text-indigo-600 transition">
              Recorded Lectures
            </div>
            <div className="text-[11px] text-muted-foreground mt-0.5">
              रिकॉर्डेड क्लास अपलोड करें
            </div>
          </Link>

          <Link
            to="/admin/pdfs"
            className="group flex flex-col p-3.5 rounded-2xl bg-background/80 hover:bg-background border border-border/60 hover:border-blue-500/50 hover:shadow-md transition-all cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600 group-hover:bg-blue-500 group-hover:text-white transition">
                <FileText className="h-4 w-4" />
              </div>
              <span className="text-[10px] font-bold text-blue-600 bg-blue-50 dark:bg-blue-950/40 px-1.5 py-0.5 rounded">
                PDFs
              </span>
            </div>
            <div className="mt-2.5 font-bold text-xs sm:text-sm text-foreground group-hover:text-blue-600 transition">
              Class Notes & PDFs
            </div>
            <div className="text-[11px] text-muted-foreground mt-0.5">
              नोट्स और किताबें अपलोड करें
            </div>
          </Link>

          <Link
            to="/admin/dpps"
            className="group flex flex-col p-3.5 rounded-2xl bg-background/80 hover:bg-background border border-border/60 hover:border-amber-500/50 hover:shadow-md transition-all cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 group-hover:bg-amber-500 group-hover:text-white transition">
                <BookOpen className="h-4 w-4" />
              </div>
              <span className="text-[10px] font-bold text-amber-600 bg-amber-50 dark:bg-amber-950/40 px-1.5 py-0.5 rounded">
                Practice
              </span>
            </div>
            <div className="mt-2.5 font-bold text-xs sm:text-sm text-foreground group-hover:text-amber-600 transition">
              DPP Sheets
            </div>
            <div className="text-[11px] text-muted-foreground mt-0.5">
              डेली प्रैक्टिस शीट डालें
            </div>
          </Link>

          <Link
            to="/admin/live-chat"
            className="group flex flex-col p-3.5 rounded-2xl bg-background/80 hover:bg-background border border-border/60 hover:border-emerald-500/50 hover:shadow-md transition-all cursor-pointer col-span-2 sm:col-span-1"
          >
            <div className="flex items-center justify-between">
              <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 group-hover:bg-emerald-500 group-hover:text-white transition">
                <MessageSquare className="h-4 w-4" />
              </div>
              <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded">
                Live Chat
              </span>
            </div>
            <div className="mt-2.5 font-bold text-xs sm:text-sm text-foreground group-hover:text-emerald-600 transition">
              Live Comments
            </div>
            <div className="text-[11px] text-muted-foreground mt-0.5">
              लाइव क्लास के डाउट्स देखें
            </div>
          </Link>
        </div>
      </div>

      {/* Confidential Owner-Only Financial & Revenue Analytics */}
      {data.isOwner && data.revenueStats && (
        <OwnerRevenueCard stats={data.revenueStats} currentUserId={data.currentUserId} />
      )}

      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {stats.map((s) => {
          const card = (
            <div className="glass-strong hover-lift rounded-2xl p-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary-glow">
                <s.icon className="h-4 w-4 text-primary-foreground" />
              </div>
              <div className="mt-2 text-2xl font-bold">{s.value}</div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{s.label}</div>
            </div>
          );
          return s.to ? (
            <Link key={s.label} to={s.to}>{card}</Link>
          ) : (
            <div key={s.label}>{card}</div>
          );
        })}
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
