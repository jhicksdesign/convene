"use server";

import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth-helpers";
import { dispatch } from "@/lib/notifications";
import { rateLimitForUser } from "@/lib/rate-limit";

export async function giveVouch(voucheeId: string, groupId: string) {
  const user = await requireUser();
  if (user.id === voucheeId) throw new Error("Can't vouch for yourself");
  await rateLimitForUser(user.id, "vouch", 50, 24 * 60 * 60_000);
  // Both must be members of the group (§8.2)
  const [a, b] = await Promise.all([
    db.membership.findUnique({ where: { userId_groupId: { userId: user.id, groupId } } }),
    db.membership.findUnique({ where: { userId_groupId: { userId: voucheeId, groupId } } }),
  ]);
  if (!a || !b) throw new Error("Both users must belong to the group");

  await db.vouch.upsert({
    where: { voucherId_voucheeId_groupId: { voucherId: user.id, voucheeId, groupId } },
    create: { voucherId: user.id, voucheeId, groupId },
    update: { revokedAt: null },
  });
  // Vouchee sees count, not identity (§8.2)
  await dispatch({
    userId: voucheeId,
    category: "VOUCH_RECEIVED",
    title: "You received a new vouch",
    body: "Someone in one of your groups vouched for you.",
  });
}

export async function revokeVouch(voucheeId: string, groupId: string) {
  const user = await requireUser();
  await db.vouch.updateMany({
    where: { voucherId: user.id, voucheeId, groupId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}
