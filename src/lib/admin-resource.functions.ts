import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const ALLOWED_TABLES = [
  "batches",
  "lectures",
  "study_materials",
  "current_affairs",
  "notifications",
  "live_classes",
  "faculty",
  "gallery",
  "results",
  "cbt_tests",
  "cbt_questions",
  "hero_slides",
] as const;

const adminSaveResourceSchema = z
  .object({
    table: z.enum(ALLOWED_TABLES),
    data: z.record(z.unknown()),
    id: z.string().optional().nullable(),
    rowKey: z.string().default("id"),
  })
  .strict();

const adminDeleteResourceSchema = z
  .object({
    table: z.enum(ALLOWED_TABLES),
    id: z.string(),
    rowKey: z.string().default("id"),
  })
  .strict();

const KNOWN_OWNER_EMAILS = [
  "hr152830@gmail.com",
  "info@sarvodayaadhyeta.in",
];

export const adminSaveResource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => adminSaveResourceSchema.parse(input))
  .handler(async ({ data: input, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1. Verify caller is admin or owner
    let isAuthorized = false;

    // A) Check RPC has_role
    try {
      const { data: isAdminRpc } = await context.supabase.rpc("has_role", {
        _user_id: context.userId,
        _role: "admin",
      });
      if (isAdminRpc) isAuthorized = true;
    } catch {
      // ignore
    }

    // B) Check user_roles table directly with service role
    if (!isAuthorized) {
      const { data: roleRow } = await supabaseAdmin
        .from("user_roles")
        .select("role")
        .eq("user_id", context.userId)
        .eq("role", "admin")
        .maybeSingle();
      if (roleRow) isAuthorized = true;
    }

    // C) Check caller email against known owner emails
    let callerEmail = "";
    try {
      const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(context.userId);
      callerEmail = (authUser.user?.email ?? "").toLowerCase().trim();
      if (callerEmail && KNOWN_OWNER_EMAILS.includes(callerEmail)) {
        isAuthorized = true;
      }
    } catch {
      // ignore
    }

    if (!isAuthorized) {
      throw new Error("Unauthorized: Only administrators can modify resources.");
    }

    // Self-healing: if caller is authorized as owner but missing in user_roles, ensure row exists
    if (callerEmail && KNOWN_OWNER_EMAILS.includes(callerEmail)) {
      try {
        await supabaseAdmin.from("user_roles").upsert(
          { user_id: context.userId, role: "admin" },
          { onConflict: "user_id,role" }
        );
      } catch (err) {
        console.warn("[adminSaveResource] failed to self-heal user_roles:", err);
      }
    }

    // 2. Perform Insert or Update with service role key (bypasses RLS)
    const anyClient = supabaseAdmin as unknown as { from: (t: string) => any };
    if (input.id) {
      const { data: updated, error } = await anyClient
        .from(input.table)
        .update(input.data)
        .eq(input.rowKey, input.id)
        .select()
        .maybeSingle();

      if (error) throw new Error(error.message);
      return { ok: true, action: "updated", data: updated };
    } else {
      const { data: inserted, error } = await anyClient
        .from(input.table)
        .insert(input.data)
        .select()
        .maybeSingle();

      if (error) throw new Error(error.message);
      return { ok: true, action: "inserted", data: inserted };
    }
  });

export const adminDeleteResource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => adminDeleteResourceSchema.parse(input))
  .handler(async ({ data: input, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let isAuthorized = false;

    try {
      const { data: isAdminRpc } = await context.supabase.rpc("has_role", {
        _user_id: context.userId,
        _role: "admin",
      });
      if (isAdminRpc) isAuthorized = true;
    } catch {}

    if (!isAuthorized) {
      const { data: roleRow } = await supabaseAdmin
        .from("user_roles")
        .select("role")
        .eq("user_id", context.userId)
        .eq("role", "admin")
        .maybeSingle();
      if (roleRow) isAuthorized = true;
    }

    if (!isAuthorized) {
      try {
        const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(context.userId);
        const email = (authUser.user?.email ?? "").toLowerCase().trim();
        if (email && KNOWN_OWNER_EMAILS.includes(email)) {
          isAuthorized = true;
        }
      } catch {}
    }

    if (!isAuthorized) {
      throw new Error("Unauthorized: Only administrators can delete resources.");
    }

    const anyClient = supabaseAdmin as unknown as { from: (t: string) => any };
    const { error } = await anyClient
      .from(input.table)
      .delete()
      .eq(input.rowKey, input.id);

    if (error) throw new Error(error.message);
    return { ok: true, action: "deleted" };
  });
