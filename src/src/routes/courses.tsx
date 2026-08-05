import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/courses")({
  component: () => <Navigate to="/batches" replace />,
});
