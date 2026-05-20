"use server";

import { revalidatePath } from "next/cache";
import { addDays } from "date-fns";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth-helpers";
import { softClaimCreate } from "@/lib/schemas";
import { withAdvisoryLock } from "@/lib/tx";
import { bump } from "@/lib/realtime";

const MAX_ACTIVE = 2; // §6.3
const EXPIRY_DAYS = 7;

export async function createSoftClaim(input: unknown) {
  const data = softClaimCreate.parse(input);
  await requireAdmin(data.groupId);

  // Serialize the count+insert per group so two concurrent admins can't both
  // squeeze a 3rd claim past the cap.
  const claim = await withAdvisoryLock(`softclaim:${data.groupId}`, async (tx) => {
    const active = await tx.softClaim.count({
      where: { groupId: data.groupId, expiresAt: { gt: new Date() }, convertedToEventId: null },
    });
    if (active >= MAX_ACTIVE) {
      throw new Error(`A group can hold at most ${MAX_ACTIVE} active soft-claims.`);
    }
    return tx.softClaim.create({
      data: {
        groupId: data.groupId,
        date: data.date,
        note: data.note ?? null,
        expiresAt: addDays(new Date(), EXPIRY_DAYS),
      },
    });
  });

  await bump("calendar");
  await bump(`group:${data.groupId}`);
  revalidatePath("/calendar");
  return claim;
}

export async function deleteSoftClaim(id: string) {
  const claim = await db.softClaim.findUnique({ where: { id } });
  if (!claim) return;
  await requireAdmin(claim.groupId);
  await db.softClaim.delete({ where: { id } });
  await bump("calendar");
  await bump(`group:${claim.groupId}`);
}

export async function convertSoftClaimToEvent(id: string, eventId: string) {
  const claim = await db.softClaim.findUnique({ where: { id } });
  if (!claim) return;
  await requireAdmin(claim.groupId);
  await db.softClaim.update({ where: { id }, data: { convertedToEventId: eventId } });
  await bump("calendar");
  await bump(`group:${claim.groupId}`);
}

export async function purgeExpiredSoftClaims() {
  await db.softClaim.deleteMany({
    where: { expiresAt: { lt: new Date() }, convertedToEventId: null },
  });
}
