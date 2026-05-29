"use client";

import { motion, useReducedMotion } from "framer-motion";

/* ─────────────────────────────────────────────────────────────────────
   GoingBurst — a one-shot spark burst fired when an RSVP lands on "Going".

   The single genuine moment of celebration in the app: committing to show
   up. Warm sienna + gold sparks radiate from the Save button, ~620ms.
   Purely decorative — never blocks or delays the save.

   The burst is keyed on `trigger` (an incrementing number bumped by the
   parent on a fresh "Going" save). Each bump remounts the sparks, which
   re-run their mount animation and settle invisible — no state, no timers,
   no effects. The layer is pointer-events-none and absolutely centered, so
   it sits correctly over the button at any viewport width.
   prefers-reduced-motion → renders nothing.
   ───────────────────────────────────────────────────────────────────── */

const SPARKS = 12;
const COLORS = ["var(--color-primary)", "#E8B04B", "var(--color-primary)"];

export function GoingBurst({ trigger }: { trigger: number }) {
  const reduce = useReducedMotion();
  if (reduce || trigger <= 0) return null;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute left-1/2 top-1/2 z-10 h-0 w-0"
    >
      {Array.from({ length: SPARKS }).map((_, i) => {
        // Even fan around the circle with a touch of per-spark variation
        // so it reads organic rather than mechanical.
        const angle = (i / SPARKS) * Math.PI * 2 + (i % 2 ? 0.22 : -0.18);
        const dist = 34 + (i % 4) * 9;
        const x = Math.cos(angle) * dist;
        const y = Math.sin(angle) * dist;
        const size = i % 3 === 0 ? 7 : 5;
        return (
          <motion.span
            key={`${trigger}-${i}`}
            className="absolute rounded-full"
            style={{
              width: size,
              height: size,
              backgroundColor: COLORS[i % COLORS.length],
              marginLeft: -size / 2,
              marginTop: -size / 2,
            }}
            initial={{ x: 0, y: 0, scale: 0, opacity: 1 }}
            animate={{ x, y, scale: 1, opacity: 0 }}
            transition={{ duration: 0.62, ease: [0.16, 1, 0.3, 1] }}
          />
        );
      })}
    </div>
  );
}
