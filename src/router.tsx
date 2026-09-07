import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    // Start loading a route's code + data the moment the user's cursor/finger
    // is on the link (hover on desktop, touchstart on mobile) instead of
    // waiting for the click. By the time they actually tap, the page is
    // usually already fetched — clicks feel instant instead of triggering a
    // visible load. Pure perceived-speed change, no behavior difference.
    defaultPreload: "intent",
    defaultPreloadDelay: 50,
    defaultPendingMs: 200,
    defaultPendingMinMs: 300,
  });

  return router;
};
