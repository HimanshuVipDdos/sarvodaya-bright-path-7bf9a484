import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

// This layout route strictly protects all /admin/* routes
export const Route = createFileRoute("/_authenticated/admin")({
  beforeLoad: async () => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) throw redirect({ to: "/auth" });

    // Verify admin role
    const { data: roles, error } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id);
      
    if (error || !roles?.some(r => r.role === "admin")) {
      // If not an admin, aggressively kick them back to dashboard
      throw redirect({ to: "/dashboard" });
    }
  },
  component: () => <Outlet />,
});
