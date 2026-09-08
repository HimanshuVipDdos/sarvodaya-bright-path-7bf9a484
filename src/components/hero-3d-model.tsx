import { motion } from "framer-motion";
import { Sparkles, GraduationCap, BookOpen, Trophy } from "lucide-react";

/**
 * Premium hero visual — replaces the old Three.js/WebGL globe.
 *
 * The old version spun up a full WebGL scene (2048x1024 canvas-texture
 * generation, multiple lights, a particle field, an uncapped
 * requestAnimationFrame loop that never stopped) on every page load. That is
 * exactly the kind of thing that makes a 2GB-RAM / no-GPU laptop chug or the
 * page take several seconds to become interactive.
 *
 * This version is 100% CSS + SVG + Framer Motion:
 *  - No WebGL context, no canvas, no per-frame JS work ever.
 *  - The idle "orbit" and "spin" motion is plain CSS animation (GPU
 *    compositor, effectively free — the browser does this even on the
 *    cheapest hardware because it never touches the JS main thread once
 *    started).
 *  - Framer Motion is used only for the one-time entrance (slide/fade/scale
 *    in) and a gentle continuous float, both single-transform animations,
 *    so the "premium, animated" feel is intact without any heavy runtime
 *    cost.
 */
export function Hero3DModel() {
  return (
    <div className="relative flex items-center justify-center select-none">
      {/* Outer ambient glow — pure CSS, no canvas */}
      <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-primary/30 via-sky-500/20 to-purple-600/30 blur-3xl scale-95 pointer-events-none animate-pulse" />

      {/* Floating status badges — Framer Motion entrance */}
      <motion.div
        initial={{ opacity: 0, y: -14, x: -10 }}
        whileInView={{ opacity: 1, y: 0, x: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5, delay: 0.3, ease: "easeOut" }}
        className="absolute -top-4 -left-6 z-20 hidden sm:flex items-center gap-2 bg-white/95 dark:bg-slate-900/90 backdrop-blur-md px-3.5 py-1.5 rounded-full shadow-lg border border-slate-200/80 text-xs font-semibold text-slate-800"
      >
        <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
        <Sparkles className="w-3.5 h-3.5 text-amber-500" />
        <span>Live & Interactive</span>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 14, x: 10 }}
        whileInView={{ opacity: 1, y: 0, x: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5, delay: 0.45, ease: "easeOut" }}
        className="absolute -bottom-4 right-0 z-20 flex items-center gap-1.5 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md px-3 py-1 rounded-full shadow-md border border-slate-200/80 text-[11px] text-slate-600"
      >
        <Trophy className="w-3 h-3 text-primary" />
        <span>Trusted by 1000+ Aspirants</span>
      </motion.div>

      {/* Main visual — one-time slide/scale entrance, then a gentle
          continuous float (single transform, negligible cost) */}
      <motion.div
        initial={{ opacity: 0, scale: 0.85, y: 20 }}
        whileInView={{ opacity: 1, scale: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="relative z-10 w-[280px] h-[280px] sm:w-[380px] sm:h-[380px] lg:w-[420px] lg:h-[420px] flex items-center justify-center"
      >
        {/* Floating idle motion now runs on the CSS-only `animate-float`
            keyframe (already defined site-wide in styles.css) instead of a
            second Framer Motion instance — one less JS-driven animation
            loop running for the entire time this component is mounted. */}
        <div className="relative w-full h-full flex items-center justify-center animate-float">
          {/* Orbiting rings — plain CSS animation, no JS per frame */}
          <div
            className="absolute inset-[6%] rounded-full border-2 border-amber-500/40"
            style={{ animation: "spin 14s linear infinite" }}
          />
          <div
            className="absolute inset-[2%] rounded-full border border-sky-400/40"
            style={{ animation: "spin 20s linear infinite reverse" }}
          />

          {/* Orbiting knowledge nodes — CSS-only orbit trick (rotating
              wrapper + fixed-position dot) */}
          <div className="absolute inset-[6%]" style={{ animation: "spin 9s linear infinite" }}>
            <span className="absolute -top-1.5 left-1/2 -translate-x-1/2 h-3 w-3 rounded-full bg-sky-400 shadow-[0_0_10px_2px_rgba(56,189,248,0.7)]" />
          </div>
          <div className="absolute inset-[2%]" style={{ animation: "spin 13s linear infinite reverse" }}>
            <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 h-2.5 w-2.5 rounded-full bg-amber-400 shadow-[0_0_10px_2px_rgba(251,191,36,0.7)]" />
          </div>

          {/* Core globe — gradient + static grid, no canvas texture work */}
          <div className="relative h-[62%] w-[62%] rounded-full bg-gradient-to-br from-[#1E3A8A] via-[#312E81] to-[#0F172A] shadow-2xl overflow-hidden border border-white/10">
            <div
              className="absolute inset-0 opacity-30"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(0deg, rgba(147,197,253,0.25) 0, rgba(147,197,253,0.25) 1px, transparent 1px, transparent 22px), repeating-linear-gradient(90deg, rgba(147,197,253,0.25) 0, rgba(147,197,253,0.25) 1px, transparent 1px, transparent 22px)",
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-tr from-emerald-500/30 via-transparent to-transparent" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_30%,rgba(251,191,36,0.35),transparent_45%)]" />
            <div className="absolute inset-0 flex items-center justify-center">
              <GraduationCap className="h-[38%] w-[38%] text-white/90 drop-shadow-lg" />
            </div>
            {/* subtle glossy highlight */}
            <div className="absolute -top-1/4 -left-1/4 h-3/4 w-3/4 rounded-full bg-white/10 blur-2xl" />
          </div>

          {/* Small floating icon chip */}
          <motion.div
            initial={{ opacity: 0, scale: 0.6 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: 0.6 }}
            className="absolute bottom-[8%] left-[4%] flex h-10 w-10 items-center justify-center rounded-2xl bg-white shadow-lg border border-slate-100"
          >
            <BookOpen className="h-5 w-5 text-[#5B21B6]" />
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
}
