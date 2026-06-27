import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export function Section({
  id,
  eyebrow,
  title,
  description,
  children,
  className,
}: {
  id?: string;
  eyebrow?: string;
  title?: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section id={id} className={cn("mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24", className)}>
      {(eyebrow || title || description) && (
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6, ease: [0.2, 0.8, 0.2, 1] }}
          className="mx-auto mb-10 max-w-2xl text-center sm:mb-14"
        >
          {eyebrow && (
            <div className="mb-3 inline-flex items-center gap-2 rounded-full glass px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-primary">
              {eyebrow}
            </div>
          )}
          {title && (
            <h2 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl md:text-5xl">
              {title}
            </h2>
          )}
          {description && (
            <p className="mt-4 text-base text-muted-foreground sm:text-lg">{description}</p>
          )}
        </motion.div>
      )}
      {children}
    </section>
  );
}
