"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireAdmin, requireUser, adminGroupIds } from "@/lib/auth-helpers";
import { groupCreate, groupUpdate } from "@/lib/schemas";
import { slugify } from "@/lib/utils";
import { withRowLock } from "@/lib/tx";
import { bump } from "@/lib/realtime";

export async function createGroup(input: unknown) {
  const user = await requireUser();
  const data = groupCreate.parse(input);
  const slug = data.slug ?? slugify(data.name);

  const existing = await db.group.findUnique({ where: { slug } });
  if (existing) throw new Error("Slug already in use");

  const group = await db.group.create({
    data: {
      name: data.name,
      slug,
      color: data.color,
      description: data.description ?? null,
      logoUrl: data.logoUrl ?? null,
      visibility: data.visibility,
      joinMode: data.joinMode,
      memberships: { create: { userId: user.id, role: "ADMIN" } },
    },
  });
  revalidatePath("/groups");
  redirect(`/g/${group.slug}/admin`);
}

export async function updateGroup(groupId: string, input: unknown) {
  await requireAdmin(groupId);
  const data = groupUpdate.parse(input);
  await db.group.update({ where: { id: groupId }, data });
  revalidatePath(`/g`);
}

export async function setSignalsOptIn(groupId: string, optIn: boolean) {
  await requireAdmin(groupId);
  await db.group.update({ where: { id: groupId }, data: { signalsOptIn: optIn } });
}

export async function setVouchRequirement(groupId: string, n: number) {
  await requireAdmin(groupId);
  await db.group.update({ where: { id: groupId }, data: { vouchRequirement: Math.max(0, Math.floor(n)) } });
}

export async function promoteMember(groupId: string, userId: string) {
  await requireAdmin(groupId);
  await db.membership.update({
    where: { userId_groupId: { userId, groupId } },
    data: { role: "ADMIN" },
  });
}

export async function demoteMember(groupId: string, userId: string) {
  await requireAdmin(groupId);
  // §6.1 — must always have ≥1 admin; lock the Group row to make count+update atomic.
  await withRowLock("Group", groupId, async (tx) => {
    const admins = await tx.membership.count({ where: { groupId, role: "ADMIN" } });
    if (admins <= 1) throw new Error("A group must have at least one admin");
    await tx.membership.update({
      where: { userId_groupId: { userId, groupId } },
      data: { role: "MEMBER" },
    });
  });
  await bump(`group:${groupId}`);
}

export async function approveJoinRequest(reqId: string) {
  const r = await db.joinRequest.findUnique({ where: { id: reqId } });
  if (!r) throw new Error("Not found");
  await requireAdmin(r.groupId);
  await db.$transaction([
    db.joinRequest.update({ where: { id: reqId }, data: { status: "APPROVED" } }),
    db.membership.create({ data: { groupId: r.groupId, userId: r.userId } }),
  ]);
}

export async function declineJoinRequest(reqId: string) {
  const r = await db.joinRequest.findUnique({ where: { id: reqId } });
  if (!r) throw new Error("Not found");
  await requireAdmin(r.groupId);
  await db.joinRequest.update({ where: { id: reqId }, data: { status: "DECLINED" } });
}

export async function proposeSafetyNetwork(groupAId: string, groupBId: string) {
  await requireAdmin(groupAId);
  await db.safetyNetworkEdge.upsert({
    where: { groupAId_groupBId: { groupAId, groupBId } },
    create: { groupAId, groupBId, confirmedByA: true },
    update: { confirmedByA: true },
  });
}

export async function confirmSafetyNetwork(groupBId: string, groupAId: string) {
  await requireAdmin(groupBId);
  await db.safetyNetworkEdge.update({
    where: { groupAId_groupBId: { groupAId, groupBId } },
    data: { confirmedByB: true },
  });
}

export async function listAdminGroupsForCurrent(): Promise<string[]> {
  const u = await requireUser();
  return adminGroupIds(u.id);
}
