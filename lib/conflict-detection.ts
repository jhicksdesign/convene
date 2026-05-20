// PRD §6.4 — Conflict detection.
// Returns warnings; never blocks. UI renders.
import { db } from "@/lib/db";
import { addDays, differenceInHours, endOfDay, isSameDay, startOfDay } from "date-fns";

export type ConflictSeverity = "hard" | "soft" | "adjacent";

export interface ConflictHit {
  severity: ConflictSeverity;
  kind: "event" | "soft_claim" | "convention";
  id: string;
  title: string;
  groupName: string | null;
  startsAt: Date;
  endsAt: Date;
  overlapPct: number | null; // §9.4
}

export interface ConflictReport {
  hits: ConflictHit[];
  alternatives: Date[]; // 3 dates in next 30 days with fewest conflicts
}

interface InputEvent {
  id?: string;
  startsAt: Date;
  endsAt: Date;
  owningGroupId: string;
}

function severity(a: { startsAt: Date; endsAt: Date }, b: { startsAt: Date; endsAt: Date }): ConflictSeverity | null {
  const overlaps = a.startsAt < b.endsAt && b.startsAt < a.endsAt;
  if (overlaps) return "hard";
  if (isSameDay(a.startsAt, b.startsAt) || isSameDay(a.endsAt, b.endsAt)) return "soft";

  const dayBefore = isSameDay(addDays(a.startsAt, -1), b.startsAt) || isSameDay(addDays(a.endsAt, -1), b.endsAt);
  const dayAfter = isSameDay(addDays(a.startsAt, 1), b.startsAt) || isSameDay(addDays(a.endsAt, 1), b.endsAt);
  if (dayBefore || dayAfter) {
    const minGap = Math.min(
      Math.abs(differenceInHours(a.startsAt, b.endsAt)),
      Math.abs(differenceInHours(b.startsAt, a.endsAt)),
    );
    if (minGap <= 4) return "adjacent";
  }
  return null;
}

async function lookupOverlapPct(groupAId: string, groupBId: string): Promise<number | null> {
  if (groupAId === groupBId) return null;
  const stat = await db.attendanceOverlap.findFirst({
    where: {
      OR: [
        { groupAId, groupBId },
        { groupAId: groupBId, groupBId: groupAId },
      ],
    },
    select: { overlapPct: true },
  });
  return stat?.overlapPct ?? null;
}

export async function detectConflicts(event: InputEvent): Promise<ConflictReport> {
  const dayStart = startOfDay(event.startsAt);
  const windowStart = addDays(dayStart, -1);
  const windowEnd = addDays(endOfDay(event.endsAt), 1);

  const [otherEvents, softClaims, conventions] = await Promise.all([
    db.event.findMany({
      where: {
        id: event.id ? { not: event.id } : undefined,
        owningGroupId: { not: event.owningGroupId },
        status: { in: ["CONFIRMED", "TENTATIVE"] },
        cancelledAt: null,
        startsAt: { lte: windowEnd },
        endsAt: { gte: windowStart },
      },
      select: {
        id: true,
        title: true,
        startsAt: true,
        endsAt: true,
        owningGroupId: true,
        owningGroup: { select: { name: true } },
      },
    }),
    db.softClaim.findMany({
      where: {
        groupId: { not: event.owningGroupId },
        date: { gte: windowStart, lte: windowEnd },
        expiresAt: { gt: new Date() },
        convertedToEventId: null,
      },
      include: { group: { select: { name: true } } },
    }),
    db.convention.findMany({
      where: { startDate: { lte: windowEnd }, endDate: { gte: windowStart } },
    }),
  ]);

  const hits: ConflictHit[] = [];

  for (const e of otherEvents) {
    const sev = severity(event, e);
    if (!sev) continue;
    const pct = await lookupOverlapPct(event.owningGroupId, e.owningGroupId);
    hits.push({
      severity: sev,
      kind: "event",
      id: e.id,
      title: e.title,
      groupName: e.owningGroup.name,
      startsAt: e.startsAt,
      endsAt: e.endsAt,
      overlapPct: pct,
    });
  }

  for (const sc of softClaims) {
    const sev = severity(event, { startsAt: sc.date, endsAt: addDays(sc.date, 1) });
    if (!sev) continue;
    hits.push({
      severity: sev,
      kind: "soft_claim",
      id: sc.id,
      title: sc.note ?? "Soft claim",
      groupName: sc.group.name,
      startsAt: sc.date,
      endsAt: addDays(sc.date, 1),
      overlapPct: null,
    });
  }

  for (const c of conventions) {
    const sev = severity(event, { startsAt: c.startDate, endsAt: c.endDate });
    if (!sev) continue;
    hits.push({
      severity: sev,
      kind: "convention",
      id: c.id,
      title: c.name,
      groupName: c.location,
      startsAt: c.startDate,
      endsAt: c.endDate,
      overlapPct: null,
    });
  }

  return { hits, alternatives: await suggestAlternatives(event) };
}

async function suggestAlternatives(event: InputEvent): Promise<Date[]> {
  const durationMs = event.endsAt.getTime() - event.startsAt.getTime();
  const startHour = event.startsAt.getHours();
  const startMinute = event.startsAt.getMinutes();

  const today = startOfDay(new Date());
  const candidates: { date: Date; score: number }[] = [];
  for (let i = 1; i <= 30; i++) {
    const day = addDays(today, i);
    const proposedStart = new Date(day);
    proposedStart.setHours(startHour, startMinute, 0, 0);
    const proposedEnd = new Date(proposedStart.getTime() + durationMs);
    const sub = await detectConflictsRaw({ ...event, startsAt: proposedStart, endsAt: proposedEnd });
    const score = sub.filter((h) => h.severity === "hard").length * 3 + sub.filter((h) => h.severity === "soft").length;
    candidates.push({ date: proposedStart, score });
  }
  candidates.sort((a, b) => a.score - b.score);
  return candidates.slice(0, 3).map((c) => c.date);
}

async function detectConflictsRaw(event: InputEvent): Promise<ConflictHit[]> {
  // Internal — skips alternative recursion to avoid loops.
  const r = await detectConflictsNoAlt(event);
  return r;
}

async function detectConflictsNoAlt(event: InputEvent): Promise<ConflictHit[]> {
  const windowStart = addDays(startOfDay(event.startsAt), -1);
  const windowEnd = addDays(endOfDay(event.endsAt), 1);
  const otherEvents = await db.event.findMany({
    where: {
      id: event.id ? { not: event.id } : undefined,
      owningGroupId: { not: event.owningGroupId },
      status: { in: ["CONFIRMED", "TENTATIVE"] },
      cancelledAt: null,
      startsAt: { lte: windowEnd },
      endsAt: { gte: windowStart },
    },
    select: { id: true, title: true, startsAt: true, endsAt: true, owningGroupId: true },
  });
  const hits: ConflictHit[] = [];
  for (const e of otherEvents) {
    const sev = severity(event, e);
    if (!sev) continue;
    hits.push({
      severity: sev,
      kind: "event",
      id: e.id,
      title: e.title,
      groupName: null,
      startsAt: e.startsAt,
      endsAt: e.endsAt,
      overlapPct: null,
    });
  }
  return hits;
}
