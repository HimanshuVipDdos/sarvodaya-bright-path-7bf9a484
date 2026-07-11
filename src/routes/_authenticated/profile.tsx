import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient, queryOptions } from "@tanstack/react-query";
import { useState } from "react";
import { motion } from "framer-motion";
import {
  User,
  Mail,
  Phone,
  GraduationCap,
  Target,
  Lock,
  Loader2,
  BookOpen,
  Trophy,
  ChevronRight,
  ShieldCheck,
  CalendarDays,
  Pencil,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Section } from "@/components/section";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { SITE } from "@/lib/site";

const profileQuery = queryOptions({
  queryKey: ["profile-page"],
  queryFn: async () => {
    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    if (!user) throw new Error("Not logged in");

    const [profile, enrollments, attempts] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
      supabase
        .from("enrollments")
        .select("id, payment_status, created_at, batch:batches(id, title, slug, exam_category)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("cbt_attempts")
        .select("id, test_id, status, score, max_score, submitted_at, test:cbt_tests(title)")
        .eq("user_id", user.id)
        .eq("status", "submitted")
        .order("submitted_at", { ascending: false })
        .limit(10),
    ]);

    return {
      user: {
        id: user.id,
        email: user.email ?? "",
        createdAt: user.created_at,
        providers: (user.app_metadata?.providers as string[] | undefined) ?? [
          user.app_metadata?.provider ?? "email",
        ],
      },
      profile: profile.data,
      enrollments: enrollments.data ?? [],
      attempts: attempts.data ?? [],
    };
  },
});

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [{ title: `My Profile — ${SITE.name}` }],
  }),
  component: ProfilePage,
});

const fade = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
};

function initialsOf(name: string | null | undefined, email: string) {
  const src = (name ?? "").trim() || email;
  return src
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("") || "S";
}

