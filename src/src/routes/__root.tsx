import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { Toaster } from "sonner";

import appCss from "../styles.css?url";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { FloatingActions } from "@/components/floating-actions";
import { SITE } from "@/lib/site";
import { supabase } from "@/integrations/supabase/client";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="glass-strong max-w-md rounded-3xl p-8 text-center">
        <h1 className="text-gradient text-7xl font-bold">404</h1>
        <h2 className="mt-4 text-xl font-semibold">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <Link
          to="/"
          className="mt-6 inline-flex items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary-glow px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-elegant"
        >
          Go home
        </Link>
      </div>
    </div>
  );
}

function PendingComponent() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="flex flex-col items-center gap-3">
        <span className="relative flex h-10 w-10 items-center justify-center">
          <span className="absolute h-10 w-10 animate-spin rounded-full border-2 border-primary/20 border-t-primary" />
        </span>
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="glass-strong max-w-md rounded-3xl p-8 text-center">
        <h1 className="text-xl font-semibold">This page didn't load</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong. Try again or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => { router.invalidate(); reset(); }}
            className="rounded-full bg-gradient-to-br from-primary to-primary-glow px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-elegant"
          >Try again</button>
          <a href="/" className="rounded-full border border-border bg-background px-5 py-2.5 text-sm font-medium">Go home</a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: `${SITE.name} — ${SITE.tagline}` },
      { name: "description", content: `${SITE.name}, Kasganj — premium coaching for UP Police, SSC, Banking, Railway, Teaching, UPSC/UPPSC and state-level competitive exams.` },
      { name: "author", content: SITE.owner },
      { property: "og:title", content: `${SITE.name} — ${SITE.tagline}` },
      { property: "og:description", content: `Premium coaching by ${SITE.owner} in Kasganj, UP for India's top competitive exams.` },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "theme-color", content: "#3a8dff" },
      { title: "Sarvodaya Adhyeta" },
      { property: "og:title", content: "Sarvodaya Adhyeta" },
      { name: "twitter:title", content: "Sarvodaya Adhyeta" },
      { name: "description", content: "Sarvodaya Ascend is a premium educational platform for Sarvodaya Adhyeta coaching institute." },
      { property: "og:description", content: "Sarvodaya Ascend is a premium educational platform for Sarvodaya Adhyeta coaching institute." },
      { name: "twitter:description", content: "Sarvodaya Ascend is a premium educational platform for Sarvodaya Adhyeta coaching institute." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/e519472a-00f3-403f-bceb-d819e96c2131/id-preview-53c1e017--9367c90c-3e5a-47b2-849c-c261ad2ba9c8.lovable.app-1782544105127.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/e519472a-00f3-403f-bceb-d819e96c2131/id-preview-53c1e017--9367c90c-3e5a-47b2-849c-c261ad2ba9c8.lovable.app-1782544105127.png" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" },
      { rel: "icon", type: "image/x-icon", href: "/favicon.ico" },
      { rel: "manifest", href: "/manifest.json" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
  pendingComponent: PendingComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
        {/* Pure-CSS boot spinner: paints the instant HTML arrives, before any
            JS has downloaded or run. Removed once React mounts (see the
            'app-ready' class added in RootComponent's useEffect below).
            This is what prevents a blank white screen on slow connections. */}
        <style>{`
          html:not(.app-ready) body::after {
            content: "";
            position: fixed;
            top: 50%;
            left: 50%;
            z-index: 10000;
            width: 40px;
            height: 40px;
            margin: -20px 0 0 -20px;
            border-radius: 9999px;
            border: 3px solid rgba(58, 141, 255, 0.2);
            border-top-color: #3a8dff;
            animation: boot-spin 0.8s linear infinite;
          }
          @keyframes boot-spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  // The actual test-taking screen (/cbt/$testId) is a full-screen exam UI
  // with its own header/timer — it must NOT be wrapped in the normal site
  // header/footer, or the site logo/branding bleeds through on top of the
  // question text. Sub-routes like /cbt/$testId/result stay normal.
  const isTakingTest = /^\/cbt\/[^/]+\/?$/.test(pathname);

  // Remove the pure-CSS boot spinner (defined in RootShell) the instant
  // React has actually mounted and can take over rendering. Runs on every
  // route's first paint, not just first load, since this component is
  // shared — but adding the class again is a no-op if already present.
  useEffect(() => {
    document.documentElement.classList.add("app-ready");
  }, []);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
        router.invalidate();
        if (event !== "SIGNED_OUT") queryClient.invalidateQueries();
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [router, queryClient]);

  // Register the service worker so the app shell (header/footer/layout) is
  // cached and shows instantly even on slow or no internet, while live data
  // still refreshes in the background whenever a connection is available.
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);

  // Fix: Radix Dialog/AlertDialog can occasionally leave document.body stuck
  // with `pointer-events: none` after closing (known Radix + React 19 issue),
  // which makes the entire page unclickable. This watches for that stuck
  // state and clears it automatically whenever no dialog is actually open.
  useEffect(() => {
    const clearStuckPointerEvents = () => {
      const hasOpenDialog = document.querySelector('[role="dialog"][data-state="open"]');
      if (!hasOpenDialog && document.body.style.pointerEvents === "none") {
        document.body.style.pointerEvents = "";
      }
    };

    const observer = new MutationObserver(clearStuckPointerEvents);
    observer.observe(document.body, { attributes: true, attributeFilter: ["style"] });

    // Also do a periodic safety check in case the mutation is missed.
    const interval = setInterval(clearStuckPointerEvents, 500);

    return () => {
      observer.disconnect();
      clearInterval(interval);
    };
  }, []);

  // Khatarnak Anti-Tamper Layer: Blocks Right-Click, F12, and View Source in Production
  useEffect(() => {
    if (!import.meta.env.PROD) return;

    const handleContextMenu = (e: MouseEvent) => e.preventDefault();
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === "F12" ||
        (e.ctrlKey && e.shiftKey && (e.key === "I" || e.key === "J" || e.key === "C" || e.key === "i" || e.key === "j" || e.key === "c")) ||
        (e.ctrlKey && (e.key === "U" || e.key === "u"))
      ) {
        e.preventDefault();
      }
    };
    
    document.addEventListener("contextmenu", handleContextMenu);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("contextmenu", handleContextMenu);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <div className="flex min-h-screen flex-col">
        {!isTakingTest && <SiteHeader />}
        <main className="flex-1">
          <Outlet />
        </main>
        {!isTakingTest && <SiteFooter />}
        {!isTakingTest && <FloatingActions />}
        <Toaster position="top-center" richColors />
      </div>
    </QueryClientProvider>
  );
}
