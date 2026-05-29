"use client";

import Link from "next/link";
import Image from "next/image";
import { useRef } from "react";
import { motion, useScroll, useTransform, useReducedMotion } from "framer-motion";
import { pickTextColor } from "@/lib/color";

/* ─────────────────────────────────────────────────────────────────────
   EventPoster — the event-detail hero.

   Two modes, same composition:
   ─ With a flyer: the image fills the hero, a group-tinted scrim rises
     from the bottom, and the title/group/date sit *on* the photo like a
     gig poster. A gentle scroll-parallax (image drifts slower than the
     page) adds depth without hijacking the scroll.
   ─ Without a flyer: a diagonal group-color gradient becomes the poster,
     so "no image" is a deliberate, branded surface rather than a hole.

   Responsive: min-height (not a fixed aspect ratio) guarantees room for a
   two-line title at every width; full-bleed on mobile, rounded card on
   sm+. Text always sits in the scrim, so legibility holds on any photo.
   prefers-reduced-motion disables the parallax (static image).
   ───────────────────────────────────────────────────────────────────── */

interface PosterGroup {
  name: string;
  slug: string;
  color: string;
}

export function EventPoster({
  flyerImageUrl,
  title,
  group,
  coHosts,
  dateText,
  timeText,
  statusLabel,
  statusTone,
}: {
  flyerImageUrl: string | null;
  title: string;
  group: PosterGroup;
  coHosts: PosterGroup[];
  dateText: string;
  timeText: string;
  /** Lowercased status word shown as a pill when not CONFIRMED. */
  statusLabel?: string | null;
  statusTone?: "cancelled" | "tentative";
}) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });
  // Image drifts down a touch as the hero scrolls away — classic parallax.
  const y = useTransform(scrollYProgress, [0, 1], reduce ? [0, 0] : [0, 60]);

  const hasFlyer = !!flyerImageUrl;
  // On the colored fallback, pick legible text; over a photo, white always wins
  // thanks to the scrim.
  const overlayText = hasFlyer ? "#ffffff" : pickTextColor(group.color);
  const isLight = overlayText === "#111111";

  return (
    <header
      ref={ref}
      className="relative -mx-4 flex min-h-[19rem] flex-col justify-end overflow-hidden px-4 pb-5 pt-16 sm:min-h-[23rem] sm:rounded-2xl sm:px-7 sm:pb-7"
    >
      {/* ── Background layer ── */}
      {hasFlyer ? (
        <motion.div aria-hidden="true" className="absolute inset-0 -z-10" style={{ y }}>
          {/* Scaled up so the parallax drift never exposes an edge. */}
          <div className="absolute inset-0 scale-110">
            <Image
              src={flyerImageUrl}
              alt=""
              fill
              className="object-cover"
              sizes="(min-width: 768px) 768px, 100vw"
              priority
            />
          </div>
        </motion.div>
      ) : (
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10"
          style={{
            background: `linear-gradient(135deg, ${group.color} 0%, ${group.color}cc 55%, ${group.color}80 100%)`,
          }}
        />
      )}

      {/* ── Scrim: darken the bottom for text legibility + a whisper of group
              color for identity. Skipped on the light colored fallback so we
              don't muddy a bright poster. ── */}
      {(hasFlyer || !isLight) && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10"
          style={{
            background: hasFlyer
              ? `linear-gradient(to top, rgba(0,0,0,0.78) 0%, rgba(0,0,0,0.35) 35%, rgba(0,0,0,0) 62%), linear-gradient(to top, ${group.color}40 0%, transparent 55%)`
              : `linear-gradient(to top, rgba(0,0,0,0.30) 0%, transparent 60%)`,
          }}
        />
      )}

      {/* ── Foreground content ── */}
      <div className="relative space-y-2.5" style={{ color: overlayText }}>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <Link
            href={`/g/${group.slug}`}
            className="inline-flex items-center gap-1.5 text-sm font-medium drop-shadow-sm transition-opacity hover:opacity-80"
          >
            <span
              aria-hidden="true"
              className="h-2.5 w-2.5 rounded-full ring-2 ring-white/30"
              style={{ backgroundColor: group.color }}
            />
            {group.name}
          </Link>
          {coHosts.map((c) => (
            <Link
              key={c.slug}
              href={`/g/${c.slug}`}
              className="inline-flex items-center gap-1.5 text-xs opacity-90 transition-opacity hover:opacity-70"
            >
              <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: c.color }} />
              + {c.name}
            </Link>
          ))}
          {statusLabel && (
            <span
              className={
                "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider " +
                (statusTone === "cancelled"
                  ? "bg-destructive text-destructive-foreground"
                  : "bg-amber-400/90 text-amber-950")
              }
            >
              {statusLabel}
            </span>
          )}
        </div>

        <h1
          className="max-w-3xl font-display text-3xl font-medium leading-[1.05] tracking-tight drop-shadow-sm sm:text-5xl"
          style={{ fontVariationSettings: '"opsz" 96, "SOFT" 35' }}
        >
          {title}
        </h1>

        <p className="font-mono text-sm tabular-nums drop-shadow-sm" style={{ opacity: 0.95 }}>
          {dateText}
          <span className="ml-2 opacity-80">{timeText}</span>
        </p>
      </div>
    </header>
  );
}
