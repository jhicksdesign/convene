"use server";

import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth-helpers";
import { locationUpsert } from "@/lib/schemas";

/** Upsert a location by canonical address (§12.4 — shared across events). */
export async function upsertLocation(input: unknown) {
  await requireUser();
  const data = locationUpsert.parse(input);
  return db.location.upsert({
    where: { address: data.address },
    create: {
      address: data.address,
      lat: data.lat,
      lng: data.lng,
      venueName: data.venueName ?? null,
      venueNotes: data.venueNotes ?? null,
    },
    update: {
      lat: data.lat,
      lng: data.lng,
      ...(data.venueName !== undefined && { venueName: data.venueName }),
    },
  });
}

/** Edit venue notes — admins of any group that has hosted at this location (§12.4). */
export async function updateVenueNotes(locationId: string, venueNotes: string) {
  const user = await requireUser();
  const hosted = await db.event.findFirst({
    where: { locationId, owningGroup: { memberships: { some: { userId: user.id, role: "ADMIN" } } } },
    select: { id: true },
  });
  if (!hosted) throw new Error("Forbidden — only admins of groups that have hosted here may edit.");
  await db.location.update({ where: { id: locationId }, data: { venueNotes } });
}
