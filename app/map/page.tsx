import { addMonths } from "date-fns";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-helpers";
import { filterVisibleEvents } from "@/lib/visibility";
import { MapView } from "@/components/map/map-view";
import { FilterChips } from "@/components/calendar/filter-chips";

export default async function MapPage({
  searchParams,
}: {
  searchParams: Promise<{ g?: string | string[]; a?: string | string[]; mine?: string }>;
}) {
  const user = await getCurrentUser();
  const sp = await searchParams;
  const selectedGroups = (Array.isArray(sp.g) ? sp.g : sp.g ? [sp.g] : []) as string[];
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

  const groupFilter: string[] = mineOnly
    ? selectedGroups.length > 0
      ? selectedGroups.filter((g) => myGroupIds.includes(g))
      : myGroupIds
    : selectedGroups;

  const horizon = addMonths(new Date(), 2);
  const events = await db.event.findMany({
    where: {
      cancelledAt: null,
      status: { in: ["CONFIRMED", "TENTATIVE"] },
      startsAt: { lte: horizon, gte: new Date() },
      locationId: { not: null },
      ...(groupFilter.length > 0 && { owningGroupId: { in: groupFilter } }),
      ...(a11yFlags.length > 0 && { accessibilityFlags: { hasEvery: a11yFlags } }),
    },
    select: {
      id: true, title: true, scope: true, owningGroupId: true,
      location: { select: { lat: true, lng: true } },
      owningGroup: { select: { color: true } },
    },
  });
  const visible = await filterVisibleEvents(user?.id ?? null, events);

  const pins = visible
    .filter((e) => e.location)
    .map((e) => ({
      eventId: e.id,
      title: e.title,
      lat: e.location!.lat,
      lng: e.location!.lng,
      color: e.owningGroup.color,
    }));

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Map</h1>
      <FilterChips groups={groups} myGroupIds={myGroupIds} showRsvpFilter={false} />
      <MapView pins={pins} />
    </section>
  );
}
