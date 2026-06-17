import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isAuthorizedCron } from "@/lib/cron-guard";
import { syncExternalCalendar } from "@/lib/ical-import";

// Keep URL-backed external calendars fresh. Fires every 6h and re-pulls any
// subscription not synced in the last ~6h. File imports (source=FILE) have no
// URL and are skipped. Bounded per run so one slow feed can't stall the batch.
const STALE_AFTER_MS = 6 * 60 * 60 * 1000;
const MAX_PER_RUN = 200;

export async function GET(req: Request) {
  if (!isAuthorizedCron(req)) return new Response("Unauthorized", { status: 401 });

  const cutoff = new Date(Date.now() - STALE_AFTER_MS);
  const due = await db.externalCalendar.findMany({
    where: {
      source: "ICS_URL",
      url: { not: null },
      OR: [{ lastSyncedAt: null }, { lastSyncedAt: { lt: cutoff } }],
    },
    select: { id: true },
    take: MAX_PER_RUN,
  });

  let synced = 0;
  let failed = 0;
  for (const c of due) {
    const res = await syncExternalCalendar(c.id);
    if (res.ok) synced++;
    else failed++;
  }
  return NextResponse.json({ considered: due.length, synced, failed });
}
