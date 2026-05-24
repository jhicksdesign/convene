"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireAdmin, requireUser, assertVerifiedEmail } from "@/lib/auth-helpers";
import { eventCreate, eventUpdate, type EventLocationInput } from "@/lib/schemas";
import { detectConflicts, type ConflictReport } from "@/lib/conflict-detection";
import { dispatch } from "@/lib/notifications";
import { renderGenericEmail } from "@/lib/email/templates/generic";
import { rateLimitForUser, refuseIfFresherThan } from "@/lib/rate-limit";
import { bump } from "@/lib/realtime";
import { embedAndStoreEvent } from "@/lib/embeddings";

async function assertAdminOfOwningOrCoHost(eventId: string, userId: string): Promise<void> {
  const event = await db.event.findUnique({
    where: { id: eventId },
    select: { owningGroupId: true, coHosts: { select: { groupId: true } } },
  });
  if (!event) throw new Error("Event not found");
  const groupIds = [event.owningGroupId, ...event.coHosts.map((c) => c.groupId)];
  const m = await db.membership.findFirst({
    where: { userId, groupId: { in: groupIds }, role: "ADMIN" },
  });
  if (!m) throw new Error("Forbidden");
}

/**
 * Resolve a LocationPicker payload into the event-side persistence shape.
 * Returns the locationId to attach (creating/upserting the Location row) along
 * with the per-event policy fields. Returns `null` for the locationId when the
 * payload is `tbd` or `none` — those modes either have no point at all or only
 * the general-area text.
 */
async function resolveLocationInput(input: EventLocationInput | undefined): Promise<{
  locationId: string | null;
  locationVisibility: "PUBLIC" | "RSVP_CONFIRMED" | "DAY_OF";
  locationGeneralArea: string | null;
} | null> {
  if (!input) return null; // caller said nothing — leave the existing relation untouched

  if (input.kind === "none") {
    return { locationId: null, locationVisibility: "PUBLIC", locationGeneralArea: null };
  }

  if (input.kind === "tbd") {
    return {
      locationId: null,
      locationVisibility: input.visibility,
      locationGeneralArea: input.generalArea ?? null,
    };
  }

  if (input.kind === "pin") {
    const loc = await db.location.upsert({
      where: { address: input.address },
      create: {
        address: input.address,
        lat: input.lat,
        lng: input.lng,
        radius: null,
        venueName: input.venueName ?? null,
        venueNotes: input.venueNotes ?? null,
      },
      update: {
        // Don't clobber lat/lng on dedupe — the canonical row's geocode wins.
        ...(input.venueName !== undefined && input.venueName !== null && { venueName: input.venueName }),
      },
    });
    return {
      locationId: loc.id,
      locationVisibility: input.visibility,
      locationGeneralArea: input.generalArea ?? null,
    };
  }

  // input.kind === "area"
  const loc = await db.location.create({
    data: {
      address: null,
      lat: input.lat,
      lng: input.lng,
      radius: input.radius,
      venueName: input.venueName ?? null,
      venueNotes: input.venueNotes ?? null,
    },
  });
  return {
    locationId: loc.id,
    locationVisibility: input.visibility,
    locationGeneralArea: input.generalArea ?? null,
  };
}

/** Create or move an event; also returns the conflict report (UI renders). */
export async function createEvent(input: unknown): Promise<{ eventId: string; conflicts: ConflictReport }> {
  await assertVerifiedEmail("create events");
  const data = eventCreate.parse(input);
  const admin = await requireAdmin(data.owningGroupId);

  // Anti-spam: no event-creation in the first hour of an account; otherwise 20/hour per user.
  await refuseIfFresherThan(admin.id, 60, "New accounts can't create events for the first hour.");
  await rateLimitForUser(admin.id, "event-create", 20, 60 * 60_000, "Too many events created — try again in an hour.");

  const resolvedLocation = await resolveLocationInput(data.location);

  const event = await db.event.create({
    data: {
      title: data.title,
      description: data.description ?? null,
      owningGroupId: data.owningGroupId,
      startsAt: data.startsAt,
      endsAt: data.endsAt,
      // Prefer the LocationPicker payload; fall back to the legacy locationId
      // for callers that haven't been migrated yet (e.g., older LLM extract paths).
      locationId: resolvedLocation ? resolvedLocation.locationId : data.locationId ?? null,
      locationVisibility: resolvedLocation?.locationVisibility ?? "PUBLIC",
      locationGeneralArea: resolvedLocation?.locationGeneralArea ?? null,
      capacity: data.capacity ?? null,
      cost: data.cost ?? null,
      scope: data.scope,
      status: data.status,
      flyerImageUrl: data.flyerImageUrl ?? null,
      tags: data.tags,
      accessibilityFlags: data.accessibilityFlags,
      rrule: data.rrule ?? null,
      allowPlusOnes: data.allowPlusOnes,
      useWaitlist: data.useWaitlist,
      coHosts: { create: data.coHostGroupIds.map((groupId) => ({ groupId })) },
    },
  });

  const conflicts = await detectConflicts(event);
  await bump("calendar");
  await bump(`group:${event.owningGroupId}`);
  // Embedding write is best-effort and does not block the response.
  void embedAndStoreEvent(event.id, {
    title: event.title,
    description: event.description,
    tags: event.tags,
    accessibilityFlags: event.accessibilityFlags,
  });
  revalidatePath("/calendar");
  return { eventId: event.id, conflicts };
}

