// Canonical visibility / block / scope gate.
// Every read path that surfaces user-generated content runs through here.
// Do not implement per-feature visibility checks elsewhere.
//
// PRD §7.4 (profile/attendance/RSVP visibility), §8.1 (event scope),
// §8.3 (blocking is bidirectional invisibility).

import { db } from "@/lib/db";
import type { Event, Visibility } from "@prisma/client";

/** IDs of users the viewer has blocked OR who have blocked the viewer. */
export async function blockedUserIds(viewerId: string | null): Promise<Set<string>> {
  if (!viewerId) return new Set();
  const [given, received] = await Promise.all([
    db.block.findMany({ where: { blockerId: viewerId }, select: { blockedId: true } }),
    db.block.findMany({ where: { blockedId: viewerId }, select: { blockerId: true } }),
  ]);
  return new Set([...given.map((b) => b.blockedId), ...received.map((b) => b.blockerId)]);
}

export async function isFriend(viewerId: string, otherId: string): Promise<boolean> {
  if (viewerId === otherId) return true;
  const f = await db.friendship.findFirst({
    where: {
      status: "ACCEPTED",
      OR: [
        { userAId: viewerId, userBId: otherId },
        { userAId: otherId, userBId: viewerId },
      ],
    },
    select: { id: true },
  });
  return !!f;
}

export async function sharesAnyGroup(viewerId: string, otherId: string): Promise<boolean> {
  if (viewerId === otherId) return true;
  const overlap = await db.membership.findFirst({
    where: {
      userId: viewerId,
      group: { memberships: { some: { userId: otherId } } },
    },
    select: { id: true },
  });
  return !!overlap;
}

export async function canSeeWithVisibility(
  viewerId: string | null,
  ownerId: string,
  level: Visibility,
  scopeGroupId?: string | null,
): Promise<boolean> {
  if (level === "PUBLIC") return true;
  if (!viewerId) return false;
  if (viewerId === ownerId) return true;

  // Blocks short-circuit everything except PUBLIC.
  const blocked = await blockedUserIds(viewerId);
  if (blocked.has(ownerId)) return false;

  switch (level) {
    case "MEMBERS":
      return sharesAnyGroup(viewerId, ownerId);
    case "GROUP":
      if (!scopeGroupId) return sharesAnyGroup(viewerId, ownerId);
      return Promise.all([
        db.membership.findUnique({ where: { userId_groupId: { userId: viewerId, groupId: scopeGroupId } } }),
        db.membership.findUnique({ where: { userId_groupId: { userId: ownerId, groupId: scopeGroupId } } }),
      ]).then(([a, b]) => !!a && !!b);
    case "FRIENDS":
      return isFriend(viewerId, ownerId);
    case "PRIVATE":
      return false;
    default:
      return false;
  }
}

/** PRD §8.1 event-scope gate. */
export async function canSeeEvent(
  viewerId: string | null,
  event: Pick<Event, "id" | "scope" | "owningGroupId">,
): Promise<boolean> {
  if (event.scope === "PUBLIC") return true;
  if (!viewerId) return false;

  const coHosts = await db.eventCoHost.findMany({
    where: { eventId: event.id },
    select: { groupId: true },
  });
  const groupIds = [event.owningGroupId, ...coHosts.map((c) => c.groupId)];

  const memberships = await db.membership.findMany({
    where: { userId: viewerId, groupId: { in: groupIds } },
    select: { groupId: true },
  });
  if (memberships.length === 0 && event.scope !== "INVITE") return false;

  if (event.scope === "MEMBERS") return memberships.length > 0;

  if (event.scope === "VOUCHED") {
    if (memberships.length === 0) return false;
    const group = await db.group.findUnique({
      where: { id: event.owningGroupId },
      select: { vouchRequirement: true },
    });
    if (!group || group.vouchRequirement === 0) return true;
    const count = await db.vouch.count({
      where: { voucheeId: viewerId, groupId: event.owningGroupId, revokedAt: null },
    });
    return count >= group.vouchRequirement;
  }

  if (event.scope === "INVITE") {
    const invited = await db.eventInvite.findUnique({
      where: { eventId_userId: { eventId: event.id, userId: viewerId } },
      select: { eventId: true },
    });
    return !!invited;
  }

  return false;
}

/** Filter a list of events by what `viewerId` is allowed to see. */
export async function filterVisibleEvents<T extends Pick<Event, "id" | "scope" | "owningGroupId">>(
  viewerId: string | null,
  events: T[],
): Promise<T[]> {
  const checks = await Promise.all(events.map((e) => canSeeEvent(viewerId, e)));
  return events.filter((_, i) => checks[i]);
}

/** Strip users the viewer has blocked (or who blocked viewer) from any user-bearing list. */
export async function filterBlockedFrom<T extends { userId: string }>(
  viewerId: string | null,
  items: T[],
): Promise<T[]> {
  if (!viewerId) return items;
  const blocked = await blockedUserIds(viewerId);
  return items.filter((i) => !blocked.has(i.userId));
}
