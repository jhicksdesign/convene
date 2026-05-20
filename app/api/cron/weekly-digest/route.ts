import { NextResponse } from "next/server";
import { addDays, startOfWeek, endOfWeek } from "date-fns";
import { db } from "@/lib/db";
import { dispatch } from "@/lib/notifications";
import { isAuthorizedCron } from "@/lib/cron-guard";
import { renderGenericEmail } from "@/lib/email/templates/generic";

// §11.3 — Sent Thursday morning 9am user-local time.
// In v1 we send once per UTC trigger and rely on local-time pre-formatting.
export async function GET(req: Request) {
  if (!isAuthorizedCron(req)) return new Response("Unauthorized", { status: 401 });

  const users = await db.user.findMany({
    where: { digestOptIn: true, deletedAt: null },
    select: {
      id: true,
      displayName: true,
      memberships: { select: { groupId: true } },
    },
  });

  const weekStart = startOfWeek(new Date(), { weekStartsOn: 5 });
  const weekEnd = endOfWeek(addDays(weekStart, 6), { weekStartsOn: 5 });

  let sent = 0;
  for (const u of users) {
    const groupIds = u.memberships.map((m) => m.groupId);
    if (groupIds.length === 0) continue;
    const events = await db.event.findMany({
      where: {
        OR: [{ owningGroupId: { in: groupIds } }, { coHosts: { some: { groupId: { in: groupIds } } } }],
        startsAt: { gte: weekStart, lte: weekEnd },
        status: "CONFIRMED",
        cancelledAt: null,
      },
      select: { id: true, title: true, startsAt: true, owningGroup: { select: { name: true } } },
      orderBy: { startsAt: "asc" },
      take: 20,
    });
    if (events.length === 0) continue;

    const body = events.map((e) => `• ${e.title} — ${e.owningGroup.name} — ${e.startsAt.toUTCString()}`).join("\n");
    await dispatch({
      userId: u.id,
      category: "WEEKLY_DIGEST",
      title: "This weekend in your groups",
      body,
      link: `/calendar`,
      email: await renderGenericEmail({
        heading: "This weekend in your groups",
        body,
        cta: { label: "Open calendar", url: `${process.env.AUTH_URL ?? ""}/calendar` },
      }),
    });
    sent++;
  }
  return NextResponse.json({ sent });
}
