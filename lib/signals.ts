// PRD §11.4 — aggregate signals shown to admins of opted-in groups.
// All numbers here are aggregate; we never expose individual member identities
// to admins of groups the user isn't in.
import { db } from "@/lib/db";
import { addDays, startOfDay, subDays } from "date-fns";

export interface OverlapPartner {
  groupId: string;
  groupName: string;
  groupColor: string;
  overlapPct: number;
}

export async function topOverlapPartners(groupId: string, limit = 3): Promise<OverlapPartner[]> {
  const rows = await db.attendanceOverlap.findMany({
    where: { groupAId: groupId },
    orderBy: { overlapPct: "desc" },
    take: limit,
  });
  const otherIds = rows.map((r) => r.groupBId);
  const groups = await db.group.findMany({
    where: { id: { in: otherIds } },
    select: { id: true, name: true, color: true },
  });
  const byId = new Map(groups.map((g) => [g.id, g]));
  return rows
    .map((r) => {
      const g = byId.get(r.groupBId);
      if (!g) return null;
      return { groupId: g.id, groupName: g.name, groupColor: g.color, overlapPct: r.overlapPct };
    })
    .filter((x): x is OverlapPartner => x !== null);
}

export interface WeeklyPoint { weekStart: string; going: number }

/** Number of GOING RSVPs per week for the last 90 days, for this group's events. */
export async function weeklyGoing(groupId: string): Promise<WeeklyPoint[]> {
  const since = startOfDay(subDays(new Date(), 90));
  const rsvps = await db.rSVP.findMany({
    where: {
      status: "GOING",
      event: { owningGroupId: groupId, startsAt: { gte: since } },
    },
    select: { event: { select: { startsAt: true } } },
  });
  const buckets: Map<number, number> = new Map();
  for (const r of rsvps) {
    const t = r.event.startsAt.getTime();
    const week = Math.floor(t / (7 * 24 * 60 * 60 * 1000));
    buckets.set(week, (buckets.get(week) ?? 0) + 1);
  }
  const out: WeeklyPoint[] = [];
  const sinceWeek = Math.floor(since.getTime() / (7 * 24 * 60 * 60 * 1000));
  const nowWeek = Math.floor(Date.now() / (7 * 24 * 60 * 60 * 1000));
  for (let w = sinceWeek; w <= nowWeek; w++) {
    out.push({ weekStart: new Date(w * 7 * 24 * 60 * 60 * 1000).toISOString(), going: buckets.get(w) ?? 0 });
  }
  return out;
}

/**
 * Members who were "regular" (≥3 GOING in the prior 90 days) but have not gone
 * to any of this group's events in the last 30 days. Returns count only.
 */
export async function lapsedRegularsCount(groupId: string): Promise<number> {
  const priorWindowStart = subDays(new Date(), 120);
  const priorWindowEnd = subDays(new Date(), 30);
  const recentWindowStart = subDays(new Date(), 30);

  const priorGroups = await db.rSVP.groupBy({
    by: ["userId"],
    where: {
      status: "GOING",
      event: { owningGroupId: groupId, startsAt: { gte: priorWindowStart, lt: priorWindowEnd } },
    },
    _count: { _all: true },
  });
  const priorUserIds = priorGroups.filter((g) => g._count._all >= 3).map((g) => g.userId);
  if (priorUserIds.length === 0) return 0;

  const stillActive = await db.rSVP.findMany({
    where: {
      status: "GOING",
      userId: { in: priorUserIds },
      event: { owningGroupId: groupId, startsAt: { gte: recentWindowStart } },
    },
    select: { userId: true },
  });
  const activeSet = new Set(stillActive.map((r) => r.userId));
  return priorUserIds.filter((u) => !activeSet.has(u)).length;
}
