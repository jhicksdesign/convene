"use client";

import { motion, useReducedMotion } from "framer-motion";
import * as React from "react";

/* ─────────────────────────────────────────────────────────────────────
   Reveal — the app's entrance-choreography primitive.

   Content rises a few pixels and fades in on mount. Used to make pages
   feel like they *arrive* rather than blink into place. Server components
   can wrap any block (or each mapped list item) with <Reveal delay={…}>.

   Accessibility / usability guarantees:
   ─ Honors prefers-reduced-motion: motion-reduced users get NO movement
     and an instant (0s) opacity settle, so nothing is ever hidden waiting
     on an animation.
   ─ The transform is small (10px) and the element keeps its normal box,
     so it never causes layout shift or horizontal overflow at any width.
   ─ `as` lets the motion element be the correct semantic node (li in a ul,
     section, etc.) so we never break valid markup or grid/flex flow.
   ───────────────────────────────────────────────────────────────────── */

type RevealTag = "div" | "li" | "section" | "ul" | "header" | "article";

interface RevealProps {
  /** Seconds to wait before the reveal begins — use index * 0.04 for stagger. */
  delay?: number;
  /** Pixels to rise from. Default 10. */
  y?: number;
  /** Semantic element to render. Default "div". */
  as?: RevealTag;
  className?: string;
  style?: React.CSSProperties;
  id?: string;
  children: React.ReactNode;
}

export function Reveal({ delay = 0, y = 10, as = "div", className, style, id, children }: RevealProps) {
  const reduce = useReducedMotion();
  const Tag = motion[as] as typeof motion.div;

  return (
    <Tag
      id={id}
      className={className}
      style={style}
      initial={{ opacity: 0, y: reduce ? 0 : y }}
      animate={{ opacity: 1, y: 0 }}
      transition={
        reduce
          ? { duration: 0 }
          : { duration: 0.4, delay, ease: [0.22, 1, 0.36, 1] }
      }
    >
      {children}
    </Tag>
  );
}