function ProfilePage() {
  const { data, isLoading } = useQuery(profileQuery);
  const queryClient = useQueryClient();

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [changingPw, setChangingPw] = useState(false);

  if (isLoading || !data) {
    return (
      <Section>
        <div className="mx-auto max-w-3xl space-y-4">
          <Skeleton className="h-40 w-full rounded-3xl" />
          <Skeleton className="h-64 w-full rounded-3xl" />
          <Skeleton className="h-40 w-full rounded-3xl" />
        </div>
      </Section>
    );
  }

  const { user, profile, enrollments, attempts } = data;
  const hasEmailProvider = user.providers.includes("email");
  const joined = new Date(user.createdAt).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  async function handleSaveProfile(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const updates = {
      full_name: String(fd.get("full_name") || "").trim() || null,
      phone: String(fd.get("phone") || "").trim() || null,
      class_level: String(fd.get("class_level") || "").trim() || null,
      exam_target: String(fd.get("exam_target") || "").trim() || null,
    };
    setSaving(true);
    try {
      const { error } = await supabase.from("profiles").update(updates).eq("id", user.id);
      if (error) throw error;
      toast.success("Profile updated!");
      setEditing(false);
      queryClient.invalidateQueries({ queryKey: ["profile-page"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save profile.");
    } finally {
      setSaving(false);
    }
  }

  async function handleChangePassword(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const pw = String(fd.get("new_password") || "");
    const confirm = String(fd.get("confirm_password") || "");
    if (pw.length < 6) {
      toast.error("Password must be at least 6 characters.");
      return;
    }
    if (pw !== confirm) {
      toast.error("Passwords don't match.");
      return;
    }
    setChangingPw(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: pw });
      if (error) throw error;
      toast.success("Password changed successfully!");
      (e.target as HTMLFormElement).reset();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not change password.";
      toast.error(
        msg.toLowerCase().includes("different from the old")
          ? "New password must be different from your current password."
          : msg,
      );
    } finally {
      setChangingPw(false);
    }
  }

  return (
    <Section>
      <div className="mx-auto max-w-3xl">
        {/* ---- Identity card ---- */}
        <motion.div {...fade} className="glass-strong overflow-hidden rounded-3xl">
          <div className="h-20 bg-gradient-to-br from-primary to-primary-glow" />
          <div className="px-6 pb-6">
            <div className="-mt-9 flex items-end justify-between gap-3">
              <div className="flex h-18 w-18 items-center justify-center rounded-3xl border-4 border-background bg-gradient-to-br from-primary to-primary-glow text-xl font-bold text-primary-foreground shadow-elegant"
                style={{ height: 72, width: 72 }}
              >
                {initialsOf(profile?.full_name, user.email)}
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="glass rounded-full"
                onClick={() => setEditing((s) => !s)}
              >
                <Pencil className="mr-1.5 h-3.5 w-3.5" />
                {editing ? "Cancel" : "Edit profile"}
              </Button>
            </div>
            <h1 className="mt-3 text-2xl font-bold tracking-tight text-balance">
              {profile?.full_name ?? "Student"}
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5" /> {user.email}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays className="h-3.5 w-3.5" /> Joined {joined}
              </span>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {user.providers.map((p) => (
                <span
                  key={p}
                  className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-medium capitalize text-primary"
                >
                  <ShieldCheck className="h-3 w-3" />
                  {p === "email" ? "Email login" : `${p} linked`}
                </span>
              ))}
              {profile?.class_level && (
                <span className="inline-flex items-center gap-1 rounded-full bg-accent px-2.5 py-1 text-[11px] font-medium text-accent-foreground">
                  <GraduationCap className="h-3 w-3" /> Class {profile.class_level}
                </span>
              )}
              {profile?.exam_target && (
                <span className="inline-flex items-center gap-1 rounded-full bg-accent px-2.5 py-1 text-[11px] font-medium text-accent-foreground">
                  <Target className="h-3 w-3" /> {profile.exam_target}
                </span>
              )}
            </div>
          </div>
        </motion.div>

        {/* ---- Edit form ---- */}
        {editing && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="overflow-hidden"
          >
            <form onSubmit={handleSaveProfile} className="glass-strong mt-4 rounded-3xl p-6">
              <h2 className="text-lg font-semibold">Edit details</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="relative">
                  <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    name="full_name"
                    defaultValue={profile?.full_name ?? ""}
                    placeholder="Full name"
                    className="glass border-0 pl-9"
                  />
                </div>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    name="phone"
                    type="tel"
                    defaultValue={profile?.phone ?? ""}
                    placeholder="Phone number"
                    className="glass border-0 pl-9"
                  />
                </div>
                <div className="relative">
                  <GraduationCap className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    name="class_level"
                    defaultValue={profile?.class_level ?? ""}
                    placeholder="Class (e.g. 10, 12)"
                    className="glass border-0 pl-9"
                  />
                </div>
                <div className="relative">
                  <Target className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    name="exam_target"
                    defaultValue={profile?.exam_target ?? ""}
                    placeholder="Exam target (e.g. NEET, JEE)"
                    className="glass border-0 pl-9"
                  />
                </div>
              </div>
              <Button
                type="submit"
                disabled={saving}
                className="mt-4 w-full rounded-2xl bg-gradient-to-br from-primary to-primary-glow py-5 font-semibold shadow-elegant sm:w-auto sm:px-8"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save changes"}
              </Button>
            </form>
          </motion.div>
        )}

        {/* ---- Linked batches ---- */}
        <motion.div {...fade} transition={{ delay: 0.05 }} className="glass-strong mt-4 rounded-3xl p-6">
          <div className="flex items-center justify-between">
            <h2 className="inline-flex items-center gap-2 text-lg font-semibold">
              <BookOpen className="h-5 w-5 text-primary" /> My Batches
            </h2>
            <span className="text-xs text-muted-foreground">{enrollments.length} linked</span>
          </div>
          {enrollments.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">
              No batch linked yet.{" "}
              <Link to="/batches" className="font-medium text-primary">
                Browse batches
              </Link>
            </p>
          ) : (
            <ul className="mt-4 space-y-2">
              {enrollments.map((e) => (
                <li key={e.id}>
                  <Link
                    to="/my-batch/$slug"
                    params={{ slug: e.batch?.slug ?? "" }}
                    className="glass flex items-center justify-between gap-3 rounded-2xl p-3 transition-colors hover:bg-primary/5"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{e.batch?.title}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {e.batch?.exam_category} ·{" "}
                        {e.payment_status === "paid" ? "Paid" : e.payment_status ?? "Enrolled"}
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </motion.div>

        {/* ---- Test history ---- */}
        <motion.div {...fade} transition={{ delay: 0.1 }} className="glass-strong mt-4 rounded-3xl p-6">
          <div className="flex items-center justify-between">
            <h2 className="inline-flex items-center gap-2 text-lg font-semibold">
              <Trophy className="h-5 w-5 text-primary" /> My Test Results
            </h2>
            <span className="text-xs text-muted-foreground">last {attempts.length}</span>
          </div>
          {attempts.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">
              You haven&apos;t attempted any test yet. Tests appear inside your batch portal.
            </p>
          ) : (
            <ul className="mt-4 space-y-2">
              {attempts.map((a) => {
                const pct = a.max_score > 0 ? Math.round((a.score / a.max_score) * 100) : 0;
                return (
                  <li key={a.id}>
                    <Link
                      to="/cbt/$testId/result"
                      params={{ testId: a.test_id }}
                      search={{ attempt: a.id }}
                      className="glass flex items-center justify-between gap-3 rounded-2xl p-3 transition-colors hover:bg-primary/5"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">
                          {(a.test as { title: string } | null)?.title ?? "Test"}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          {a.submitted_at
                            ? new Date(a.submitted_at).toLocaleDateString("en-IN", {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                              })
                            : ""}
                        </div>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                          pct >= 60
                            ? "bg-primary/10 text-primary"
                            : pct >= 33
                              ? "bg-accent text-accent-foreground"
                              : "bg-destructive/10 text-destructive"
                        }`}
                      >
                        {a.score}/{a.max_score} · {pct}%
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </motion.div>

        {/* ---- Change password ---- */}
        {hasEmailProvider && (
          <motion.div {...fade} transition={{ delay: 0.15 }} className="glass-strong mt-4 rounded-3xl p-6">
            <h2 className="inline-flex items-center gap-2 text-lg font-semibold">
              <Lock className="h-5 w-5 text-primary" /> Change Password
            </h2>
            <form onSubmit={handleChangePassword} className="mt-4 grid gap-3 sm:grid-cols-2">
              <Input
                name="new_password"
                type="password"
                required
                minLength={6}
                placeholder="New password"
                className="glass border-0"
              />
              <Input
                name="confirm_password"
                type="password"
                required
                minLength={6}
                placeholder="Confirm new password"
                className="glass border-0"
              />
              <Button
                type="submit"
                disabled={changingPw}
                variant="outline"
                className="rounded-2xl sm:col-span-2 sm:w-auto sm:justify-self-start sm:px-8"
              >
                {changingPw ? <Loader2 className="h-4 w-4 animate-spin" /> : "Update password"}
              </Button>
            </form>
          </motion.div>
        )}
      </div>
    </Section>
  );
}
