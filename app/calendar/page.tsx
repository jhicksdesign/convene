import { addDays, addMonths, startOfMonth, subDays } from "date-fns";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-helpers";
import { filterVisibleEvents } from "@/lib/visibility";
import { expandAll } from "@/lib/recurrence";
import { type CalEvent } from "@/components/calendar/month-view";
import { CalendarBoard } from "@/components/calendar/calendar-board";
import { FilterChips } from "@/components/calendar/filter-chips";
import { RealtimeSubscribe } from "@/components/realtime/subscribe";
import { Reveal } from "@/components/common/reveal";

const CANCELLED_HIDE_DAYS = 30; // §6.2 — cancelled events hidden from default views after 30d

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ g?: string | string[]; r?: string | string[]; a?: string | string[]; mine?: string }>;
}) {
  const user = await getCurrentUser();
  const sp = await searchParams;
  const selectedGroups = (Array.isArray(sp.g) ? sp.g : sp.g ? [sp.g] : []) as string[];
  const rsvpStatuses = (Array.isArray(sp.r) ? sp.r : sp.r ? [sp.r] : []) as ("GOING" | "INTERESTED" | "MAYBE")[];
  const a11yFlags = (Array.isArray(sp.a) ? sp.a : sp.a ? [sp.a] : []) as string[];
  const mineOnly = sp.mine === "1";

  const myMemberships = user
    ? await db.membership.findMany({ where: { userId: user.id }, select: { groupId: true } })
    : [];
  const myGroupIds = myMemberships.map((m) => m.groupId);

  // Unauth viewers shouldn't even see the names of MEMBERS_VISIBLE groups in
  // the filter chips — that would leak group existence to non-members.
  const groups = await db.group.findMany({
    where: user
      ? { visibility: { in: ["PUBLIC_LISTED", "MEMBERS_VISIBLE"] } }
      : { visibility: "PUBLIC_LISTED" },
    select: { id: true, name: true, color: true },
  });

  const from = startOfMonth(new Date());
  const to = addMonths(from, 2);

  const groupFilter: string[] = mineOnly
    ? selectedGroups.length > 0
      ? selectedGroups.filter((g) => myGroupIds.includes(g))
      : myGroupIds
    : selectedGroups;

  const rawEvents = await db.event.findMany({
    where: {
      // Hide cancelled events older than 30 days (§6.2); keep recent cancellations visible with a badge.
      OR: [
        { cancelledAt: null },
        { cancelledAt: { gt: subDays(new Date(), CANCELLED_HIDE_DAYS) } },
      ],
      status: { in: ["CONFIRMED", "TENTATIVE", "CANCELLED"] },
      endsAt: { gte: from },
      startsAt: { lte: to },
      ...(groupFilter.length > 0 && { owningGroupId: { in: groupFilter } }),
      ...(a11yFlags.length > 0 && { accessibilityFlags: { hasEvery: a11yFlags } }),
      ...(rsvpStatuses.length > 0 && user && {
        rsvps: { some: { userId: user.id, status: { in: rsvpStatuses } } },
      }),
    },
    select: {
      id: true,
      title: true,
      startsAt: true,
      endsAt: true,
      status: true,
      owningGroupId: true,
      scope: true,
      rrule: true,
      recurrenceExceptions: true,
      owningGroup: { select: { name: true, color: true } },
    },
  });
  const visible = await filterVisibleEvents(user?.id ?? null, rawEvents);

  const instances = expandAll(visible, from, to);
  const calEvents: CalEvent[] = instances.map((i) => {
    const e = visible.find((x) => x.id === i.parentId)!;
    return {
      id: e.id,
      title: e.title,
      startsAt: i.startsAt.toISOString(),
      endsAt: i.endsAt.toISOString(),
      groupName: e.owningGroup.name,
      color: e.owningGroup.color,
      status: e.status,
    };
  });

  const claims = await db.softClaim.findMany({
    where: {
      expiresAt: { gt: new Date() },
      convertedToEventId: null,
      ...(groupFilter.length > 0 && { groupId: { in: groupFilter } }),
    },
    include: { group: { select: { name: true, color: true } } },
  });
  for (const c of claims) {
    calEvents.push({
      id: `claim-${c.id}`,
      title: c.note ?? "Soft claim",
      startsAt: c.date.toISOString(),
      endsAt: addDays(c.date, 1).toISOString(),
      groupName: c.group.name,
      color: c.group.color,
      isSoftClaim: true,
    });
  }

  const subscribedChannels = ["calendar", ...selectedGroups.map((g) => `group:${g}`)];

  return (
    <section className="relative space-y-4">
      {/* Soft warm glow anchored to the top of the calendar — the same dusk
          atmosphere as the landing pages, dialed right down so the working
          grid stays clean and legible at every width. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 -top-6 -z-10 h-56 sm:h-72"
        style={{
          background:
            "radial-gradient(70% 100% at 50% 0%, var(--color-orb-warm) 0%, transparent 70%)",
          opacity: 0.1,
        }}
      />
      <RealtimeSubscribe channels={subscribedChannels} />
      <Reveal>
        <FilterChips
          groups={groups}
          myGroupIds={myGroupIds}
          showRsvpFilter={!!user}
        />
      </Reveal>
      <Reveal delay={0.06}>
        <CalendarBoard events={calEvents} />
      </Reveal>
    </section>
  );
}
