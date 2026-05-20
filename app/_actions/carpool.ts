"use server";

import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth-helpers";
import { canSeeEvent } from "@/lib/visibility";
import { carpoolOfferCreate, carpoolRequestCreate } from "@/lib/schemas";
import { rateLimitForUser } from "@/lib/rate-limit";

async function assertCanSeeEvent(eventId: string, userId: string) {
  const ev = await db.event.findUnique({
    where: { id: eventId },
    select: { id: true, scope: true, owningGroupId: true },
  });
  if (!ev) throw new Error("Event not found");
  if (!(await canSeeEvent(userId, ev))) throw new Error("Forbidden");
}

export async function offerRide(input: unknown) {
  const data = carpoolOfferCreate.parse(input);
  const user = await requireUser();
  await rateLimitForUser(user.id, "carpool-create", 10, 60 * 60_000);
  await assertCanSeeEvent(data.eventId, user.id);
  return db.carpoolOffer.create({
    data: {
      eventId: data.eventId,
      userId: user.id,
      pickupArea: data.pickupArea,
      seatsAvailable: data.seatsAvailable,
      departureTime: data.departureTime,
    },
  });
}

export async function requestRide(input: unknown) {
  const data = carpoolRequestCreate.parse(input);
  const user = await requireUser();
  await rateLimitForUser(user.id, "carpool-create", 10, 60 * 60_000);
  await assertCanSeeEvent(data.eventId, user.id);
  return db.carpoolRequest.create({
    data: {
      eventId: data.eventId,
      userId: user.id,
      pickupArea: data.pickupArea,
      preferredDepartureTime: data.preferredDepartureTime,
    },
  });
}

/** §12.3 — mutual confirmation; only then exchange contact info. */
export async function matchRide(offerId: string, requestId: string) {
  const user = await requireUser();
  const [offer, request] = await Promise.all([
    db.carpoolOffer.findUnique({ where: { id: offerId } }),
    db.carpoolRequest.findUnique({ where: { id: requestId } }),
  ]);
  if (!offer || !request) throw new Error("Not found");
  if (user.id !== offer.userId && user.id !== request.userId) throw new Error("Forbidden");
  await db.carpoolRequest.update({ where: { id: requestId }, data: { matchedOfferId: offerId } });
}
