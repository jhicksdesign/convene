"use client";

import { useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Date + start-time + duration picker for community events.
 *
 * Mental model: "Saturday 7pm, 4 hours" — not "Saturday 7pm to Saturday 11pm".
 * Most events are single-day, 1–8 hours. Multi-day is opt-in.
 *
 * Inputs/outputs are local-naive ISO-ish strings (`YYYY-MM-DDTHH:MM`) — the
 * same shape `datetime-local` produces, so server actions can keep parsing
 * them with `new Date(...)`.
 */

const DURATION_CHIPS = [
  { label: "1h", hours: 1 },
  { label: "2h", hours: 2 },
  { label: "4h", hours: 4 },
  { label: "6h", hours: 6 },
  { label: "8h", hours: 8 },
] as const;

interface Props {
  startsAt: string | undefined;
  endsAt: string | undefined;
  onChange: (next: { startsAt: string; endsAt: string }) => void;
}

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

function toLocalIso(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function parseLocal(s: string | undefined): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function hoursBetween(a: Date, b: Date): number {
  return Math.round(((b.getTime() - a.getTime()) / 3_600_000) * 4) / 4; // 15-min resolution
}

function nextSaturday7pm(): Date {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  const daysToSat = (6 - d.getDay() + 7) % 7 || 7;
  d.setDate(d.getDate() + daysToSat);
  d.setHours(19, 0, 0, 0);
  return d;
}

export function DateTimeDurationPicker({ startsAt, endsAt, onChange }: Props) {
  // Initialize from props (edit flow) or sensible defaults (create flow).
  const initialStart = useMemo(() => parseLocal(startsAt) ?? nextSaturday7pm(), [startsAt]);
  const initialEnd = useMemo(() => {
    const e = parseLocal(endsAt);
    if (e) return e;
    const d = new Date(initialStart);
    d.setHours(d.getHours() + 4);
    return d;
  }, [endsAt, initialStart]);

  const initialDuration = Math.max(0.25, hoursBetween(initialStart, initialEnd));
  const isMultiDay =
    initialStart.toDateString() !== initialEnd.toDateString();

  const [date, setDate] = useState(() =>
    `${initialStart.getFullYear()}-${pad(initialStart.getMonth() + 1)}-${pad(initialStart.getDate())}`,
  );
  const [time, setTime] = useState(() =>
    `${pad(initialStart.getHours())}:${pad(initialStart.getMinutes())}`,
  );
  const [duration, setDuration] = useState<number>(initialDuration);
  const [customDuration, setCustomDuration] = useState<string>(
    DURATION_CHIPS.some((c) => c.hours === initialDuration) ? "" : String(initialDuration),
  );
  const [multiDay, setMultiDay] = useState(isMultiDay);
  const [endDate, setEndDate] = useState(() =>
    `${initialEnd.getFullYear()}-${pad(initialEnd.getMonth() + 1)}-${pad(initialEnd.getDate())}`,
  );
  const [endTime, setEndTime] = useState(() =>
    `${pad(initialEnd.getHours())}:${pad(initialEnd.getMinutes())}`,
  );

  // Compute and emit on every change.
  useEffect(() => {
    const [y, m, d] = date.split("-").map(Number);
    const [hh, mm] = time.split(":").map(Number);
    if (!y || !m || !d || isNaN(hh) || isNaN(mm)) return;

    const start = new Date(y, m - 1, d, hh, mm, 0, 0);

    let end: Date;
    if (multiDay) {
      const [ey, em, ed] = endDate.split("-").map(Number);
      const [ehh, emm] = endTime.split(":").map(Number);
      if (!ey || !em || !ed || isNaN(ehh) || isNaN(emm)) return;
      end = new Date(ey, em - 1, ed, ehh, emm, 0, 0);
    } else {
      end = new Date(start);
      end.setMinutes(end.getMinutes() + Math.round(duration * 60));
    }
    onChange({ startsAt: toLocalIso(start), endsAt: toLocalIso(end) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, time, duration, multiDay, endDate, endTime]);

  // Local timezone label (American shortform when possible).
  const tzLabel = useMemo(() => {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const short = new Intl.DateTimeFormat("en-US", { timeZoneName: "short" })
        .formatToParts(new Date())
        .find((p) => p.type === "timeZoneName")?.value;
      return short ?? tz;
    } catch {
      return "local";
    }
  }, []);

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="event-date">Date</Label>
          <Input id="event-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </div>
        <div>
          <Label htmlFor="event-time">
            Start time <span className="text-xs font-normal text-muted-foreground">({tzLabel})</span>
          </Label>
          <Input id="event-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} required />
        </div>
      </div>

      {!multiDay && (
        <div>
          <Label>Duration</Label>
          <div className="mt-1 flex flex-wrap gap-2">
            {DURATION_CHIPS.map((c) => {
              const active = duration === c.hours && customDuration === "";
              return (
                <button
                  key={c.label}
                  type="button"
                  onClick={() => {
                    setDuration(c.hours);
                    setCustomDuration("");
                  }}
                  className={cn(
                    "rounded-full border px-3 py-1 text-sm font-medium transition-colors",
                    active
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-input hover:bg-accent",
                  )}
                >
                  {c.label}
                </button>
              );
            })}
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={0.25}
                max={168}
                step={0.25}
                placeholder="Custom"
                value={customDuration}
                onChange={(e) => {
                  const v = e.target.value;
                  setCustomDuration(v);
                  const n = parseFloat(v);
                  if (!isNaN(n) && n > 0) setDuration(n);
                }}
                className="w-24"
              />
              <span className="text-sm text-muted-foreground">hours</span>
            </div>
          </div>
        </div>
      )}

      {multiDay && (
        <div className="grid gap-3 rounded-md border bg-muted/30 p-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="event-end-date">End date</Label>
            <Input id="event-end-date" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required />
          </div>
          <div>
            <Label htmlFor="event-end-time">End time</Label>
            <Input id="event-end-time" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} required />
          </div>
        </div>
      )}

      <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
        <Switch checked={multiDay} onCheckedChange={setMultiDay} />
        This event spans multiple days
      </label>
    </div>
  );
}
