import { notFound, forbidden } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser, isAdminOf } from "@/lib/auth-helpers";
import { EventForm } from "@/components/events/event-form";
import type { LocationValue } from "@/components/events/location-picker";

export default async function EditEventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await requireUser();
  const event = await db.event.findUnique({
    where: { id },
    include: { coHosts: { select: { groupId: true } }, location: true },
  });
  if (!event) notFound();

  // Convert the persisted location relation + per-event policy fields into a
  // LocationPicker-shaped initial value so the picker hydrates correctly.
  let initialLocation: LocationValue;
  if (event.location && event.location.radius != null) {
    initialLocation = {
      kind: "area",
      lat: event.location.lat,
      lng: event.location.lng,
      radius: event.location.radius,
      venueName: event.location.venueName,
      venueNotes: event.location.venueNotes,
      visibility: event.locationVisibility,
      generalArea: event.locationGeneralArea,
    };
  } else if (event.location && event.location.address) {
    initialLocation = {
      kind: "pin",
      address: event.location.address,
      lat: event.location.lat,
      lng: event.location.lng,
      venueName: event.location.venueName,
      venueNotes: event.location.venueNotes,
      visibility: event.locationVisibility,
      generalArea: event.locationGeneralArea,
    };
  } else if (event.locationGeneralArea) {
    initialLocation = {
      kind: "tbd",
      generalArea: event.locationGeneralArea,
      visibility: event.locationVisibility,
    };
  } else {
    initialLocation = { kind: "none" };
  }

  const groupIds = [event.owningGroupId, ...event.coHosts.map((c) => c.groupId)];
  const isAdmin = (await Promise.all(groupIds.map((g) => isAdminOf(me.id, g)))).some(Boolean);
  if (!isAdmin) forbidden();

  const ownableGroups = await db.group.findMany({
    where: { memberships: { some: { userId: me.id, role: "ADMIN" } } },
    select: { id: true, name: true },
  });

  return (
    <section className="mx-auto max-w-3xl space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Edit event</h1>
      <EventForm
        ownableGroups={ownableGroups}
        initial={{
          id: event.id,
          title: event.title,
          description: event.description ?? undefined,
          owningGroupId: event.owningGroupId,
          startsAt: event.startsAt.toISOString().slice(0, 16),
          endsAt: event.endsAt.toISOString().slice(0, 16),
          capacity: event.capacity ?? null,
          cost: event.cost ?? null,
          scope: event.scope,
          status: event.status,
          tags: event.tags,
          accessibilityFlags: event.accessibilityFlags,
          rrule: event.rrule ?? null,
          allowPlusOnes: event.allowPlusOnes,
          location: initialLocation,
          mapCenter: event.location
            ? { lat: event.location.lat, lng: event.location.lng }
            : undefined,
        }}
      />
    </section>
  );
}
