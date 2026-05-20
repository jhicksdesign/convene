import { NextResponse } from "next/server";
import { subDays } from "date-fns";
import { db } from "@/lib/db";
import { isAuthorizedCron } from "@/lib/cron-guard";

const GRACE_DAYS = 30; // §8.9

export async function GET(req: Request) {
  if (!isAuthorizedCron(req)) return new Response("Unauthorized", { status: 401 });
  const cutoff = subDays(new Date(), GRACE_DAYS);

  const users = await db.user.findMany({
    where: { deletedAt: { lt: cutoff } },
    select: { id: true, email: true },
  });

  for (const u of users) {
    // Cascade is configured on RSVPs, vouches, friendships, sessions etc.
    // Audit log entries keep anonymized actor references (FK without cascade).
    await db.user.delete({ where: { id: u.id } });
  }
  return NextResponse.json({ deleted: users.length });
}
