"use server";

import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth-helpers";
import { dispatch } from "@/lib/notifications";
import { rateLimitForUser } from "@/lib/rate-limit";

function orderedPair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

export async function requestFriend(otherUserId: string) {
  const user = await requireUser();
  if (user.id === otherUserId) return;
  await rateLimitForUser(user.id, "friend-request", 30, 24 * 60 * 60_000, "Too many friend requests today.");
  const [userAId, userBId] = orderedPair(user.id, otherUserId);
  await db.friendship.upsert({
    where: { userAId_userBId: { userAId, userBId } },
    create: { userAId, userBId, initiatorId: user.id, status: "PENDING" },
    update: {},
  });
  await dispatch({
    userId: otherUserId,
    category: "FRIEND_REQUEST",
    title: `${user.displayName} wants to be friends`,
    body: "Open Convene to accept or decline.",
    link: `/u/${user.id}`,
  });
}

export async function acceptFriend(otherUserId: string) {
  const user = await requireUser();
  const [userAId, userBId] = orderedPair(user.id, otherUserId);
  const f = await db.friendship.findUnique({ where: { userAId_userBId: { userAId, userBId } } });
  if (!f || f.status !== "PENDING") return;
  if (f.initiatorId === user.id) return; // can't accept your own
  await db.friendship.update({
    where: { userAId_userBId: { userAId, userBId } },
    data: { status: "ACCEPTED", acceptedAt: new Date() },
  });
  await dispatch({
    userId: otherUserId,
    category: "FRIEND_ACCEPTED",
    title: `${user.displayName} accepted your friend request`,
    body: "You can now see each other's RSVPs.",
    link: `/u/${user.id}`,
  });
}

export async function declineFriend(otherUserId: string) {
  const user = await requireUser();
  const [userAId, userBId] = orderedPair(user.id, otherUserId);
  await db.friendship.updateMany({
    where: { userAId, userBId, status: "PENDING", NOT: { initiatorId: user.id } },
    data: { status: "DECLINED" },
  });
}

export async function removeFriend(otherUserId: string) {
  const user = await requireUser();
  const [userAId, userBId] = orderedPair(user.id, otherUserId);
  await db.friendship.deleteMany({ where: { userAId, userBId } });
}
