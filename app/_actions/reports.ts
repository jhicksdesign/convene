"use server";

import { addHours } from "date-fns";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth-helpers";
import { reportCreate } from "@/lib/schemas";
import { dispatch } from "@/lib/notifications";
import { logReportAction } from "@/lib/audit";
import { rateLimitForUser } from "@/lib/rate-limit";

const SUBJECT_NOTIFY_HOURS = 48; // §8.7

export async function submitReport(input: unknown) {
  const data = reportCreate.parse(input);
  const user = await requireUser();
  await rateLimitForUser(user.id, "report-submit", 5, 24 * 60 * 60_000, "Too many reports today. If this is urgent, contact admins directly.");
  const report = await db.incidentReport.create({
    data: {
      reporterId: user.id,
      subjectId: data.subjectId ?? null,
      eventId: data.eventId ?? null,
      body: data.body,
      evidenceUrls: data.evidenceUrls,
      confidential: data.confidential,
      shareWithSafetyNetwork: data.shareWithSafetyNetwork,
      subjectNotifyDueAt: data.confidential ? null : addHours(new Date(), SUBJECT_NOTIFY_HOURS),
    },
  });
  await logReportAction(report.id, user.id, "submitted", { eventId: data.eventId, subjectId: data.subjectId });

  // Route to admins of the involved event's owning group and (if shareable) groups the subject is in
  const adminUserIds = await routeRecipients(report.id);
  await Promise.all(
    adminUserIds.map((uid) =>
      dispatch({
        userId: uid,
        category: "REPORT_FILED",
        title: "A new incident report needs attention",
        body: "Open the report center to triage.",
        link: `/reports/${report.id}`,
      }),
    ),
  );
  return report;
}

async function routeRecipients(reportId: string): Promise<string[]> {
  const r = await db.incidentReport.findUnique({
    where: { id: reportId },
    include: { event: { select: { owningGroupId: true } } },
  });
  if (!r) return [];

  const targetGroupIds = new Set<string>();
  if (r.event?.owningGroupId) targetGroupIds.add(r.event.owningGroupId);
  if (r.shareWithSafetyNetwork && r.subjectId) {
    const subjectMemberships = await db.membership.findMany({
      where: { userId: r.subjectId },
      select: { groupId: true },
    });
    for (const m of subjectMemberships) targetGroupIds.add(m.groupId);
  }
  if (targetGroupIds.size === 0) return [];
  const admins = await db.membership.findMany({
    where: { role: "ADMIN", groupId: { in: Array.from(targetGroupIds) } },
    select: { userId: true },
  });
  return Array.from(new Set(admins.map((a) => a.userId)));
}

export async function transitionReport(reportId: string, next: "ACKNOWLEDGED" | "INVESTIGATING" | "RESOLVED" | "DISMISSED", resolutionNote?: string) {
  const user = await requireUser();
  const r = await db.incidentReport.findUnique({ where: { id: reportId } });
  if (!r) throw new Error("Not found");
  // Admin of any routed group can transition
  const routed = await routeRecipients(reportId);
  if (!routed.includes(user.id)) throw new Error("Forbidden");

  const data: Record<string, unknown> = { status: next };
  if (next === "ACKNOWLEDGED" && !r.acknowledgedAt) data.acknowledgedAt = new Date();
  if (next === "RESOLVED" || next === "DISMISSED") {
    data.resolvedAt = new Date();
    data.resolutionNote = resolutionNote ?? null;
  }

  await db.incidentReport.update({ where: { id: reportId }, data });
  await logReportAction(reportId, user.id, `status_${next.toLowerCase()}`, { resolutionNote });
  await dispatch({
    userId: r.reporterId,
    category: "REPORT_STATUS",
    title: `Your report is now ${next}`,
    body: resolutionNote ?? "Open Convene for details.",
    link: `/reports/${reportId}`,
  });
}

export async function confirmConfidentiality(reportId: string, confidential: boolean) {
  const user = await requireUser();
  const routed = await routeRecipients(reportId);
  if (!routed.includes(user.id)) throw new Error("Forbidden");
  await db.incidentReport.update({
    where: { id: reportId },
    data: {
      confidential,
      subjectNotifyDueAt: confidential ? null : addHours(new Date(), SUBJECT_NOTIFY_HOURS),
    },
  });
  await logReportAction(reportId, user.id, "confidentiality_changed", { confidential });
}
