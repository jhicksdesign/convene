"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser, requireAdmin } from "@/lib/auth-helpers";
import { dispatch } from "@/lib/notifications";
import { withRowLock } from "@/lib/tx";
import { bump } from "@/lib/realtime";

export async function joinOrRequest(groupId: string, message?: string) {
  const user = await requireUser();
  const group = await db.group.findUnique({ where: { id: groupId } });
  if (!group) throw new Error("Group not found");

  const existing = await db.membership.findUnique({
    where: { userId_groupId: { userId: user.id, groupId } },
  });
  if (existing) return { status: "already_member" as const };

  if (group.joinMode === "OPEN") {
    await db.membership.create({ data: { userId: user.id, groupId } });
    revalidatePath(`/g/${group.slug}`);
    return { status: "joined" as const };
  }

  if (group.joinMode === "REQUEST") {
    const req = await db.joinRequest.upsert({
      where: { groupId_userId: { groupId, userId: user.id } },
      create: { groupId, userId: user.id, message: message ?? null, status: "PENDING" },
      update: { status: "PENDING", message: message ?? null },
    });
    // Notify all admins of this group
    const admins = await db.membership.findMany({
      where: { groupId, role: "ADMIN" },
      select: { userId: true },
    });
    await Promise.all(
      admins.map((a) =>
        dispatch({
          userId: a.userId,
          category: "JOIN_REQUEST",
          title: `New join request for ${group.name}`,
          body: `${user.displayName} wants to join.`,
          link: `/g/${group.slug}/admin`,
        }),
      ),
    );
    return { status: "requested" as const, requestId: req.id };
  }

  return { status: "invite_only" as const };
}

export async function leaveGroup(groupId: string) {
  const user = await requireUser();
  // Lock the group row so the ≥1-admin invariant is checked atomically with the delete.
  await withRowLock("Group", groupId, async (tx) => {
    const m = await tx.membership.findUnique({
      where: { userId_groupId: { userId: user.id, groupId } },
    });
    if (!m) return;
    if (m.role === "ADMIN") {
      const admins = await tx.membership.count({ where: { groupId, role: "ADMIN" } });
      if (admins <= 1) throw new Error("Promote another admin before leaving");
    }
    await tx.membership.delete({ where: { userId_groupId: { userId: user.id, groupId } } });
  });
  await bump(`group:${groupId}`);
}

export async function removeMember(groupId: string, userId: string) {
  await requireAdmin(groupId);
  const group = await db.group.findUnique({ where: { id: groupId }, select: { name: true } });
  await db.membership.delete({ where: { userId_groupId: { userId, groupId } } });
  const action = `Removed from group ${group?.name ?? groupId}`;
  await dispatch({
    userId,
    category: "ADMIN_ACTION",
    title: "You were removed from a group",
    body: "An admin removed you. Tap to request review.",
    link: `/reports/appeals/new?action=${encodeURIComponent(action)}`,
  });
  await bump(`group:${groupId}`);
}
