// External calendar import — the inbound half of iCal interop.
//
// `lib/ical.ts` *generates* feeds (Convene → your calendar app). This module
// *parses* them (your Google/Apple calendar → Convene), so personal-conflict
// detection knows when an event clashes with your real life.
//
// We intentionally parse a pragmatic subset of RFC 5545 — enough for what
// Google ("Secret address in iCal format") and Apple (shared calendar URL)
// actually emit: VEVENT with DTSTART/DTEND/DURATION, all-day DATE values,
// TZID-qualified times, RRULE (expanded via the `rrule` lib), and EXDATE.
// VTODO, VALARM, attendees, and attachments are ignored by design — we only
// need busy time windows.
import { rrulestr } from "rrule";
import { fromZonedTime } from "date-fns-tz";
import { db } from "@/lib/db";

export interface ParsedBusy {
  uid: string;
  title: string;
  startsAt: Date;
  endsAt: Date;
}

const MAX_ENTRIES = 2000;
const MAX_INSTANCES_PER_EVENT = 500;

// ─── line handling ──────────────────────────────────────────────────

function unfold(text: string): string[] {
  // RFC 5545 §3.1: a CRLF followed by a space or tab is a line continuation.
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const out: string[] = [];
  for (const line of lines) {
    if ((line.startsWith(" ") || line.startsWith("\t")) && out.length > 0) {
      out[out.length - 1] += line.slice(1);
    } else {
      out.push(line);
    }
  }
  return out;
}

function unescapeText(v: string): string {
  return v
    .replace(/\\n/gi, "\n")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\");
}

interface RawProp {
  params: Record<string, string>;
  value: string;
}

function parseProp(line: string): { name: string; prop: RawProp } | null {
  const colon = line.indexOf(":");
  if (colon === -1) return null;
  const head = line.slice(0, colon);
  const value = line.slice(colon + 1);
  const parts = head.split(";");
  const name = parts[0].toUpperCase();
  const params: Record<string, string> = {};
  for (const p of parts.slice(1)) {
    const eq = p.indexOf("=");
    if (eq !== -1) params[p.slice(0, eq).toUpperCase()] = p.slice(eq + 1).replace(/^"|"$/g, "");
  }
  return { name, prop: { params, value } };
}

// ─── date handling ──────────────────────────────────────────────────

interface ParsedDate {
  date: Date;
  isAllDay: boolean;
}

/** Parse an iCal DATE / DATE-TIME value, honoring TZID / UTC / floating. */
function parseICalDate(prop: RawProp): ParsedDate | null {
  const raw = prop.value.trim();
  const isDate = prop.params.VALUE === "DATE" || /^\d{8}$/.test(raw);
  if (isDate) {
    const m = /^(\d{4})(\d{2})(\d{2})$/.exec(raw);
    if (!m) return null;
    return { date: new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])), isAllDay: true };
  }
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?$/.exec(raw);
  if (!m) return null;
  const [, y, mo, d, h, mi, s, z] = m;
  if (z === "Z") {
    return { date: new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi, +s)), isAllDay: false };
  }
  const wall = `${y}-${mo}-${d}T${h}:${mi}:${s}`;
  const tzid = prop.params.TZID;
  if (tzid) {
    try {
      return { date: fromZonedTime(wall, tzid), isAllDay: false };
    } catch {
      /* unknown TZID — fall through to floating */
    }
  }
  // Floating time: interpret as UTC. Good enough for a busy/clash check.
  return { date: new Date(`${wall}Z`), isAllDay: false };
}

/** Parse an ISO-8601 duration (e.g. PT1H30M, P1D) into milliseconds. */
function parseDurationMs(v: string): number | null {
  const m = /^([+-]?)P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(v.trim());
  if (!m) return null;
  const sign = m[1] === "-" ? -1 : 1;
  const [, , w, d, h, mi, s] = m;
  const ms =
    (Number(w || 0) * 7 * 24 * 60 * 60 +
      Number(d || 0) * 24 * 60 * 60 +
      Number(h || 0) * 60 * 60 +
      Number(mi || 0) * 60 +
      Number(s || 0)) *
    1000;
  return sign * ms;
}

