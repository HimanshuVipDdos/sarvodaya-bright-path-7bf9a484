import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/cbt/$testId")({
  component: () => <Outlet />,
});