export async function updateEvent(eventId: string, input: unknown): Promise<ConflictReport> {
  const user = await requireUser();
  await assertAdminOfOwningOrCoHost(eventId, user.id);
  const data = eventUpdate.parse(input);

  const resolvedLocation = data.location !== undefined ? await resolveLocationInput(data.location) : null;

  const updated = await db.event.update({
    where: { id: eventId },
    data: {
      ...(data.title !== undefined && { title: data.title }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.startsAt !== undefined && { startsAt: data.startsAt }),
      ...(data.endsAt !== undefined && { endsAt: data.endsAt }),
      ...(data.locationId !== undefined && { locationId: data.locationId }),
      ...(resolvedLocation && {
        locationId: resolvedLocation.locationId,
        locationVisibility: resolvedLocation.locationVisibility,
        locationGeneralArea: resolvedLocation.locationGeneralArea,
      }),
      ...(data.capacity !== undefined && { capacity: data.capacity }),
      ...(data.cost !== undefined && { cost: data.cost }),
      ...(data.scope !== undefined && { scope: data.scope }),
      ...(data.status !== undefined && { status: data.status }),
      ...(data.flyerImageUrl !== undefined && { flyerImageUrl: data.flyerImageUrl }),
      ...(data.tags !== undefined && { tags: data.tags }),
      ...(data.accessibilityFlags !== undefined && { accessibilityFlags: data.accessibilityFlags }),
      ...(data.rrule !== undefined && { rrule: data.rrule }),
      ...(data.allowPlusOnes !== undefined && { allowPlusOnes: data.allowPlusOnes }),
      ...(data.useWaitlist !== undefined && { useWaitlist: data.useWaitlist }),
    },
  });

  // Notify RSVPers of material changes
  const rsvps = await db.rSVP.findMany({
    where: { eventId, status: { in: ["GOING", "INTERESTED", "MAYBE", "CONDITIONAL", "WAITLIST"] } },
    select: { userId: true },
  });
  await Promise.all(
    rsvps.map((r) =>
      dispatch({
        userId: r.userId,
        category: "EVENT_UPDATED",
        title: `${updated.title} was updated`,
        body: "Open the event for the latest details.",
        link: `/e/${eventId}`,
      }),
    ),
  );

  await bump("calendar");
  await bump(`event:${eventId}`);
  await bump(`group:${updated.owningGroupId}`);
  if (data.title !== undefined || data.description !== undefined || data.tags !== undefined || data.accessibilityFlags !== undefined) {
    void embedAndStoreEvent(updated.id, {
      title: updated.title,
      description: updated.description,
      tags: updated.tags,
      accessibilityFlags: updated.accessibilityFlags,
    });
  }
  revalidatePath(`/e/${eventId}`);
  return detectConflicts(updated);
}

export async function cancelEvent(eventId: string, reason?: string) {
  const user = await requireUser();
  await assertAdminOfOwningOrCoHost(eventId, user.id);
  const ev = await db.event.update({
    where: { id: eventId },
    data: { status: "CANCELLED", cancelledAt: new Date() },
  });
  const rsvps = await db.rSVP.findMany({ where: { eventId }, select: { userId: true } });
  const email = await renderGenericEmail({
    heading: `${ev.title} cancelled`,
    body: reason ?? "The organizer cancelled this event.",
  });
  await Promise.all(
    rsvps.map((r) =>
      dispatch({
        userId: r.userId,
        category: "EVENT_CANCELLED",
        title: `${ev.title} was cancelled`,
        body: reason ?? "The organizer cancelled this event.",
        link: `/e/${eventId}`,
        email,
      }),
    ),
  );
  await bump("calendar");
  await bump(`event:${eventId}`);
  await bump(`group:${ev.owningGroupId}`);
  revalidatePath("/calendar");
}