// ─── VEVENT extraction ──────────────────────────────────────────────

export function parseICS(text: string, range: { from: Date; to: Date }): ParsedBusy[] {
  const lines = unfold(text);
  const out: ParsedBusy[] = [];

  let inEvent = false;
  let props: Record<string, RawProp> = {};
  let exdates: ParsedDate[] = [];

  for (const line of lines) {
    if (out.length >= MAX_ENTRIES) break;
    const upper = line.toUpperCase();
    if (upper === "BEGIN:VEVENT") {
      inEvent = true;
      props = {};
      exdates = [];
      continue;
    }
    if (upper === "END:VEVENT") {
      inEvent = false;
      const built = buildEntries(props, exdates, range);
      for (const b of built) {
        if (out.length >= MAX_ENTRIES) break;
        out.push(b);
      }
      continue;
    }
    if (!inEvent) continue;

    const parsed = parseProp(line);
    if (!parsed) continue;
    if (parsed.name === "EXDATE") {
      // EXDATE may be a comma-separated list.
      for (const v of parsed.prop.value.split(",")) {
        const pd = parseICalDate({ params: parsed.prop.params, value: v });
        if (pd) exdates.push(pd);
      }
    } else {
      props[parsed.name] = parsed.prop;
    }
  }

  return out;
}

function buildEntries(
  props: Record<string, RawProp>,
  exdates: ParsedDate[],
  range: { from: Date; to: Date },
): ParsedBusy[] {
  const dtstart = props.DTSTART ? parseICalDate(props.DTSTART) : null;
  if (!dtstart) return [];

  const uid = props.UID?.value?.trim() || `${dtstart.date.getTime()}`;
  const title = props.SUMMARY ? unescapeText(props.SUMMARY.value).trim() || "Busy" : "Busy";

  let durationMs: number;
  if (props.DTEND) {
    const dtend = parseICalDate(props.DTEND);
    durationMs = dtend ? dtend.date.getTime() - dtstart.date.getTime() : 0;
  } else if (props.DURATION) {
    durationMs = parseDurationMs(props.DURATION.value) ?? 0;
  } else {
    durationMs = dtstart.isAllDay ? 24 * 60 * 60 * 1000 : 60 * 60 * 1000;
  }
  if (durationMs <= 0) durationMs = dtstart.isAllDay ? 24 * 60 * 60 * 1000 : 60 * 60 * 1000;

  const overlaps = (start: Date, end: Date) => start < range.to && end > range.from;

  if (props.RRULE) {
    const exSet = new Set(exdates.map((e) => e.date.getTime()));
    let starts: Date[] = [];
    try {
      const rule = rrulestr(`RRULE:${props.RRULE.value}`, { dtstart: dtstart.date });
      starts = rule.between(range.from, range.to, true).slice(0, MAX_INSTANCES_PER_EVENT);
    } catch {
      starts = [];
    }
    const entries: ParsedBusy[] = [];
    for (const start of starts) {
      if (exSet.has(start.getTime())) continue;
      const end = new Date(start.getTime() + durationMs);
      if (!overlaps(start, end)) continue;
      entries.push({ uid: `${uid}:${start.toISOString()}`, title, startsAt: start, endsAt: end });
    }
    return entries;
  }

  const end = new Date(dtstart.date.getTime() + durationMs);
  if (!overlaps(dtstart.date, end)) return [];
  return [{ uid, title, startsAt: dtstart.date, endsAt: end }];
}

// ─── fetch (with a basic SSRF guard) ────────────────────────────────

export class CalendarFetchError extends Error {}

