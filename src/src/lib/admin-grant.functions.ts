import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const grantInputSchema = z.object({
  email: z.string().email("Invalid email format"),
  batch_id: z.string().uuid("Invalid batch ID format"),
  amount_paid_inr: z.number().nonnegative().optional(),
  payment_status: z.enum(["paid", "unpaid", "refunded"]).optional(),
  expires_at: z.string().datetime().nullable().optional(),
}).strict();

export const grantBatchAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => grantInputSchema.parse(input))
  .handler(async ({ data, context }) => {
    // Verify caller is admin
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Find user by email
    const email = data.email.trim().toLowerCase();
    let userId: string | null = null;
    let page = 1;
    while (page <= 20) {
      const { data: list, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 });
      if (error) throw new Error(error.message);
      const found = list.users.find((u) => (u.email ?? "").toLowerCase() === email);
      if (found) { userId = found.id; break; }
      if (list.users.length < 200) break;
      page += 1;
    }
    if (!userId) throw new Error(`No student found with email ${email}. Ask them to sign up first.`);

    const { error: upErr } = await supabaseAdmin.from("enrollments").upsert(
      {
        user_id: userId,
        batch_id: data.batch_id,
        status: "active",
        payment_status: data.payment_status ?? "paid",
        payment_provider: "admin_grant",
        amount_paid_inr: data.amount_paid_inr ?? 0,
        expires_at: data.expires_at ?? null,
      },
      { onConflict: "user_id,batch_id" },
    );
    if (upErr) throw new Error(upErr.message);

    return { ok: true, user_id: userId };
  });
