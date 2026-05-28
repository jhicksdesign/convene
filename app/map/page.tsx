import { addMonths } from "date-fns";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-helpers";
import { filterVisibleEvents } from "@/lib/visibility";
import { MapView } from "@/components/map/map-view";
import { FilterChips } from "@/components/calendar/filter-chips";
import { exposedLocation } from "@/lib/event-location";

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

  // Admin groups — used by exposedLocation to grant unrestricted address view.
  const myAdminGroupIds = user
    ? (await db.membership.findMany({ where: { userId: user.id, role: "ADMIN" }, select: { groupId: true } })).map((m) => m.groupId)
    : [];

  const groups = await db.group.findMany({
    where: user
      ? { visibility: { in: ["PUBLIC_LISTED", "MEMBERS_VISIBLE"] } }
      : { visibility: "PUBLIC_LISTED" },
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
      id: true,
      title: true,
      scope: true,
      owningGroupId: true,
      startsAt: true,
      locationVisibility: true,
      locationGeneralArea: true,
      location: {
        select: { id: true, address: true, lat: true, lng: true, radius: true, venueName: true, venueNotes: true },
      },
      owningGroup: { select: { color: true } },
      coHosts: { select: { groupId: true } },
    },
  });
  const visible = await filterVisibleEvents(user?.id ?? null, events);

  // Viewer's RSVPs across the candidate events — drives the RSVP_CONFIRMED policy.
  const myRsvps = user
    ? await db.rSVP.findMany({
        where: { userId: user.id, eventId: { in: visible.map((e) => e.id) } },
        select: { eventId: true, status: true },
      })
    : [];
  const rsvpByEvent = new Map(myRsvps.map((r) => [r.eventId, r.status]));

  // Bucket each visible event into pins vs areas (vs hidden-fuzzy circles).
  const pins: { eventId: string; title: string; lat: number; lng: number; color: string }[] = [];
  const areas: { eventId: string; title: string; lat: number; lng: number; radius: number; color: string; hidden?: boolean }[] = [];

  for (const e of visible) {
    if (!e.location) continue;
    const isAdmin =
      user && [e.owningGroupId, ...e.coHosts.map((c) => c.groupId)].some((g) => myAdminGroupIds.includes(g));
    const exposed = exposedLocation(
      {
        startsAt: e.startsAt,
        locationVisibility: e.locationVisibility,
        locationGeneralArea: e.locationGeneralArea,
        location: e.location,
      },
      { viewerRsvp: rsvpByEvent.get(e.id) ?? null, isAdmin: isAdmin ?? false },
    );

    if (exposed.kind === "pin") {
      pins.push({ eventId: e.id, title: e.title, lat: exposed.lat, lng: exposed.lng, color: e.owningGroup.color });
    } else if (exposed.kind === "area") {
      areas.push({
        eventId: e.id,
        title: e.title,
        lat: exposed.lat,
        lng: exposed.lng,
        radius: exposed.radius,
        color: e.owningGroup.color,
      });
    } else if (exposed.kind === "hidden" && exposed.approxLat != null && exposed.approxLng != null) {
      // Render a ~1km dashed circle at coarsened coords so the viewer can see
      // "something happens here" without being able to find the exact venue.
      areas.push({
        eventId: e.id,
        title: e.title,
        lat: exposed.approxLat,
        lng: exposed.approxLng,
        radius: 1000,
        color: e.owningGroup.color,
        hidden: true,
      });
    }
    // exposed.kind === "none" → skip (no point at all)
  }

  return (
    <section className="space-y-4">
      <h1 className="font-display text-3xl font-medium tracking-tight">Map</h1>
      <FilterChips groups={groups} myGroupIds={myGroupIds} showRsvpFilter={false} />
      <MapView pins={pins} areas={areas} />
    </section>
  );
}
