import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });

    // Force any user (new signup OR an old user who never filled these in)
    // to complete their profile before reaching anything else. The /profile
    // route itself is excluded, or this would redirect in an infinite loop.
    if (location.pathname !== "/profile") {
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name,phone")
        .eq("id", data.user.id)
        .maybeSingle();

      const hasName = !!profile?.full_name?.trim();
      const hasPhone = !!profile?.phone?.trim();

      if (!hasName || !hasPhone) {
        throw redirect({ to: "/profile", search: { setup: "1" } });
      }
    }

    return { user: data.user };
  },
  component: () => <Outlet />,
});
