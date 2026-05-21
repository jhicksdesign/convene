"use client";

import Link from "next/link";
import { addDays, endOfMonth, format, isSameDay, isSameMonth, startOfMonth, startOfWeek } from "date-fns";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { pickTextColor } from "@/lib/color";
import { cn } from "@/lib/utils";

export interface CalEvent {
  id: string;
  title: string;
  startsAt: string; // ISO
  endsAt: string;
  groupName: string;
  color: string;
  status?: "TENTATIVE" | "CONFIRMED" | "CANCELLED";
  isSoftClaim?: boolean;
}

export function MonthView({ events, initialMonth }: { events: CalEvent[]; initialMonth?: string }) {
  const [cursor, setCursor] = useState(() => (initialMonth ? new Date(initialMonth) : new Date()));
  const today = new Date();

  const days = useMemo(() => {
    const monthStart = startOfMonth(cursor);
    const monthEnd = endOfMonth(cursor);
    const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 });
    const gridEnd = addDays(startOfWeek(addDays(monthEnd, 7), { weekStartsOn: 0 }), -1);
    const out: Date[] = [];
    let d = gridStart;
    while (d <= gridEnd) {
      out.push(d);
      d = addDays(d, 1);
    }
    return out;
  }, [cursor]);

  const evs = useMemo(() =>
    events.map((e) => ({ ...e, _start: new Date(e.startsAt), _end: new Date(e.endsAt) })),
    [events],
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-2xl font-medium tracking-tight">{format(cursor, "MMMM yyyy")}</h2>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setCursor(addDays(startOfMonth(cursor), -1))}>
            ← Prev
          </Button>
          <Button variant="outline" size="sm" onClick={() => setCursor(new Date())}>Today</Button>
          <Button variant="outline" size="sm" onClick={() => setCursor(addDays(endOfMonth(cursor), 1))}>Next →</Button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-xl border bg-border text-sm" style={{ boxShadow: "var(--shadow-paper)" }}>
        {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((d) => (
          <div key={d} className="bg-secondary px-2 py-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            {d}
          </div>
        ))}
        {days.map((d) => {
          const dayEvents = evs.filter((e) => isSameDay(e._start, d) || (e._start <= d && e._end >= d));
          const inMonth = isSameMonth(d, cursor);
          const isToday = isSameDay(d, today);
          return (
            <div
              key={d.toISOString()}
              className={cn(
                "relative min-h-28 bg-background p-1.5",
                !inMonth && "opacity-55",
              )}
            >
              <div
                className={cn(
                  "inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-[11px] font-mono tabular-nums",
                  isToday
                    ? "bg-primary text-primary-foreground font-semibold"
                    : "text-muted-foreground",
                )}
              >
                {format(d, "d")}
              </div>
              <div className="mt-1 space-y-1">
                {dayEvents.slice(0, 3).map((e) => {
                  const start = e._start;
                  const isAllDay =
                    !e.isSoftClaim &&
                    start.getHours() === 0 &&
                    start.getMinutes() === 0 &&
                    e._end.getTime() - start.getTime() >= 12 * 3_600_000;
                  const h = start.getHours();
                  const m = start.getMinutes();
                  const ms = m ? `:${m.toString().padStart(2, "0")}` : "";
                  const timeLabel = isAllDay || e.isSoftClaim
                    ? null
                    : h === 0 ? "12a"
                      : h < 12 ? `${h}${ms}a`
                      : h === 12 ? `12${ms}p`
                      : `${h - 12}${ms}p`;
                  const fg = pickTextColor(e.color);
                  const cancelled = e.status === "CANCELLED";
                  return (
                    <Link
                      key={e.id + e.startsAt}
                      href={e.isSoftClaim ? "#" : `/e/${e.id}`}
                      className={cn(
                        "group/pill block h-6 overflow-hidden rounded-md text-[11px] leading-none transition-transform duration-100 hover:-translate-y-px",
                        e.isSoftClaim && "border border-dashed opacity-70",
                        cancelled && "cal-pill-cancelled",
                      )}
                      style={{
                        backgroundColor: e.isSoftClaim ? "transparent" : e.color,
                        color: e.isSoftClaim ? e.color : fg,
                        borderColor: e.isSoftClaim ? e.color : undefined,
                      }}
                      title={`${e.title} — ${e.groupName}`}
                      aria-label={`${e.title}, ${e.groupName}${cancelled ? " (cancelled)" : ""}${timeLabel ? `, ${timeLabel}` : ""}`}
                    >
                      <span className="flex h-full items-center gap-1 px-1.5">
                        {timeLabel && (
                          <span className="font-mono text-[10px] font-semibold tabular-nums opacity-90">{timeLabel}</span>
                        )}
                        <span className={cn("truncate font-medium", cancelled && "line-through opacity-80")}>
                          {e.title}
                        </span>
                      </span>
                    </Link>
                  );
                })}
                {dayEvents.length > 3 && (
                  <div className="pl-1 text-[10px] font-medium text-muted-foreground">
                    +{dayEvents.length - 3} more
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
