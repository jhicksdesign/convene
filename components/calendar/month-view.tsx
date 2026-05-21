"use client";

import Link from "next/link";
import { addDays, endOfMonth, format, isSameDay, isSameMonth, startOfMonth, startOfWeek } from "date-fns";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { pickTextColor } from "@/lib/color";

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
        <h2 className="text-xl font-semibold tracking-tight">{format(cursor, "MMMM yyyy")}</h2>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setCursor(addDays(startOfMonth(cursor), -1))}>
            ← Prev
          </Button>
          <Button variant="outline" size="sm" onClick={() => setCursor(new Date())}>Today</Button>
          <Button variant="outline" size="sm" onClick={() => setCursor(addDays(endOfMonth(cursor), 1))}>Next →</Button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-md border bg-border text-sm">
        {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((d) => (
          <div key={d} className="bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">{d}</div>
        ))}
        {days.map((d) => {
          const dayEvents = evs.filter((e) => isSameDay(e._start, d) || (e._start <= d && e._end >= d));
          return (
            <div
              key={d.toISOString()}
              className={`min-h-24 bg-background p-1 ${!isSameMonth(d, cursor) ? "opacity-50" : ""}`}
            >
              <div className="text-xs text-muted-foreground">{format(d, "d")}</div>
              <div className="mt-1 space-y-0.5">
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
                  return (
                    <Link
                      key={e.id + e.startsAt}
                      href={`/e/${e.id}`}
                      className={`block truncate rounded px-1 py-0.5 text-[11px] leading-tight ${e.isSoftClaim ? "opacity-50" : ""} ${e.status === "CANCELLED" ? "line-through" : ""}`}
                      style={{ backgroundColor: e.color, color: fg }}
                      title={`${e.title} — ${e.groupName}`}
                      aria-label={`${e.title}, ${e.groupName}${e.status === "CANCELLED" ? " (cancelled)" : ""}${timeLabel ? `, ${timeLabel}` : ""}`}
                    >
                      {timeLabel && <span className="mr-1 font-semibold opacity-90">{timeLabel}</span>}
                      {e.title}
                    </Link>
                  );
                })}
                {dayEvents.length > 3 && (
                  <div className="text-[10px] text-muted-foreground">+{dayEvents.length - 3} more</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
