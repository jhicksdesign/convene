import { NextResponse } from "next/server";
import { isAuthorizedCron } from "@/lib/cron-guard";
import { computeAttendanceOverlap } from "@/lib/attendance-overlap";

export async function GET(req: Request) {
  if (!isAuthorizedCron(req)) return new Response("Unauthorized", { status: 401 });
  await computeAttendanceOverlap();
  return NextResponse.json({ ok: true });
}
