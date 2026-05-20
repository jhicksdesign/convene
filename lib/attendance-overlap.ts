// PRD §9.4 — compute pairwise group attendance overlap. Run by nightly cron.
// Output:  for each ordered pair (A, B): share of A's regulars who also
// have >=3 GOING RSVPs to B in the last 90 days.
import { db } from "@/lib/db";
import { subDays } from "date-fns";

const WINDOW_DAYS = 90;
const REGULAR_MIN = 3;

export async function computeAttendanceOverlap(): Promise<void> {
  const since = subDays(new Date(), WINDOW_DAYS);

  const groups = await db.group.findMany({ select: { id: true } });
  const groupIds = groups.map((g) => g.id);

  // userId -> groupId -> GOING count
  const counts: Map<string, Map<string, number>> = new Map();

  const rsvps = await db.rSVP.findMany({
    where: { status: "GOING", event: { startsAt: { gte: since } } },
    select: { userId: true, event: { select: { owningGroupId: true } } },
  });

  for (const r of rsvps) {
    if (!counts.has(r.userId)) counts.set(r.userId, new Map());
    const inner = counts.get(r.userId)!;
    inner.set(r.event.owningGroupId, (inner.get(r.event.owningGroupId) ?? 0) + 1);
  }

  // For each (A, B): |regulars of A who are regulars of B| / |regulars of A|
  for (const a of groupIds) {
    const regularsA = Array.from(counts.entries())
      .filter(([_, m]) => (m.get(a) ?? 0) >= REGULAR_MIN)
      .map(([uid]) => uid);
    if (regularsA.length === 0) continue;

    for (const b of groupIds) {
      if (a === b) continue;
      const both = regularsA.filter((uid) => (counts.get(uid)?.get(b) ?? 0) >= REGULAR_MIN).length;
      const pct = both / regularsA.length;

      await db.attendanceOverlap.upsert({
        where: { groupAId_groupBId: { groupAId: a, groupBId: b } },
        create: { groupAId: a, groupBId: b, overlapPct: pct, windowDays: WINDOW_DAYS },
        update: { overlapPct: pct, computedAt: new Date(), windowDays: WINDOW_DAYS },
      });
    }
  }
}
