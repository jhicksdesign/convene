import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isAuthorizedCron } from "@/lib/cron-guard";

export async function GET(req: Request) {
  if (!isAuthorizedCron(req)) return new Response("Unauthorized", { status: 401 });
  const { count } = await db.softClaim.deleteMany({
    where: { expiresAt: { lt: new Date() }, convertedToEventId: null },
  });
  return NextResponse.json({ purged: count });
}
