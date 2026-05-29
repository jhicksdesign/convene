"use client";

import Link from "next/link";
import { addDays, format, isSameDay, startOfWeek } from "date-fns";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { pickTextColor } from "@/lib/color";
import { cn } from "@/lib/utils";
import type { CalEvent } from "@/components/calendar/month-view";

export function WeekView({ events }: { events: CalEvent[] }) {
  const [cursor, setCursor] = useState(() => startOfWeek(new Date(), { weekStartsOn: 0 }));
  const today = new Date();
  const days = Array.from({ length: 7 }, (_, i) => addDays(cursor, i));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-2xl font-medium tracking-tight">
          {format(cursor, "MMM d")} – {format(addDays(cursor, 6), "MMM d, yyyy")}
        </h2>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setCursor(addDays(cursor, -7))}>← Prev</Button>
          <Button variant="outline" size="sm" onClick={() => setCursor(startOfWeek(new Date(), { weekStartsOn: 0 }))}>Today</Button>
          <Button variant="outline" size="sm" onClick={() => setCursor(addDays(cursor, 7))}>Next →</Button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-2">
        {days.map((d) => {
          const dayEvents = events.filter((e) => isSameDay(new Date(e.startsAt), d));
          const isToday = isSameDay(d, today);
          return (
            <div
              key={d.toISOString()}
              className={cn(
                "min-h-48 rounded-xl border bg-card p-2 transition-colors",
                isToday && "border-primary/40 bg-primary/[0.04] ring-1 ring-primary/30",
              )}
              style={{ boxShadow: "var(--shadow-paper)" }}
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  {format(d, "EEE")}
                </span>
                <span
                  className={
                    isToday
                      ? "inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary text-[11px] font-mono font-semibold tabular-nums text-primary-foreground"
                      : "text-sm font-mono tabular-nums text-foreground"
                  }
                >
                  {format(d, "d")}
                </span>
              </div>
              <div className="space-y-1.5">
                {dayEvents.map((e) => {
                  const fg = pickTextColor(e.color);
                  const cancelled = e.status === "CANCELLED";
                  return (
                    <Link
                      key={e.id + e.startsAt}
                      href={`/e/${e.id}`}
                      className={`block rounded-md px-2 py-1.5 text-xs leading-tight transition-all duration-100 hover:-translate-y-px hover:shadow-[0_4px_12px_-4px_rgba(0,0,0,0.30)] ${cancelled ? "cal-pill-cancelled" : ""}`}
                      style={{ backgroundColor: e.color, color: fg }}
                    >
                      <div className="font-mono text-[10px] font-semibold tabular-nums opacity-90">
                        {format(new Date(e.startsAt), "p")}
                      </div>
                      <div className={`mt-0.5 truncate font-medium ${cancelled ? "line-through opacity-80" : ""}`}>
                        {e.title}
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