/** Reject non-https and obvious internal targets before fetching. */
export function assertSafeCalendarUrl(raw: string): URL {
  // Apple hands out webcal:// links — same payload over https.
  const normalized = raw.trim().replace(/^webcal:\/\//i, "https://");
  let url: URL;
  try {
    url = new URL(normalized);
  } catch {
    throw new CalendarFetchError("That doesn't look like a valid URL.");
  }
  if (url.protocol !== "https:") throw new CalendarFetchError("Only https calendar URLs are allowed.");

  const host = url.hostname.toLowerCase();
  const blocked =
    host === "localhost" ||
    host.endsWith(".local") ||
    host === "metadata.google.internal" ||
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^169\.254\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
    host === "0.0.0.0" ||
    host === "[::1]";
  if (blocked) throw new CalendarFetchError("That host isn't allowed.");
  return url;
}

const MAX_ICS_BYTES = 5_000_000; // 5MB

export async function fetchICS(rawUrl: string): Promise<string> {
  const url = assertSafeCalendarUrl(rawUrl);
  let res: Response;
  try {
    res = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(10_000),
      headers: { Accept: "text/calendar, text/plain, */*" },
    });
  } catch {
    throw new CalendarFetchError("Couldn't reach that calendar URL.");
  }
  if (!res.ok) throw new CalendarFetchError(`Calendar URL returned ${res.status}.`);
  const text = await res.text();
  if (text.length > MAX_ICS_BYTES) throw new CalendarFetchError("That calendar is too large to import.");
  if (!text.includes("BEGIN:VCALENDAR")) throw new CalendarFetchError("That URL isn't an iCal feed.");
  return text;
}

// ─── sync ───────────────────────────────────────────────────────────

const HORIZON_PAST_DAYS = 1;
const HORIZON_FUTURE_DAYS = 180;

function syncWindow(): { from: Date; to: Date } {
  const now = Date.now();
  return {
    from: new Date(now - HORIZON_PAST_DAYS * 24 * 60 * 60 * 1000),
    to: new Date(now + HORIZON_FUTURE_DAYS * 24 * 60 * 60 * 1000),
  };
}

/** Replace a calendar's stored busy blocks from a fresh ICS payload. */
export async function importICSText(calendarId: string, text: string): Promise<number> {
  const entries = parseICS(text, syncWindow());
  // De-dupe by uid within this payload (same instance can appear twice).
  const byUid = new Map<string, ParsedBusy>();
  for (const e of entries) byUid.set(e.uid, e);
  const rows = [...byUid.values()];

  await db.$transaction([
    db.externalCalendarEvent.deleteMany({ where: { calendarId } }),
    db.externalCalendarEvent.createMany({
      data: rows.map((r) => ({
        calendarId,
        uid: r.uid.slice(0, 500),
        title: r.title.slice(0, 300),
        startsAt: r.startsAt,
        endsAt: r.endsAt,
      })),
      skipDuplicates: true,
    }),
  ]);
  return rows.length;
}

/** Re-fetch a URL-backed calendar and refresh its busy blocks. */
export async function syncExternalCalendar(
  calendarId: string,
): Promise<{ ok: boolean; count: number; error?: string }> {
  const cal = await db.externalCalendar.findUnique({
    where: { id: calendarId },
    select: { id: true, url: true, source: true },
  });
  if (!cal) return { ok: false, count: 0, error: "Calendar not found." };
  if (cal.source !== "ICS_URL" || !cal.url) {
    return { ok: false, count: 0, error: "This calendar has no URL to sync." };
  }
  try {
    const text = await fetchICS(cal.url);
    const count = await importICSText(cal.id, text);
    await db.externalCalendar.update({
      where: { id: cal.id },
      data: { lastSyncedAt: new Date(), lastError: null },
    });
    return { ok: true, count };
  } catch (e) {
    const error = e instanceof Error ? e.message : "Sync failed.";
    await db.externalCalendar.update({ where: { id: cal.id }, data: { lastError: error } });
    return { ok: false, count: 0, error };
  }
}
