"use client";

import { MotionConfig } from "framer-motion";

export function MotionProvider({ children }: { children: React.ReactNode }) {
  // "user" honors the prefers-reduced-motion media query at the OS level.
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
