"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { MonthView, type CalEvent } from "@/components/calendar/month-view";
import { WeekView } from "@/components/calendar/week-view";
import { AgendaView } from "@/components/calendar/agenda-view";
import { cn } from "@/lib/utils";

/* ─────────────────────────────────────────────────────────────────────
   CalendarBoard — client shell for the three calendar views.

   Replaces the static Radix tab strip with a segmented control whose
   active "pill" physically slides between options (framer layoutId), and
   crossfades the view body on switch. The heavy lifting (visibility,
   recurrence expansion) still happens on the server; this only owns which
   view is showing.

   Responsive: the control is inline-flex and wraps naturally; each view
   handles its own breakpoints. prefers-reduced-motion (honored globally by
   MotionProvider) disables the slide/fade — the control still works.
   ───────────────────────────────────────────────────────────────────── */

const VIEWS = [
  { k: "month", label: "Month" },
  { k: "week", label: "Week" },
  { k: "agenda", label: "Agenda" },
] as const;

type ViewKey = (typeof VIEWS)[number]["k"];

export function CalendarBoard({ events }: { events: CalEvent[] }) {
  const [view, setView] = useState<ViewKey>("month");

  return (
    <div className="space-y-3">
      <div
        role="tablist"
        aria-label="Calendar view"
        className="inline-flex items-center gap-1 rounded-lg bg-muted p-1"
      >
        {VIEWS.map((v) => {
          const active = view === v.k;
          return (
            <button
              key={v.k}
              role="tab"
              type="button"
              aria-selected={active}
              onClick={() => setView(v.k)}
              className={cn(
                "relative rounded-md px-3 py-1 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {active && (
                <motion.span
                  layoutId="cal-view-indicator"
                  className="absolute inset-0 rounded-md bg-background shadow"
                  transition={{ type: "spring", stiffness: 420, damping: 34 }}
                />
              )}
              <span className="relative z-10">{v.label}</span>
            </button>
          );
        })}
      </div>

      <motion.div
        key={view}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
      >
        {view === "month" && <MonthView events={events} />}
        {view === "week" && <WeekView events={events} />}
        {view === "agenda" && (
          <AgendaView events={[...events].sort((a, b) => a.startsAt.localeCompare(b.startsAt))} />
        )}
      </motion.div>
    </div>
  );
}
