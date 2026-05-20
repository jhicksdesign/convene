"use client";

import Link from "next/link";
import { addDays, format, isSameDay, startOfWeek } from "date-fns";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { CalEvent } from "@/components/calendar/month-view";

export function WeekView({ events }: { events: CalEvent[] }) {
  const [cursor, setCursor] = useState(() => startOfWeek(new Date(), { weekStartsOn: 0 }));
  const days = Array.from({ length: 7 }, (_, i) => addDays(cursor, i));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold tracking-tight">
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
          return (
            <div key={d.toISOString()} className="min-h-48 rounded-md border bg-background p-2">
              <div className="mb-1 text-xs font-medium text-muted-foreground">{format(d, "EEE d")}</div>
              <div className="space-y-1">
                {dayEvents.map((e) => (
                  <Link
                    key={e.id + e.startsAt}
                    href={`/e/${e.id}`}
                    className="block rounded px-2 py-1 text-xs text-white"
                    style={{ backgroundColor: e.color }}
                  >
                    <div className="truncate font-medium">{e.title}</div>
                    <div className="opacity-90">{format(new Date(e.startsAt), "p")}</div>
                  </Link>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
