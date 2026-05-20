import { addDays, addMonths, startOfMonth, subDays } from "date-fns";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-helpers";
import { filterVisibleEvents } from "@/lib/visibility";
import { expandAll } from "@/lib/recurrence";
import { MonthView, type CalEvent } from "@/components/calendar/month-view";
import { AgendaView } from "@/components/calendar/agenda-view";
import { WeekView } from "@/components/calendar/week-view";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { FilterChips } from "@/components/calendar/filter-chips";
import { RealtimeSubscribe } from "@/components/realtime/subscribe";

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

  const groups = await db.group.findMany({
    where: { visibility: { in: ["PUBLIC_LISTED", "MEMBERS_VISIBLE"] } },
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
    <section className="space-y-4">
      <RealtimeSubscribe channels={subscribedChannels} />
      <FilterChips
        groups={groups}
        myGroupIds={myGroupIds}
        showRsvpFilter={!!user}
      />
      <Tabs defaultValue="month">
        <TabsList>
          <TabsTrigger value="month">Month</TabsTrigger>
          <TabsTrigger value="week">Week</TabsTrigger>
          <TabsTrigger value="agenda">Agenda</TabsTrigger>
        </TabsList>
        <TabsContent value="month"><MonthView events={calEvents} /></TabsContent>
        <TabsContent value="week"><WeekView events={calEvents} /></TabsContent>
        <TabsContent value="agenda">
          <AgendaView events={calEvents.sort((a, b) => a.startsAt.localeCompare(b.startsAt))} />
        </TabsContent>
      </Tabs>
    </section>
  );
}
