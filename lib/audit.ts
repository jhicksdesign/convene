// Immutable audit log for incident reports and admin actions (PRD §8.7).
import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";

export async function logReportAction(
  reportId: string,
  actorUserId: string,
  action: string,
  details: Record<string, unknown> = {},
): Promise<void> {
  await db.reportAuditLogEntry.create({
    data: { reportId, actorUserId, action, details: details as Prisma.InputJsonValue },
  });
}
