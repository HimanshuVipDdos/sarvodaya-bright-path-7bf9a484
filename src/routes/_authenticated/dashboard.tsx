import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  BookOpen,
  Video,
  FileText,
  Bell,
  Trophy,
  Clock,
  LogOut,
  Shield,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Section } from "@/components/section";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const dashboardQuery = queryOptions({
  queryKey: ["dashboard"],
  queryFn: async () => {
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) return { profile: null, enrollments: [], roles: [], liveClasses: [] };

    const [profile, enrollments, roles] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
      supabase.from("enrollments").select("*, batch:batches(*)").eq("user_id", userId),
      supabase.from("user_roles").select("role").eq("user_id", userId),
    ]);
    return {
      profile: profile.data,
      enrollments: enrollments.data ?? [],
      roles: (roles.data ?? []).map((r) => r.role),
    };
  },
});

export const Route = createFileRoute("/_authenticated/dashboard")({
  loader: ({ context }) => context.queryClient.ensureQueryData(dashboardQuery),
  component: Dashboard,
});

function Dashboard() {
  const { data } = useSuspenseQuery(dashboardQuery);
  const isAdmin = data.roles.includes("admin");

  async function handleSignOut() {
    await supabase.auth.signOut();
    toast.success("Signed out");
    window.location.href = "/";
  }

  return (
    <Section>
      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="mb-8 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-primary">Student Dashboard</div>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">
            Hello, {data.profile?.full_name ?? "Student"} 👋
          </h1>
        </div>
        <div className="flex gap-2">
          {isAdmin && (
            <Button asChild variant="ghost" className="rounded-full glass">
              <Link to="/admin"><Shield className="mr-1.5 h-4 w-4" /> Admin Panel</Link>
            </Button>
          )}
          <Button variant="ghost" onClick={handleSignOut} className="rounded-full glass">
            <LogOut className="mr-1.5 h-4 w-4" /> Sign out
          </Button>
        </div>
      </motion.div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { icon: BookOpen, label: "Purchased Batches", value: data.enrollments.length },
          { icon: Video, label: "Live Classes", value: 0 },
          { icon: FileText, label: "PDF Notes", value: 0 },
          { icon: Trophy, label: "Mock Tests", value: 0 },
        ].map((s) => (
          <div key={s.label} className="glass-strong rounded-3xl p-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary-glow">
              <s.icon className="h-5 w-5 text-primary-foreground" />
            </div>
            <div className="mt-3 text-2xl font-bold">{s.value}</div>
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="mt-10 grid gap-6 lg:grid-cols-3">
        <div className="glass-strong rounded-3xl p-6 lg:col-span-2">
          <h2 className="text-lg font-semibold">My Batches</h2>
          {data.enrollments.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-dashed border-border p-8 text-center">
              <BookOpen className="mx-auto h-8 w-8 text-muted-foreground" />
              <p className="mt-3 text-sm text-muted-foreground">
                You haven't enrolled in any batch yet.
              </p>
              <Button asChild className="mt-4 rounded-full bg-gradient-to-br from-primary to-primary-glow">
                <Link to="/batches">Browse batches</Link>
              </Button>
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {data.enrollments.map((e: any) => (
                <div key={e.id} className="glass flex items-center justify-between rounded-2xl p-4">
                  <div>
                    <div className="font-semibold">{e.batch?.title}</div>
                    <div className="text-xs text-muted-foreground">{e.batch?.exam_category}</div>
                  </div>
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">{e.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="glass-strong rounded-3xl p-6">
          <h2 className="text-lg font-semibold">Quick Links</h2>
          <ul className="mt-4 space-y-2 text-sm">
            {[
              { icon: Video, label: "Live Classes", to: "/dashboard" },
              { icon: BookOpen, label: "Recorded Lectures", to: "/dashboard" },
              { icon: FileText, label: "PDF & DPP", to: "/free-study-material" },
              { icon: Clock, label: "Mock Tests", to: "/dashboard" },
              { icon: Bell, label: "Announcements", to: "/notifications" },
            ].map((q) => (
              <li key={q.label}>
                <Link to={q.to} className="glass flex items-center gap-3 rounded-2xl p-3 hover:bg-primary/5">
                  <q.icon className="h-4 w-4 text-primary" />
                  <span>{q.label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mt-10 glass rounded-3xl p-6 text-center text-sm text-muted-foreground">
        Live classes, recorded lectures, PDFs/DPPs and mock tests will appear here as your admin
        publishes them. Payments and self-enrollment are coming soon.
      </div>
    </Section>
  );
}
