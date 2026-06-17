// Personal-calendar clash detection — the payoff of external calendar import.
//
// `lib/conflict-detection.ts` answers "does this event clash with another
// GROUP's event?" (an admin scheduling concern). This answers a different,
// per-viewer question: "does this event overlap something already on MY
// subscribed Google/Apple calendar?" — surfaced near the RSVP so a member
// notices the clash before committing.
import { db } from "@/lib/db";

export interface PersonalConflict {
  title: string;
  startsAt: Date;
  endsAt: Date;
  calendarLabel: string;
}

export async function personalBusyConflicts(
  userId: string,
  startsAt: Date,
  endsAt: Date,
): Promise<PersonalConflict[]> {
  // Half-open overlap: existing.start < window.end AND existing.end > window.start.
  const rows = await db.externalCalendarEvent.findMany({
    where: {
      calendar: { userId, enabled: true },
      startsAt: { lt: endsAt },
      endsAt: { gt: startsAt },
    },
    select: {
      title: true,
      startsAt: true,
      endsAt: true,
      calendar: { select: { label: true } },
    },
    orderBy: { startsAt: "asc" },
    take: 20,
  });
  return rows.map((r) => ({
    title: r.title,
    startsAt: r.startsAt,
    endsAt: r.endsAt,
    calendarLabel: r.calendar.label,
  }));
}
