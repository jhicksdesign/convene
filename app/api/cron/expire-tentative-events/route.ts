import { NextResponse } from "next/server";
import { subDays } from "date-fns";
import { db } from "@/lib/db";
import { isAuthorizedCron } from "@/lib/cron-guard";
import { dispatch } from "@/lib/notifications";

export async function GET(req: Request) {
  if (!isAuthorizedCron(req)) return new Response("Unauthorized", { status: 401 });

  // §6.2 — tentative events auto-cancel after group.tentativeExpiryDays (default 14).
  const groups = await db.group.findMany({ select: { id: true, tentativeExpiryDays: true } });
  let cancelled = 0;
  for (const g of groups) {
    const cutoff = subDays(new Date(), g.tentativeExpiryDays);
    const events = await db.event.findMany({
      where: { owningGroupId: g.id, status: "TENTATIVE", createdAt: { lt: cutoff }, cancelledAt: null },
      select: { id: true, title: true },
    });
    for (const ev of events) {
      await db.event.update({
        where: { id: ev.id },
        data: { status: "CANCELLED", cancelledAt: new Date() },
      });
      cancelled++;
      const admins = await db.membership.findMany({
        where: { groupId: g.id, role: "ADMIN" },
        select: { userId: true },
      });
      await Promise.all(
        admins.map((a) =>
          dispatch({
            userId: a.userId,
            category: "EVENT_CANCELLED",
            title: `${ev.title} was auto-cancelled`,
            body: "It was tentative for too long without being confirmed.",
            link: `/e/${ev.id}`,
          }),
        ),
      );
    }
  }
  return NextResponse.json({ cancelled });
}
