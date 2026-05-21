"use client";

import { useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";

/**
 * Friendly recurrence picker for community events.
 *
 * The patterns we care about for v1:
 *   - One-time (no recurrence)
 *   - Weekly on the same weekday as the start date
 *   - Every other week
 *   - Monthly on the Nth weekday (e.g. "first Saturday")
 *   - Monthly on the same date
 *
 * Output: an RRULE string compatible with the rrule package (consumed by
 * lib/recurrence.ts `expand()`).
 */

type Kind = "none" | "weekly" | "biweekly" | "monthly-nth" | "monthly-date";

const RRULE_DAY = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"] as const;

interface Props {
  startDate: string | undefined; // YYYY-MM-DDTHH:MM local form
  rrule: string | null;
  onChange: (rrule: string | null) => void;
}

function parseRrule(rrule: string | null): { kind: Kind; count?: number; until?: string } {
  if (!rrule) return { kind: "none" };
  const parts = Object.fromEntries(
    rrule
      .replace(/^RRULE:/, "")
      .split(";")
      .map((p) => p.split("=") as [string, string]),
  );
  const freq = parts.FREQ;
  const interval = Number(parts.INTERVAL ?? "1");
  let kind: Kind = "none";
  if (freq === "WEEKLY" && interval === 1) kind = "weekly";
  else if (freq === "WEEKLY" && interval === 2) kind = "biweekly";
  else if (freq === "MONTHLY" && parts.BYDAY) kind = "monthly-nth";
  else if (freq === "MONTHLY") kind = "monthly-date";
  return {
    kind,
    count: parts.COUNT ? Number(parts.COUNT) : undefined,
    until: parts.UNTIL,
  };
}

function nthWeekdayOfMonth(date: Date): number {
  // Returns 1..5 for the Nth occurrence of this weekday in the month.
  return Math.ceil(date.getDate() / 7);
}

function buildRrule(kind: Kind, start: Date, opts: { count?: number; until?: string }): string | null {
  if (kind === "none") return null;
  const parts: string[] = [];
  const day = RRULE_DAY[start.getDay()];
  switch (kind) {
    case "weekly":
      parts.push(`FREQ=WEEKLY`, `BYDAY=${day}`);
      break;
    case "biweekly":
      parts.push(`FREQ=WEEKLY`, `INTERVAL=2`, `BYDAY=${day}`);
      break;
    case "monthly-nth":
      parts.push(`FREQ=MONTHLY`, `BYDAY=${nthWeekdayOfMonth(start)}${day}`);
      break;
    case "monthly-date":
      parts.push(`FREQ=MONTHLY`, `BYMONTHDAY=${start.getDate()}`);
      break;
  }
  if (opts.count && opts.count > 0) parts.push(`COUNT=${opts.count}`);
  if (opts.until) {
    // Convert YYYY-MM-DD to YYYYMMDDT000000Z form
    const d = new Date(opts.until);
    const u = `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(d.getUTCDate()).padStart(2, "0")}T235959Z`;
    parts.push(`UNTIL=${u}`);
  }
  return parts.join(";");
}

export function RecurrencePicker({ startDate, rrule, onChange }: Props) {
  const initial = useMemo(() => parseRrule(rrule), [rrule]);
  const [kind, setKind] = useState<Kind>(initial.kind);
  const [count, setCount] = useState<string>(initial.count ? String(initial.count) : "");
  const [until, setUntil] = useState<string>(initial.until ? initial.until.slice(0, 4) + "-" + initial.until.slice(4, 6) + "-" + initial.until.slice(6, 8) : "");

  // When kind / count / until change, recompute the RRULE.
  useEffect(() => {
    if (!startDate) {
      onChange(null);
      return;
    }
    const start = new Date(startDate);
    if (isNaN(start.getTime())) {
      onChange(null);
      return;
    }
    const c = count ? parseInt(count, 10) : undefined;
    const u = until || undefined;
    onChange(buildRrule(kind, start, { count: c, until: u }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, count, until, startDate]);

  const start = startDate ? new Date(startDate) : null;
  const weekday = start
    ? start.toLocaleDateString(undefined, { weekday: "long" })
    : "the start date";
  const nth = start ? ["first", "second", "third", "fourth", "fifth"][nthWeekdayOfMonth(start) - 1] : "first";

  return (
    <div className="space-y-3">
      <div>
        <Label>Repeats</Label>
        <Select value={kind} onValueChange={(v) => setKind(v as Kind)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">One-time event</SelectItem>
            <SelectItem value="weekly">Weekly on {weekday}</SelectItem>
            <SelectItem value="biweekly">Every other {weekday}</SelectItem>
            <SelectItem value="monthly-nth">Monthly — {nth} {weekday}</SelectItem>
            <SelectItem value="monthly-date">
              Monthly on the {start ? start.getDate() : "N"}{start ? ordinalSuffix(start.getDate()) : "th"}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>
      {kind !== "none" && (
        <div className="grid gap-3 rounded-md border bg-muted/30 p-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="rec-count">Ends after (optional)</Label>
            <Input
              id="rec-count"
              type="number"
              min={1}
              placeholder="N occurrences"
              value={count}
              onChange={(e) => {
                setCount(e.target.value);
                if (e.target.value) setUntil("");
              }}
            />
          </div>
          <div>
            <Label htmlFor="rec-until">… or on date (optional)</Label>
            <Input
              id="rec-until"
              type="date"
              value={until}
              onChange={(e) => {
                setUntil(e.target.value);
                if (e.target.value) setCount("");
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function ordinalSuffix(n: number): string {
  const v = n % 100;
  if (v >= 11 && v <= 13) return "th";
  switch (v % 10) {
    case 1: return "st";
    case 2: return "nd";
    case 3: return "rd";
    default: return "th";
  }
}
