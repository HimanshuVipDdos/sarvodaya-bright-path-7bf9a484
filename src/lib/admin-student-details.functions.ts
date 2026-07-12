import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getStudentDetails = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { user_id: string }) => {
    if (!input?.user_id) throw new Error("user_id is required");
    return input;
  })
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
        supabaseAdmin.from("profiles").select("full_name, phone, class_level, exam_target, created_at").eq("id", data.user_id).maybeSingle(),
        supabaseAdmin
          .from("enrollments")
          .select("status, payment_status, enrolled_at, batch:batches(title)")
          .eq("user_id", data.user_id),
        supabaseAdmin
          .from("cbt_attempts")
          .select("status, score, max_score, submitted_at")
          .eq("user_id", data.user_id),
      ]);
    if (authErr) throw new Error(authErr.message);

    const submitted = (attempts ?? []).filter((a) => a.status === "submitted");
    const lastAttemptAt = submitted.length
      ? submitted.map((a) => a.submitted_at).sort().at(-1)
      : null;

    return {
      full_name: profile?.full_name ?? null,
      phone: profile?.phone ?? null,
      email: authUser.user?.email ?? null,
      class_level: profile?.class_level ?? null,
      exam_target: profile?.exam_target ?? null,
      joined_at: authUser.user?.created_at ?? profile?.created_at ?? null,
      last_sign_in_at: authUser.user?.last_sign_in_at ?? null,
      batches: (enrollments ?? []).map((e) => ({
        title: (e.batch as { title: string } | null)?.title ?? "Batch",
        status: e.status,
        payment_status: e.payment_status,
        enrolled_at: e.enrolled_at,
      })),
      tests_given: submitted.length,
      tests_in_progress: (attempts ?? []).length - submitted.length,
      last_test_at: lastAttemptAt,
    };
  });
