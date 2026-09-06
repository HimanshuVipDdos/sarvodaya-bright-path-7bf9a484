import { useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, GraduationCap } from "lucide-react";
import { NAV, SITE } from "@/lib/site";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const handleLoginClick = () => {
    window.location.href = "/auth";
  };

  return (
    <header className="sticky top-0 z-[100] w-full">
      <div className="mx-auto mt-3 max-w-7xl px-3 sm:px-6">
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5, ease: [0.2, 0.8, 0.2, 1] }}
          className="glass-strong flex items-center justify-between rounded-3xl px-4 py-2.5 sm:px-6"
        >
          <Link to="/" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary-glow shadow-elegant">
              <GraduationCap className="h-5 w-5 text-primary-foreground" />
            </div>
            <div className="leading-tight">
              <div className="text-sm font-semibold tracking-tight sm:text-base">
                {SITE.name}
              </div>
              <div className="hidden text-[10px] uppercase tracking-[0.18em] text-muted-foreground sm:block">
                Kasganj · Uttar Pradesh
              </div>
            </div>
          </Link>

          <nav className="hidden items-center gap-1 lg:flex">
            {NAV.slice(0, 7).map((n) => {
              const active = pathname === n.to;
              return (
                <Link
                  key={n.to}
                  to={n.to}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
                    active
                      ? "bg-primary/10 text-primary"
                      : "text-foreground/70 hover:text-foreground",
                  )}
                >
                  {n.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-2">
            <Button 
              size="sm" 
              variant="ghost" 
              className="hidden sm:inline-flex"
              onClick={handleLoginClick}
            >
              Login
            </Button>
            <Button asChild size="sm" className="hidden rounded-full bg-gradient-to-br from-primary to-primary-glow shadow-elegant sm:inline-flex">
              <Link to="/dashboard">My Batches</Link>
            </Button>
            <button
              className="inline-flex h-9 w-9 items-center justify-center rounded-full text-foreground/80 hover:bg-foreground/5 lg:hidden"
              onClick={() => setOpen((s) => !s)}
              aria-label="Toggle navigation"
            >
              {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </motion.div>

        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="glass-strong mt-2 overflow-hidden rounded-3xl p-2 lg:hidden"
            >
              <div className="grid grid-cols-2 gap-1">
                {NAV.map((n) => (
                  <Link
                    key={n.to}
                    to={n.to}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "rounded-xl px-3 py-2 text-sm",
                      pathname === n.to
                        ? "bg-primary/10 text-primary"
                        : "hover:bg-foreground/5",
                    )}
                  >
                    {n.label}
                  </Link>
                ))}
              </div>
              <div className="mt-1 grid grid-cols-2 gap-1">
                <Link
                  to="/dashboard"
                  onClick={() => setOpen(false)}
                  className="rounded-xl bg-gradient-to-br from-primary to-primary-glow px-3 py-2 text-center text-sm font-semibold text-primary-foreground"
                >
                  My Batches
                </Link>
                <button
                  onClick={handleLoginClick}
                  className="rounded-xl border border-border px-3 py-2 text-center text-sm font-medium"
                >
                  Login
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </header>
  );
}
