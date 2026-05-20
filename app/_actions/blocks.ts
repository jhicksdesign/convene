"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth-helpers";

export async function blockUser(otherUserId: string) {
  const user = await requireUser();
  if (user.id === otherUserId) return;
  await db.block.upsert({
    where: { blockerId_blockedId: { blockerId: user.id, blockedId: otherUserId } },
    create: { blockerId: user.id, blockedId: otherUserId },
    update: {},
  });
  revalidatePath("/settings/blocks");
}

export async function unblockUser(otherUserId: string) {
  const user = await requireUser();
  await db.block.deleteMany({ where: { blockerId: user.id, blockedId: otherUserId } });
  revalidatePath("/settings/blocks");
}
