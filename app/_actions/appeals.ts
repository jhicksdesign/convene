"use server";

import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth-helpers";

export async function fileAppeal(originalAction: string, userStatement: string, reportId?: string) {
  const user = await requireUser();
  // Only one appeal per action (§8.8)
  const existing = await db.appeal.findFirst({
    where: { affectedUserId: user.id, originalAction },
  });
  if (existing) throw new Error("You've already appealed this action.");

  return db.appeal.create({
    data: {
      affectedUserId: user.id,
      originalAction,
      userStatement,
      reportId: reportId ?? null,
    },
  });
}

export async function respondToAppeal(appealId: string, adminResponse: string) {
  const user = await requireUser();
  // Admin authority is implied by who can see /reports/appeals/[id] — checked in the page;
  // here we record the response and resolve.
  const appeal = await db.appeal.findUnique({ where: { id: appealId } });
  if (!appeal) throw new Error("Not found");
  if (appeal.affectedUserId === user.id) throw new Error("You can't respond to your own appeal.");

  await db.appeal.update({
    where: { id: appealId },
    data: { adminResponse, resolvedAt: new Date() },
  });
}