export async function addCoHost(eventId: string, groupId: string) {
  const user = await requireUser();
  await assertAdminOfOwningOrCoHost(eventId, user.id);
  await db.eventCoHost.create({ data: { eventId, groupId } });
}

export async function removeCoHost(eventId: string, groupId: string) {
  const user = await requireUser();
  await assertAdminOfOwningOrCoHost(eventId, user.id);
  await db.eventCoHost.delete({ where: { eventId_groupId: { eventId, groupId } } });
}

export async function addRecurrenceException(eventId: string, instanceStartsAt: Date) {
  const user = await requireUser();
  await assertAdminOfOwningOrCoHost(eventId, user.id);
  await db.event.update({
    where: { id: eventId },
    data: { recurrenceExceptions: { push: instanceStartsAt } },
  });
  await bump("calendar");
  await bump(`event:${eventId}`);
}

/**
 * Detach a single instance from its recurring parent so it can be edited
 * independently (PRD §6.2). Creates a standalone event copied from parent,
 * scheduled at `instanceStartsAt`, and adds that date to the parent's
 * exception list so the series no longer renders it.
 *
 * Returns the new standalone event's id.
 */
export async function detachInstance(parentEventId: string, instanceStartsAt: Date): Promise<{ eventId: string }> {
  const user = await requireUser();
  await assertAdminOfOwningOrCoHost(parentEventId, user.id);

  const parent = await db.event.findUnique({
    where: { id: parentEventId },
    include: { coHosts: { select: { groupId: true } } },
  });
  if (!parent || !parent.rrule) throw new Error("Not a recurring event");

  const duration = parent.endsAt.getTime() - parent.startsAt.getTime();
  const instanceStart = new Date(instanceStartsAt);
  const instanceEnd = new Date(instanceStart.getTime() + duration);

  const detached = await db.$transaction(async (tx) => {
    const created = await tx.event.create({
      data: {
        owningGroupId: parent.owningGroupId,
        title: parent.title,
        description: parent.description,
        startsAt: instanceStart,
        endsAt: instanceEnd,
        locationId: parent.locationId,
        capacity: parent.capacity,
        cost: parent.cost,
        scope: parent.scope,
        status: parent.status,
        flyerImageUrl: parent.flyerImageUrl,
        tags: parent.tags,
        accessibilityFlags: parent.accessibilityFlags,
        allowPlusOnes: parent.allowPlusOnes,
        rrule: null,
        recurrenceParentId: parent.id,
        coHosts: { create: parent.coHosts.map((c) => ({ groupId: c.groupId })) },
      },
    });
    await tx.event.update({
      where: { id: parent.id },
      data: { recurrenceExceptions: { push: instanceStart } },
    });
    return created;
  });

  await bump("calendar");
  await bump(`event:${parent.id}`);
  await bump(`group:${parent.owningGroupId}`);
  revalidatePath(`/e/${parent.id}`);
  return { eventId: detached.id };
}

/** Cancel a single instance of a recurring series without affecting the rest. */
export async function cancelInstance(parentEventId: string, instanceStartsAt: Date) {
  const user = await requireUser();
  await assertAdminOfOwningOrCoHost(parentEventId, user.id);
  const parent = await db.event.findUnique({ where: { id: parentEventId }, select: { rrule: true, owningGroupId: true } });
  if (!parent?.rrule) throw new Error("Not a recurring event");
  await db.event.update({
    where: { id: parentEventId },
    data: { recurrenceExceptions: { push: new Date(instanceStartsAt) } },
  });
  await bump("calendar");
  await bump(`event:${parentEventId}`);
  await bump(`group:${parent.owningGroupId}`);
  revalidatePath(`/e/${parentEventId}`);
}

export async function inviteToEvent(eventId: string, userIds: string[]) {
  const user = await requireUser();
  await assertAdminOfOwningOrCoHost(eventId, user.id);
  await db.eventInvite.createMany({
    data: userIds.map((uid) => ({ eventId, userId: uid })),
    skipDuplicates: true,
  });
}

export async function createEventFromExtractionThenRedirect(input: unknown) {
  const { eventId } = await createEvent(input);
  redirect(`/e/${eventId}`);
}
