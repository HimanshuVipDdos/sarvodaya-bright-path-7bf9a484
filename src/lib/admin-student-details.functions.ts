import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const studentDetailsSchema = z.object({
  user_id: z.string().uuid("Invalid user ID format"),
}).strict();

export const getStudentDetails = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => studentDetailsSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [{ data: authUser, error: authErr }, { data: profile }, { data: enrollments }, { data: attempts }] =
      await Promise.all([
        supabaseAdmin.auth.admin.getUserById(data.user_id),
        supabaseAdmin
          .from("profiles")
          .select("full_name, phone, class_level, exam_target, created_at")
          .eq("id", data.user_id)
          .maybeSingle(),
        supabaseAdmin
          .from("enrollments")
          .select("id, batch_id, status, payment_status, amount_paid_inr, enrolled_at, batch:batches(id, title, fees_inr, exam_category)")
          .eq("user_id", data.user_id)
          .order("enrolled_at", { ascending: false }),
        supabaseAdmin
          .from("cbt_attempts")
          .select("id, test_id, status, score, max_score, submitted_at, test:cbt_tests(title, duration_minutes)")
          .eq("user_id", data.user_id)
          .order("submitted_at", { ascending: false }),
      ]);
    if (authErr) throw new Error(authErr.message);

    const submitted = (attempts ?? []).filter((a) => a.status === "submitted");
    const lastAttemptAt = submitted.length
      ? submitted.map((a) => a.submitted_at).sort().at(-1)
      : null;

    let totalScore = 0;
    let totalMaxScore = 0;
    let highestPct = 0;

    const formattedAttempts = (attempts ?? []).map((a) => {
      const score = a.score ?? 0;
      const maxScore = a.max_score ?? 100;
      const pct = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
      if (a.status === "submitted") {
        totalScore += score;
        totalMaxScore += maxScore;
        if (pct > highestPct) highestPct = pct;
      }
      return {
        id: a.id,
        test_id: a.test_id,
        test_title: (a.test as { title: string } | null)?.title ?? "Mock Test",
        duration_minutes: (a.test as { duration_minutes: number } | null)?.duration_minutes ?? 0,
        status: a.status,
        score: a.score,
        max_score: a.max_score,
        percentage: pct,
        submitted_at: a.submitted_at,
      };
    });

    const averagePct = totalMaxScore > 0 ? Math.round((totalScore / totalMaxScore) * 100) : 0;

    // Batch IDs enrolled
    const enrolledBatchIds = (enrollments ?? []).map((e) => e.batch_id);
    let totalLecturesInBatches = 0;
    if (enrolledBatchIds.length > 0) {
      const { count } = await supabaseAdmin
        .from("lectures")
        .select("id", { count: "exact", head: true })
        .in("batch_id", enrolledBatchIds);
      totalLecturesInBatches = count ?? 0;
    }

    return {
      user_id: data.user_id,
      full_name: profile?.full_name ?? null,
      phone: profile?.phone ?? null,
      email: authUser.user?.email ?? null,
      class_level: profile?.class_level ?? null,
      exam_target: profile?.exam_target ?? null,
      joined_at: authUser.user?.created_at ?? profile?.created_at ?? null,
      last_sign_in_at: authUser.user?.last_sign_in_at ?? null,
      batches: (enrollments ?? []).map((e) => ({
        id: e.id,
        batch_id: e.batch_id,
        title: (e.batch as { title: string } | null)?.title ?? "Batch",
        fees_inr: (e.batch as { fees_inr: number } | null)?.fees_inr ?? 0,
        exam_category: (e.batch as { exam_category: string } | null)?.exam_category ?? "",
        status: e.status,
        payment_status: e.payment_status,
        amount_paid_inr: e.amount_paid_inr ?? 0,
        enrolled_at: e.enrolled_at,
      })),
      tests_given: submitted.length,
      tests_in_progress: (attempts ?? []).length - submitted.length,
      last_test_at: lastAttemptAt,
      average_percentage: averagePct,
      highest_percentage: highestPct,
      test_history: formattedAttempts,
      total_lectures_in_enrolled_batches: totalLecturesInBatches,
    };
  });
