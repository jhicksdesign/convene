import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isAuthorizedCron } from "@/lib/cron-guard";
import { dispatch } from "@/lib/notifications";
import { renderGenericEmail } from "@/lib/email/templates/generic";

// PRD §8.7 — subject is notified about a non-confidential report after 48h.
// Fires hourly. We mark `subjectNotifiedAt` to make this idempotent.
export async function GET(req: Request) {
  if (!isAuthorizedCron(req)) return new Response("Unauthorized", { status: 401 });

  const due = await db.incidentReport.findMany({
    where: {
      confidential: false,
      subjectId: { not: null },
      subjectNotifyDueAt: { lt: new Date() },
      subjectNotifiedAt: null,
    },
    select: { id: true, subjectId: true },
  });

  let delivered = 0;
  for (const r of due) {
    if (!r.subjectId) continue;
    await dispatch({
      userId: r.subjectId,
      category: "REPORT_STATUS",
      title: "A report has been filed about you",
      body: "An admin team is reviewing it. You'll be contacted with next steps.",
      link: `/reports/${r.id}`,
      email: await renderGenericEmail({
        heading: "A report has been filed about you",
        body: "An admin team is reviewing a report involving you. You'll hear about next steps soon.",
      }),
    });
    await db.incidentReport.update({
      where: { id: r.id },
      data: { subjectNotifiedAt: new Date() },
    });
    delivered++;
  }
  return NextResponse.json({ delivered });
}
